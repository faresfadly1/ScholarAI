"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Globe2,
  GraduationCap,
  Plus,
  Search,
  Link2,
  FileText,
  Upload,
  Sparkles,
  ExternalLink,
  Settings2,
} from "lucide-react";
import { api } from "@/lib/api";
import { uploadDocument } from "@/lib/uploads";
import { formatDate } from "@/lib/utils";
import type { Analysis, Document, Scholarship } from "@/types";
import { Button } from "./ui/button";
import { Badge, Empty, ErrorState, Loading, PageHeader } from "./ui/common";
export function ScholarshipsPage() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const q = useQuery({
    queryKey: ["scholarships"],
    queryFn: () => api<Scholarship[]>("/scholarships"),
    refetchInterval: 5000,
  });
  const filtered = q.data?.filter((s) =>
    `${s.name} ${s.data.country} ${s.data.university}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="FIND YOUR NEXT CHAPTER"
        title="My scholarships"
        description="Your opportunities, organized. Add official requirements and understand your fit."
      >
        <Button asChild>
          <Link href="/scholarships/new">
            <Plus size={17} /> Add scholarship
          </Link>
        </Button>
      </PageHeader>
      <div className="list-toolbar">
        <div className="tabs">
          <span className="active">
            All scholarships <b>{q.data?.length || 0}</b>
          </span>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities…"
            aria-label="Search opportunities"
          />
        </div>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : filtered?.length ? (
        <div className="scholarship-grid">
          {filtered.map((s, i) => (
            <Link className="panel scholarship-card" href={`/scholarships/${s.id}`} key={s.id}>
              <div className="split">
                <span className={`university-mark mark-${i % 3}`}>
                  <GraduationCap size={28} />
                </span>
                <Badge status={s.status} />
              </div>
              <h2>{s.name}</h2>
              <p>{s.data.university || "Provider not specified"}</p>
              <div className="scholarship-tags">
                <span>
                  <Globe2 size={14} />
                  {s.data.country || "Not specified"}
                </span>
                <span>{s.data.degree_level || "Degree not specified"}</span>
              </div>
              <div className="scholarship-card-bottom">
                <span>
                  <CalendarDays size={15} />
                  {formatDate(s.data.deadline)}
                </span>
                <strong>{s.data.funding_type || "Funding not specified"}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="Make room for your next opportunity"
          description="Start with an official scholarship page, an admissions PDF, or pasted requirements."
        >
          <Button asChild>
            <Link href="/scholarships/new">
              <Plus size={16} /> Add your first scholarship
            </Link>
          </Button>
        </Empty>
      )}
    </>
  );
}
export function NewScholarship() {
  const [method, setMethod] = useState("text"),
    [error, setError] = useState("");
  const router = useRouter();
  const docs = useQuery({
    queryKey: ["documents"],
    queryFn: () => api<Document[]>("/documents"),
    refetchInterval: 3000,
  });
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      if (method === "url")
        return api<Scholarship>("/scholarships/from-url", {
          method: "POST",
          body: JSON.stringify({ name: form.get("name"), url: form.get("url") }),
        });
      if (method === "pdf") {
        const id = form.get("document_id");
        if (!id) throw new Error("Select a processed scholarship guide");
        return api<Scholarship>(
          `/scholarships/from-document?document_id=${id}&name=${encodeURIComponent(String(form.get("name")))}`,
          { method: "POST" },
        );
      }
      return api<Scholarship>("/scholarships/manual", {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(form),
          deadline: form.get("deadline") || null,
        }),
      });
    },
    onSuccess: (s) => router.push(`/scholarships/${s.id}`),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument(file, "Scholarship guide"),
    onSuccess: () => docs.refetch(),
    onError: (e) => setError(e.message),
  });
  return (
    <>
      <PageHeader
        eyebrow="A NEW OPPORTUNITY"
        title="Add a scholarship"
        description="Start with the source. We’ll turn its requirements into a checklist you can inspect."
      />
      <div className="narrow-page">
        <div className="method-tabs">
          {[
            { id: "text", title: "Paste requirements", icon: FileText },
            { id: "url", title: "Scholarship URL", icon: Link2 },
            { id: "pdf", title: "Upload a guide", icon: Upload },
          ].map((m) => (
            <button
              className={method === m.id ? "active" : ""}
              key={m.id}
              onClick={() => setMethod(m.id)}
            >
              <m.icon size={21} />
              {m.title}
            </button>
          ))}
        </div>
        <form
          className="panel padded form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(new FormData(e.currentTarget));
          }}
        >
          <label>
            Scholarship or program name
            <input
              name="name"
              placeholder="e.g. Global AI Excellence Scholarship"
              required
              minLength={3}
              maxLength={250}
            />
          </label>
          {method === "text" && (
            <>
              <div className="form-grid">
                <label>
                  University / provider
                  <input name="university" placeholder="University name" />
                </label>
                <label>
                  Country
                  <input name="country" placeholder="Country" />
                </label>
                <label>
                  Degree level
                  <select name="degree_level">
                    <option>Master&apos;s</option>
                    <option>PhD</option>
                    <option>Bachelor&apos;s</option>
                  </select>
                </label>
                <label>
                  Field
                  <input name="field" placeholder="Artificial Intelligence" />
                </label>
                <label>
                  Application deadline
                  <input type="date" name="deadline" />
                </label>
                <label>
                  Funding
                  <select name="funding_type">
                    <option>Not specified</option>
                    <option>Fully funded</option>
                    <option>Partial funding</option>
                    <option>Tuition waiver</option>
                  </select>
                </label>
              </div>
              <label>
                Official requirements
                <textarea
                  name="text"
                  required
                  minLength={10}
                  rows={10}
                  placeholder={
                    "Paste the exact requirements, one per line. For example:\nGPA >= 3.0/4\nTOEFL >= 90 OR IELTS >= 6.5\n2 recommendation letters required\nResearch experience preferred"
                  }
                />
                <span className="field-hint">
                  Use the original wording. We flag unclear requirements for review.
                </span>
              </label>
            </>
          )}
          {method === "url" && (
            <>
              <label>
                Public scholarship URL
                <input
                  type="url"
                  name="url"
                  required
                  placeholder="https://university.edu/scholarships/program"
                />
              </label>
              <div className="info-box">
                We read public pages only. If the page is restricted or cannot be retrieved, switch
                to pasted requirements.
              </div>
            </>
          )}
          {method === "pdf" && (
            <>
              <label>
                Upload official guide
                <input
                  type="file"
                  accept=".pdf,.docx"
                  disabled={upload.isPending}
                  onChange={(e) => {
                    if (e.target.files?.[0]) upload.mutate(e.target.files[0]);
                  }}
                />
              </label>
              {upload.isSuccess && (
                <p className="info-box">
                  Guide uploaded. Wait until it appears in the processed guides below.
                </p>
              )}
              <label>
                Choose a processed guide
                <select name="document_id" required>
                  <option value="">Select a guide</option>
                  {docs.data
                    ?.filter(
                      (d) => d.document_type === "Scholarship guide" && d.status === "Processed",
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.filename}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          {(mutation.error || error) && (
            <p role="alert" className="error-message">
              {mutation.error?.message || error}
            </p>
          )}
          <div className="form-footer">
            <Button disabled={mutation.isPending} type="submit">
              <Sparkles size={17} />
              {mutation.isPending ? "Adding scholarship…" : "Extract requirements"}
            </Button>
          </div>
        </form>
        <p className="disclaimer">
          Extracted requirements may need human verification. Always consult the official
          scholarship source.
        </p>
      </div>
    </>
  );
}
export function ScholarshipDetail({ id }: { id: string }) {
  const router = useRouter(),
    client = useQueryClient();
  const q = useQuery({
    queryKey: ["scholarship", id],
    queryFn: () => api<Scholarship>(`/scholarships/${id}`),
    refetchInterval: 3000,
  });
  const analysis = useMutation({
    mutationFn: () =>
      api<Analysis>("/analyses", { method: "POST", body: JSON.stringify({ scholarship_id: id }) }),
    onSuccess: (a) => router.push(`/analysis/${a.id}`),
  });
  const retry = useMutation({
    mutationFn: () => api(`/scholarships/${id}/retry`, { method: "POST" }),
    onSuccess: () => q.refetch(),
  });
  const [weightsOpen, setWeightsOpen] = useState(false);
  const update = useMutation({
    mutationFn: (weights: Record<string, number>) =>
      api(`/scholarships/${id}`, { method: "PUT", body: JSON.stringify({ weights }) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["scholarship", id] });
      setWeightsOpen(false);
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const s = q.data;
  if (!s) return null;
  return (
    <>
      <PageHeader
        eyebrow="SCHOLARSHIP WORKSPACE"
        title={s.name}
        description={`${s.data.university || "Provider not specified"} · ${s.data.country || "Country not specified"}`}
      >
        <Button variant="outline" onClick={() => setWeightsOpen(!weightsOpen)}>
          <Settings2 size={16} /> Scoring weights
        </Button>
        <Button
          disabled={s.status !== "Ready" || !s.active || analysis.isPending}
          onClick={() => analysis.mutate()}
        >
          <Sparkles size={16} />
          {analysis.isPending ? "Starting…" : "Analyze my application"}
        </Button>
      </PageHeader>
      <div className="detail-meta">
        <Badge status={s.status} />
        <span>
          <CalendarDays size={16} /> Deadline: {formatDate(s.data.deadline)}
        </span>
        <span>{s.source_type}</span>
        {s.source_url && (
          <a href={s.source_url} target="_blank" rel="noreferrer" className="text-link">
            View source <ExternalLink size={14} />
          </a>
        )}
      </div>
      {analysis.error && <p className="error-message">{analysis.error.message}</p>}
      {s.status === "Processing" && (
        <Loading text="Reading the source and extracting requirements…" />
      )}
      {s.status === "Failed" && (
        <div className="error-message">
          {s.error}
          <Button variant="outline" onClick={() => retry.mutate()}>
            Retry extraction
          </Button>
          <Link href="/scholarships/new">Paste requirements instead</Link>
        </div>
      )}
      {weightsOpen && (
        <form
          className="panel padded form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              Object.fromEntries(
                Array.from(new FormData(e.currentTarget)).map(([k, v]) => [k, Number(v)]),
              ),
            );
          }}
        >
          <h2>Transparent scoring weights</h2>
          <p>Weights must total 100%. Changes affect future analyses only.</p>
          <div className="form-grid">
            {Object.entries(s.weights).map(([k, v]) => (
              <label key={k}>
                {k}
                <input name={k} type="number" min="0" max="100" defaultValue={v} required />
              </label>
            ))}
          </div>
          {update.error && <p className="error-message">{update.error.message}</p>}
          <Button disabled={update.isPending}>Save scoring weights</Button>
        </form>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Structured requirements{" "}
              <span className="count-pill">{s.requirements?.length || 0}</span>
            </h2>
            <p>Exact source wording, with mandatory and preferred requirements separated.</p>
          </div>
        </div>
        <div className="requirements-list">
          {s.requirements?.map((r) => (
            <div className="requirement-row" key={r.id}>
              <span className={`requirement-icon ${r.data.mandatory ? "required" : ""}`}>
                <FileText size={18} />
              </span>
              <div>
                <h3>{r.data.title}</h3>
                <blockquote>{r.data.source_text}</blockquote>
                <span className="muted">
                  {r.data.category.replaceAll("_", " ")} · {Math.round(r.data.confidence * 100)}%
                  extraction confidence ·{" "}
                  {r.admin_verified ? "Admin verified" : "Unverified extraction"}
                </span>
              </div>
              <span className={`tiny-tag ${r.data.mandatory ? "" : "optional"}`}>
                {r.data.mandatory ? "REQUIRED" : "PREFERRED"}
              </span>
            </div>
          ))}
        </div>
      </section>
      <details className="panel source-details">
        <summary>Original supplied source</summary>
        <pre>{s.source_text}</pre>
      </details>
    </>
  );
}
