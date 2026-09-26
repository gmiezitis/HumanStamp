# Human Stamp Agency Demo - Deployment Guide

This guide explains how to deploy the Human Stamp agency demo to production in under 30 minutes.

## Prerequisites

- Docker and Docker Compose installed
- A server with at least 2GB RAM (Railway, Fly.io, Render, or any VPS)
- PostgreSQL database (can use Docker Compose or managed service)
- S3-compatible storage (optional, for production; local disk works for testing)
- SMTP server or Resend account (optional, for email magic links)

## Required Environment Variables

### Core Configuration

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Base URL (for magic links and sign-off URLs)
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"

# Session secret (generate with: openssl rand -hex 32)
JWT_SECRET="your-secret-key-here"
```

### Signing Keys (Required for Production)

Generate production signing keys:

```bash
cd packages/core
node -e "
const { generateKeyPair } = require('./dist/index.js');
generateKeyPair().then(keys => {
  console.log('SIGNING_PRIVATE_KEY=' + keys.privateKey);
  console.log('SIGNING_PUBLIC_KEY=' + keys.publicKey);
});
"
```

Add to your environment:

```bash
SIGNING_PRIVATE_KEY="your-private-key-hex"
SIGNING_PUBLIC_KEY="your-public-key-hex"
```

### Storage Configuration

#### Option 1: Local Disk (Development/Testing)

```bash
STORAGE_TYPE="local"
STORAGE_LOCAL_PATH="/app/storage"
```

#### Option 2: S3-Compatible Storage (Recommended for Production)

Use Cloudflare R2, AWS S3, or any S3-compatible service:

```bash
STORAGE_TYPE="s3"
S3_BUCKET="your-bucket-name"
S3_REGION="auto"  # or your region
S3_ENDPOINT="https://your-account.r2.cloudflarestorage.com"  # optional, for R2
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
```

### Email Configuration (Optional)

#### Option 1: Console Logging (Development)

No configuration needed. Magic links will be logged to the console.

#### Option 2: SMTP (Production)

```bash
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"  # true for port 465
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@yourdomain.com"
```

#### Option 3: Resend (Recommended)

Use [Resend](https://resend.com) for reliable email delivery:

```bash
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="resend"
SMTP_PASS="your-resend-api-key"
SMTP_FROM="noreply@yourdomain.com"
```

## Deployment Methods

### Option 1: Docker Compose (Simplest)

1. Clone the repository
2. Create a `.env` file with the required variables
3. Run:

```bash
cd apps/web
docker-compose up -d
```

4. The app will be available at http://localhost:3000

To seed demo data:

```bash
docker-compose exec web pnpm seed
```

### Option 2: Railway

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database service
3. Add the web app service:
   - Connect your GitHub repository
   - Set root directory to `/`
   - Build command: `cd apps/web && pnpm install && pnpm build`
   - Start command: `cd apps/web && pnpm start`
4. Add a worker service:
   - Same repository and build
   - Start command: `cd apps/web && pnpm worker`
5. Add all environment variables to both services
6. Deploy

### Option 3: Fly.io

1. Install the Fly CLI
2. Create `fly.toml`:

```toml
app = "humanstamp"

[build]
  dockerfile = "apps/web/Dockerfile"

[env]
  PORT = "3000"
  NODE_ENV = "production"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

3. Create and attach a Postgres database:

```bash
fly postgres create
fly postgres attach <db-name>
```

4. Set secrets:

```bash
fly secrets set JWT_SECRET="..." SIGNING_PRIVATE_KEY="..." SIGNING_PUBLIC_KEY="..."
```

5. Deploy:

```bash
fly deploy
```

6. Deploy worker as a separate app with the same database attachment

### Option 4: Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your repository
3. Configure:
   - Build command: `cd apps/web && pnpm install && pnpm build`
   - Start command: `cd apps/web && pnpm start`
4. Add a PostgreSQL database
5. Add a Background Worker service:
   - Same repository
   - Start command: `cd apps/web && pnpm worker`
6. Add environment variables
7. Deploy

## Post-Deployment Setup

### 1. Run Database Migrations

```bash
# If using Docker Compose
docker-compose exec web pnpm prisma:push

# If using Railway/Fly/Render, migrations run automatically on first deploy
# or use the CLI to run them manually
```

### 2. Seed Demo Data (Optional)

```bash
# If using Docker Compose
docker-compose exec web pnpm seed

# If using other platforms, run via SSH or exec into the container
```

### 3. Verify Deployment

1. Visit your app URL
2. Try signing in with your email
3. Check that the magic link arrives (or appears in logs)
4. Create a workspace and test the workflow

## Monitoring

### Logs

```bash
# Docker Compose
docker-compose logs -f web
docker-compose logs -f worker

# Railway
railway logs

# Fly.io
fly logs

# Render
Check the Render dashboard
```

### Health Checks

Add a health check endpoint:

```bash
curl https://yourdomain.com/api/health
```

## Troubleshooting

### Database Connection Issues

- Ensure `DATABASE_URL` is correctly formatted
- Check that the database is accessible from your app
- Verify Prisma migrations have run

### Storage Issues

- For local storage, ensure the volume is mounted correctly
- For S3, verify credentials and bucket permissions
- Test with a small video upload

### Email Delivery Issues

- Check SMTP credentials
- Verify SMTP_FROM is authorized to send
- Look for errors in application logs

### Worker Not Processing Jobs

- Ensure the worker process is running
- Check worker logs for errors
- Verify DATABASE_URL is set for the worker

## Security Notes

1. **Never commit secrets to Git**
2. Use strong, randomly generated values for `JWT_SECRET`
3. Rotate signing keys periodically
4. Use HTTPS in production (Let's Encrypt via Caddy/Traefik or platform SSL)
5. Restrict S3 bucket access to your application only
6. Set up database backups

## Scaling

- **Web service**: Can scale horizontally (multiple instances)
- **Worker service**: Can scale horizontally (multiple worker processes)
- **Database**: Use connection pooling (e.g., PgBouncer) for high traffic
- **Storage**: S3 scales automatically

## Cost Estimates

- **Railway**: ~$5-20/month (includes Postgres and 2 services)
- **Fly.io**: ~$10-30/month (includes Postgres and 2 apps)
- **Render**: ~$7-25/month (includes Postgres and 2 services)
- **Cloudflare R2**: First 10GB free, then ~$0.015/GB/month
- **Resend**: 3,000 emails/month free, then $10/month

## Support

If you encounter issues, check:

1. Application logs
2. Database connectivity
3. Environment variables are set correctly
4. Prisma client is generated
5. Storage permissions
