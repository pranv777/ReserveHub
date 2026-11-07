import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { Logo } from "../landing/LandingPage";

const toc = [
  ["getting-started", "Getting started"],
  ["finding-slots", "Finding a slot"],
  ["booking", "Booking a slot"],
  ["waitlist", "The waitlist"],
  ["cancelling", "Cancelling a booking"],
  ["notifications", "Notifications"],
  ["admins", "For administrators"],
  ["rules", "Rules at a glance"],
  ["messages", "Common messages"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl font-bold text-[#14213D]">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const ol = "list-decimal space-y-1 pl-5";
const ul = "list-disc space-y-1 pl-5";

export function DocsPage() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="ReserveHub home"><Logo /></Link>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm font-medium">
            <Link className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100" to="/">Home</Link>
            {session ? (
              <Link to="/availability" className="btn btn-primary">Open app</Link>
            ) : (
              <Link to="/signin" className="btn btn-primary">Sign in</Link>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold text-slate-900">On this page</p>
          <ul className="mt-3 space-y-1 border-l border-slate-200">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-slate-600 hover:border-indigo-700 hover:text-indigo-700"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="max-w-2xl space-y-12">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-[#14213D]">
              ReserveHub documentation
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              How to find, book and cancel time slots, how the waitlist works, and what administrators can manage.
            </p>
          </div>

          <Section id="getting-started" title="Getting started">
            <ol className={ol}>
              <li>Choose <strong>Create an account</strong> and enter your email and a password of at least 8 characters. Type the password twice to confirm it.</li>
              <li>We email you a 6-digit code. Enter it on the next screen. The code expires after a short time; use <strong>Resend code</strong> (available 60 seconds after the last one) if it runs out.</li>
              <li>Once the code is accepted your account is ready and you are signed in.</li>
            </ol>
            <p>
              New accounts are members. Administrator access is given by whoever runs your ReserveHub; you cannot
              request it from the sign-up form.
            </p>
          </Section>

          <Section id="finding-slots" title="Finding a slot">
            <p>
              The <strong>Availability</strong> page lists upcoming time slots. Narrow the list with the filters:
            </p>
            <ul className={ul}>
              <li><strong>Location</strong> and <strong>Category</strong> must match exactly what the administrator entered, including capital letters.</li>
              <li><strong>From</strong> and <strong>Until</strong> limit the list to a date range.</li>
              <li><strong>Available only</strong> is on by default. Turn it off to also see slots that are already booked.</li>
            </ul>
            <p>
              Each slot shows a status: <em>available</em>, <em>booked</em> by someone else, or <em>confirmed</em> if
              the booking is yours.
            </p>
          </Section>

          <Section id="booking" title="Booking a slot">
            <ol className={ol}>
              <li>Open a slot with <strong>View</strong>.</li>
              <li>Choose <strong>Book this slot</strong>, then <strong>Confirm booking</strong>.</li>
              <li>The booking is confirmed straight away. It appears under <strong>My bookings</strong> and you get a notification.</li>
            </ol>
            <p>
              If someone books the slot a moment before you, you will see that it is no longer available and can join
              its waitlist instead. Clicking confirm twice, or retrying after a bad connection, never creates two bookings.
            </p>
          </Section>

          <Section id="waitlist" title="The waitlist">
            <p>
              When a slot is booked by someone else, choose <strong>Join the waitlist</strong> on its page. The line is
              first come, first served, in the order people joined.
            </p>
            <ul className={ul}>
              <li><strong>My waitlist</strong> shows your place in the queue for each slot.</li>
              <li>When the booking is cancelled, the first person waiting is booked automatically, at the same moment as the cancellation. Nobody else can grab the slot in between.</li>
              <li>If you are promoted, you get a notification and the entry shows a link to your new booking.</li>
              <li>You can leave a waitlist at any time while you are waiting, and you will lose your place in the line.</li>
              <li>People whose accounts have been disabled are skipped when someone is promoted.</li>
            </ul>
            <p>
              You cannot join the waitlist for a slot that is free (book it instead), for a slot you already hold, or
              for a slot you are already waiting for. A slot that has started can no longer be booked or joined.
            </p>
          </Section>

          <Section id="cancelling" title="Cancelling a booking">
            <p>
              Open <strong>My bookings</strong>, choose <strong>Cancel booking</strong> next to the booking, then confirm
              with <strong>Yes, cancel booking</strong>. You can cancel any time until the slot starts.
            </p>
            <p>
              A cancelled booking cannot be restored. If the slot is still free you can book it again. If people are
              waiting, the first in line gets it automatically.
            </p>
          </Section>

          <Section id="notifications" title="Notifications">
            <p>You are told in the app when:</p>
            <ul className={ul}>
              <li>a booking is confirmed,</li>
              <li>a booking is cancelled, and</li>
              <li>you move off the waitlist into a booking.</li>
            </ul>
            <p>
              Notifications are shown on the <strong>Notifications</strong> page, and the menu shows how many are
              unread. The page refreshes every 20 to 30 seconds. Use <strong>Mark as read</strong> to clear one.
              ReserveHub does not email you about bookings; the only emails it sends are sign-up verification codes.
            </p>
            <p>All times appear in your own time zone.</p>
          </Section>

          <Section id="admins" title="For administrators">
            <p>
              Administrators see two extra pages in the menu.
            </p>
            <h3 className="pt-2 font-semibold text-slate-900">Manage resources</h3>
            <ul className={ul}>
              <li><strong>Create or edit a resource.</strong> A name is required (up to 120 characters). Location, category and description are optional. Capacity must be a whole number from 1 to 10,000; it is for information only, because each slot can still be booked by one person.</li>
              <li><strong>Add a slot.</strong> The start must be in the future, the end must be after the start, and a slot can last at most 24 hours. Slots of the same resource cannot overlap, although back-to-back slots are fine.</li>
              <li><strong>Deactivate a resource.</strong> It can no longer be booked and its slots disappear from the availability list. Existing bookings and history are kept.</li>
            </ul>
            <h3 className="pt-2 font-semibold text-slate-900">Bookings &amp; audit</h3>
            <ul className={ul}>
              <li><strong>All bookings</strong> lists every booking with the member's email, and can be filtered by status.</li>
              <li><strong>Audit events</strong> is a timeline of changes such as bookings created, cancelled and promoted from the waitlist. Filter it by event type, for example <code className="rounded bg-slate-100 px-1">booking.created</code>. Events with no person behind them, such as an automatic promotion, show the actor as "system".</li>
            </ul>
          </Section>

          <Section id="rules" title="Rules at a glance">
            <ul className={ul}>
              <li>Each slot has at most one confirmed booking.</li>
              <li>Slots last up to 24 hours and never overlap within a resource.</li>
              <li>Bookings and waitlist entries are only possible before a slot starts.</li>
              <li>Cancellation is allowed until the slot starts.</li>
              <li>The waitlist order is the order people joined.</li>
              <li>Times are stored in UTC and shown in your local time zone.</li>
            </ul>
          </Section>

          <Section id="messages" title="Common messages">
            <dl className="divide-y divide-slate-200 border-y border-slate-200">
              {[
                ["This slot is no longer available.", "Someone else booked it first. Join the waitlist from the slot page."],
                ["This slot is available; book it directly instead.", "You tried to join the waitlist for a free slot."],
                ["You are already on the waitlist for this slot.", "You already have a place in line. Check My waitlist."],
                ["You already hold this slot.", "The slot is already booked by you."],
                ["Bookings cannot be cancelled after the slot has started.", "Cancellation closes when the slot begins."],
                ["Token has expired or is invalid", "The sign-up code is wrong or too old. Request a new one with Resend code."],
                ["Cannot reach the server.", "Check your connection and try again."],
              ].map(([message, meaning]) => (
                <div key={message} className="py-3">
                  <dt className="font-medium text-slate-900">{message}</dt>
                  <dd className="mt-1 text-slate-600">{meaning}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </main>
      </div>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-600">© {new Date().getFullYear()} ReserveHub</div>
      </footer>
    </div>
  );
}
