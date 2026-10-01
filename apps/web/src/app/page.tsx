import Link from 'next/link';
import { AgencyDemo } from '@/components/AgencyDemo';

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="w-5 h-5 shrink-0"
    >
      <path
        d="m4 10 4 4 8-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="bg-[#f7f8f2] text-[#17251e] min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:block focus:p-4"
      >
        Skip to content
      </a>
      <header className="max-w-7xl mx-auto px-5 sm:px-8 py-6 flex justify-between items-center gap-4">
        <Link
          href="/"
          aria-label="HumanStamp home"
          className="flex items-center gap-3 font-semibold text-lg tracking-tight"
        >
          <span
            aria-hidden="true"
            className="grid place-items-center bg-[#17251e] text-[#d9edaa] w-9 h-9 rounded-lg text-sm"
          >
            hs.
          </span>
          HumanStamp
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-6 text-sm"
        >
          <a
            href="#example"
            className="hidden sm:block hover:underline underline-offset-4"
          >
            See how it works
          </a>
          <Link href="/auth/signin" className="hs-button hs-button-outline">
            Agency sign in <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>
      <main id="main">
        <section
          aria-labelledby="hero-title"
          className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-[1.1fr_1fr] items-center gap-12 lg:gap-16"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-6">
              The final handoff, made clear
            </p>
            <h1
              id="hero-title"
              className="text-5xl sm:text-6xl xl:text-7xl leading-[1.06] tracking-[-0.055em] font-semibold max-w-2xl"
            >
              Ship the exact cut your client approved.
            </h1>
            <p className="text-lg leading-relaxed text-[#526157] mt-7 max-w-lg">
              One final video. One clear decision. One shareable approval
              record. Stop digging through email to prove which version got the
              green light.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a href="#example" className="hs-button hs-button-dark">
                Try the approval example <span aria-hidden="true">→</span>
              </a>
              <Link href="/auth/signin" className="hs-button hs-button-outline">
                Open agency workspace
              </Link>
            </div>
            <p className="text-sm text-[#526157] mt-4">
              Try it without signing up. Clients review without an account.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#526157] mt-8">
              <span className="inline-flex gap-1.5 items-center">
                <Check /> Exact-file approval
              </span>
              <span className="inline-flex gap-1.5 items-center">
                <Check /> AI-use declaration
              </span>
              <span className="inline-flex gap-1.5 items-center">
                <Check /> PDF + signed JSON
              </span>
            </div>
          </div>
          <div className="relative lg:pl-6">
            <div className="rounded-2xl border border-[#d9dfd4] bg-white p-5 sm:p-7 shadow-[0_20px_60px_-35px_rgba(23,37,30,0.3)]">
              <div className="flex justify-between items-center text-xs mb-5">
                <span className="uppercase tracking-[0.13em] text-stone-500">
                  Final delivery record
                </span>
                <span className="bg-[#e8f0dc] text-[#345c31] rounded-full px-3 py-1.5 flex gap-1.5 items-center">
                  <Check /> Approved
                </span>
              </div>
              <div className="rounded-xl bg-[#21392d] aspect-[16/9] flex flex-col justify-between p-6 text-white overflow-hidden">
                <p className="text-xs tracking-[0.18em] uppercase text-[#d9edaa]">
                  Spring campaign / v3
                </p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl sm:text-4xl font-medium tracking-tight">
                    Ready for
                    <br />
                    the next chapter.
                  </p>
                  <a
                    href="#example"
                    aria-label="Try the sample approval"
                    className="grid place-items-center rounded-full border border-white/50 w-12 h-12 shrink-0"
                  >
                    ▶
                  </a>
                </div>
              </div>
              <h2 className="font-semibold text-lg mt-5">
                spring-campaign-v3.mp4
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Example handoff · illustrative record
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Agency approval</dt>
                  <dd className="flex items-center gap-2">
                    <Check /> Producer recorded
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-500">Client decision</dt>
                  <dd className="flex items-center gap-2">
                    <Check /> This version approved
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-3">
                  <dt className="text-stone-500">AI-use declaration</dt>
                  <dd>AI-assisted</dd>
                </div>
              </dl>
            </div>
            <p className="text-xs text-center text-[#526157] mt-5">
              A decision tied to a file—not a floating “looks good.”
            </p>
          </div>
        </section>
        <section
          aria-label="Agency benefits"
          className="border-y border-[#dce2d5] bg-[#edf1e7]"
        >
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-7 px-5 sm:px-8 py-9">
            {[
              {
                title: 'Stop the version guessing.',
                body: 'Every review and decision belongs to a specific cut. Replacements need fresh approval.',
              },
              {
                title: 'Make client decisions easy.',
                body: 'Send one review link. The client watches the file and approves or requests changes—no account needed.',
              },
              {
                title: 'Hand over a useful record.',
                body: 'Keep the file identifier, decisions, and declared AI use together. Export a PDF or signed JSON.',
              },
            ].map((item, i) => (
              <div key={item.title}>
                <p className="text-xs text-[#65775e] mb-3">0{i + 1}</p>
                <h2 className="font-semibold text-lg tracking-tight">
                  {item.title}
                </h2>
                <p className="text-sm leading-relaxed text-[#526157] mt-2 max-w-sm">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section
          id="example"
          aria-labelledby="example-title"
          className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24 scroll-mt-6"
        >
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#65775e]">
              Try it. No signup.
            </p>
            <h2
              id="example-title"
              className="text-3xl sm:text-4xl font-semibold tracking-[-0.035em] mt-4"
            >
              From “looks good” to ready to deliver.
            </h2>
            <p className="mt-4 text-[#526157] leading-relaxed">
              Take the client’s seat. Approve the sample cut, open its handoff
              record, then see what happens when the file changes.
            </p>
          </div>
          <AgencyDemo />
        </section>
        <section
          aria-labelledby="workflow-title"
          className="max-w-7xl mx-auto px-5 sm:px-8 pb-16 sm:pb-24"
        >
          <div className="border-t border-[#dce2d5] pt-12 grid lg:grid-cols-2 gap-10">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] font-semibold text-[#65775e]">
                A focused addition to your workflow
              </p>
              <h2
                id="workflow-title"
                className="text-3xl sm:text-4xl font-semibold tracking-[-0.035em] mt-4 max-w-md"
              >
                Keep your creative tools.
                <br />
                Make the final approval clear.
              </h2>
              <p className="mt-5 text-[#526157] leading-relaxed max-w-md">
                Use HumanStamp at final delivery or after a revision. It is
                built around the handoff record, not another editing suite.
              </p>
            </div>
            <ol className="space-y-7">
              {[
                {
                  title: 'Upload the delivery cut',
                  text: 'Identify the exact file and record how AI was used. No claim that an AI detector can prove its origin.',
                },
                {
                  title: 'Request the client’s decision',
                  text: 'Preview the file, approve or request changes. Email invitations, reminders, and agency notifications keep the workflow moving.',
                },
                {
                  title: 'Share the approved record',
                  text: 'Once internal and client approvals are complete, create the signed receipt and export the handoff record.',
                },
              ].map((item, i) => (
                <li key={item.title} className="flex gap-5">
                  <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full border border-[#ced8c5] text-sm">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-[#526157] mt-2">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          aria-labelledby="trust-title"
          className="max-w-7xl mx-auto px-5 sm:px-8 pb-16"
        >
          <div className="rounded-2xl border border-[#d6dece] p-6 sm:p-9 grid md:grid-cols-2 gap-8">
            <div>
              <h2 id="trust-title" className="font-semibold text-xl">
                Clear evidence. Honest limits.
              </h2>
              <p className="text-sm leading-relaxed text-[#526157] mt-3">
                HumanStamp records claims and approval decisions. A signed
                record helps check the record’s integrity; it does not prove a
                video is true, verify a reviewer’s identity, or certify legal
                compliance.
              </p>
            </div>
            <div className="space-y-4 text-sm">
              <details className="border-b border-[#d6dece] pb-4">
                <summary className="cursor-pointer font-medium">
                  Does a new version keep the old approval?
                </summary>
                <p className="mt-3 text-[#526157] leading-relaxed">
                  No. Uploads and labelled outputs are fresh drafts. Previous
                  decisions stay attached to the previous file.
                </p>
              </details>
              <details className="border-b border-[#d6dece] pb-4">
                <summary className="cursor-pointer font-medium">
                  Does it replace Frame.io or our project tool?
                </summary>
                <p className="mt-3 text-[#526157] leading-relaxed">
                  No integrations are promised. Keep your current
                  creative-review process and use HumanStamp for final-file
                  approval and the handoff record.
                </p>
              </details>
              <details>
                <summary className="cursor-pointer font-medium">
                  Does the signature survive social-media re-encoding?
                </summary>
                <p className="mt-3 text-[#526157] leading-relaxed">
                  The exact file hash changes if a platform re-encodes the
                  video. A signed approval record is tied to the original file,
                  not every transformed copy.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <div className="bg-[#17251e] rounded-2xl p-8 sm:p-12 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between text-white">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Make your next handoff unambiguous.
              </h2>
              <p className="text-[#ccd6cf] mt-3">
                Start with one final cut, one client, and one clear decision.
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="hs-button hs-button-lime shrink-0"
            >
              Open agency workspace →
            </Link>
          </div>
        </section>
      </main>
      <footer className="max-w-7xl mx-auto px-5 sm:px-8 pb-8 flex flex-col sm:flex-row justify-between gap-4 text-xs text-[#526157]">
        <p>HumanStamp · Approval records for agency video handoffs.</p>
        <Link href="/verify" className="underline underline-offset-4">
          Verify an existing file or record →
        </Link>
      </footer>
    </div>
  );
}
