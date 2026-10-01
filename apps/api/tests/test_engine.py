import pytest

from app.schemas.contracts import Criterion
from app.scoring.engine import analyze, evaluate
from app.services.analysis import simulate


def rule(kind="numeric_min", key="toefl", value=90, **kw):
    return Criterion(
        category="language",
        title="TOEFL",
        criterion_type=kind,
        key=key,
        required_value=value,
        source_text="TOEFL >= 90",
        **kw,
    )


def evidence(value):
    return [{"value": value, "confidence": 1, "source": "certificate", "snippet": str(value)}]


@pytest.mark.parametrize(
    "score,status", [(96, "SATISFIED"), (80, "NOT_SATISFIED"), (90, "SATISFIED")]
)
def test_toefl(score, status):
    assert evaluate(rule(), {"toefl": evidence(score)})["status"] == status


def test_missing_certificate():
    assert evaluate(rule(), {})["status"] == "MISSING_EVIDENCE"


def test_gpa_scale_not_converted():
    r = rule(key="gpa", value=3, unit="4")
    assert evaluate(r, {"gpa": evidence(3.62), "gpa_scale": evidence(4)})["status"] == "SATISFIED"
    assert evaluate(r, {"gpa": evidence(90), "gpa_scale": evidence(100)})["status"] == "UNCERTAIN"


def test_date_boundary():
    r = rule("date_before", "graduation_date", "2027-09-01")
    assert evaluate(r, {"graduation_date": evidence("2027-01-01")})["status"] == "SATISFIED"
    assert evaluate(r, {"graduation_date": evidence("2027-09-01")})["status"] == "NOT_SATISFIED"


def test_age():
    r = rule("numeric_max", "age", 30, operator="<")
    assert (
        evaluate(r, {"date_of_birth": evidence("1997-01-01")}, "2027-01-01")["status"]
        == "NOT_SATISFIED"
    )


def test_documents():
    r = rule("document_required", "Recommendation letter", 2)
    assert (
        evaluate(r, {"Recommendation letter": evidence("letter")})["status"] == "MISSING_EVIDENCE"
    )


@pytest.mark.parametrize("kind,status", [("any_of", "SATISFIED"), ("all_of", "NOT_SATISFIED")])
def test_groups(kind, status):
    r = rule(kind, children=[rule(), rule(key="ielts", value=6.5)])
    assert evaluate(r, {"toefl": evidence(80), "ielts": evidence(7)})["status"] == status


def test_conflicting_values():
    assert evaluate(rule(), {"toefl": evidence(96) + evidence(80)})["status"] == "UNCERTAIN"


def test_low_confidence():
    assert evaluate(rule(), {"toefl": [{"value": 96, "confidence": 0.4}]})["status"] == "UNCERTAIN"


def test_weight_and_simulation_immutability():
    snapshot = {
        "requirements": [rule().model_dump()],
        "facts": {"toefl": evidence(80)},
        "weights": {"language": 15, "academic": 25},
        "as_of": "2026-09-30",
        "scholarship": {},
    }
    assert analyze(snapshot)["overall_score"] == 88.9
    result = simulate(snapshot, {"toefl": 100})
    assert result["simulated_score"] == 100
    assert snapshot["facts"]["toefl"][0]["value"] == 80
    assert result["label"] == "SIMULATION ONLY"


def test_strict_numeric_minimum():
    assert evaluate(rule(operator=">"), {"toefl": evidence(90)})["status"] == "NOT_SATISFIED"


@pytest.mark.parametrize("value,scale", [(5, 4), (-1, 4), (3, "invalid")])
def test_invalid_gpa_is_uncertain(value, scale):
    assert (
        evaluate(
            rule(key="gpa", value=3, unit="4"),
            {"gpa": evidence(value), "gpa_scale": evidence(scale)},
        )["status"]
        == "UNCERTAIN"
    )


@pytest.mark.parametrize(
    "source,value,status",
    [
        ("TOEFL > 90", 90, "NOT_SATISFIED"),
        ("TOEFL <= 90", 96, "NOT_SATISFIED"),
        ("GPA > 3.0/4", 3.0, "NOT_SATISFIED"),
        ("Graduation after 2027-09-01", "2027-10-01", "SATISFIED"),
        ("Graduation by 2027-09-01", "2027-09-01", "SATISFIED"),
    ],
)
def test_extraction_preserves_comparison_direction(source, value, status):
    from app.parsers.requirements import extract_requirements

    criterion = extract_requirements(source)[0]
    facts = {criterion.key: evidence(value), "gpa_scale": evidence(4)}
    assert evaluate(criterion, facts)["status"] == status
