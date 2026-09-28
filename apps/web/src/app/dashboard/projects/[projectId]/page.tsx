import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, FileCheck, GitCompare } from 'lucide-react';

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
          receipt: true,
          _count: { select: { approvals: true } },
        },
      },
      clientSignOffs: true,
    },
  });

  if (!project) redirect('/dashboard');

  const latestVersion = project.versions[0];
  const hasReceipt = project.versions.some(v => v.receipt);
  const pendingSignOff = project.clientSignOffs.find(s => !s.usedAt);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link href={`/dashboard/clients/${project.clientId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back to {project.client.name}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">{project.client.name}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          {latestVersion && project.versions.length > 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <GitCompare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Compare Latest</p>
                    <p className="text-xs text-muted-foreground">v{latestVersion.versionNumber} vs previous</p>
                  </div>
                  <Link href={`/dashboard/projects/${projectId}/versions/${latestVersion.id}/compare/${project.versions[1]?.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {hasReceipt && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <FileCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">View Receipt</p>
                    <p className="text-xs text-muted-foreground">Cryptographic proof</p>
                  </div>
                  <Link href={`/r/${project.versions.find(v => v.receipt)?.receipt?.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {pendingSignOff && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Awaiting Sign-off</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingSignOff.versionId ? `v${project.versions.find(v => v.id === pendingSignOff.versionId)?.versionNumber}` : 'Version'} needs review
                    </p>
                  </div>
                  <Link href={`/signoff/${pendingSignOff.token}`}>
                    <Button size="sm" variant="outline">Review</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Versions Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Version History</CardTitle>
            <Link href={`/dashboard/projects/${projectId}/upload`}>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload New Version
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {project.versions.length === 0 ? (
              <div className="text-center py-12">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No versions yet</p>
                <Link href={`/dashboard/projects/${projectId}/upload`}>
                  <Button>Upload First Version</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {project.versions.map((version, idx) => {
                  const hasApprovals = version._count.approvals > 0;
                  const hasSignOff = project.clientSignOffs.some(s => s.versionId === version.id && s.usedAt);
                  const pendingVersionSignOff = project.clientSignOffs.find(s => s.versionId === version.id && !s.usedAt);
                  const hasLabel = false; // Labeled video fields not in schema yet

                  return (
                    <div key={version.id} className="flex gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-background font-semibold text-sm">
                          v{version.versionNumber}
                        </div>
                        {idx < project.versions.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{version.filename}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(version.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{version.aiClaim}</Badge>
                            {hasApprovals && (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                            {hasSignOff && (
                              <Badge variant="default" className="bg-blue-500">Client Signed</Badge>
                            )}
                            {pendingVersionSignOff && (
                              <Badge variant="default" className="bg-amber-500">Awaiting Client</Badge>
                            )}
                            {hasLabel && (
                              <Badge variant="outline">AI Label Applied</Badge>
                            )}
                          </div>
                        </div>

                        {version._count.approvals > 0 && (
                          <div className="text-sm">
                            {version.approvals.slice(0, 2).map((approval) => (
                              <p key={approval.id} className="text-muted-foreground">
                                ✓ {approval.approverName}, {approval.approverRole} at {approval.company}
                              </p>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Link href={`/dashboard/projects/${projectId}/versions/${version.id}`}>
                            <Button size="sm" variant="default">View Details</Button>
                          </Link>
                          {idx < project.versions.length - 1 && (
                            <Link href={`/dashboard/projects/${projectId}/versions/${version.id}/compare/${project.versions[idx + 1].id}`}>
                              <Button size="sm" variant="outline">
                                <GitCompare className="h-4 w-4 mr-2" />
                                Compare
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
