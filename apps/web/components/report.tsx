"use client";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, label } from "@/lib/utils";
import type { Analysis, Task } from "@/types";
import { Button } from "./ui/button";
import { ErrorState, Loading } from "./ui/common";
import { Logo } from "./shell";
export function Report({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["report", id],
    queryFn: async () => ({
      analysis: await api<Analysis>(`/analyses/${id}`),
      tasks: await api<Task[]>(`/analyses/${id}/roadmap`),
    }),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return null;
  const a = q.data.analysis;
  if (a.status !== "Completed")
    return <Loading text="Your report will be available after analysis completes." />;
  return (
    <article className="print-report">
      <div className="split">
        <Logo />
        <Button className="no-print" onClick={() => window.print()}>
          <Printer size={17} /> Print / save PDF
        </Button>
      </div>
      <h1>ScholarAI Application Analysis</h1>
      <dl>
        <dt>Student</dt>
        <dd>{a.snapshot.profile.full_name || "Student"}</dd>
        <dt>Scholarship</dt>
        <dd>{a.snapshot.scholarship.name}</dd>
        <dt>Date / version</dt>
        <dd>
          {formatDate(a.created_at)} / {a.version}
        </dd>
      </dl>
      <h2>Executive summary</h2>
      <p>{a.result.eligibility}</p>
      <p>
        Overall Fit Score: <strong>{a.result.overall_score}/100</strong> · Documents:{" "}
        {a.result.documents_complete}/{a.result.documents_required} · Critical gaps:{" "}
        {a.result.critical_gaps}
      </p>
      <h2>Fit Score</h2>
      <p>{a.result.score_method}</p>
      <table>
        <tbody>
          {Object.entries(a.result.categories).map(([k, c]) => (
            <tr key={k}>
              <th>{label(k)}</th>
              <td>{c.score ?? "Not evaluated"}</td>
              <td>Weight: {c.weight}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Eligibility & requirement evidence</h2>
      {a.result.evaluations.map((e, i) => (
        <section className="report-evidence" key={i}>
          <h3>
            {e.criterion.title} — {label(e.status)}
          </h3>
          <blockquote>{e.criterion.source_text}</blockquote>
          <p>{e.reason}</p>
          {e.evidence.map((f, j) => (
            <p key={j}>
              {f.source} · Page {f.page || "N/A"}: “{f.snippet}”
              {f.corrected_at ? ` (Corrected value: ${String(f.value)})` : ""}
            </p>
          ))}
        </section>
      ))}
      {[
        { title: "Strengths", items: a.result.strengths },
        { title: "Gaps", items: a.result.gaps },
        { title: "Recommended actions", items: a.result.recommendations },
      ].map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.items.map((item, i) => (
            <div key={i}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </section>
      ))}
      <h2>Application roadmap</h2>
      {q.data.tasks.map((t) => (
        <div key={t.id}>
          <h3>
            {t.data.title} · {t.status}
          </h3>
          <p>
            {t.data.priority} priority · {formatDate(t.data.deadline)}
          </p>
          <p>{t.data.description}</p>
        </div>
      ))}
      <footer>
        This report evaluates alignment with supplied scholarship information. It does not predict
        or guarantee selection.
      </footer>
    </article>
  );
}
