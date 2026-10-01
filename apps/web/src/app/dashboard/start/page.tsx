import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, getUserWorkspaces } from '@/lib/session';
import { AgencyQuickStart } from '@/components/AgencyQuickStart';

export default async function StartPage() {
  const session = await getSession();
  if (!session) redirect('/auth/signin');
  const workspaces = await getUserWorkspaces(session.userId);
  return (
    <main className="min-h-screen bg-[#f7f8f2] px-5 py-10 sm:py-16">
      <div className="max-w-xl mx-auto">
        <Link
          href="/dashboard"
          className="text-sm text-stone-600 underline underline-offset-4"
        >
          ← Agency dashboard
        </Link>
        <p className="text-xs uppercase tracking-[0.15em] text-stone-500 mt-10">
          Your first real handoff
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3">
          Start with one cut.
        </h1>
        <p className="text-stone-600 mt-4 mb-8 leading-relaxed">
          Set up the campaign here, then upload the delivery video. Next, record
          internal approval and send the client a review link.
        </p>
        <AgencyQuickStart
          workspaces={workspaces.map(({ id, name }) => ({ id, name }))}
        />
      </div>
    </main>
  );
}
