"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Search,
  Download,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Eye,
  Check,
  FileCheck2,
} from "lucide-react";
import { api } from "@/lib/api";
import { uploadDocument } from "@/lib/uploads";
import { formatDate, label } from "@/lib/utils";
import type { Document, Fact } from "@/types";
import { Button } from "./ui/button";
import { Badge, Empty, ErrorState, Loading, Modal, PageHeader } from "./ui/common";
export const documentTypes = [
  "CV",
  "Transcript",
  "Diploma",
  "Enrollment certificate",
  "Graduation certificate",
  "TOEFL certificate",
  "IELTS certificate",
  "GRE certificate",
  "GMAT certificate",
  "Recommendation letter",
  "Statement of Purpose",
  "Research paper",
  "Passport",
  "Scholarship guide",
  "Other",
];
export function DocumentsPage() {
  const client = useQueryClient(),
    input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState("CV"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [remove, setRemove] = useState<Document | null>(null),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["documents"],
    queryFn: () => api<Document[]>("/documents"),
    refetchInterval: 3000,
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument(file, type),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["documents"] });
      setNotice("Document uploaded. We’re extracting your evidence.");
    },
  });
  const deletion = useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: ["documents"] });
      setRemove(null);
      setNotice(data.message);
    },
  });
  const reprocess = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}/reprocess`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["documents"] }),
  });
  const docs =
    query.data?.filter((d) =>
      `${d.filename} ${d.document_type}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageHeader
        eyebrow="YOUR APPLICATION, BACKED BY EVIDENCE"
        title="My documents"
        description="A secure home for the documents that tell your story."
      />
      <div
        className="upload-panel"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) upload.mutate(e.dataTransfer.files[0]);
        }}
      >
        <div className="upload-symbol">
          <Upload size={27} />
        </div>
        <div>
          <h2>Bring your evidence together</h2>
          <p>
            Drop a document here, or choose a file. PDF, DOCX, PNG, JPG · up to{" "}
            {process.env.NEXT_PUBLIC_FREE_DEPLOYMENT_MODE === "true" ? "4" : "15"} MB
          </p>
          <div className="upload-actions">
            <label className="sr-only" htmlFor="document-type">
              Document type
            </label>
            <select id="document-type" value={type} onChange={(e) => setType(e.target.value)}>
              {documentTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Button disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Upload size={16} />
              {upload.isPending ? "Uploading…" : "Choose file"}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.[0]) upload.mutate(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <span className="upload-secure">
          <ShieldCheck size={15} /> Only you can access your files
        </span>
      </div>
      {(upload.error || deletion.error || reprocess.error) && (
        <p className="error-message" role="alert">
          {(upload.error || deletion.error || reprocess.error)?.message}
        </p>
      )}
      {notice && (
        <p className="info-box" role="status">
          {notice}
        </p>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            Document library <span className="count-pill">{query.data?.length || 0}</span>
          </h2>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search documents…"
              aria-label="Search documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : docs.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="document-name">
                        <span className="file-icon">
                          <FileText size={20} />
                        </span>
                        <div>
                          <button onClick={() => setSelected(d.id)}>{d.filename}</button>
                          <span>
                            {(d.file_size / 1024).toFixed(0)} KB
                            {d.page_count
                              ? ` · ${d.page_count} ${d.mime_type.includes("word") ? "text section" : "page"}${d.page_count > 1 ? "s" : ""}`
                              : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{d.document_type}</td>
                    <td>
                      <Badge status={d.status} />
                      {d.error && <span className="field-error">{d.error}</span>}
                    </td>
                    <td>{formatDate(d.created_at)}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label={`Review ${d.filename}`}
                          title="Review extracted facts"
                          onClick={() => setSelected(d.id)}
                        >
                          <Eye size={17} />
                        </button>
                        <a
                          className="icon-button"
                          href={`/api/documents/${d.id}/download`}
                          aria-label={`Download ${d.filename}`}
                        >
                          <Download size={17} />
                        </a>
                        {d.status === "Failed" && (
                          <button
                            className="icon-button"
                            aria-label="Retry processing"
                            onClick={() => reprocess.mutate(d.id)}
                          >
                            <RefreshCw size={17} />
                          </button>
                        )}
                        <button
                          className="icon-button"
                          aria-label={`Delete ${d.filename}`}
                          onClick={() => setRemove(d)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={search ? "No matching documents" : "Your evidence starts here"}
            description="Upload your CV, transcript, and language certificate. You can review and correct extracted facts."
          />
        )}
      </section>
      <p className="disclaimer">
        <ShieldCheck size={15} /> Private storage. You control your documents and can delete them at
        any time.
      </p>
      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Review extracted evidence"
        description="Check each fact against its source. Corrections apply to future analyses."
      >
        {selected && <DocumentReview id={selected} />}
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={(open) => !open && setRemove(null)}
        title="Delete this document?"
        description="The original file and extracted facts will be deleted. Historical analysis snapshots remain until you delete those analyses or your account."
      >
        <p>{remove?.filename}</p>
        <div className="actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Keep document
          </Button>
          <Button
            variant="destructive"
            disabled={deletion.isPending}
            onClick={() => remove && deletion.mutate(remove.id)}
          >
            Delete document
          </Button>
        </div>
      </Modal>
    </>
  );
}
function DocumentReview({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["document", id],
    queryFn: () => api<Document>(`/documents/${id}`),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div className="fact-list">
      <div className="info-box">
        <FileCheck2 size={18} />
        {q.data?.filename} · {q.data?.status}
      </div>
      {Array.isArray(q.data?.extraction.warnings) &&
        q.data.extraction.warnings.map((warning, i) => (
          <p key={i} className="error-message">
            {String(warning)}
          </p>
        ))}
      {q.data?.facts?.length ? (
        q.data.facts.map((f) => <FactEditor key={f.id} fact={f} documentId={id} />)
      ) : (
        <Empty
          title="No structured facts extracted"
          description="Processing may still be running, or this document may need manual review. Source documents remain available to download."
        />
      )}
    </div>
  );
}
function FactEditor({ fact, documentId }: { fact: Fact; documentId: string }) {
  const client = useQueryClient();
  const [value, setValue] = useState(String(fact.value));
  const mutation = useMutation({
    mutationFn: () =>
      api(`/documents/${documentId}/facts/${fact.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["document", documentId] }),
  });
  return (
    <div className="fact-editor">
      <div className="split">
        <strong>{label(fact.key)}</strong>
        <span className="muted">
          {fact.verified
            ? "User verified"
            : `${Math.round(fact.confidence * 100)}% extraction confidence`}{" "}
          · Page {fact.page}
        </span>
      </div>
      <blockquote>{fact.snippet}</blockquote>
      <div className="inline-edit">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Correct ${label(fact.key)}`}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Check size={14} /> Verify
        </Button>
      </div>
      {fact.corrected_at && (
        <small>
          Original extraction: {String(fact.original_value)} · Corrected{" "}
          {formatDate(fact.corrected_at)}
        </small>
      )}
      {mutation.error && <p className="error-message">{mutation.error.message}</p>}
    </div>
  );
}
