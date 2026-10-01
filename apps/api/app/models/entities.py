from datetime import datetime, timezone
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


class Identity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Identity, Base):
    __tablename__ = "users"
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default="student")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Owned(Identity):
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class Session(Owned, Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuthToken(Owned, Base):
    __tablename__ = "auth_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    purpose: Mapped[str] = mapped_column(String(30))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Profile(Owned, Base):
    __tablename__ = "user_profiles"
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)


class EducationRecord(Owned, Base):
    __tablename__ = "education_records"
    data: Mapped[dict] = mapped_column(JSON)


class ExperienceRecord(Owned, Base):
    __tablename__ = "experience_records"
    data: Mapped[dict] = mapped_column(JSON)


class ResearchRecord(Owned, Base):
    __tablename__ = "research_records"
    data: Mapped[dict] = mapped_column(JSON)


class Skill(Identity, Base):
    __tablename__ = "skills"
    name: Mapped[str] = mapped_column(String(120), unique=True)


class UserSkill(Owned, Base):
    __tablename__ = "user_skills"
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))


class Document(Owned, Base):
    __tablename__ = "documents"
    document_type: Mapped[str] = mapped_column(String(60))
    filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(500))
    file_size: Mapped[int] = mapped_column(Integer)
    mime_type: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="Uploaded")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_text: Mapped[str] = mapped_column(Text, default="")
    extraction: Mapped[dict] = mapped_column(JSON, default=dict)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)


class DocumentPage(Owned, Base):
    __tablename__ = "document_pages"
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    page: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)


class DocumentFact(Owned, Base):
    __tablename__ = "document_facts"
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(80))
    value: Mapped[dict | list | str | float | int | None] = mapped_column(JSON)
    original_value: Mapped[dict | list | str | float | int | None] = mapped_column(JSON)
    page: Mapped[int] = mapped_column(Integer)
    snippet: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Scholarship(Owned, Base):
    __tablename__ = "scholarships"
    name: Mapped[str] = mapped_column(String(250))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    source_text: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_document_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    source_type: Mapped[str] = mapped_column(String(80), default="User-pasted text")
    source_last_checked: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    status: Mapped[str] = mapped_column(String(30), default="Processing")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    weights: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "academic": 25,
            "research": 20,
            "technical": 20,
            "language": 15,
            "experience": 10,
            "documents": 10,
        },
    )


class ScholarshipSource(Owned, Base):
    __tablename__ = "scholarship_sources"
    scholarship_id: Mapped[str] = mapped_column(ForeignKey("scholarships.id", ondelete="CASCADE"))
    data: Mapped[dict] = mapped_column(JSON)


class Requirement(Owned, Base):
    __tablename__ = "scholarship_requirements"
    scholarship_id: Mapped[str] = mapped_column(
        ForeignKey("scholarships.id", ondelete="CASCADE"), index=True
    )
    data: Mapped[dict] = mapped_column(JSON)
    admin_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Analysis(Owned, Base):
    __tablename__ = "analyses"
    scholarship_id: Mapped[str] = mapped_column(ForeignKey("scholarships.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(30), default="Processing")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)


class AnalysisChild(Owned):
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class CriterionEvaluation(AnalysisChild, Base):
    __tablename__ = "criterion_evaluations"


class FitScore(AnalysisChild, Base):
    __tablename__ = "fit_scores"


class AnalysisStrength(AnalysisChild, Base):
    __tablename__ = "analysis_strengths"


class AnalysisGap(AnalysisChild, Base):
    __tablename__ = "analysis_gaps"


class Recommendation(AnalysisChild, Base):
    __tablename__ = "recommendations"


class RoadmapTask(AnalysisChild, Base):
    __tablename__ = "roadmap_tasks"
    status: Mapped[str] = mapped_column(String(30), default="Not Started")


class SimulationRun(AnalysisChild, Base):
    __tablename__ = "simulation_runs"


class ChatThread(AnalysisChild, Base):
    __tablename__ = "chat_threads"


class ChatMessage(AnalysisChild, Base):
    __tablename__ = "chat_messages"


class DocumentChunk(Owned, Base):
    __tablename__ = "document_chunks"
    document_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
    )
    scholarship_id: Mapped[str | None] = mapped_column(
        ForeignKey("scholarships.id", ondelete="CASCADE"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text)
    page: Mapped[int] = mapped_column(Integer, default=1)
    section: Mapped[str] = mapped_column(String(200), default="")
    embedding: Mapped[list] = mapped_column(
        JSON().with_variant(Vector(settings.embedding_dimensions), "postgresql")
    )


class AuditLog(Owned, Base):
    __tablename__ = "audit_logs"
    action: Mapped[str] = mapped_column(String(100))
    resource_id: Mapped[str] = mapped_column(String(100))
