import Link from "next/link";
import {
  Check,
  FileSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  GraduationCap,
  Route,
  FlaskConical,
  Quote,
} from "lucide-react";
import { Logo } from "@/components/shell";
import { Button } from "@/components/ui/button";
export default function Home() {
  const pagesPreview = process.env.GITHUB_PAGES === "true";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://scholarai.vercel.app").replace(/\/$/, "");
  const signInHref = pagesPreview ? `${appUrl}/login` : "/login";
  const startHref = pagesPreview ? `${appUrl}/register` : "/register";
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/">
          <Logo />
        </Link>
        <div>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Built for your next step</a>
        </div>
        <div>
          <Link href={signInHref}>{pagesPreview ? "Launch ScholarAI" : "Sign in"}</Link>
          <Button asChild>
            <Link href={startHref}>{pagesPreview ? "Launch ScholarAI" : "Get started"}</Link>
          </Button>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span /> YOUR AMBITION. BACKED BY EVIDENCE.
            </span>
            <h1>
              Know exactly what your scholarship application is <em>missing.</em>
            </h1>
            <p>
              Turn your documents and scholarship requirements into a clear, evidence-based plan for
              your next chapter.
            </p>
            <div className="actions">
              <Button asChild>
                <Link href={startHref}>{pagesPreview ? "Launch ScholarAI" : "Analyze my application"}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={pagesPreview ? `${appUrl}/login?demo=1` : "/login?demo=1"}>
                  {pagesPreview ? "Try Demo" : "View demo"}
                </Link>
              </Button>
            </div>
            {pagesPreview && (
              <p className="hero-note">
                Sign in or open the synthetic demo in the live ScholarAI application.
              </p>
            )}
            <span className="hero-note">
              <ShieldCheck size={16} /> Private documents. Transparent decisions. No false promises.
            </span>
          </div>
          <div className="hero-report">
            <div className="hero-report-top">
              <span className="stat-icon green">
                <GraduationCap size={25} />
              </span>
              <span className="tiny-tag">ILLUSTRATIVE ANALYSIS</span>
            </div>
            <h3>
              Your next opportunity,
              <br />a little clearer.
            </h3>
            <p>Global AI Excellence Scholarship · Fictional example</p>
            <div className="hero-score">
              <div>
                <strong>Application fit</strong>
                <span>Based on supplied requirements</span>
              </div>
              <span className="hero-score-number">
                82<small>/100</small>
              </span>
            </div>
            <div className="hero-rule">
              <Check size={17} />
              <span>Academic requirements</span>
              <strong>Satisfied</strong>
            </div>
            <div className="hero-rule">
              <Check size={17} />
              <span>English language</span>
              <strong>Satisfied</strong>
            </div>
            <div className="hero-rule warning">
              <FileSearch size={17} />
              <span>Recommendation letters</span>
              <strong>1 missing</strong>
            </div>
            <div className="hero-report-note">
              <Sparkles size={16} /> One clear next step: request your second letter.
            </div>
          </div>
        </section>
        <div className="landing-strip">
          <span>More clarity.</span>
          <span>Better preparation.</span>
          <span>A plan you can act on.</span>
        </div>
        <section id="how-it-works" className="landing-section">
          <div className="eyebrow">FROM DOCUMENTS TO DIRECTION</div>
          <h2>
            A big next step.
            <br />
            Four simple first steps.
          </h2>
          <div className="workflow-grid">
            {[
              {
                icon: Upload,
                title: "Bring your evidence",
                text: "Upload your CV, transcript, and certificates.",
              },
              {
                icon: GraduationCap,
                title: "Choose your opportunity",
                text: "Add official requirements from a URL, PDF, or text.",
              },
              {
                icon: FileSearch,
                title: "Understand your fit",
                text: "See each requirement, your evidence, and the reasoning.",
              },
              {
                icon: Route,
                title: "Make a plan",
                text: "Turn missing requirements into prioritized next steps.",
              },
            ].map((f, i) => (
              <div key={f.title}>
                <span className="workflow-number">0{i + 1}</span>
                <f.icon size={27} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="features" className="landing-features">
          <div>
            <div className="eyebrow">EVERY CONCLUSION HAS A SOURCE</div>
            <h2>
              A clearer picture.
              <br />A stronger application.
            </h2>
            <p>
              Check hard eligibility separately from application fit. Explore improvements without
              changing your real evidence.
            </p>
            <Button asChild>
              <Link href={startHref}>
                {pagesPreview ? "Explore the project" : "Build my application plan"}
              </Link>
            </Button>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: ShieldCheck,
                title: "Eligibility, explained",
                text: "Deterministic checks for exact requirements, with uncertainty made visible.",
              },
              {
                icon: Quote,
                title: "Evidence you can inspect",
                text: "Follow every extracted fact back to a document and source snippet.",
              },
              {
                icon: FlaskConical,
                title: "Explore ‘what if’",
                text: "See how a hypothetical improvement changes alignment.",
              },
              {
                icon: Sparkles,
                title: "An informed assistant",
                text: "Ask questions about your application with internal source citations.",
              },
            ].map((f) => (
              <article key={f.title}>
                <f.icon size={25} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>
          ScholarAI evaluates published scholarship requirements and application fit.
          <br />
          It does not predict or guarantee admission.
        </p>
        <span>© {new Date().getFullYear()} ScholarAI</span>
      </footer>
    </div>
  );
}
