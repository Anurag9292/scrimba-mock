import Link from "next/link";
import LessonList from "@/components/lesson/LessonList";
import AuthNav from "@/components/auth/AuthNav";

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-mono text-sm font-bold text-white">
            S
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            ScrimbaClone
          </span>
        </Link>

        <AuthNav />
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-600/10 blur-[120px]" />
        <div className="absolute right-0 top-1/2 h-[300px] w-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/60 px-4 py-1.5 text-sm text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Interactive code screencasts
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          <span className="text-white">Code. Record.</span>
          <br />
          <span className="gradient-text">Teach interactively.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
          Create interactive coding screencasts where viewers can pause the
          video and edit the code themselves. The best way to learn is by doing.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/record" className="btn-primary px-6 py-3 text-base">
            <RecordIcon />
            Start Recording
          </Link>
          <Link href="#lessons" className="btn-secondary px-6 py-3 text-base">
            <PlayIcon />
            Browse Lessons
          </Link>
          <Link href="/paths" className="btn-secondary px-6 py-3 text-base">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
            Learning Paths
          </Link>
        </div>
      </div>
    </section>
  );
}

function LessonListSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Your Lessons</h2>
        <Link
          href="/record"
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RecordIcon />
          New Lesson
        </Link>
      </div>
      <LessonList />
    </section>
  );
}

function FeatureCards() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Record Card */}
        <Link href="/record" className="card-hover group block p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20 transition-colors group-hover:bg-red-500/15">
            <RecordIcon />
          </div>
          <h2 className="text-xl font-semibold text-white">
            Recording Studio
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-gray-400">
            Record your coding sessions with a built-in Monaco editor.
            Capture every keystroke, file change, and cursor movement
            alongside your audio narration. Create polished, interactive
            tutorials effortlessly.
          </p>
          <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-brand-400 transition-colors group-hover:text-brand-300">
            Open studio
            <ArrowRightIcon />
          </div>
        </Link>

        {/* Play Card */}
        <Link href="#lessons" className="card-hover group block p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20 transition-colors group-hover:bg-brand-500/15">
            <PlayIcon />
          </div>
          <h2 className="text-xl font-semibold text-white">
            Interactive Player
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-gray-400">
            Watch coding screencasts with a fully interactive code editor.
            Pause at any moment to experiment with the code yourself, then
            resume playback seamlessly. Learning by doing, reimagined.
          </p>
          <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-brand-400 transition-colors group-hover:text-brand-300">
            Browse lessons
            <ArrowRightIcon />
          </div>
        </Link>
      </div>

      {/* Feature highlights */}
      <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          { label: "Monaco Editor", desc: "VS Code experience" },
          { label: "Live Recording", desc: "Capture everything" },
          { label: "Interactive", desc: "Pause & edit code" },
          { label: "Shareable", desc: "Link to any lesson" },
        ].map((feature) => (
          <div
            key={feature.label}
            className="rounded-lg border border-gray-800/60 bg-gray-900/30 p-4 text-center"
          >
            <div className="text-sm font-semibold text-white">
              {feature.label}
            </div>
            <div className="mt-1 text-xs text-gray-500">{feature.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecordIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h10.638l-3.96-3.96a.75.75 0 111.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06l3.96-3.96H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <div id="lessons">
          <LessonListSection />
        </div>
        <FeatureCards />
      </main>
      <footer className="border-t border-gray-800/60 py-8 text-center text-sm text-gray-600">
        ScrimbaClone &mdash; Interactive code screencasts
      </footer>
    </div>
  );
}
