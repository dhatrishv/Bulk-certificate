from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RecipientInput(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name cannot be empty")
        return value


class GenerationJobCreate(BaseModel):
    course_name: str = Field(..., min_length=2, max_length=200)
    issuer_name: str = Field(..., min_length=2, max_length=200)
    issue_date: date
    recipients: list[RecipientInput] = Field(..., min_length=1, max_length=10000)

    @model_validator(mode="after")
    def validate_unique_recipients(self):
        emails = [str(r.email).lower() for r in self.recipients]
        if len(emails) != len(set(emails)):
            raise ValueError("Duplicate recipient email addresses are not allowed")
        return self


class CertificateResponse(BaseModel):
    id: str
    job_id: str
    recipient_name: str
    recipient_email: str
    status: str
    file_path: str | None = None
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerationJobResponse(BaseModel):
    id: str
    course_name: str
    issuer_name: str
    issue_date: date
    status: str
    total: int
    success_count: int
    failure_count: int
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class JobStatusResponse(BaseModel):
    job: GenerationJobResponse
    progress_percent: float
    certificates: list[CertificateResponse]
