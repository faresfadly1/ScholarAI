"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LockKeyhole, ShieldCheck, UserRound, Trash2, CheckCircle2 } from "lucide-react";
import { api, downloadJson } from "@/lib/api";
import type { Auth, Profile } from "@/types";
import { Button } from "./ui/button";
import { Modal, PageHeader } from "./ui/common";
export function SettingsPage() {
  const client = useQueryClient(),
    router = useRouter();
  const [confirmation, setConfirmation] = useState(""),
    [deleting, setDeleting] = useState(false);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<{ data: Profile; gemini_available: boolean }>("/profile"),
  });
  const preference = useMutation({
    mutationFn: (enabled: boolean) =>
      api("/settings", { method: "PUT", body: JSON.stringify({ ai_enabled: enabled }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["profile"] }),
  });
  const q = useQuery({ queryKey: ["session"], queryFn: () => api<Auth>("/auth/me") });
  const update = useMutation({
    mutationFn: (data: Record<string, FormDataEntryValue>) =>
      api<{ login_required: boolean }>("/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      if (data.login_required) {
        client.clear();
        router.push("/login");
      } else client.invalidateQueries({ queryKey: ["session"] });
    },
  });
  const exportData = useMutation({
    mutationFn: () => api("/account/export"),
    onSuccess: (data) => downloadJson(data, "scholarai-account.json"),
  });
  const remove = useMutation({
    mutationFn: () => api("/account", { method: "DELETE" }),
    onSuccess: () => {
      client.clear();
      router.push("/");
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE, YOUR CONTROL"
        title="Account settings"
        description="Manage your account and keep control of your personal data."
      />
      <div className="settings-grid">
        <section className="panel padded">
          <h2>
            <UserRound size={20} /> Personal information
          </h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            <label>
              Name
              <input
                name="name"
                defaultValue={q.data?.user.name}
                key={q.data?.user.name}
                required
              />
            </label>
            <label>
              Email
              <input value={q.data?.user.email || ""} readOnly />
            </label>
            <span className="muted">
              {q.data?.user.email_verified
                ? "Email verified"
                : "Email verification pending. Check your verification email."}
            </span>
            <Button disabled={update.isPending}>Save name</Button>
          </form>
        </section>
        <section className="panel padded">
          <h2>
            <LockKeyhole size={20} /> Password & security
          </h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            <label>
              Current password
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
            <p className="field-hint">
              At least 12 characters. Updating your password signs out all sessions.
            </p>
            <Button variant="outline" disabled={update.isPending}>
              Update password
            </Button>
          </form>
        </section>
        <section className="panel padded">
          <h2>
            <ShieldCheck size={20} /> Your data belongs to you
          </h2>
          <p>
            Export your profile, document facts, scholarship records, and analysis snapshots as
            JSON.
          </p>
          <Button
            variant="outline"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            <Download size={16} /> Export account data
          </Button>
          <hr />
          <label className="inline-label">
            <input
              type="checkbox"
              checked={profile.data?.data.ai_enabled === true}
              disabled={preference.isPending || profile.data?.gemini_available !== true}
              onChange={(e) => preference.mutate(e.target.checked)}
            />{" "}
            Allow external AI processing
          </label>
          {preference.error && <p className="error-message">{preference.error.message}</p>}
          <p>
            External AI is off by default. Enabling it sends relevant document excerpts and profile
            details to Google Gemini. Gemini’s free tier may use submitted content to improve its
            services; turn this on only if you accept that. Already shared data follows Google’s
            retention policy.
          </p>
          <p>
            With external AI off, ScholarAI uses deterministic extraction and rule-based analysis.
            Enabling Gemini is optional and never required to use the application.
          </p>
          {profile.data?.gemini_available !== true && (
            <p>Gemini is not configured on this deployment, so external AI cannot be enabled.</p>
          )}
        </section>
        <section className="panel padded danger-zone">
          <h2>
            <Trash2 size={20} /> Delete account
          </h2>
          <p>
            Permanently remove your account, original files, extracted facts, analyses, simulations,
            and conversations.
          </p>
          <Button variant="destructive" onClick={() => setDeleting(true)}>
            Delete my account
          </Button>
        </section>
      </div>
      {update.isSuccess && (
        <p className="success-text">
          <CheckCircle2 size={16} /> Settings saved
        </p>
      )}
      {(update.error || exportData.error) && (
        <p className="error-message">{(update.error || exportData.error)?.message}</p>
      )}
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="Permanently delete your account?"
        description="This action cannot be undone. Export your data first if you want to keep a copy."
      >
        <label>
          Type DELETE to confirm
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </label>
        {remove.error && <p className="error-message">{remove.error.message}</p>}
        <Button
          variant="destructive"
          disabled={confirmation !== "DELETE" || remove.isPending}
          onClick={() => remove.mutate()}
        >
          Permanently delete my account
        </Button>
      </Modal>
    </>
  );
}
