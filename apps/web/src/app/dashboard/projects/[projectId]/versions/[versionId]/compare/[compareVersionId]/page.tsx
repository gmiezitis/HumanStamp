import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function CompareVersionsPage({ 
  params 
}: { 
  params: Promise<{ projectId: string; versionId: string; compareVersionId: string }> 
}) {
  const { projectId, versionId, compareVersionId } = await params;
  const session = await getSession();
  
  if (!session) redirect('/auth/signin');

  const [version1, version2] = await Promise.all([
    prisma.version.findUnique({
      where: { id: versionId },
      include: { project: true },
    }),
    prisma.version.findUnique({
      where: { id: compareVersionId },
    }),
  ]);

  if (!version1 || !version2 || version1.projectId !== projectId || version2.projectId !== projectId) {
    redirect('/dashboard');
  }

  // Get comparison data if fingerprints exist
  let comparisonData: any = null;
  if (version1.fingerprint && version2.fingerprint) {
    try {
      const fp1 = JSON.parse(version1.fingerprint);
      const fp2 = JSON.parse(version2.fingerprint);
      
      // Calculate similarity locally (importing would require moving the function)
      // For now, just show that they're different
      comparisonData = {
        changedSpans: [], // Would calculate from fingerprints
        overallSimilarity: 0.85, // Placeholder
      };
    } catch (e) {
      console.error('Error parsing fingerprints:', e);
    }
  }

  const hasMismatch = version1.aiClaim !== version2.aiClaim || 
                      version1.c2paPresent !== version2.c2paPresent;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link 
            href={`/dashboard/projects/${projectId}/versions/${versionId}`} 
            className="text-sm text-stone-600 hover:text-stone-900 mb-2 inline-block"
          >
            ← Back to Version {version1.versionNumber}
          </Link>
          <h1 className="text-xl font-bold text-stone-900">
            Compare Versions
          </h1>
          <p className="text-sm text-stone-500">
            v{version1.versionNumber} vs v{version2.versionNumber}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Mismatch Warning */}
        {hasMismatch && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              ⚠️ Claim or Metadata Mismatch Detected
            </h3>
            <div className="space-y-2 text-sm text-amber-800">
              {version1.aiClaim !== version2.aiClaim && (
                <p>• AI claim changed: {version2.aiClaim} → {version1.aiClaim}</p>
              )}
              {version1.c2paPresent !== version2.c2paPresent && (
                <p>• C2PA presence changed: {version2.c2paPresent ? 'Yes' : 'No'} → {version1.c2paPresent ? 'Yes' : 'No'}</p>
              )}
            </div>
          </div>
        )}

        {/* Version Comparison Table */}
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 border-b border-stone-200">
              <tr>
                <th className="text-left p-4 font-semibold text-stone-700">Property</th>
                <th className="text-left p-4 font-semibold text-stone-700">v{version2.versionNumber}</th>
                <th className="text-left p-4 font-semibold text-stone-700">v{version1.versionNumber}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="p-4 text-stone-600">Filename</td>
                <td className="p-4 font-mono text-xs">{version2.filename}</td>
                <td className="p-4 font-mono text-xs">{version1.filename}</td>
              </tr>
              <tr>
                <td className="p-4 text-stone-600">AI Claim</td>
                <td className="p-4">{version2.aiClaim}</td>
                <td className="p-4">{version1.aiClaim}</td>
              </tr>
              <tr>
                <td className="p-4 text-stone-600">C2PA</td>
                <td className="p-4">{version2.c2paPresent ? 'Present' : 'Not found'}</td>
                <td className="p-4">{version1.c2paPresent ? 'Present' : 'Not found'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Changed Spans */}
        {comparisonData?.changedSpans && comparisonData.changedSpans.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">
              Changed Time Spans
            </h3>
            <div className="space-y-2">
              {comparisonData.changedSpans.map((span: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
                  <span className="text-red-600 font-bold">⚠</span>
                  <span className="text-sm text-stone-900">
                    {span.start.toFixed(1)}s - {span.end.toFixed(1)}s
                  </span>
                </div>
              ))}
            </div>
            {comparisonData.overallSimilarity && (
              <p className="mt-4 text-sm text-stone-600">
                Overall similarity: {(comparisonData.overallSimilarity * 100).toFixed(1)}%
              </p>
            )}
          </div>
        )}

        {!version1.mismatchAcked && hasMismatch && (
          <form 
            action={`/api/versions/${versionId}/acknowledge-mismatch`}
            method="POST"
            className="bg-white border border-stone-200 rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold text-stone-900 mb-3">
              Acknowledge Mismatch
            </h3>
            <p className="text-sm text-stone-600 mb-4">
              The claim or metadata for this version doesn't match the previous version.
              Please acknowledge this discrepancy to proceed.
            </p>
            <button
              type="submit"
              className="bg-amber-700 text-white px-6 py-2 rounded hover:bg-amber-800"
            >
              I Acknowledge the Mismatch
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
