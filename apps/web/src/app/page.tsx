export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-stone-900 mb-4">
            Human Stamp
          </h1>
          <p className="text-xl text-stone-600 max-w-2xl mx-auto">
            When a client asks "who approved this?", you have the answer.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-stone-200">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              For EU Agencies
            </h2>
            <p className="text-stone-700 mb-6">
              Since 2 Aug 2026, EU AI Act Art. 50(4) requires deployers to disclose deepfakes. 
              Brands' legal teams increasingly ask: <em>who approved this, and how was it made?</em>
            </p>
            <p className="text-stone-700">
              Human Stamp keeps <strong>one signed record per video version</strong>: internal approvals, 
              client sign-offs, AI usage disclosure, and whether the file changed afterwards.
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-sm border border-stone-200">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              Evidence for Legal Teams
            </h2>
            <p className="text-stone-700 mb-4">
              Export a complete audit trail as PDF and signed JSON:
            </p>
            <ul className="text-stone-700 space-y-2 list-disc list-inside">
              <li>Project and version details</li>
              <li>C2PA Content Credentials (if present)</li>
              <li>Internal approvals with roles</li>
              <li>Client sign-offs with decisions</li>
              <li>Label application records</li>
              <li>Hash-chained event log</li>
            </ul>
          </div>
        </div>

        <div className="bg-stone-900 text-white p-12 rounded-lg mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-4xl mb-3">1</div>
              <h3 className="text-xl font-semibold mb-2">Record</h3>
              <p className="text-stone-300">
                Upload versions, scan for C2PA credentials and AI signals. 
                Acknowledge any mismatches between your claim and what the file says.
              </p>
            </div>
            <div>
              <div className="text-4xl mb-3">2</div>
              <h3 className="text-xl font-semibold mb-2">Approve</h3>
              <p className="text-stone-300">
                Internal reviewers stamp versions with their role and company. 
                Send sign-off links to clients—no account needed.
              </p>
            </div>
            <div>
              <div className="text-4xl mb-3">3</div>
              <h3 className="text-xl font-semibold mb-2">Deliver</h3>
              <p className="text-stone-300">
                Generate a signed receipt with QR card. Export the complete record as 
                PDF and JSON for the client's legal team.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-lg mb-16">
          <h3 className="text-lg font-bold text-amber-900 mb-3">
            What This Record Is
          </h3>
          <p className="text-amber-800">
            <strong>A signed record of claims and approvals</strong>—not proof a video is true. 
            It documents who approved what and when, and whether the file matches its record. 
            It does not certify EU compliance, detect AI on its own, or survive TikTok/Instagram re-encoding 
            (though fingerprinting helps recovery).
          </p>
        </div>

        <div className="text-center">
          <a
            href="/verify"
            className="inline-block bg-stone-900 text-white px-8 py-3 rounded-md text-lg font-semibold hover:bg-stone-800"
          >
            Verify a Video
          </a>
        </div>

        <footer className="mt-16 pt-8 border-t border-stone-200 text-center text-stone-500 text-sm">
          <p>
            <strong>Legal Disclaimer:</strong> This record documents approvals and disclosures. 
            It is not legal advice or a certification of compliance.
          </p>
        </footer>
      </div>
    </div>
  );
}
