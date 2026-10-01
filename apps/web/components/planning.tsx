"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Circle,
  CircleDashed,
  FlaskConical,
  Route,
  Sparkles,
  CalendarDays,
  Columns3,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, label } from "@/lib/utils";
import type { Analysis, Simulation, Task } from "@/types";
import { Button } from "./ui/button";
import { Badge, Disclaimer, Empty, ErrorState, Loading, PageHeader } from "./ui/common";
import { ScoreRing } from "./dashboard";
export function SimulationPage({ id }: { id: string }) {
  const [toefl, setToefl] = useState(""),
    [ielts, setIelts] = useState(""),
    [gpa, setGpa] = useState(""),
    [letters, setLetters] = useState(""),
    [skills, setSkills] = useState(""),
    [research, setResearch] = useState(""),
    [graduation, setGraduation] = useState("");
  const q = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api<Analysis>(`/analyses/${id}`),
  });
  const run = useMutation({
    mutationFn: () =>
      api<Simulation>(`/analyses/${id}/simulate`, {
        method: "POST",
        body: JSON.stringify({
          ...(toefl ? { toefl: Number(toefl) } : {}),
          ...(ielts ? { ielts: Number(ielts) } : {}),
          ...(gpa ? { gpa: Number(gpa) } : {}),
          ...(letters ? { recommendation_letters: Number(letters) } : {}),
          ...(skills
            ? {
                skills: skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(research ? { research: research.split("\n").filter(Boolean) } : {}),
          ...(graduation ? { graduation_date: graduation } : {}),
        }),
      }),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const a = q.data;
  if (!a) return null;
  return (
    <>
      <PageHeader
        eyebrow="EXPLORE WHAT’S POSSIBLE"
        title="A small change. A clearer picture."
        description="Test hypothetical improvements and see how your application alignment changes."
      >
        <Button variant="outline" asChild>
          <Link href={`/analysis/${id}`}>Back to analysis</Link>
        </Button>
      </PageHeader>
      <div className="simulation-label">
        <FlaskConical size={18} />
        <strong>SIMULATION ONLY</strong>
        <span>Your real profile and document evidence stay unchanged.</span>
      </div>
      <div className="simulation-layout">
        <form
          className="panel padded form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          <h2>Build a scenario</h2>
          <p className="muted">Leave an input blank to keep its original evidence.</p>
          <div className="form-grid">
            <label>
              TOEFL score
              <input
                type="number"
                min="0"
                max="120"
                value={toefl}
                onChange={(e) => setToefl(e.target.value)}
                placeholder="e.g. 100"
              />
            </label>
            <label>
              IELTS score
              <input
                type="number"
                min="0"
                max="9"
                step="0.5"
                value={ielts}
                onChange={(e) => setIelts(e.target.value)}
                placeholder="e.g. 7.5"
              />
            </label>
            <label>
              GPA (same scale)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="e.g. 3.8"
              />
            </label>
            <label>
              Recommendation letters
              <input
                type="number"
                min="0"
                max="10"
                value={letters}
                onChange={(e) => setLetters(e.target.value)}
                placeholder="e.g. 2"
              />
            </label>
          </div>
          <label>
            Graduation date
            <input type="date" value={graduation} onChange={(e) => setGraduation(e.target.value)} />
          </label>
          <label>
            Scenario skills
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Python, Machine Learning, PyTorch"
            />
            <span className="field-hint">
              Comma-separated. Replaces the scenario’s skills list.
            </span>
          </label>
          <label>
            Scenario research
            <textarea
              rows={3}
              value={research}
              onChange={(e) => setResearch(e.target.value)}
              placeholder="Computer Vision research project"
            />
            <span className="field-hint">One item per line. Hypothetical evidence only.</span>
          </label>
          {run.error && <p className="error-message">{run.error.message}</p>}
          <Button disabled={run.isPending} type="submit">
            <FlaskConical size={16} />
            {run.isPending ? "Evaluating scenario…" : "Run simulation"}
          </Button>
        </form>
        <div className="stack">
          <section className="panel padded">
            <div className="eyebrow">{a.snapshot.scholarship.name}</div>
            <h2>The potential difference</h2>
            <div className="score-comparison">
              <div>
                <ScoreRing score={a.result.overall_score} size={104} />
                <span>Current fit</span>
              </div>
              <span className="simulation-plus">→</span>
              <div>
                <ScoreRing score={run.data?.simulated_score ?? a.result.overall_score} size={104} />
                <span>Simulated fit</span>
              </div>
            </div>
            {run.data ? (
              <>
                <div className="score-difference">
                  {run.data.difference > 0 ? "+" : ""}
                  {run.data.difference} <small>fit score points</small>
                </div>
                <p className="muted">{run.data.eligibility}</p>
                <div className="simulation-categories">
                  {Object.entries(run.data.categories).map(([k, c]) => (
                    <div key={k}>
                      <span>{label(k)}</span>
                      <span>{run.data.current_categories[k].score ?? "N/A"}</span>
                      <strong>{c.score ?? "N/A"}</strong>
                    </div>
                  ))}
                </div>
                <p className="field-hint">{run.data.qualitative_method}</p>
                {run.data.difference === 0 && (
                  <p className="info-box">
                    This change does not increase requirement fulfillment. Scores are capped once a
                    requirement is satisfied.
                  </p>
                )}
              </>
            ) : (
              <p className="muted center">Adjust your scenario and run a simulation to compare.</p>
            )}
          </section>
          <div className="info-box">
            <Sparkles size={19} />
            <p>
              These results describe evidence alignment. They do not predict selection, and
              hypothetical qualifications must never be presented as real achievements.
            </p>
          </div>
        </div>
      </div>
      <Disclaimer />
    </>
  );
}
export function RoadmapPage({ id }: { id?: string }) {
  const client = useQueryClient();
  const [filter, setFilter] = useState("All tasks");
  const q = useQuery({
    queryKey: ["roadmap", id || "all"],
    queryFn: () => api<Task[]>(id ? `/analyses/${id}/roadmap` : "/roadmap"),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task["status"] }) =>
      api(`/roadmap/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["roadmap"] }),
  });
  const tasks = q.data || [],
    done = tasks.filter((t) => t.status === "Completed").length;
  const filtered = tasks
    .filter((t) => filter === "All tasks" || t.status === filter)
    .sort((a, b) => (b.data.priority_score || 0) - (a.data.priority_score || 0));
  return (
    <>
      <PageHeader
        eyebrow="ONE STEP CLOSER"
        title="Your application roadmap"
        description="Turn application gaps into a plan. Focus on what matters next."
      >
        {id && (
          <Button variant="outline" asChild>
            <Link href={`/analysis/${id}`}>Back to analysis</Link>
          </Button>
        )}
      </PageHeader>
      <div className="roadmap-progress panel">
        <span className="stat-icon green">
          <Route size={24} />
        </span>
        <div>
          <h2>
            {done} of {tasks.length} steps completed
          </h2>
          <p>Every completed step brings more clarity to your application.</p>
        </div>
        <div className="roadmap-progress-bar">
          <div className="bar-track">
            <div style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
          </div>
          <strong>{tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</strong>
        </div>
      </div>
      <div className="tabs roadmap-tabs">
        {["All tasks", "Not Started", "In Progress", "Completed"].map((f) => (
          <button className={filter === f ? "active" : ""} key={f} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {update.error && <p className="error-message">{update.error.message}</p>}
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : filtered.length ? (
        <div className="stack">
          {filtered.map((t) => (
            <div
              className={`panel roadmap-task ${t.status === "Completed" ? "completed" : ""}`}
              key={t.id}
            >
              <span className="task-state-icon">
                {t.status === "Completed" ? (
                  <Check size={21} />
                ) : t.status === "In Progress" ? (
                  <CircleDashed size={21} />
                ) : (
                  <Circle size={21} />
                )}
              </span>
              <div className="roadmap-task-body">
                <div className="split">
                  <Badge status={t.data.priority}>{t.data.priority} priority</Badge>
                  <span className="muted">{label(t.data.category)}</span>
                </div>
                <h3>{t.data.title}</h3>
                <p>{t.data.description}</p>
                <div className="detail-meta">
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(t.data.deadline)}
                  </span>
                  {t.data.historical && <span>Historical · deadline passed</span>}
                  <Link className="text-link" href={`/analysis/${t.analysis_id}`}>
                    View evidence
                  </Link>
                </div>
              </div>
              <select
                value={t.status}
                aria-label={`Status: ${t.data.title}`}
                disabled={update.isPending}
                onChange={(e) =>
                  update.mutate({ id: t.id, status: e.target.value as Task["status"] })
                }
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title={tasks.length ? "No tasks in this view" : "Your roadmap starts with an analysis"}
          description="We generate prioritized tasks from missing evidence and unmet requirements."
        >
          <Button asChild variant="outline">
            <Link href="/scholarships">Choose a scholarship</Link>
          </Button>
        </Empty>
      )}
    </>
  );
}
export function ComparePage() {
  const [selected, setSelected] = useState<string[]>([]),
    [sort, setSort] = useState("score");
  const q = useQuery({ queryKey: ["analyses"], queryFn: () => api<Analysis[]>("/analyses") });
  const compare = useMutation({
    mutationFn: () =>
      api<Analysis[]>("/compare", { method: "POST", body: JSON.stringify(selected) }),
  });
  const rows = [...(compare.data || [])].sort((a, b) =>
    sort === "score"
      ? b.result.overall_score - a.result.overall_score
      : sort === "documents"
        ? (b.result.documents_required
            ? b.result.documents_complete / b.result.documents_required
            : 0) -
          (a.result.documents_required
            ? a.result.documents_complete / a.result.documents_required
            : 0)
        : (a.snapshot.scholarship.deadline || "9999").localeCompare(
            b.snapshot.scholarship.deadline || "9999",
          ),
  );
  return (
    <>
      <PageHeader
        eyebrow="SIDE BY SIDE, WITH PERSPECTIVE"
        title="Compare your opportunities"
        description="Compare up to four saved analyses by measurable application criteria."
      />
      <section className="panel padded">
        <div className="split">
          <h2>Select analyses</h2>
          <span className="tiny-tag">{selected.length} / 4 SELECTED</span>
        </div>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : q.data?.length ? (
          <>
            <div className="compare-select">
              {q.data
                .filter((a) => a.status === "Completed")
                .map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      disabled={!selected.includes(a.id) && selected.length >= 4}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, a.id]
                            : selected.filter((i) => i !== a.id),
                        )
                      }
                    />
                    <span>
                      {a.snapshot.scholarship.name}
                      <small>
                        Version {a.version} · {formatDate(a.created_at)}
                      </small>
                    </span>
                    <strong>{Math.round(a.result.overall_score)}</strong>
                  </label>
                ))}
            </div>
            <Button
              disabled={!selected.length || compare.isPending}
              onClick={() => compare.mutate()}
            >
              <Columns3 size={17} /> Compare selected
            </Button>
          </>
        ) : (
          <Empty
            title="Nothing to compare yet"
            description="Analyze a scholarship to start building your comparison."
          />
        )}
        {compare.error && <p className="error-message">{compare.error.message}</p>}
      </section>
      {rows.length > 0 && (
        <section className="panel comparison-panel">
          <div className="panel-heading">
            <h2>Your comparison</h2>
            <label className="inline-label">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="score">Fit Score</option>
                <option value="deadline">Deadline</option>
                <option value="documents">Document completeness</option>
              </select>
            </label>
          </div>
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Application criteria</th>
                  {rows.map((a) => (
                    <th key={a.id}>
                      <Link href={`/analysis/${a.id}`}>{a.snapshot.scholarship.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Eligibility</th>
                  {rows.map((a) => (
                    <td key={a.id}>{a.result.eligibility}</td>
                  ))}
                </tr>
                <tr className="comparison-score">
                  <th>Overall Fit Score</th>
                  {rows.map((a) => (
                    <td key={a.id}>
                      {a.result.overall_score}
                      <small>/100</small>
                    </td>
                  ))}
                </tr>
                {["academic", "research", "technical", "language", "experience", "documents"].map(
                  (c) => (
                    <tr key={c}>
                      <th>{label(c)}</th>
                      {rows.map((a) => (
                        <td key={a.id}>{a.result.categories[c]?.score ?? "Not evaluated"}</td>
                      ))}
                    </tr>
                  ),
                )}
                <tr>
                  <th>Documents complete</th>
                  {rows.map((a) => (
                    <td key={a.id}>
                      {a.result.documents_complete} / {a.result.documents_required}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>Deadline</th>
                  {rows.map((a) => (
                    <td key={a.id}>{formatDate(a.snapshot.scholarship.deadline)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Disclaimer />
    </>
  );
}
