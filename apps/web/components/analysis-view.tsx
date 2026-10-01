"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import {
  CalendarDays,
  Download,
  Printer,
  RefreshCw,
  FlaskConical,
  ShieldCheck,
  FileCheck2,
  Flag,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Route,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { api, downloadJson } from "@/lib/api";
import { formatDate, label } from "@/lib/utils";
import type { Analysis, Category, Evaluation } from "@/types";
import { Button } from "./ui/button";
import { Badge, Disclaimer, Empty, ErrorState, Loading, Modal, PageHeader } from "./ui/common";
import { ScoreRing } from "./dashboard";
import { Assistant } from "./assistant";
export function AlignmentChart({ categories }: { categories: Record<string, Category> }) {
  const data = Object.entries(categories).map(([name, c]) => ({
    category: label(name),
    score: c.score ?? 0,
  }));
  return (
    <div
      className="radar-chart"
      role="img"
      aria-label={Object.entries(categories)
        .map(([k, c]) => `${k}: ${c.score ?? "not evaluated"}`)
        .join(", ")}
    >
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="#e2e8e3" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#68766c", fontSize: 12 }} />
          <Radar
            dataKey="score"
            stroke="#247658"
            fill="#409571"
            fillOpacity={0.18}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function AnalysisPage({ id }: { id: string }) {
  const router = useRouter();
  const [tab, setTab] = useState("overview"),
    [why, setWhy] = useState<string | null>(null),
    [deleting, setDeleting] = useState(false);
  const q = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api<Analysis>(`/analyses/${id}`),
    refetchInterval: (query) => (query.state.data?.status === "Processing" ? 2000 : false),
  });
  const rerun = useMutation({
    mutationFn: () => api<Analysis>(`/analyses/${id}/rerun`, { method: "POST" }),
    onSuccess: (a) => router.push(`/analysis/${a.id}`),
  });
  const remove = useMutation({
    mutationFn: () => api(`/analyses/${id}`, { method: "DELETE" }),
    onSuccess: () => router.push("/analyses"),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const a = q.data;
  if (!a) return null;
  if (a.status === "Processing")
    return (
      <>
        <PageHeader
          title="Reading your application"
          description="We’re comparing the scholarship’s requirements with your saved evidence."
        />
        <Loading text="Checking requirements, scoring alignment, and building your roadmap…" />
      </>
    );
  if (a.status === "Failed")
    return (
      <>
        <ErrorState error={new Error(a.error || "Analysis failed")} retry={() => rerun.mutate()} />
        {rerun.error && <p className="error-message">{rerun.error.message}</p>}
      </>
    );
  const r = a.result,
    s = a.snapshot.scholarship;
  const evaluations = why
    ? r.evaluations.filter(
        (e) =>
          e.criterion.category === why ||
          (why === "academic" &&
            ["degree", "field_of_study", "graduation", "age", "nationality", "other"].includes(
              e.criterion.category,
            )),
      )
    : [];
  return (
    <>
      <PageHeader
        eyebrow={`APPLICATION ANALYSIS · VERSION ${a.version}`}
        title={s.name}
        description={`${s.university || "Scholarship application"} · ${s.country || "Country not specified"}`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadJson(a, `scholarai-analysis-${id}.json`)}
        >
          <Download size={15} /> Export JSON
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/analysis/${id}/report`}>
            <Printer size={15} /> Report
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={rerun.isPending}
          onClick={() => rerun.mutate()}
        >
          <RefreshCw size={15} /> Rerun analysis
        </Button>
      </PageHeader>
      <div className="detail-meta">
        <span>
          <CalendarDays size={15} /> Deadline: {formatDate(s.deadline)}
        </span>
        {r.days_remaining !== null && (
          <span className={r.closed ? "deadline-closed" : "deadline-count"}>
            {r.closed ? "Applications closed" : `${r.days_remaining} days remaining`}
          </span>
        )}
        <span>Analyzed {formatDate(a.created_at)}</span>
        <span>Profile v{a.snapshot.profile_version}</span>
      </div>
      {rerun.error && <p className="error-message">{rerun.error.message}</p>}
      <div
        className={`eligibility-banner ${r.eligibility.startsWith("Eligible ") ? "eligible" : ""}`}
      >
        <ShieldCheck size={23} />
        <div>
          <strong>{r.eligibility}</strong>
          <p>Hard eligibility is evaluated separately from your application fit.</p>
        </div>
        <span className="tiny-tag">EVIDENCE-BASED</span>
      </div>
      <div className="analysis-stats">
        <div className="panel overall-fit">
          <ScoreRing score={r.overall_score} size={98} />
          <div>
            <span className="eyebrow">OVERALL FIT SCORE</span>
            <h2>Your application alignment</h2>
            <p>Based on {r.evaluations.length} published requirements</p>
          </div>
        </div>
        <div className="panel compact-stat">
          <FileCheck2 size={22} />
          <strong>
            {r.documents_complete}
            <small> / {r.documents_required}</small>
          </strong>
          <span>Required documents</span>
        </div>
        <div className="panel compact-stat">
          <Flag size={22} />
          <strong>{r.critical_gaps.toString().padStart(2, "0")}</strong>
          <span>Critical gaps</span>
        </div>
      </div>
      <Disclaimer />
      <div className="analysis-tabs tabs">
        {[
          { id: "overview", label: "Overview" },
          { id: "evidence", label: "Requirements & evidence" },
          { id: "gaps", label: "Gaps & next steps" },
          { id: "assistant", label: "Application assistant" },
        ].map((t) => (
          <button className={tab === t.id ? "active" : ""} key={t.id} onClick={() => setTab(t.id)}>
            {t.id === "assistant" && <Sparkles size={15} />} {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="analysis-columns">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Your alignment profile</h2>
                <p>Six dimensions. One transparent picture.</p>
              </div>
            </div>
            <AlignmentChart categories={r.categories} />
            <div className="category-list">
              {Object.entries(r.categories).map(([key, c]) => (
                <div className="category-row" key={key}>
                  <span>{label(key)}</span>
                  <div className="bar-track">
                    <div style={{ width: `${c.score || 0}%` }} />
                  </div>
                  <strong>{c.score === null ? "N/A" : Math.round(c.score)}</strong>
                  <button className="why-button" onClick={() => setWhy(key)}>
                    Why? <HelpCircle size={13} />
                  </button>
                </div>
              ))}
            </div>
            <details className="score-explanation">
              <summary>
                How this score is calculated <ChevronDown size={14} />
              </summary>
              <p>{r.score_method}</p>
              <p>
                Available scoring coverage: {r.scoring_coverage}% of configured category weights.
              </p>
              {Object.entries(r.categories).map(([key, c]) => (
                <p key={key}>
                  {label(key)}: {c.weight}% weight · {c.method}
                </p>
              ))}
            </details>
          </section>
          <div className="stack">
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  <CheckCircle2 size={19} className="green-text" /> Your strengths
                </h2>
                <span className="count-pill">{r.strengths.length}</span>
              </div>
              <div className="insight-list">
                {r.strengths.slice(0, 4).map((strength, i) => (
                  <div key={i}>
                    <CheckCircle2 size={16} />
                    <div>
                      <h3>{strength.title}</h3>
                      <p>{strength.description}</p>
                      <span>{strength.evidence[0]?.source || "Source requirement"}</span>
                    </div>
                  </div>
                ))}
                {!r.strengths.length && (
                  <p>Verified strengths will appear as supporting evidence is added.</p>
                )}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  <Flag size={19} /> Give these your attention
                </h2>
              </div>
              <div className="insight-list gaps-list">
                {r.gaps.slice(0, 3).map((g, i) => (
                  <div key={i}>
                    <AlertTriangle size={16} />
                    <div>
                      <h3>{g.title}</h3>
                      <p>{g.description}</p>
                      <Badge status={g.priority}>{g.priority}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" onClick={() => setTab("gaps")}>
                View all gaps
              </Button>
            </section>
            <div className="simulation-prompt">
              <FlaskConical size={25} />
              <div>
                <h3>A little improvement. A different picture?</h3>
                <p>Explore changes without editing your real evidence.</p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/analysis/${id}/simulate`}>Try What-If</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
      {tab === "evidence" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Every decision, explained</h2>
              <p>Requirement → evidence → deterministic evaluation.</p>
            </div>
            <span className="tiny-tag">{s.source_type}</span>
          </div>
          <div className="evaluation-list">
            {r.evaluations.map((e, i) => (
              <EvidenceRow evaluation={e} key={i} />
            ))}
          </div>
        </section>
      )}
      {tab === "gaps" && (
        <div className="stack">
          <div className="split">
            <div>
              <h2>Your application, a step stronger</h2>
              <p className="muted">
                Prioritized by impact, urgency, and feasibility. Ordering is a planning heuristic.
              </p>
            </div>
            <Button asChild>
              <Link href={`/roadmap/${id}`}>
                <Route size={16} /> Open roadmap
              </Link>
            </Button>
          </div>
          {r.recommendations.map((g, i) => (
            <section className="panel recommendation-card" key={i}>
              <span className="recommendation-number">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <Badge status={g.priority}>{g.priority} priority</Badge>
                <h3>{g.title}</h3>
                <p>{g.description}</p>
                <div className="detail-meta">
                  <span>Impact: {g.impact}/100</span>
                  <span>Urgency: {g.urgency}/100</span>
                  <span>Feasibility: {g.feasibility}/100</span>
                  {g.historical && <span>Historical application</span>}
                </div>
              </div>
            </section>
          ))}
          {!r.recommendations.length && (
            <Empty
              title="No unresolved requirements"
              description="All evaluated criteria are satisfied based on this snapshot. Check the official source before applying."
            />
          )}
        </div>
      )}
      {tab === "assistant" && <Assistant analysisId={id} />}
      <div className="analysis-bottom">
        <span>
          Snapshot preserved · Scoring v1.0 ·{" "}
          {a.snapshot.model_metadata.provider === "mock"
            ? "Local deterministic mode"
            : "AI-assisted extraction"}
        </span>
        <button className="text-link muted" onClick={() => setDeleting(true)}>
          <Trash2 size={13} /> Delete analysis
        </button>
      </div>
      <Modal
        open={!!why}
        onOpenChange={(v) => !v && setWhy(null)}
        title={`${label(why || "")} alignment`}
        description="Scores come from the requirement evaluations below. Missing evidence contributes zero."
      >
        {evaluations.length ? (
          evaluations.map((e, i) => <EvidenceRow evaluation={e} key={i} />)
        ) : (
          <p>
            No requirements were supplied for this category. It is excluded from the weighted score.
          </p>
        )}
      </Modal>
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this analysis?"
        description="This removes the saved snapshot, roadmap, simulations, and chat. Your original documents remain."
      >
        {remove.error && <p className="error-message">{remove.error.message}</p>}
        <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
          Delete analysis
        </Button>
      </Modal>
    </>
  );
}
export function EvidenceRow({ evaluation: e }: { evaluation: Evaluation }) {
  return (
    <details className="evidence-row">
      <summary>
        <span className="evidence-title">
          <span className="tiny-tag">{e.criterion.mandatory ? "REQUIRED" : "PREFERRED"}</span>
          <strong>{e.criterion.title}</strong>
        </span>
        <Badge status={e.status} />
        <ChevronDown size={16} />
      </summary>
      <div className="evidence-body">
        <div>
          <span className="eyebrow">SCHOLARSHIP REQUIREMENT</span>
          <blockquote>{e.criterion.source_text}</blockquote>
          {e.criterion.source_url && (
            <a href={e.criterion.source_url} target="_blank" rel="noreferrer" className="text-link">
              Official source <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div>
          <span className="eyebrow">YOUR EVIDENCE</span>
          {e.evidence.length ? (
            e.evidence.map((f, i) => (
              <div key={i}>
                <blockquote>{f.snippet}</blockquote>
                <span className="evidence-source">
                  {f.source}
                  {f.page ? ` · Page ${f.page}` : ""}
                  {f.corrected_at ? ` · User-corrected value: ${String(f.value)}` : ""}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No supporting evidence found.</p>
          )}
        </div>
        <div className="evaluation-reason">
          <strong>Reason</strong>
          <p>{e.reason}</p>
          <span>
            {Math.round(e.confidence * 100)}% evidence confidence · Criterion score{" "}
            {Math.round(e.score)}/100
          </span>
        </div>
      </div>
    </details>
  );
}
