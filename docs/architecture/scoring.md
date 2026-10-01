# Eligibility, fit, and evidence

ScholarAI keeps eligibility decisions separate from fit scores. A satisfied criterion is not an offer of admission.

## Evidence and snapshots

A fact records its value, original extraction, document ID, page/section, verbatim snippet, extraction confidence, verification flag, and correction timestamp. Corrections do not alter the original source. Profile values are explicitly self-reported; GPA, degree, field and language scores require document facts for exact eligibility checks.

Every analysis saves the profile version, document versions, requirement versions, scholarship version, scoring weights/version, provider metadata, date of evaluation, and complete evidence map. A rerun creates a new analysis ID. Deleting an original document does not rewrite historical snapshots; users can delete the analysis or account to remove these copies.

## Deterministic rule semantics

- Numeric minimum: inclusive `>=` unless the source explicitly specifies `>`; numeric maximum: inclusive `<=` unless the source explicitly specifies `<`.
- Dates: `date_before` and `date_after` use ISO dates. Before/after are strict; explicitly inclusive “by,” “on or before,” and “on or after” preserve inclusive boundaries.
- Age: completed years as of the snapshot date. Requirements with a different reference date need manual review.
- GPA: only compare the same explicitly supplied scale. Never convert a 100-point or unfamiliar GPA to 4.0 automatically.
- Document counts: require successfully processed, tenant-owned documents. Identical parsed text in the same document category counts only once. Missing copies are MISSING_EVIDENCE, not evidence of ineligibility.
- Conflicting values or low-confidence facts: UNCERTAIN.
- OR: any satisfied child passes; otherwise uncertainty or missing alternatives prevents a definitive failure. AND: any failed child fails; otherwise all children must pass.
- Mandatory qualitative criteria: manual review. An embedding or LLM cannot satisfy them.
- Unsourced/ambiguous rules: no inferred hard pass or fail.

The five statuses are SATISFIED, NOT_SATISFIED, MISSING_EVIDENCE, UNCERTAIN, NOT_APPLICABLE. NOT_APPLICABLE is reserved for explicitly reviewed scope; the current extractor does not infer exemptions.

## Transparent score

The six default weights are academic 25, research 20, technical 20, language 15, experience 10, documents 10. Each category averages its criteria using criterion weights. Exact minimum scores use `min(100, actual / minimum * 100)`; satisfied categorical/date rules score 100, failed rules score 0, missing evidence scores 0. Document counts receive proportional credit.

Categories with no supplied criteria are shown as N/A, excluded, and remaining weights normalized. The UI reports the original weight coverage; a high score with low coverage must not be interpreted as comprehensive competitiveness. Language scores saturate at the published minimum: raising 96 to 100 when the requirement is 90 produces no additional points.

Local development uses literal evidence overlap for advisory alignment. With a configured embedding provider, optional semantic criteria use cosine similarity, stored in the snapshot. Similarity is an uncalibrated alignment signal, not a scientifically validated admissions model. These evaluations remain UNCERTAIN and clearly advisory.

## Roadmap

Missing mandatory evidence and failed mandatory criteria become critical tasks. Optional gaps become improvement tasks. Ordering uses impact × 0.5 + urgency × 0.3 + feasibility × 0.2. This is a planning heuristic. Passed deadlines are historical and have zero urgency.

## Simulation

A deep copy of the analysis snapshot receives labeled hypothetical evidence. Results are persisted in simulation_runs separately. Real profile, documents, facts, and the original analysis never change. Numeric scenarios reuse saved qualitative assessments. Changing skills or research uses explicit literal overlap for the hypothetical scenario, disclosed in the response; the simulation endpoint does not make synchronous external AI calls.
