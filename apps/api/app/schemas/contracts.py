from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Credentials(StrictModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=120)


class ProfileInput(StrictModel):
    full_name: str = ""
    nationality: str = ""
    country_of_residence: str = ""
    date_of_birth: date | None = None
    university: str = ""
    degree: str = ""
    field_of_study: str = ""
    gpa: float | None = Field(default=None, ge=0)
    gpa_scale: float = Field(default=4, gt=0, le=100)
    graduation_date: date | None = None
    graduation_year: int | None = Field(default=None, ge=1900, le=2200)
    english_test: str = ""
    english_score: float | None = Field(default=None, ge=0, le=120)
    test_date: date | None = None
    skills: list[str] = Field(default_factory=list, max_length=100)
    research: list[str] = Field(default_factory=list, max_length=100)
    experience: list[str] = Field(default_factory=list, max_length=100)
    courses: list[str] = Field(default_factory=list, max_length=100)
    target_degree: str = "Master's"
    target_fields: list[str] = Field(default_factory=list)
    preferred_countries: list[str] = Field(default_factory=list)
    ai_enabled: bool = True

    @model_validator(mode="after")
    def validate_scores(self):
        if self.gpa is not None and self.gpa > self.gpa_scale:
            raise ValueError("GPA cannot exceed its scale")
        if (
            self.english_test == "IELTS"
            and self.english_score is not None
            and self.english_score > 9
        ):
            raise ValueError("IELTS cannot exceed 9")
        return self


CriterionType = Literal[
    "numeric_min",
    "numeric_max",
    "boolean",
    "exact_match",
    "one_of",
    "date_before",
    "date_after",
    "document_required",
    "semantic_match",
    "manual_review",
    "any_of",
    "all_of",
]


class Criterion(StrictModel):
    id: str = ""
    category: Literal[
        "academic",
        "language",
        "degree",
        "field_of_study",
        "age",
        "nationality",
        "graduation",
        "experience",
        "research",
        "technical",
        "documents",
        "other",
    ]
    title: str
    description: str = ""
    criterion_type: CriterionType
    key: str = ""
    operator: str = ""
    required_value: Any = None
    unit: str = ""
    mandatory: bool = True
    weight: float = Field(default=1, ge=0)
    source_text: str = Field(min_length=1)
    source_page: int | None = None
    source_url: str | None = None
    confidence: float = Field(default=0.9, ge=0, le=1)
    admin_verified: bool = False
    children: list["Criterion"] = Field(default_factory=list)


class ScholarshipExtractionSchema(StrictModel):
    requirements: list[Criterion] = Field(max_length=100)


class ExtractedFact(StrictModel):
    key: str
    value: Any
    page: int = Field(ge=1)
    snippet: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)


class DocumentExtractionSchema(StrictModel):
    facts: list[ExtractedFact]
    education: list[dict] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    research: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class ResearchAlignmentSchema(StrictModel):
    matched_themes: list[str]
    missing_themes: list[str]
    source_ids: list[str]
    explanation: str


class RecommendationSchema(StrictModel):
    title: str
    description: str
    source_ids: list[str]
    impact: float = Field(ge=0, le=100)
    urgency: float = Field(ge=0, le=100)
    feasibility: float = Field(ge=0, le=100)


class ScholarshipInput(StrictModel):
    name: str = Field(min_length=3, max_length=250)
    text: str = Field(min_length=10, max_length=100000)
    university: str = ""
    country: str = ""
    degree_level: str = "Master's"
    field: str = ""
    deadline: date | None = None
    funding_type: str = "Not specified"


class UrlInput(StrictModel):
    url: str = Field(max_length=2000)
    name: str = Field(default="Imported scholarship", max_length=250)


class ScholarshipUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=3, max_length=250)
    active: bool | None = None
    weights: dict[str, float] | None = None

    @model_validator(mode="after")
    def valid_weights(self):
        if self.weights is not None:
            if (
                set(self.weights)
                != {"academic", "research", "technical", "language", "experience", "documents"}
                or any(v < 0 for v in self.weights.values())
                or abs(sum(self.weights.values()) - 100) > 0.001
            ):
                raise ValueError("Six category weights must be nonnegative and total 100")
        return self


class AnalysisInput(StrictModel):
    scholarship_id: str


class SimulationInput(StrictModel):
    toefl: float | None = Field(default=None, ge=0, le=120)
    ielts: float | None = Field(default=None, ge=0, le=9)
    gpa: float | None = Field(default=None, ge=0, le=100)
    graduation_date: date | None = None
    skills: list[str] | None = None
    research: list[str] | None = None
    recommendation_letters: int | None = Field(default=None, ge=0, le=10)


class ChatInput(StrictModel):
    message: str = Field(min_length=1, max_length=2000)


class TaskUpdate(StrictModel):
    status: Literal["Not Started", "In Progress", "Completed"]


class FactCorrection(StrictModel):
    value: str | float | list[str]


class EmailInput(StrictModel):
    email: EmailStr


class ResetInput(StrictModel):
    token: str
    password: str = Field(min_length=12, max_length=128)


class TokenInput(StrictModel):
    token: str


class SettingsInput(StrictModel):
    ai_enabled: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=12, max_length=128)
