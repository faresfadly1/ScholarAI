"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Criterion, Scholarship } from "@/types";
import { Button } from "./ui/button";
import { Badge, ErrorState, Loading, PageHeader, Modal } from "./ui/common";
export function AdminPage() {
  const [editing, setEditing] = useState<{ id: string; data: Criterion } | null>(null),
    [json, setJson] = useState("");
  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () =>
      api<{ status: string; task_mode?: string; ai_provider?: string }>("/admin/health"),
  });
  const q = useQuery({
    queryKey: ["admin"],
    queryFn: () => api<Scholarship[]>("/admin/scholarships"),
  });
  const update = useMutation({
    mutationFn: () =>
      api(`/admin/requirements/${editing?.id}`, {
        method: "PATCH",
        body: JSON.stringify(JSON.parse(json)),
      }),
    onSuccess: () => {
      setEditing(null);
      q.refetch();
    },
  });
  const deactivate = useMutation({
    mutationFn: (s: Scholarship) =>
      api(`/admin/scholarships/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !s.active }),
      }),
    onSuccess: () => q.refetch(),
  });
  return (
    <>
      <PageHeader
        eyebrow="HUMAN VERIFICATION"
        title="Scholarship review"
        description="Inspect original sources, correct criteria, and verify extracted requirements."
      />
      <div className="info-box">
        System health: {health.data?.status || health.error?.message || "Checking…"} · Tasks:{" "}
        {health.data?.task_mode || "unknown"} · AI: {health.data?.ai_provider || "unknown"}
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        q.data?.map((s) => (
          <section className="panel padded admin-scholarship" key={s.id}>
            <div className="split">
              <div>
                <h2>{s.name}</h2>
                <p>
                  {s.source_type} · Version {s.version}
                </p>
              </div>
              <Button variant="outline" onClick={() => deactivate.mutate(s)}>
                {s.active ? "Deactivate" : "Activate"}
              </Button>
            </div>
            <details className="source-details">
              <summary>Original source</summary>
              <pre>{s.source_text}</pre>
            </details>
            {s.requirements?.map((r) => (
              <div className="admin-requirement" key={r.id}>
                <div>
                  <h3>{r.data.title}</h3>
                  <p>
                    {r.data.criterion_type} · Weight {r.data.weight} ·{" "}
                    {Math.round(r.data.confidence * 100)}% confidence
                  </p>
                </div>
                <Badge status={r.admin_verified ? "SATISFIED" : "UNCERTAIN"}>
                  {r.admin_verified ? "Verified" : "Needs review"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing({ id: r.id, data: r.data });
                    setJson(
                      JSON.stringify({ ...r.data, admin_verified: r.admin_verified }, null, 2),
                    );
                  }}
                >
                  Edit & verify
                </Button>
              </div>
            ))}
          </section>
        ))
      )}
      {deactivate.error && <p className="error-message">{deactivate.error.message}</p>}
      <Modal
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Review structured criterion"
        description="Edit the structured fields and set admin_verified to true only after checking the source. Source text must remain an exact quote."
      >
        <textarea
          className="code-input"
          rows={18}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          aria-label="Criterion JSON"
        />
        {update.error && <p className="error-message">{update.error.message}</p>}
        <Button disabled={update.isPending} onClick={() => update.mutate()}>
          Save reviewed criterion
        </Button>
      </Modal>
    </>
  );
}
