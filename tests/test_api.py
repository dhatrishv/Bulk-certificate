from pathlib import Path

from app.database import SessionLocal
from app.models import Certificate


PAYLOAD = {
    "course_name": "Python Backend Development",
    "issuer_name": "Example Academy",
    "issue_date": "2026-10-08",
    "recipients": [
        {"name": "Alice Johnson", "email": "alice@example.com"},
        {"name": "Bob Smith", "email": "bob@example.com"},
    ],
}


def test_create_generation_job(client):
    response = client.post("/api/v1/jobs", json=PAYLOAD)

    assert response.status_code == 202
    data = response.json()
    assert data["total"] == 2
    assert data["status"] in {"pending", "running", "completed"}


def test_input_validation(client):
    invalid = {
        **PAYLOAD,
        "recipients": [{"name": "", "email": "not-an-email"}],
    }

    response = client.post("/api/v1/jobs", json=invalid)

    assert response.status_code == 422


def test_duplicate_recipient_emails_are_rejected(client):
    invalid = {
        **PAYLOAD,
        "recipients": [
            {"name": "Alice Johnson", "email": "same@example.com"},
            {"name": "Bob Smith", "email": "SAME@example.com"},
        ],
    }

    response = client.post("/api/v1/jobs", json=invalid)

    assert response.status_code == 422


def test_certificate_generation(client):
    response = client.post("/api/v1/jobs", json=PAYLOAD)
    assert response.status_code == 202

    job_id = response.json()["id"]
    status = client.get(f"/api/v1/jobs/{job_id}")
    assert status.status_code == 200

    data = status.json()
    assert data["job"]["success_count"] == 2
    assert data["job"]["status"] == "completed"

    successful = [
        c for c in data["certificates"] if c["status"] == "success"
    ]
    assert len(successful) == 2

    for cert in successful:
        assert Path(cert["file_path"]).exists()


def test_job_status_and_progress(client):
    response = client.post("/api/v1/jobs", json=PAYLOAD)
    job_id = response.json()["id"]

    status = client.get(f"/api/v1/jobs/{job_id}")
    data = status.json()

    assert data["progress_percent"] == 100.0
    assert data["job"]["total"] == 2


def test_individual_certificate_failure_does_not_stop_job(client, monkeypatch):
    from app.services import certificate_generator

    original = certificate_generator.generate_certificate
    calls = {"count": 0}

    def fake_generate(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("Simulated PDF generation error")
        return original(*args, **kwargs)

    monkeypatch.setattr(
        "app.services.job_processor.generate_certificate",
        fake_generate,
    )

    response = client.post("/api/v1/jobs", json=PAYLOAD)
    job_id = response.json()["id"]

    status = client.get(f"/api/v1/jobs/{job_id}")
    data = status.json()

    assert data["job"]["status"] == "partial"
    assert data["job"]["success_count"] == 1
    assert data["job"]["failure_count"] == 1

    failed = [c for c in data["certificates"] if c["status"] == "failed"]
    successful = [c for c in data["certificates"] if c["status"] == "success"]

    assert len(failed) == 1
    assert len(successful) == 1
    assert "Simulated PDF generation error" in failed[0]["error_message"]


def test_retrieving_generated_certificate(client):
    response = client.post("/api/v1/jobs", json=PAYLOAD)
    job_id = response.json()["id"]

    status = client.get(f"/api/v1/jobs/{job_id}").json()
    certificate_id = status["certificates"][0]["id"]

    download = client.get(f"/api/v1/certificates/{certificate_id}")

    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert download.content.startswith(b"%PDF")


def test_failed_certificate_cannot_be_downloaded(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.job_processor.generate_certificate",
        lambda **kwargs: (_ for _ in ()).throw(
            RuntimeError("Simulated PDF generation error")
        ),
    )

    response = client.post("/api/v1/jobs", json=PAYLOAD)
    job_id = response.json()["id"]
    status = client.get(f"/api/v1/jobs/{job_id}").json()
    certificate_id = status["certificates"][0]["id"]

    download = client.get(f"/api/v1/certificates/{certificate_id}")

    assert download.status_code == 409


def test_missing_resources_return_not_found(client):
    assert client.get("/api/v1/jobs/not-a-job").status_code == 404
    assert client.get("/api/v1/jobs/not-a-job/certificates").status_code == 404
    assert client.get("/api/v1/certificates/not-a-certificate").status_code == 404
