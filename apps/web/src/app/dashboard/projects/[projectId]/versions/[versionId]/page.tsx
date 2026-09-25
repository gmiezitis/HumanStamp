import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { VersionActions } from '@/components/VersionActions';

export default async function VersionDetailPage({ 
  params 
}: { 
  params: Promise<{ projectId: string; versionId: string }> 
}) {
  const { projectId, versionId } = await params;
  const session = await getSession();
  
  if (!session) redirect('/auth/signin');

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    include: {
      project: {
        include: {
          client: { include: { workspace: true } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            select: { id: true, versionNumber: true },
          },
        },
      },
      approvals: { include: { user: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!version || version.projectId !== projectId) redirect('/dashboard');

  const olderVersions = version.project.versions.filter(
    (v) => v.versionNumber < version.versionNumber
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link 
            href={`/dashboard/projects/${projectId}`} 
            className="text-sm text-stone-600 hover:text-stone-900 mb-2 inline-block"
          >
            ← Back to {version.project.name}
          </Link>
          <h1 className="text-xl font-bold text-stone-900">
            Version {version.versionNumber}
          </h1>
          <p className="text-sm text-stone-500">{version.filename}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Version Info */}
        <section className="bg-white border border-stone-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-32 text-stone-600">AI Claim:</dt>
              <dd className="text-stone-900">{version.aiClaim}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-stone-600">C2PA:</dt>
              <dd className="text-stone-900">
                {version.c2paPresent ? 'Present' : 'Not found'}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-stone-600">Uploaded:</dt>
              <dd className="text-stone-900">{new Date(version.createdAt).toLocaleString()}</dd>
            </div>
          </dl>

          {version.mismatchAcked && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-sm font-medium text-amber-900">⚠️ Mismatch Acknowledged</p>
              <p className="text-xs text-amber-800 mt-1">{version.mismatchNote}</p>
            </div>
          )}
        </section>

        {/* Approvals */}
        <section className="bg-white border border-stone-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Approvals ({version.approvals.length})
          </h2>
          {version.approvals.length === 0 ? (
            <p className="text-sm text-stone-600">No approvals yet</p>
          ) : (
            <div className="space-y-3">
              {version.approvals.map((approval) => (
                <div key={approval.id} className="border-b border-stone-100 pb-3 last:border-0">
                  <p className="text-sm font-medium text-stone-900">
                    {approval.approverName || 'Unknown'}, {approval.approverRole}
                  </p>
                  <p className="text-xs text-stone-600">
                    {approval.company} • {new Date(approval.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Compare with older versions */}
        {olderVersions.length > 0 && (
          <section className="bg-white border border-stone-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Compare</h2>
            <div className="space-y-2">
              {olderVersions.map((oldVer) => (
                <Link
                  key={oldVer.id}
                  href={`/dashboard/projects/${projectId}/versions/${version.id}/compare/${oldVer.id}`}
                  className="block p-3 border border-stone-200 rounded hover:border-stone-400 hover:bg-stone-50"
                >
                  <span className="text-sm text-stone-900">
                    Compare with v{oldVer.versionNumber}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="bg-white border border-stone-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Actions</h2>
          <VersionActions versionId={versionId} />
        </section>
      </main>
    </div>
  );
}
