import { redirect } from 'next/navigation';
import { getSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Users, ChevronRight } from 'lucide-react';

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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{workspace.name}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Clients</h2>
            <p className="text-sm text-muted-foreground">Manage your client accounts</p>
          </div>
          <Link href={`/dashboard/workspaces/${workspaceId}/clients/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </Link>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Clients Yet</CardTitle>
              <CardDescription>Create your first client to start managing projects</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/dashboard/workspaces/${workspaceId}/clients/new`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Client
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Link key={client.id} href={`/dashboard/clients/${client.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{client.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {client._count.projects} project{client._count.projects !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
