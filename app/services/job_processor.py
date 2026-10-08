import logging
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import GenerationJob, Certificate
from app.services.certificate_generator import generate_certificate

logger = logging.getLogger(__name__)


def process_generation_job(job_id: str):
    """
    Process every certificate independently.

    A failure for one recipient is recorded on that certificate and does
    not stop the remaining recipients from being processed.
    """
    db = SessionLocal()

    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if not job:
            logger.error("Cannot process certificate job %s: job was not found", job_id)
            return

        job.status = "running"
        db.commit()

        certificates = (
            db.query(Certificate)
            .filter(Certificate.job_id == job_id)
            .order_by(Certificate.created_at.asc())
            .all()
        )

        for certificate in certificates:
            try:
                certificate.status = "running"
                db.commit()

                path = generate_certificate(
                    certificate_id=certificate.id,
                    job_id=job.id,
                    recipient_name=certificate.recipient_name,
                    course_name=job.course_name,
                    issuer_name=job.issuer_name,
                    issue_date=job.issue_date,
                )

                certificate.status = "success"
                certificate.file_path = path
                certificate.error_message = None
                job.success_count += 1

            except Exception as exc:
                certificate.status = "failed"
                certificate.error_message = str(exc)
                job.failure_count += 1

            finally:
                db.commit()

        if job.failure_count == 0:
            job.status = "completed"
        elif job.success_count == 0:
            job.status = "failed"
        else:
            job.status = "partial"

        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception:
        logger.exception("Unexpected failure while processing certificate job %s", job_id)
        # A job-level failure should not leave the job permanently "running".
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()
