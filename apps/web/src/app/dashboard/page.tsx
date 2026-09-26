import { redirect } from 'next/navigation';
import { getSession, getUserWorkspaces } from '@/lib/session';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }

  const workspaces = await getUserWorkspaces(session.userId);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-stone-900">Human Stamp</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-600">{session.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-stone-600 hover:text-stone-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Workspaces</h2>
          <Link
            href="/dashboard/workspaces/new"
            className="bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-800 text-sm"
          >
            New Workspace
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
            <p className="text-stone-600 mb-4">No workspaces yet</p>
            <Link
              href="/dashboard/workspaces/new"
              className="inline-block bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800"
            >
              Create your first workspace
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/dashboard/workspaces/${workspace.id}`}
                className="bg-white border border-stone-200 rounded-lg p-6 hover:border-stone-400 transition-colors"
              >
                <h3 className="font-semibold text-stone-900 mb-2">{workspace.name}</h3>
                <p className="text-sm text-stone-500">
                  Role: {workspace.role}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
