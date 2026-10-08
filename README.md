# Bulk Certificate Generator

Bulk Certificate Generator is a full-stack application for creating certificates for many recipients in one request.

The project contains:

- A **FastAPI backend** that validates requests, creates generation jobs, generates PDF certificates, tracks progress, and exposes downloads.
- A **plain HTML/CSS/JavaScript frontend** that provides an operations dashboard for creating jobs, monitoring progress, reviewing failures, and downloading certificates.
- A **SQLite relational database** for local development.
- A predefined **ReportLab certificate template**.

The backend is the source of truth for all certificate data. The frontend does not generate certificates or calculate fake statistics.

---

## What the application does

The application follows this workflow:

```text
1. User enters course, issuer, date, and recipients
2. Frontend sends one JSON request to the backend
3. Backend validates the request
4. Backend creates a generation job and recipient records
5. Backend returns HTTP 202 Accepted
6. Background processing generates one PDF per recipient
7. Frontend polls the job-status endpoint
8. User reviews successful and failed recipients
9. User downloads successful certificates
```

One failed certificate does not stop the other recipients in the same job.

---

## Technology

### Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite
- ReportLab
- Pydantic
- Pytest

### Frontend

- HTML
- CSS
- JavaScript
- Vite development server
- Browser Fetch API

The frontend does not use React or TypeScript.

---

## Project structure

```text
bulk_certificate_generator/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── services/
│       ├── certificate_generator.py
│       └── job_processor.py
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
├── storage/
│   └── certificates/
├── tests/
├── certificates.db
├── requirements.txt
└── README.md
```

### Important backend files

- `app/main.py` defines the API endpoints.
- `app/schemas.py` defines request validation and response shapes.
- `app/models.py` defines the database tables.
- `app/services/job_processor.py` processes certificates independently.
- `app/services/certificate_generator.py` contains the single predefined PDF template.

### Important frontend files

- `frontend/index.html` is the HTML entry point.
- `frontend/app.js` contains routing, API calls, forms, polling, CSV parsing, and download behavior.
- `frontend/styles.css` contains the dashboard styling.
- `frontend/vite.config.js` proxies frontend API requests to FastAPI during development.

---

## Prerequisites

Install:

- Python 3.11 or newer
- Node.js 18 or newer
- npm

Check the installations:

```powershell
python --version
node --version
npm --version
```

If `python` is not available on Windows, use the Python executable installed on your machine.

---

## Backend setup

Open PowerShell in the project root:

```powershell
cd "C:\Users\Dhathrish\Downloads\bulk_certificate_generator_assignment\bulk_certificate_generator"
```

Create a virtual environment:

```powershell
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\activate
```

Install the Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

If PowerShell blocks activation, you can run the project with the Python executable inside `.venv` directly:

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

---

## Frontend setup

Open a second PowerShell window:

```powershell
cd "C:\Users\Dhathrish\Downloads\bulk_certificate_generator_assignment\bulk_certificate_generator\frontend"
npm install
```

The frontend uses the development proxy in `vite.config.js`:

```text
/api/*    -> http://127.0.0.1:8000/api/*
/health   -> http://127.0.0.1:8000/health
```

This means no backend CORS change is required for local development.

---

## Run the application

Two terminals are required.

### Terminal 1: backend

From the project root:

