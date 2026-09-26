# E2E Demo Test Script

This script walks through the 10-step agency demo scenario.

## Prerequisites

```bash
# Start services
cd apps/web
docker-compose up -d

# Run migrations
pnpm prisma:push

# Seed demo data
pnpm seed

# Start web server (terminal 1)
pnpm dev

# Start worker (terminal 2)
pnpm worker
```

## Demo Steps

### 1. Sign In
- Visit http://localhost:3000
- Request magic link with: demo@humanstamp.test
- Check console logs for magic link
- Click link to sign in

### 2. View Demo Workspace
- Should see "Demo Agency" workspace
- Client: "Euronics-like Brand"
- Project: "Autumn Campaign"
- 2 versions already seeded

### 3. Upload New Version (v3)
```bash
# Generate a test video
cd /tmp
ffmpeg -f lavfi -i color=c=red:s=1280x720:d=3 \
  -vf "drawtext=text='Version 3':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
  -c:v libx264 -preset ultrafast test-v3.mp4
```

- Upload test-v3.mp4 to project
- Set AI claim: "human"
- Wait for processing (worker scans C2PA, generates fingerprint)

### 4. View Scan Results
- Check version details
- View C2PA status: "No credentials found"
- View ffprobe metadata
- No mismatch (claim matches file)

### 5. Upload v4 with AI Content
```bash
# Simulate AI video (add metadata)
ffmpeg -f lavfi -i color=c=purple:s=1280x720:d=3 \
  -vf "drawtext=text='AI Generated':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
  -metadata encoder="Sora" \
  -c:v libx264 -preset ultrafast test-v4-ai.mp4
```

- Upload test-v4-ai.mp4
- Set AI claim: "human" (intentional mismatch)
- Worker detects mismatch
- View mismatch warning
- Acknowledge with note: "Client requested human-only workflow, but file metadata suggests AI. Confirmed with client this is acceptable."

### 6. Compare Versions
- Navigate to versions compare view
- Compare v3 and v4
- View changed time spans (should show most spans changed due to different content)

### 7. Internal Approval
- Click "Approve" on v4
- Enter:
  - Approver name: "Alice Johnson" (optional)
  - Role: "Creative Director"
  - Company: "Demo Agency"
- Submit approval
- Event logged in chain

### 8. Request Client Sign-off
- Click "Request Sign-off" for v4
- Enter client email: client@euronics.test
- Generate sign-off link
- Copy link: http://localhost:3000/signoff/[token]

### 9. Client Sign-off (no account)
- Open sign-off link in incognito window
- View project and version details
- Enter signer name: "Bob Williams"
- Select decision: "Approved"
- Add comment (optional): "Looks great, approved for campaign"
- Submit
- Sign-off recorded and logged

### 10. Generate Receipt and Export
- Navigate to v4 version page
- Click "Generate Receipt"
- View receipt page with QR card
- Verify signature (should show valid)
- Export as PDF
- Export as JSON
- View event chain head

### 11. Burn Label (Optional)
- Click "Burn Label" on v4
- Select label: "AI-generated" or "Contains AI-generated content"
- Select corner: "bottom-right"
- Duration: 5 seconds (or 0 for entire video)
- Wait for worker to process
- New labeled version (v5) created

### 12. Verify Video
- Download v4 file
- Visit http://localhost:3000/verify
- Upload the same file
- Should show "Exact Match Found"
- Click "View Receipt"

### 13. Verify Modified Copy
- Re-encode v4 with different settings:
```bash
ffmpeg -i test-v4-ai.mp4 -vf scale=640:360 -b:v 500k test-v4-modified.mp4
```
- Upload to /verify
- Should show "Fingerprint Match" with similarity score
- If segments changed, shows "Changed after approval" warning

## Expected Results

✓ All 10 demo steps complete successfully
✓ Events recorded in hash-chained log
✓ Receipt signature verifies
✓ Mismatch detection works
✓ Fingerprint matching handles re-encoded files
✓ PDF and JSON exports contain complete audit trail
✓ Legal disclaimer present on all public pages

## Verification

```bash
# Check event chain integrity
curl http://localhost:3000/api/workspaces/[workspaceId]/verify-chain

# Verify receipt signature
curl http://localhost:3000/api/receipts/[receiptId]/verify

# Check permission isolation (should fail)
# - Try to access another workspace's data with different user
```

## Clean Up

```bash
# Stop services
docker-compose down

# Clear data
rm -rf storage/
pnpm prisma:push --force-reset
```
