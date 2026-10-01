'use client';

import { useReducer } from 'react';
import Link from 'next/link';
import { WorkflowBadge } from './WorkflowBadge';
import {
  demoReducer,
  demoRecord,
  demoStatus,
  initialDemoState,
} from '@/lib/agency-demo';

export function AgencyDemo() {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  const status = demoStatus(state);
  const download = () => {
    const record = demoRecord(state);
    if (!record) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'humanstamp-example-record.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-12 items-start">
      <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 justify-between p-5 border-b border-stone-100">
          <div>
            <p className="font-semibold">Spring campaign</p>
            <p className="text-sm text-stone-500 mt-1">
              Client view · example only
            </p>
          </div>
          <WorkflowBadge status={status} />
        </div>
        <video
          controls
          playsInline
          preload="metadata"
          src="/demo/agency-cut.mp4"
          poster="/demo/agency-cut-poster.png"
          aria-label="Play the original HumanStamp sample video"
          className="w-full aspect-video bg-stone-950"
        />
        <div className="p-5 sm:p-7 space-y-5">
          <div>
            <p className="font-medium break-all">
              spring-campaign-v{state.version}.mp4
            </p>
            <p className="text-sm text-stone-500 mt-1">
              {state.internalApproved
                ? 'Internal approval recorded · example producer'
                : 'New file · fresh internal and client approvals required'}
            </p>
          </div>
          {!state.requested ? (
            <button
              type="button"
              className="hs-button hs-button-dark w-full"
              onClick={() => dispatch('request-review')}
            >
              Start a fresh review
            </button>
          ) : !state.decision ? (
            <fieldset>
              <legend className="text-sm font-medium mb-3">
                Try making the client decision
              </legend>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => dispatch('approve')}
                  className="hs-button hs-button-dark flex-1"
                >
                  Approve this cut
                </button>
                <button
                  type="button"
                  onClick={() => dispatch('request-changes')}
                  className="hs-button hs-button-outline flex-1"
                >
                  Request changes
                </button>
              </div>
            </fieldset>
          ) : (
            <div role="status" className="bg-stone-50 rounded-xl p-4">
              <p className="font-semibold">
                {state.decision === 'approved'
                  ? 'Client approval recorded'
                  : 'Changes requested'}
              </p>
              <p className="text-sm text-stone-600 mt-1">
                {state.decision === 'approved'
                  ? 'The handoff record belongs to this exact version.'
                  : 'The file is not ready for handoff. A revised cut needs a fresh review.'}
              </p>
            </div>
          )}
          <p className="text-xs text-stone-500">
            Illustrative decisions only. No account, email, or customer file is
            used. The sample video is the same in each simulated version.
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="rounded-2xl bg-[#17251e] text-white p-7 sm:p-8"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[#b3c5b9]">
            Agency handoff
          </p>
          <h3 className="text-2xl font-semibold mt-4">
            {state.recordOpen
              ? 'A record you can hand over.'
              : status === 'approved'
                ? 'Now you know what to ship.'
                : status === 'changes-requested'
                  ? 'The revision is not approved.'
                  : status === 'draft'
                    ? 'New cut. New approval.'
                    : 'No more “approved which version?”'}
          </h3>
          <p className="text-[#ccd6cf] mt-4 leading-relaxed">
            {state.recordOpen
              ? 'The final file, the agency approval, the client decision, and the declared AI use—all in one record.'
              : status === 'approved'
                ? 'Agency and client have approved this cut. Open its handoff record, then try replacing it.'
                : status === 'draft'
                  ? 'Earlier decisions stay with the old file. This replacement cannot quietly inherit a green light.'
                  : status === 'changes-requested'
                    ? 'A changes request keeps this cut out of final approval. Upload the revision and ask again.'
                    : 'Play the sample and make a client decision. See how the agency’s delivery status changes.'}
          </p>
          {state.recordOpen && (
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-t border-white/20 pt-3">
                <dt className="text-[#b3c5b9]">File</dt>
                <dd className="break-all text-right">
                  spring-campaign-v{state.version}.mp4
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#b3c5b9]">Client decision</dt>
                <dd>Approved</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#b3c5b9]">AI declaration</dt>
                <dd>AI-assisted</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#b3c5b9]">Record</dt>
                <dd>Unsigned example</dd>
              </div>
            </dl>
          )}
          {status === 'approved' && (
            <button
              type="button"
              className="hs-button hs-button-lime w-full mt-6"
              onClick={() =>
                state.recordOpen ? download() : dispatch('open-record')
              }
            >
              {state.recordOpen
                ? 'Download example record'
                : 'Open handoff record'}
            </button>
          )}
          {state.decision && (
            <button
              type="button"
              className="mt-4 underline text-sm underline-offset-4 text-[#ccd6cf]"
              onClick={() => dispatch('replace')}
            >
              Try a replacement cut →
            </button>
          )}
        </div>
        <div className="px-1">
          <h3 className="font-semibold">Bring this into your next handoff.</h3>
          <p className="text-stone-600 text-sm leading-relaxed mt-2">
            Use your own final video, request approval, and share the signed
            record. Keep your existing creative-review tools.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block mt-4 font-semibold underline underline-offset-4"
          >
            Open agency workspace →
          </Link>
          <button
            type="button"
            onClick={() => dispatch('reset')}
            className="block mt-5 text-sm text-stone-500 underline underline-offset-4"
          >
            Reset example
          </button>
        </div>
      </div>
    </div>
  );
}
