"use client";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ShieldCheck, Sparkles, Check, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Auth } from "@/types";
import { Logo } from "./shell";
import { Button } from "./ui/button";
const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(12, "Use at least 12 characters."),
});
type Values = z.infer<typeof schema>;
const subscribe = () => () => {};
export function AuthForm({
  mode,
}: {
  mode: "login" | "register" | "forgot-password" | "reset-password" | "verify-email";
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const router = useRouter(),
    search = useSearchParams(),
    client = useQueryClient();
  const token = search.get("token") || "";
  const demoRequested = mode === "login" && search.get("demo") === "1";
  const authMode = mode === "login" || mode === "register";
  useEffect(() => {
    // Start waking the free backend while the visitor fills in the form.
    void fetch("/api/ready", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(45_000),
    }).catch(() => {});
  }, []);
  const form = useForm<Values>({
    resolver: authMode ? zodResolver(schema) : undefined,
    defaultValues: { name: "", email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (demoRequested)
        return api<Auth & { message: string }>("/auth/demo", { method: "POST", body: "{}" });
      const payload =
        mode === "register"
          ? values
          : mode === "login"
            ? { email: values.email, password: values.password }
            : mode === "forgot-password"
              ? { email: values.email }
              : mode === "reset-password"
                ? { token, password: values.password }
                : { token };
      return api<Auth & { message: string }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      if (data.user) {
        client.setQueryData(["session"], data);
        router.push(mode === "register" ? "/onboarding" : "/dashboard");
      }
    },
  });
  const titles = {
    login: "Good to have you back.",
    register: "Your next chapter starts here.",
    "forgot-password": "Let’s get you back in.",
    "reset-password": "Set a new password.",
    "verify-email": "Verify your email.",
  };
  return (
    <div className="auth-layout">
      <div className="auth-main">
        <Link href="/">
          <Logo />
        </Link>
        <div className="auth-box">
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>{titles[mode]}</h1>
          <p>
            {mode === "register"
              ? "Build a stronger scholarship application, backed by your evidence."
              : mode === "login"
                ? "Sign in to your personal application workspace."
                : "Keep your ScholarAI account safe and accessible."}
          </p>
          {mutation.isSuccess && !authMode ? (
            <div className="success-box">
              <Check size={20} />
              {mutation.data.message}
              <Link href="/login">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="form-stack">
              <fieldset
                className="form-stack"
                disabled={!ready}
                style={{ border: 0, padding: 0, margin: 0 }}
              >
                {mode === "register" && (
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      required
                      {...form.register("name")}
                    />
                  </label>
                )}
                {["login", "register", "forgot-password"].includes(mode) && (
                  <label>
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@university.edu"
                      required
                      {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                      <span className="field-error">{form.formState.errors.email.message}</span>
                    )}
                  </label>
                )}
                {["login", "register", "reset-password"].includes(mode) && (
                  <label>
                    Password
                    <input
                      type="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      minLength={12}
                      placeholder="At least 12 characters"
                      required
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <span className="field-error">{form.formState.errors.password.message}</span>
                    )}
                  </label>
                )}
                {mode === "login" && (
                  <Link className="text-link forgot-link" href="/forgot-password">
                    Forgot password?
                  </Link>
                )}
                {mutation.error && (
                  <p className="error-message" role="alert">
                    {mutation.error.message}
                  </p>
                )}
                <Button
                  disabled={
                    mutation.isPending || (!authMode && mode !== "forgot-password" && !token)
                  }
                  type="submit"
                >
                  {mutation.isPending ? <LoaderCircle size={17} className="spin" /> : null}
                  {mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create my account"
                      : mode === "forgot-password"
                        ? "Send reset link"
                        : mode === "reset-password"
                          ? "Update password"
                          : "Verify email"}
                </Button>
                {mutation.isPending && (
                  <p className="auth-privacy" role="status">
                    Connecting to ScholarAI. The free server may take a few minutes to start; please
                    keep this page open. Your request will continue automatically.
                  </p>
                )}
                {demoRequested && (
                  <div className="auth-privacy">
                    <p>
                      Open a shared, read-only workspace with synthetic sample documents and
                      scholarship results.
                    </p>
                    <p>Do not upload personal documents or save private information in the demo.</p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ email: "", password: "" })}
                    >
                      {mutation.isPending ? <LoaderCircle size={17} className="spin" /> : null}
                      Try the synthetic demo
                    </Button>
                  </div>
                )}
              </fieldset>
            </form>
          )}
          {authMode && (
            <p className="auth-alternative">
              {mode === "login" ? "New to ScholarAI?" : "Already have an account?"}{" "}
              <Link href={mode === "login" ? "/register" : "/login"}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </Link>
            </p>
          )}
          <div className="auth-privacy">
            <ShieldCheck size={15} /> Your documents are yours. Always.
          </div>
        </div>
        <small>© {new Date().getFullYear()} ScholarAI</small>
      </div>
      <div className="auth-aside">
        <span className="auth-star">✳</span>
        <div className="eyebrow">AMBITION, MEET DIRECTION.</div>
        <h2>
          You bring the ambition.
          <br />
          We bring the clarity.
        </h2>
        <p>
          Understand the requirements. Find the gaps.
          <br />
          Make your next step count.
        </p>
        <div className="auth-evidence-card">
          <span>
            <GraduationCap size={24} />
          </span>
          <h3>A plan built around you.</h3>
          <div>
            <Check size={16} /> Transparent eligibility checks
          </div>
          <div>
            <Check size={16} /> Every conclusion linked to evidence
          </div>
          <div>
            <Check size={16} /> A personalized application roadmap
          </div>
          <footer>
            <Sparkles size={15} /> Clearer applications. Informed decisions.
          </footer>
        </div>
        <span className="auth-disclaimer">
          We evaluate application fit. We never predict admission.
        </span>
      </div>
    </div>
  );
}