```powershell
python -m uvicorn app.main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

### Terminal 2: frontend

From the `frontend` directory:

```powershell
npm run dev
```

The frontend normally runs at:

```text
http://127.0.0.1:5173
```

Open the frontend URL in a browser.

### Check the backend

Open:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

FastAPI documentation is available at:

```text
http://127.0.0.1:8000/docs
```

---

## Using the frontend

### Dashboard

The dashboard displays live data retrieved from tracked backend jobs:

- Total certificates
- Successful certificates
- Failed certificates
- Active jobs
- Recent jobs
- Success percentage

The frontend stores submitted job IDs in browser `localStorage` so it can poll those jobs later.

### Create Job

1. Open **Create job** from the sidebar.
2. Enter:
   - Course name
   - Issuer name
   - Issue date
3. Add recipients manually or upload a CSV.
4. Click **Create generation job**.
5. The application redirects to the job details page.

### CSV upload

The frontend accepts CSV files with a name and email column.

Recommended format:

```csv
name,email
Alice Johnson,alice@example.com
Bob Smith,bob@example.com
```

The parser also supports:

- Quoted values
- Names containing commas
- UTF-8 BOM files
- Semicolon-separated files
- Tab-separated files
- Header names such as `recipient_name` and `recipient_email`

For example:

```csv
recipient_name,recipient_email
"Smith, John",john@example.com
Alice Johnson,alice@example.com
```

The frontend validates that each imported row contains both a name and an email.

`.xlsx` files are not currently supported. Save Excel workbooks as CSV UTF-8 before uploading them.

### Job details

The job details page shows:

- Job ID
- Course name
- Issuer
- Issue date
- Job status
- Total recipients
- Successful count
- Failed count
- Pending count
- Progress percentage
- Per-recipient status
- Failure messages
- Certificate download buttons

Jobs with status `pending` or `running` are polled automatically.

### Jobs page

The backend currently does not provide a `GET /api/v1/jobs` endpoint.

Therefore, the frontend cannot retrieve every historical job from the database. The Jobs page displays jobs submitted from the current browser using locally stored job IDs. This limitation is explicitly shown in the interface rather than replacing real data with mock data.

---

## Backend API

### Health check

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

### Create a generation job

```http
POST /api/v1/jobs
Content-Type: application/json
```

Request:

```json
{
  "course_name": "Python Backend Development",
  "issuer_name": "Example Academy",
  "issue_date": "2026-10-08",
  "recipients": [
    {
      "name": "Alice Johnson",
      "email": "alice@example.com"
    },
    {
      "name": "Bob Smith",
      "email": "bob@example.com"
    }
  ]
}
```

The API responds with HTTP `202 Accepted`:

```json
{
  "id": "job-id",
  "course_name": "Python Backend Development",
  "issuer_name": "Example Academy",
  "issue_date": "2026-10-08",
  "status": "pending",
  "total": 2,
  "success_count": 0,
  "failure_count": 0,
  "created_at": "2026-10-08T12:00:00",
  "completed_at": null
}
```

### Get job status

```http
GET /api/v1/jobs/{job_id}
```

Response:

```json
{
  "job": {
    "id": "job-id",
    "course_name": "Python Backend Development",
    "issuer_name": "Example Academy",
    "issue_date": "2026-10-08",
    "status": "completed",
    "total": 2,
    "success_count": 2,
    "failure_count": 0,
    "created_at": "2026-10-08T12:00:00",
    "completed_at": "2026-10-08T12:00:04"
  },
  "progress_percent": 100,
  "certificates": [
    {
      "id": "certificate-id",
      "job_id": "job-id",
      "recipient_name": "Alice Johnson",
      "recipient_email": "alice@example.com",
      "status": "success",
      "file_path": "storage/certificates/job-id/certificate-id.pdf",
      "error_message": null,
      "created_at": "2026-10-08T12:00:00"
    }
  ]
}
```

### List certificates for a job

```http
GET /api/v1/jobs/{job_id}/certificates
```

### Download a certificate

```http
GET /api/v1/certificates/{certificate_id}
```

The response is the generated PDF file.

---

## Status values

### Job statuses

| Status | Meaning |
|---|---|
| `pending` | The job was created and is waiting to process. |
| `running` | The backend is processing recipients. |
| `completed` | All certificates were generated successfully. |
| `partial` | At least one certificate succeeded and at least one failed. |
| `failed` | No certificate was generated successfully, or the job failed at the job level. |

### Certificate statuses

| Status | Meaning |
|---|---|
| `pending` | Recipient has not started processing. |
| `running` | Recipient is currently being processed. |
| `success` | PDF generation completed successfully. |
| `failed` | PDF generation failed for this recipient. |

---

## Validation and failure handling

The backend validates:

- Course name length
- Issuer name length
- Recipient name length
- Email format
- At least one recipient
- Maximum of 10,000 recipients per job
- Duplicate email addresses

Each recipient is processed independently:

```text
Recipient A succeeds
Recipient B fails
Recipient C succeeds
```

The final job status becomes `partial`, with the failed recipient containing an `error_message`.

Failed certificates return HTTP `409` if a download is attempted. A generated certificate whose file has been removed returns HTTP `410`.

---

## Database design

The SQLite database contains two main tables.

### `generation_jobs`

Stores:

- Job ID
- Course name
- Issuer name
- Issue date
- Total recipients
- Success count
- Failure count
- Job status
- Creation and completion timestamps

### `certificates`

Stores:

- Certificate ID
- Parent job ID
- Recipient name
- Recipient email
- Certificate status
- Generated PDF path
- Error message
- Creation timestamp

Relationship:

```text
generation_jobs 1 ---- N certificates
```

---

## Certificate generation

The application uses one fixed ReportLab template from:

```text
app/services/certificate_generator.py
```

Each PDF includes:

- Certificate of completion title
- Recipient name
- Course name
- Issue date
- Issuer name
- Certificate ID
- Decorative border
- Signature labels

Generated files are stored locally at:

```text
storage/certificates/<job_id>/<certificate_id>.pdf
```

The certificate ID is used as the filename to avoid collisions when recipient names are identical.

---

## Run tests

From the project root:

```powershell
python -m pytest -q
```

The tests cover:

- Creating a generation job
- Invalid recipient input
- Duplicate recipient emails
- PDF generation
- Job progress
- Individual certificate failure
- Failed certificate download behavior
- Successful certificate download
- Missing resource responses

To build the frontend:

```powershell
cd frontend
npm run build
```

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'app'`

