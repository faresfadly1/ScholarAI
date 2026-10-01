"use client";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Languages,
  Code2,
  Microscope,
  UserRound,
  Compass,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Profile } from "@/types";
import { Button } from "./ui/button";
import { Loading, ErrorState, PageHeader } from "./ui/common";
export function ProfilePage({ onboarding = false }: { onboarding?: boolean }) {
  const q = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<{ data: Profile; version: number }>("/profile"),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <>
      <PageHeader
        eyebrow="THE FOUNDATION OF YOUR APPLICATION"
        title={onboarding ? "Let’s get to know you." : "My academic profile"}
        description="Your profile adds context. Uploaded documents provide the evidence for eligibility checks."
      />
      {q.data && <ProfileEditor data={q.data.data} onboarding={onboarding} />}
    </>
  );
}
function ProfileEditor({ data, onboarding }: { data: Profile; onboarding: boolean }) {
  const [section, setSection] = useState(0);
  const router = useRouter(),
    client = useQueryClient();
  const { register, handleSubmit } = useForm<Profile>({
    defaultValues: {
      ...data,
      gpa_scale: data.gpa_scale || 4,
      target_degree: data.target_degree || "Master's",
    },
  });
  const [lists, setLists] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ["skills", "research", "experience", "courses", "target_fields", "preferred_countries"].map(
        (k) => [
          k,
          ((data[k as keyof Profile] as string[]) || []).join(
            k === "research" || k === "experience" ? "\n" : ", ",
          ),
        ],
      ),
    ),
  );
  const mutation = useMutation({
    mutationFn: (v: Profile) =>
      api("/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...v,
          ...Object.fromEntries(
            Object.entries(lists).map(([k, v]) => [
              k,
              v
                .split(k === "research" || k === "experience" ? "\n" : ",")
                .map((s) => s.trim())
                .filter(Boolean),
            ]),
          ),
          gpa: Number.isNaN(v.gpa) ? null : v.gpa,
          english_score: Number.isNaN(v.english_score) ? null : v.english_score,
          graduation_year: Number.isNaN(v.graduation_year) ? null : v.graduation_year,
          date_of_birth: v.date_of_birth || null,
          graduation_date: v.graduation_date || null,
          test_date: v.test_date || null,
        }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["profile"] });
      if (onboarding) router.push("/documents");
    },
  });
  const tabs = [
    { name: "Personal", icon: UserRound },
    { name: "Academic", icon: GraduationCap },
    { name: "Languages", icon: Languages },
    { name: "Skills & research", icon: Microscope },
    { name: "Experience & goals", icon: Compass },
  ];
  const listField = (key: string, title: string, placeholder: string, multiline = false) => (
    <label>
      {title}
      {multiline ? (
        <textarea
          value={lists[key]}
          onChange={(e) => setLists({ ...lists, [key]: e.target.value })}
          placeholder={placeholder}
          rows={5}
        />
      ) : (
        <input
          value={lists[key]}
          onChange={(e) => setLists({ ...lists, [key]: e.target.value })}
          placeholder={placeholder}
        />
      )}
      <span className="field-hint">
        {multiline
          ? "One item per line. Include only genuine experience."
          : "Separate items with commas."}
      </span>
    </label>
  );
  return (
    <div className="profile-layout">
      <nav className="profile-nav">
        {tabs.map((tab, i) => (
          <button
            className={section === i ? "active" : ""}
            key={tab.name}
            onClick={() => setSection(i)}
          >
            <tab.icon size={19} />
            <span>{tab.name}</span>
          </button>
        ))}
        <div className="profile-tip">
          <Code2 size={22} />
          <strong>Your evidence matters.</strong>
          <p>
            Profile details are self-reported. Upload certificates and transcripts to support exact
            eligibility checks.
          </p>
        </div>
      </nav>
      <form className="panel profile-form" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div className="panel-heading">
          <div>
            <h2>{tabs[section].name} information</h2>
            <p>Keep your information accurate and up to date.</p>
          </div>
          <span className="tiny-tag">{section + 1} OF 5</span>
        </div>
        <div className="form-grid">
          {section === 0 && (
            <>
              <label>
                Full name
                <input {...register("full_name")} autoComplete="name" />
              </label>
              <label>
                Date of birth
                <input {...register("date_of_birth")} type="date" />
              </label>
              <label>
                Nationality
                <input {...register("nationality")} placeholder="e.g. Canadian" />
              </label>
              <label>
                Country of residence
                <input {...register("country_of_residence")} placeholder="e.g. Canada" />
              </label>
            </>
          )}
          {section === 1 && (
            <>
              <label>
                Current university
                <input {...register("university")} placeholder="Your university" />
              </label>
              <label>
                Degree
                <input {...register("degree")} placeholder="Bachelor of Engineering" />
              </label>
              <label>
                Field of study
                <input {...register("field_of_study")} placeholder="Computer Engineering" />
              </label>
              <label>
                Expected graduation date
                <input {...register("graduation_date")} type="date" />
              </label>
              <label>
                GPA
                <input
                  {...register("gpa", { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
              <label>
                GPA scale
                <input
                  {...register("gpa_scale", { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                />
              </label>
              <label>
                Graduation year
                <input
                  {...register("graduation_year", { valueAsNumber: true })}
                  type="number"
                  min="1900"
                  max="2200"
                />
              </label>
              {listField(
                "courses",
                "Relevant coursework",
                "Machine Learning, Linear Algebra, Algorithms",
              )}
            </>
          )}
          {section === 2 && (
            <>
              <label>
                English test
                <select {...register("english_test")}>
                  <option value="">Select a test</option>
                  <option>TOEFL</option>
                  <option>IELTS</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Total score
                <input
                  {...register("english_score", { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="120"
                  step="0.5"
                />
              </label>
              <label>
                Test date
                <input {...register("test_date")} type="date" />
              </label>
              <div className="info-box">
                Upload your language certificate under Documents. A self-reported score alone is not
                used to satisfy a certificate requirement.
              </div>
            </>
          )}
          {section === 3 && (
            <>
              {listField(
                "skills",
                "Technical skills & tools",
                "Python, Machine Learning, Docker, AWS",
              )}
              {listField(
                "research",
                "Research projects, publications & interests",
                "Computer Vision graduation project",
                true,
              )}
            </>
          )}
          {section === 4 && (
            <>
              {listField(
                "experience",
                "Internships, employment & volunteer work",
                "Role, organization, dates, and your contribution",
                true,
              )}
              <label>
                Target degree
                <select {...register("target_degree")}>
                  <option>Master&apos;s</option>
                  <option>PhD</option>
                  <option>Bachelor&apos;s</option>
                </select>
              </label>
              {listField("target_fields", "Target fields", "Artificial Intelligence, Data Science")}
              {listField(
                "preferred_countries",
                "Preferred countries",
                "Germany, Netherlands, Canada",
              )}
            </>
          )}
        </div>
        <div className="form-footer">
          {mutation.error && (
            <p className="error-message" role="alert">
              {mutation.error.message}
            </p>
          )}
          {mutation.isSuccess && (
            <span className="success-text">
              <CheckCircle2 size={16} /> Profile saved
            </span>
          )}
          <div className="actions">
            {section > 0 && (
              <Button type="button" variant="outline" onClick={() => setSection(section - 1)}>
                Previous
              </Button>
            )}
            {section < 4 && (
              <Button type="button" variant="outline" onClick={() => setSection(section + 1)}>
                Next section
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              <Save size={16} />
              {mutation.isPending ? "Saving…" : onboarding ? "Save & continue" : "Save profile"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
