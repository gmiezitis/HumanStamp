import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, Users, CheckCircle2, Download, Eye, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <span className="text-xl font-bold">Human Stamp</span>
          </div>
          <Link href="/verify">
            <Button variant="ghost" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Verify Receipt
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        <section className="py-20 text-center">
          <Badge className="mb-4" variant="secondary">
            EU AI Act Compliance Ready
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Approved, Provable AI Video
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            When a client asks "who approved this?", you have the answer.
            Signed approval records for agencies creating AI-enhanced video.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <form action="/api/auth/demo-login" method="POST">
              <Button size="lg" className="text-lg px-8">
                <Zap className="mr-2 h-5 w-5" />
                Try the Live Demo
              </Button>
            </form>
            <Link href="/verify">
              <Button variant="outline" size="lg" className="text-lg px-8">
                <Eye className="mr-2 h-5 w-5" />
                Verify a Receipt
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold text-center mb-12">Why Agencies Choose Human Stamp</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="mb-2 text-primary">
                  <Shield className="h-8 w-8" />
                </div>
                <CardTitle>End Client Disputes</CardTitle>
                <CardDescription>
                  No more "we never approved that version" arguments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Timestamped, signed approval chain with client sign-offs.
                  Every version tracked, every approval recorded.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 text-primary">
                  <FileCheck className="h-8 w-8" />
                </div>
                <CardTitle>See Exactly What Changed</CardTitle>
                <CardDescription>
                  Spot-second precision on differences between versions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Advanced fingerprinting shows changed time spans. Compare side-by-side and
                  know exactly what was edited.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-2 text-primary">
                  <Users className="h-8 w-8" />
                </div>
                <CardTitle>EU AI Act Labelling</CardTitle>
                <CardDescription>
                  Article 50 disclosure requirements handled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Burn-in AI content labels, export signed receipts, and provide
                  verifiable proof for legal teams.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Upload & Compare Versions</h3>
                <p className="text-muted-foreground">
                  Upload video versions to your project. Compare any two versions to see
                  exactly what changed, down to the second.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Internal Approval</h3>
                <p className="text-muted-foreground">
                  Team members approve versions with their role and company.
                  All approvals are timestamped and signed.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Client Sign-off</h3>
                <p className="text-muted-foreground">
                  Send a secure link to your client. They sign off without needing an account.
                  Decision recorded permanently.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Export Verifiable Receipt</h3>
                <p className="text-muted-foreground">
                  Generate a signed receipt with QR code. Download PDF + JSON evidence pack.
                  Anyone can verify authenticity.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <Card className="border-muted-foreground/20 bg-muted/30">
            <CardHeader>
              <CardTitle>Experience the Full Workflow in Seconds</CardTitle>
              <CardDescription>
                Click "Try the Live Demo" to see a pre-populated agency workspace with:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Multiple video versions with comparisons</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Internal approvals and client sign-offs</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">AI label burned-in version</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Complete verifiable receipt</span>
                </li>
              </ul>
              <div className="mt-6">
                <form action="/api/auth/demo-login" method="POST">
                  <Button size="lg" className="w-full sm:w-auto">
                    <Zap className="mr-2 h-5 w-5" />
                    Try the Live Demo Now
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="py-16">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
              What This Record Provides
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              A cryptographically signed record of claims and approvals—documenting who approved
              what and when. This is not proof a video is authentic or true, nor does it
              certify legal compliance. It creates an auditable approval trail for your agency.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          <p>
            <strong>Legal Disclaimer:</strong> This record documents approvals and disclosures.
            It is not legal advice or a certification of compliance.
          </p>
        </div>
      </footer>
    </div>
  );
}
