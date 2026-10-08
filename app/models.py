import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def uuid_str():
    return str(uuid.uuid4())


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(String(36), primary_key=True, default=uuid_str)
    course_name = Column(String(200), nullable=False)
    issuer_name = Column(String(200), nullable=False)
    issue_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    total = Column(Integer, nullable=False)
    success_count = Column(Integer, nullable=False, default=0)
    failure_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at = Column(DateTime, nullable=True)

    certificates = relationship(
        "Certificate",
        back_populates="job",
        cascade="all, delete-orphan",
    )


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String(36), primary_key=True, default=uuid_str)
    job_id = Column(String(36), ForeignKey("generation_jobs.id"), nullable=False)
    recipient_name = Column(String(200), nullable=False)
    recipient_email = Column(String(320), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    file_path = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    job = relationship("GenerationJob", back_populates="certificates")