Run Uvicorn from the project root:

```powershell
python -m uvicorn app.main:app --reload
```

Do not run:

```powershell
python app\main.py
```

### Frontend shows API errors

Confirm that:

1. The backend terminal is running.
2. `http://127.0.0.1:8000/health` returns `{"status":"ok"}`.
3. The frontend was started from the `frontend` directory.
4. The browser is open at the Vite URL, normally `http://127.0.0.1:5173`.

### CSV values appear in the wrong fields

Use a CSV with a header row:

```csv
name,email
Alice Johnson,alice@example.com
```

If a name contains a comma, quote it:

```csv
"Smith, John",john@example.com
```

### Certificate download fails

Only certificates with status `success` can be downloaded. Check the job details page for the recipient status and error message.

---

## Design decisions

### Why does job creation return `202 Accepted`?

Certificate generation can take time for a large recipient list. The backend creates the job immediately and processes PDFs in a background task so the HTTP request does not remain open.

### Why is progress calculated by the backend?

The backend owns the authoritative success and failure counts. The frontend displays the backend's `progress_percent` value rather than estimating progress locally.

### Why SQLite?

SQLite is zero-configuration and appropriate for an assignment or local demonstration. A production deployment should use PostgreSQL or another managed relational database.

### Why local PDF storage?

Local storage keeps the assignment simple. Production deployments should use object storage such as Azure Blob Storage, Amazon S3, or Google Cloud Storage.

### Why does the frontend track job IDs locally?

The existing backend exposes job-by-ID endpoints but does not expose a list-all-jobs endpoint. The frontend stores submitted IDs in browser `localStorage` so it can provide a useful jobs dashboard without inventing data or changing the backend contract.

---

## Production improvements

For a high-volume production system:

1. Replace SQLite with PostgreSQL.
2. Replace FastAPI `BackgroundTasks` with a durable queue such as Celery/RQ plus Redis or a cloud queue.
3. Store certificates in object storage.
4. Add authentication and authorization.
5. Add rate limiting and request-size limits.
6. Add database indexes for job and certificate status queries.
7. Add retry handling for transient generation failures.
8. Add structured logs, metrics, and tracing.
9. Add a backend `GET /api/v1/jobs` endpoint for complete job history.
10. Add direct `.xlsx` support if required, using a trusted spreadsheet parser.
11. Make the certificate template editable instead of hardcoding the layout in `app/services/certificate_generator.py`. A production implementation could store template versions and configurable fields such as title, logo, colors, fonts, issuer text, signature labels, and positioning in the database or managed object storage. Certificate jobs should reference the selected template version so that editing a template does not change certificates that were already generated. Template editing should also validate uploaded assets, restrict supported formatting, and provide a preview before a template is published.

---

## Quick reference

| Component | Command or URL |
|---|---|
| Start backend | `python -m uvicorn app.main:app --reload` |
| Start frontend | `npm run dev` from `frontend/` |
| Backend URL | `http://127.0.0.1:8000` |
| Frontend URL | `http://127.0.0.1:5173` |
| Swagger UI | `http://127.0.0.1:8000/docs` |
| Health check | `http://127.0.0.1:8000/health` |
| Run tests | `python -m pytest -q` |
| Build frontend | `npm run build` from `frontend/` |
