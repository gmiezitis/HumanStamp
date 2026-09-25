import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { UploadVersionForm } from '@/components/UploadVersionForm';

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getSession();
  
  if (!session) redirect('/auth/signin');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { include: { workspace: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: {
          approvals: { include: { user: true } },
          _count: { select: { approvals: true } },
        },
      },
    },
  });

  if (!project) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href={`/dashboard/clients/${project.clientId}`} className="text-sm text-stone-600 hover:text-stone-900 mb-2 inline-block">
            ← Back to {project.client.name}
          </Link>
          <h1 className="text-xl font-bold text-stone-900">{project.name}</h1>
          <p className="text-sm text-stone-500">{project.client.name}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-4">Upload Version</h2>
          <UploadVersionForm projectId={projectId} />
        </section>

        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-4">Versions</h2>
          {project.versions.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
              <p className="text-stone-600">No versions yet. Upload the first version above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {project.versions.map((version) => (
                <div key={version.id} className="bg-white border border-stone-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-stone-900">v{version.versionNumber}</h3>
                      <p className="text-sm text-stone-600 font-mono">{version.filename}</p>
                      <p className="text-xs text-stone-500 mt-1">{new Date(version.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="text-xs bg-stone-100 px-2 py-1 rounded">{version.aiClaim}</span>
                  </div>

                  {version.c2paPresent && (
                    <div className="mb-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                      ✓ C2PA credentials found
                    </div>
                  )}

                  {version.mismatchAcked && (
                    <div className="mb-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚠️ Mismatch acknowledged: {version.mismatchNote}
                    </div>
                  )}

                  {version._count.approvals > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-green-700 mb-1">
                        ✓ {version._count.approvals} approval{version._count.approvals > 1 ? 's' : ''}
                      </p>
                      {version.approvals.slice(0, 2).map((approval) => (
                        <p key={approval.id} className="text-xs text-stone-600">
                          {approval.approverName && `${approval.approverName}, `}
                          {approval.approverRole} at {approval.company}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/projects/${projectId}/versions/${version.id}`}
                      className="text-sm bg-stone-900 text-white px-3 py-1.5 rounded hover:bg-stone-800"
                    >
                      View Details & Actions
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
