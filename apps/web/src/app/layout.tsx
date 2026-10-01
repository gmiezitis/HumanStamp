import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HumanStamp — Ship the exact cut your client approved',
  description:
    'Client video approval and a signed final-file handoff record for agencies. Keep decisions, versions, and declared AI use together.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
