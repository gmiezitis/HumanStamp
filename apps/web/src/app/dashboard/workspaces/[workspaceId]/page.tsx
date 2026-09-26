import { redirect } from 'next/navigation';
import { getSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId);
  } catch {
    redirect('/dashboard');
  }

  const [workspace, clients] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
    }),
    prisma.client.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    }),
  ]);

  if (!workspace) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900 mb-2 inline-block">
            ← Back to workspaces
          </Link>
          <h1 className="text-xl font-bold text-stone-900">{workspace.name}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Clients</h2>
          <Link
            href={`/dashboard/workspaces/${workspaceId}/clients/new`}
            className="bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-800 text-sm"
          >
            New Client
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
            <p className="text-stone-600 mb-4">No clients yet</p>
            <Link
              href={`/dashboard/workspaces/${workspaceId}/clients/new`}
              className="inline-block bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800"
            >
              Create your first client
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                className="bg-white border border-stone-200 rounded-lg p-6 hover:border-stone-400 transition-colors"
              >
                <h3 className="font-semibold text-stone-900 mb-1">{client.name}</h3>
                <p className="text-sm text-stone-500">
                  {client._count.projects} project{client._count.projects !== 1 ? 's' : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
