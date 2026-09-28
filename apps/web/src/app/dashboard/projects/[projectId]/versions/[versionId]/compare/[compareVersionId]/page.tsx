import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { compareVersionFingerprints, type VideoFingerprint } from '@/lib/segment-fingerprint';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertCircle, Shield, FileCheck, TrendingUp } from 'lucide-react';

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
      include: { project: { include: { client: true } } },
    }),
    prisma.version.findUnique({
      where: { id: compareVersionId },
    }),
  ]);

  if (!version1 || !version2 || version1.projectId !== projectId || version2.projectId !== projectId) {
    redirect('/dashboard');
  }

  let comparisonData: any = null;
  if (version1.fingerprint && version2.fingerprint) {
    try {
      const fp1: VideoFingerprint = JSON.parse(version1.fingerprint);
      const fp2: VideoFingerprint = JSON.parse(version2.fingerprint);
      
      comparisonData = compareVersionFingerprints(fp1, fp2);
    } catch (e) {
      console.error('Error parsing fingerprints:', e);
    }
  }

  const hasMismatch = version1.aiClaim !== version2.aiClaim || 
                      version1.c2paPresent !== version2.c2paPresent;

  const duration = version1.duration || 8;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link 
            href={`/dashboard/projects/${projectId}/versions/${versionId}`}
          >
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Version {version1.versionNumber}
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Compare Versions</h1>
              <p className="text-sm text-muted-foreground">
                {version1.project.client.name} · {version1.project.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">v{version2.versionNumber}</Badge>
              <span className="text-muted-foreground">vs</span>
              <Badge variant="outline">v{version1.versionNumber}</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {hasMismatch && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-amber-900">
                  Claim or Metadata Mismatch Detected
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-800">
              {version1.aiClaim !== version2.aiClaim && (
                <p>• AI claim changed: {version2.aiClaim} → {version1.aiClaim}</p>
              )}
              {version1.c2paPresent !== version2.c2paPresent && (
                <p>• C2PA presence changed: {version2.c2paPresent ? 'Yes' : 'No'} → {version1.c2paPresent ? 'Yes' : 'No'}</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Version {version2.versionNumber}</span>
                <Badge variant="secondary">Base</Badge>
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {version2.filename}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI Claim:</span>
                <span className="font-medium">{version2.aiClaim}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">C2PA:</span>
                <span className="font-medium">{version2.c2paPresent ? 'Present' : 'Not found'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{version2.duration?.toFixed(1)}s</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Version {version1.versionNumber}</span>
                <Badge variant="default">Current</Badge>
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {version1.filename}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI Claim:</span>
                <span className="font-medium">{version1.aiClaim}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">C2PA:</span>
                <span className="font-medium">{version1.c2paPresent ? 'Present' : 'Not found'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{version1.duration?.toFixed(1)}s</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {comparisonData?.changedSpans && comparisonData.changedSpans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Changed Time Spans
              </CardTitle>
              <CardDescription>
                Segments that differ between the two versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-muted rounded-lg p-4 mb-4">
                <div className="relative h-12 bg-background rounded overflow-hidden">
                  {comparisonData.changedSpans.map((span: any, i: number) => {
                    const left = (span.start / duration) * 100;
                    const width = ((span.end - span.start) / duration) * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-red-500/70 hover:bg-red-500 transition-colors"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                        }}
                        title={`${span.start.toFixed(1)}s - ${span.end.toFixed(1)}s`}
                      />
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-muted-foreground pointer-events-none">
                    <span>0s</span>
                    <span>{duration.toFixed(1)}s</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Click on timeline to jump to that moment (when implemented)
                </p>
              </div>

              <div className="space-y-2">
                {comparisonData.changedSpans.map((span: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">
                        {span.start.toFixed(1)}s - {span.end.toFixed(1)}s
                      </span>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {(span.end - span.start).toFixed(1)}s changed
                    </Badge>
                  </div>
                ))}
              </div>

              {comparisonData.overallSimilarity && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Similarity:</span>
                    <span className="font-semibold">
                      {(comparisonData.overallSimilarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {comparisonData?.changedSpans && comparisonData.changedSpans.length === 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-6">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">No Changes Detected</p>
                  <p className="text-sm text-green-700">
                    These versions appear identical based on fingerprint analysis
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!version1.mismatchAcked && hasMismatch && (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle>Acknowledge Mismatch</CardTitle>
              <CardDescription>
                The claim or metadata for this version doesn't match the previous version.
                Please acknowledge this discrepancy to proceed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                action={`/api/versions/${versionId}/acknowledge-mismatch`}
                method="POST"
              >
                <Button type="submit" variant="default">
                  I Acknowledge the Mismatch
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
