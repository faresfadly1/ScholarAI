"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleCheck,
  FileText,
  GraduationCap,
  Plus,
  Sparkles,
  Upload,
  Target,
  Clock3,
  ShieldCheck,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Analysis, Auth, Document, Scholarship, Task } from "@/types";
import { Button } from "./ui/button";
import { Badge, Disclaimer, Empty, ErrorState, Loading } from "./ui/common";
const colors = ["#257959", "#b7cba6", "#d9c693", "#87a8b3"];
export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  return (
    <div
      className="score-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--green) ${score * 3.6}deg, #e8eee9 0deg)`,
      }}
    >
      <span style={{ fontSize: size > 80 ? "2.6rem" : "1.15rem" }}>
        {Math.round(score)}
        {size > 80 && <small>/ 100</small>}
      </span>
    </div>
  );
}
export function Dashboard() {
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<Auth>("/auth/me") });
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [analyses, scholarships, documents, tasks] = await Promise.all([
        api<Analysis[]>("/analyses"),
        api<Scholarship[]>("/scholarships"),
        api<Document[]>("/documents"),
        api<Task[]>("/roadmap"),
      ]);
      return { analyses, scholarships, documents, tasks, now: Date.now() };
    },
    refetchInterval: 10000,
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  if (!query.data) return null;
  const { analyses, scholarships, documents, tasks, now } = query.data;
  const completed = analyses.filter((a) => a.status === "Completed");
  const unique = completed.filter(
    (a, i, all) => all.findIndex((b) => b.scholarship_id === a.scholarship_id) === i,
  );
  const upcoming = scholarships
    .filter((s) => s.data.deadline && new Date(s.data.deadline).getTime() >= now)
    .sort((a, b) => (a.data.deadline || "").localeCompare(b.data.deadline || ""));
  const todo = tasks
    .filter((t) => t.status !== "Completed")
    .sort((a, b) => (b.data.priority_score || 0) - (a.data.priority_score || 0));
  const firstName = session.data?.user.name.split(" ")[0] || "there";
  return (
    <div className="dashboard">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>
            Welcome back, {firstName} <span className="wave">✦</span>
          </h1>
          <p>Big ambitions. Clear next steps. Let’s move your applications forward.</p>
        </div>
        <Button asChild>
          <Link href="/scholarships/new">
            <Plus size={17} /> New application
          </Link>
        </Button>
      </div>
      <div className="insight-banner">
        <span className="insight-icon">
          <Sparkles size={22} />
        </span>
        <div>
          <strong>A stronger application starts with knowing where you stand.</strong>
          <p>
            {todo.length
              ? `You have ${todo.filter((t) => t.data.priority === "Critical").length} priority requirements to work on. Your roadmap will help you take the next step.`
              : "Add your documents and a scholarship to turn your evidence into an application plan."}
          </p>
        </div>
        <Link href="/roadmap">
          View my roadmap <ChevronRight size={17} />
        </Link>
      </div>
      <div className="stats-grid">
        {[
          {
            title: "Active applications",
            value: scholarships.filter((s) => s.active).length,
            icon: GraduationCap,
            caption: "In your workspace",
            color: "green",
          },
          {
            title: "Scholarships analyzed",
            value: unique.length,
            icon: ChartNoAxesCombined,
            caption: `${analyses.length} total analysis versions`,
            color: "purple",
          },
          {
            title: "Documents uploaded",
            value: documents.length,
            icon: FileText,
            caption: `${documents.filter((d) => d.status === "Processed").length} processed and ready`,
            color: "blue",
          },
          {
            title: "Upcoming deadlines",
            value: upcoming.length,
            icon: CalendarDays,
            caption: upcoming[0]
              ? `Next: ${formatDate(upcoming[0].data.deadline)}`
              : "No deadlines on the horizon",
            color: "amber",
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <span className={`stat-icon ${stat.color}`}>
                <stat.icon size={18} />
              </span>
            </div>
            <strong className="stat-value">{stat.value.toString().padStart(2, "0")}</strong>
            <span className="stat-caption">{stat.caption}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Your applications <span className="count-pill">{unique.length}</span>
                </h2>
                <p>A little clarity on where you stand.</p>
              </div>
              <Link className="text-link" href="/analyses">
                View all <ChevronRight size={15} />
              </Link>
            </div>
            {unique.length ? (
              <div className="application-list">
                {unique.slice(0, 3).map((a, i) => (
                  <Link href={`/analysis/${a.id}`} className="application-row" key={a.id}>
                    <div className={`university-mark mark-${i % 3}`}>
                      <GraduationCap size={25} />
                    </div>
                    <div className="application-info">
                      <h3>{a.snapshot.scholarship.name}</h3>
                      <p>
                        {a.snapshot.scholarship.university || "Your scholarship"} <span>·</span>{" "}
                        {a.snapshot.scholarship.country || "Country not specified"}
                      </p>
                      <div className="application-meta">
                        <Badge status={a.result.critical_gaps ? "MISSING_EVIDENCE" : "SATISFIED"}>
                          {a.result.critical_gaps
                            ? `${a.result.critical_gaps} requirements to review`
                            : "Requirements satisfied"}
                        </Badge>
                        <span>
                          <CalendarDays size={12} />
                          {formatDate(a.snapshot.scholarship.deadline)}
                        </span>
                      </div>
                    </div>
                    <div className="fit-mini">
                      <ScoreRing score={a.result.overall_score} />
                      <span>Fit Score</span>
                    </div>
                    <ChevronRight size={16} className="muted" />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="Your first opportunity is waiting"
                description="Add a scholarship, then run an evidence-based analysis."
              >
                <Button asChild variant="outline">
                  <Link href="/scholarships/new">
                    <Plus size={16} /> Add scholarship
                  </Link>
                </Button>
              </Empty>
            )}
            <Link href="/scholarships" className="panel-bottom-link">
              <Plus size={15} /> Explore your scholarships
            </Link>
          </section>
          <section className="panel fit-overview">
            <div className="panel-heading">
              <div>
                <h2>Your fit at a glance</h2>
                <p>Evidence alignment across your latest applications.</p>
              </div>
              <span className="tiny-tag">LATEST ANALYSES</span>
            </div>
            {unique.length ? (
              <>
                <div className="fit-bars">
                  {unique.slice(0, 4).map((a, i) => (
                    <div className="fit-bar-row" key={a.id}>
                      <span title={a.snapshot.scholarship.name}>{a.snapshot.scholarship.name}</span>
                      <div className="bar-track">
                        <div
                          style={{ width: `${a.result.overall_score}%`, background: colors[i] }}
                        />
                      </div>
                      <strong>
                        {Math.round(a.result.overall_score)}
                        <small> /100</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="chart-axis">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </>
            ) : (
              <Empty
                title="A clearer picture, backed by evidence"
                description="Your fit scores will appear after your first analysis."
              />
            )}
            <Disclaimer />
          </section>
          <div className="trust-row">
            <ShieldCheck size={17} />
            <span>Grounded in your evidence. Designed for your future.</span>
            <span className="muted">No predictions. Just a clearer plan.</span>
          </div>
        </div>
        <div className="dashboard-secondary">
          <section className="panel next-steps">
            <div className="panel-heading">
              <div>
                <h2>Your next steps</h2>
                <p>Small actions. Meaningful progress.</p>
              </div>
              <RouteIcon />
            </div>
            {todo.length ? (
              <div className="task-preview-list">
                {todo.slice(0, 3).map((t) => (
                  <Link href={`/roadmap/${t.analysis_id}`} className="task-preview" key={t.id}>
                    <span className="task-check" />
                    <div>
                      <h3>{t.data.title}</h3>
                      <p>{t.data.category.replaceAll("_", " ")}</p>
                      <span className={`priority-label ${t.data.priority.toLowerCase()}`}>
                        <span /> {t.data.priority} priority
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="small-empty">
                <CircleCheck size={26} />
                <p>You’re all caught up. New analysis gaps will become actionable tasks here.</p>
              </div>
            )}
            <Link href="/roadmap" className="panel-bottom-link">
              Open application roadmap <ChevronRight size={15} />
            </Link>
          </section>
          <section className="panel deadline-panel">
            <div className="panel-heading">
              <h2>On the horizon</h2>
              <CalendarDays size={18} className="muted" />
            </div>
            {upcoming.length ? (
              upcoming.slice(0, 2).map((s) => (
                <Link className="deadline-row" href={`/scholarships/${s.id}`} key={s.id}>
                  <div className="date-tile">
                    <span>
                      {new Date(s.data.deadline + "T12:00:00").toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </span>
                    <strong>{new Date(s.data.deadline + "T12:00:00").getDate()}</strong>
                  </div>
                  <div>
                    <h3>{s.name}</h3>
                    <span>
                      {Math.ceil(
                        (new Date(s.data.deadline + "T00:00:00").getTime() - now) / 86400000,
                      )}{" "}
                      days to prepare
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="small-empty">
                Add a scholarship deadline to keep your preparation on track.
              </p>
            )}
          </section>
          <section className="document-prompt">
            <div className="document-art">
              <FileText size={25} />
              <span>
                <Check size={11} />
              </span>
            </div>
            <h2>Your story, supported.</h2>
            <p>Keep your documents up to date for a more complete picture of your application.</p>
            <Button asChild variant="outline">
              <Link href="/documents">
                <Upload size={15} /> Manage documents
              </Link>
            </Button>
            <span className="private-label">
              <ShieldCheck size={12} /> Private and secure
            </span>
          </section>
        </div>
      </div>
    </div>
  );
}
function RouteIcon() {
  return <Target size={20} className="muted" />;
}
export function AnalysesList() {
  const q = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api<Analysis[]>("/analyses"),
    refetchInterval: 5000,
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVIDENCE INTO INSIGHT</div>
          <h1>My analyses</h1>
          <p>Every analysis is a saved snapshot of your application.</p>
        </div>
        <Button asChild>
          <Link href="/scholarships">
            <Plus size={17} /> Run an analysis
          </Link>
        </Button>
      </div>
      {q.data?.length ? (
        <div className="analysis-card-grid">
          {q.data.map((a) => (
            <Link className="panel analysis-card" href={`/analysis/${a.id}`} key={a.id}>
              <div className="split">
                <span className="stat-icon green">
                  <ChartNoAxesCombined size={20} />
                </span>
                <Badge status={a.status} />
              </div>
              <h2>{a.snapshot.scholarship.name}</h2>
              <p>{a.snapshot.scholarship.university || "Scholarship application"}</p>
              {a.status === "Completed" && (
                <div className="analysis-card-score">
                  <ScoreRing score={a.result.overall_score} size={80} />
                  <div>
                    <strong>Overall Fit Score</strong>
                    <p>{a.result.critical_gaps} critical requirements to review</p>
                  </div>
                </div>
              )}
              <div className="analysis-card-footer">
                <span>
                  <Clock3 size={13} /> {formatDate(a.created_at)} · v{a.version}
                </span>
                <ArrowUpRight size={17} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="No analyses yet"
          description="Add a scholarship and compare its requirements with your evidence."
        >
          <Button asChild>
            <Link href="/scholarships">Choose a scholarship</Link>
          </Button>
        </Empty>
      )}
      <Disclaimer />
    </>
  );
}
