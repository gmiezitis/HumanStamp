import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const session = await getSession();
  
  if (!session) redirect('/auth/signin');

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      workspace: true,
      projects: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { versions: true } },
        },
      },
    },
  });

  if (!client) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href={`/dashboard/workspaces/${client.workspaceId}`} className="text-sm text-stone-600 hover:text-stone-900 mb-2 inline-block">
            ← Back to {client.workspace.name}
          </Link>
          <h1 className="text-xl font-bold text-stone-900">{client.name}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-stone-900">Projects</h2>
          <Link
            href={`/dashboard/clients/${clientId}/projects/new`}
            className="bg-stone-900 text-white px-4 py-2 rounded-md hover:bg-stone-800 text-sm"
          >
            New Project
          </Link>
        </div>

        {client.projects.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
            <p className="text-stone-600 mb-4">No projects yet</p>
            <Link
              href={`/dashboard/clients/${clientId}/projects/new`}
              className="inline-block bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800"
            >
              Create first project
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {client.projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="bg-white border border-stone-200 rounded-lg p-6 hover:border-stone-400 transition-colors"
              >
                <h3 className="font-semibold text-stone-900 mb-1">{project.name}</h3>
                <p className="text-sm text-stone-500">
                  {project._count.versions} version{project._count.versions !== 1 ? 's' : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
