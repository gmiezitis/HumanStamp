import { redirect } from 'next/navigation';
import { getSession, getUserWorkspaces } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OnboardingTour } from '@/components/OnboardingTour';
import { 
  Shield, 
  CheckCircle2, 
  Clock, 
  FileCheck, 
  Users, 
  AlertCircle,
  Plus,
  LogOut,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

async function getDashboardMetrics(userId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: {
      memberships: {
        some: { userId },
      },
    },
    include: {
      clients: {
        include: {
          projects: {
            include: {
              versions: {
                include: {
                  approvals: true,
                  receipts: true,
                },
              },
              signOffs: true,
            },
          },
        },
      },
    },
  });

  let totalVersions = 0;
  let versionsWithApprovals = 0;
  let pendingSignOffs = 0;
  let completedSignOffs = 0;
  let receiptsReady = 0;
  const recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    projectName: string;
    clientName: string;
  }> = [];

  for (const workspace of workspaces) {
    for (const client of workspace.clients) {
      for (const project of client.projects) {
        for (const version of project.versions) {
          totalVersions++;
          if (version.approvals.length > 0) {
            versionsWithApprovals++;
            
            for (const approval of version.approvals) {
              recentActivity.push({
                type: 'approval',
                description: `${approval.approverName || 'Someone'} approved v${version.versionNumber}`,
                timestamp: approval.createdAt,
                projectName: project.name,
                clientName: client.name,
              });
            }
          }
          if (version.receipts.length > 0) {
            receiptsReady++;
            
            for (const receipt of version.receipts) {
              recentActivity.push({
                type: 'receipt',
                description: `Receipt generated for v${version.versionNumber}`,
                timestamp: receipt.createdAt,
                projectName: project.name,
                clientName: client.name,
              });
            }
          }
        }

        for (const signOff of project.signOffs) {
          if (signOff.usedAt) {
            completedSignOffs++;
            recentActivity.push({
              type: 'signoff',
              description: `${signOff.signerName || signOff.email} signed off`,
              timestamp: signOff.usedAt,
              projectName: project.name,
              clientName: client.name,
            });
          } else if (signOff.expiresAt > new Date()) {
            pendingSignOffs++;
          }
        }
      }
    }
  }

  recentActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    totalVersions,
    versionsWithApprovals,
    pendingSignOffs,
    completedSignOffs,
    receiptsReady,
    recentActivity: recentActivity.slice(0, 10),
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }

  const workspaces = await getUserWorkspaces(session.userId);
  const metrics = await getDashboardMetrics(session.userId);

  const hasData = metrics.totalVersions > 0;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour />
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <h1 className="text-xl font-bold">Human Stamp</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.email}</span>
            <form action="/api/auth/logout" method="POST">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {hasData ? (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
              <p className="text-muted-foreground">
                Overview of your approval workflow and recent activity
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Approved Versions
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.versionsWithApprovals}</div>
                  <p className="text-xs text-muted-foreground">
                    of {metrics.totalVersions} total versions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Awaiting Client Sign-off
                  </CardTitle>
                  <Clock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.pendingSignOffs}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.completedSignOffs} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Receipts Ready
                  </CardTitle>
                  <FileCheck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.receiptsReady}</div>
                  <p className="text-xs text-muted-foreground">
                    Signed and verifiable
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Workspaces
                  </CardTitle>
                  <Users className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{workspaces.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active workspaces
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest approvals, sign-offs, and receipts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics.recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {metrics.recentActivity.map((activity, i) => (
                        <div key={i} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                          <div className="mt-1">
                            {activity.type === 'approval' && (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            )}
                            {activity.type === 'signoff' && (
                              <Users className="h-5 w-5 text-blue-600" />
                            )}
                            {activity.type === 'receipt' && (
                              <FileCheck className="h-5 w-5 text-purple-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {activity.clientName} · {activity.projectName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Workspaces</CardTitle>
                  <CardDescription>
                    Select a workspace to view projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {workspaces.map((workspace) => (
                      <Link
                        key={workspace.id}
                        href={`/dashboard/workspaces/${workspace.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div>
                          <h3 className="font-medium">{workspace.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Role: {workspace.role}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    ))}
                    <Link href="/dashboard/workspaces/new">
                      <Button variant="outline" className="w-full mt-2">
                        <Plus className="mr-2 h-4 w-4" />
                        New Workspace
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Welcome to Human Stamp</h2>
              <p className="text-muted-foreground">
                Get started by creating your first workspace
              </p>
            </div>

            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>No Workspaces Yet</CardTitle>
                <CardDescription>
                  Create a workspace to manage your video approval projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/workspaces/new">
                  <Button size="lg" className="w-full">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Your First Workspace
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
