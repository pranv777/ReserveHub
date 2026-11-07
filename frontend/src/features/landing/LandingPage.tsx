import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { SlotBoard } from "./SlotBoard";


const steps = [
  {
    title: "Browse upcoming slots",
    body: "See which slots are coming up and whether each one is free, filtered by location, category and date.",
  },
  {
    title: "Book it, or join the waitlist",
    body: "If the slot is free, book it. If someone already has it, join the waitlist and keep your place in line.",
  },
  {
    title: "Get the slot when someone cancels",
    body: "The first person waiting is booked automatically as soon as the booking is cancelled, and is told in the app.",
  },
];

const features = [
  {
    title: "One booking per slot",
    body: "The database itself refuses a second confirmed booking for the same slot, so two people can't end up with it, even if they click at the same moment.",
  },
  {
    title: "A fair waitlist",
    body: "First come, first served. When a booking is cancelled, the next person in line is booked in the same step, so the slot is never left open for someone else to grab.",
  },
  {
    title: "Safe retries",
    body: "Each booking request carries a unique key, so a double click or a retry after a bad connection gives you one booking, not two.",
  },
  {
    title: "Find what's free",
    body: "Filter upcoming slots by location, category and date range. Times appear in your own time zone.",
  },
  {
    title: "Notifications in the app",
    body: "You're told when a booking is confirmed or cancelled, and when you move off the waitlist into a booking.",
  },
  {
    title: "Admin tools",
    body: "Administrators add resources and their time slots, and can see every booking along with an audit timeline of changes.",
  },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-xl font-bold text-[#14213D]">
      <span aria-hidden="true" className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded-md bg-indigo-700 p-1">
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white/40" />
        <span className="rounded-[2px] bg-white/40" />
        <span className="rounded-[2px] bg-white" />
      </span>
      ReserveHub
    </span>
  );
}

const navLink = "rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100";

function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3">
          <Link to="/" aria-label="ReserveHub home"><Logo /></Link>
          <nav aria-label="Main" className="order-3 flex w-full items-center gap-1 text-sm font-medium sm:order-none sm:ml-auto sm:w-auto">
            <a className={navLink} href="#about">About</a>
            <a className={navLink} href="#features">Features</a>
            <Link className={navLink} to="/docs">Documentation</Link>
          </nav>
          <Link to="/signin" className="btn btn-primary">Sign in</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:48px_48px] opacity-60 [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
            <div>
              <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-[#14213D] sm:text-6xl">
                Book a slot. If it's taken, join the line.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-slate-600">
                ReserveHub lets people reserve rooms, courts and equipment by time slot. When a slot is full, they join
                its waitlist, and the first person in line gets it automatically when someone cancels.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signin?mode=signup" className="btn btn-primary px-5 py-2.5 text-base">Create an account</Link>
                <a href="#about" className="btn px-5 py-2.5 text-base">See how it works</a>
              </div>
            </div>
            <SlotBoard />
          </div>
        </section>

        <section id="about" className="scroll-mt-20 border-t border-slate-200">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="font-display text-3xl font-bold text-[#14213D] sm:text-4xl">What ReserveHub is for</h2>
              <p className="mt-4 max-w-prose text-slate-600">
                Shared things that several people want at the same time: a meeting room, a court, a piece of equipment.
                An administrator adds each resource and its time slots. Members see what's free, book it, and queue when
                it's taken, so nobody has to keep checking for a cancellation.
              </p>
            </div>
            <ol className="divide-y divide-slate-200 border-y border-slate-200">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-5 py-6">
                  <span aria-hidden="true" className="font-display text-3xl font-bold text-indigo-700">{i + 1}</span>
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#14213D]">{s.title}</h3>
                    <p className="mt-1 max-w-md text-slate-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="font-display text-3xl font-bold text-[#14213D] sm:text-4xl">What's built in</h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="border-t-2 border-[#14213D] pt-4">
                  <dt className="font-display text-xl font-bold text-[#14213D]">{f.title}</dt>
                  <dd className="mt-2 max-w-md text-slate-600">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-[#14213D]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold text-white">See what's open</h2>
              <p className="mt-2 text-slate-300">Create an account to book a slot or join a waitlist.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/signin?mode=signup" className="btn border-white bg-white px-5 py-2.5 text-base text-[#14213D] hover:bg-slate-100">
                Create an account
              </Link>
              <Link to="/signin" className="btn border-slate-500 bg-transparent px-5 py-2.5 text-base text-white hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-slate-600">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-1">
            <a className={navLink} href="#about">About</a>
            <a className={navLink} href="#features">Features</a>
            <Link className={navLink} to="/docs">Documentation</Link>
            <Link className={navLink} to="/signin">Sign in</Link>
          </nav>
          <p>© {new Date().getFullYear()} ReserveHub</p>
        </div>
      </footer>
    </div>
  );
}

/** "/" shows the homepage to visitors and sends signed-in users to the app. */
export function HomeRoute() {
  const { session, loading } = useAuth();
  if (loading) return <p role="status" className="p-8 text-center">Loading…</p>;
  if (session) return <Navigate to="/availability" replace />;
  return <LandingPage />;
}
