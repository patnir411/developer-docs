# GCP Deployment Architecture

## Overview

This system is designed for minimal-cost, serverless deployment on Google Cloud Platform (GCP). It uses a fully serverless architecture with pay-per-use pricing.

## Architecture Components

### 1. Cloud Functions (Serverless)

**Cost**: ~$0.40/million invocations + $0.0000025/GB-second

- **scraper-function**: Runs the web scraping
- **tracker-function**: Handles change detection
- **api-function**: Serves CLI queries (optional)

**Deployment**:
- Node.js 20 runtime
- 512MB memory (adjustable)
- 540 second timeout
- Triggered by Cloud Scheduler or HTTP

### 2. Cloud Scheduler

**Cost**: $0.10/job/month (3 jobs = $0.30/month)

- **daily-scrape**: Triggers scraper at 2 AM UTC daily
- **weekly-cleanup**: Cleanup old snapshots weekly
- **health-check**: Optional health monitoring

### 3. Cloud Storage

**Cost**: $0.020/GB/month (Standard storage)

**Buckets**:
- `gemini-docs-storage`: Scraped documentation (~100MB = $0.002/month)
- `gemini-snapshots`: Version snapshots (~500MB = $0.01/month)
- `gemini-artifacts`: Build artifacts (~50MB = $0.001/month)

### 4. Firestore

**Cost**: $0.06/100K reads, $0.18/100K writes, $0.18/GB stored

**Collections**:
- `snapshots`: Metadata for snapshots (~1MB = $0.0002/month)
- `changes`: Change records (~5MB = $0.001/month)
- `metrics`: Usage metrics (~1MB = $0.0002/month)

**Expected Usage**: ~10K reads, ~1K writes per day = $0.20/month

### 5. Cloud Build

**Cost**: 120 build-minutes/day free, then $0.003/build-minute

**Usage**: ~10 minutes/day for builds = FREE (within free tier)

### 6. Cloud Logging

**Cost**: 50 GB/month free, then $0.50/GB

**Expected**: ~1GB/month logs = FREE (within free tier)

### 7. Artifact Registry

**Cost**: $0.10/GB/month storage

**Usage**: Docker images ~500MB = $0.05/month

## Total Monthly Cost Estimate

```
Cloud Functions (daily execution)     : $0.05
Cloud Scheduler (3 jobs)              : $0.30
Cloud Storage (650MB)                 : $0.013
Firestore (operations + storage)      : $0.20
Cloud Build                           : $0.00 (free tier)
Cloud Logging                         : $0.00 (free tier)
Artifact Registry                     : $0.05
                                      --------
TOTAL                                 : ~$0.61/month
```

**With traffic/usage**: ~$1-3/month maximum

## Cost Optimization Strategies

### 1. Minimal Dependencies

- Use native Node.js APIs where possible
- Avoid heavy libraries (use `cheerio` over `puppeteer` when possible)
- Bundle only production dependencies
- Use webpack/esbuild to minimize bundle size

### 2. Efficient Caching

- Cache HTTP responses in Cloud Storage
- Use Firestore for metadata only (cheaper than Storage for small data)
- Implement ETag-based conditional requests
- Cache parsed documentation locally

### 3. Smart Execution

- Only scrape changed pages (use HEAD requests first)
- Batch operations to reduce function invocations
- Use Cloud Functions 2nd gen (cheaper, better performance)
- Implement exponential backoff to avoid rate limiting

### 4. Storage Optimization

- Compress snapshots before storing
- Use lifecycle policies to delete old snapshots (>90 days)
- Store diffs instead of full snapshots when possible
- Use Cloud Storage Nearline for old snapshots ($0.01/GB/month)

### 5. Free Tier Maximization

- Stay within Cloud Build free tier (120 min/day)
- Stay within Cloud Logging free tier (50GB/month)
- Use Cloud Run free tier for API (2M requests/month free)
- Leverage Firestore free tier (1GB storage, 50K reads/day)

## Deployment Regions

**Recommended**: `us-central1` (Iowa)
- Lowest cost for most services
- Excellent connectivity
- Part of free tier for many services

**Alternative**: `us-east1` (South Carolina)
- Similar pricing
- Good for East Coast users

## Monitoring & Alerting

### Cloud Monitoring (Free Tier)

- Function execution metrics
- Error rates and latency
- Storage usage
- Cost tracking

### Budget Alerts

```
Set budget alerts at:
- $1/month (warning)
- $5/month (critical)
- $10/month (emergency shutdown)
```

## Security

### IAM Roles (Least Privilege)

- Functions: `roles/cloudfunctions.invoker`
- Storage: `roles/storage.objectAdmin` (scoped to specific buckets)
- Firestore: `roles/datastore.user`
- Scheduler: `roles/cloudscheduler.admin`

### Secrets Management

- Use Secret Manager for API keys (if needed)
- Cost: $0.06/secret/month + $0.03/10K accesses

### VPC & Networking

- Use VPC Connector only if needed (adds ~$9/month)
- Public Cloud Functions with IAM auth (recommended, free)

## Scalability

### Current Design

- Handles: 100 pages/day scraping
- Storage: Up to 10GB documentation
- Queries: 10K/day through API

### Scale Limits

- Can scale to 1000 pages/day for ~$5/month
- Can handle 1M API queries/month in free tier
- Firestore: 1M documents = ~$0.20/month

## Disaster Recovery

### Backups

- Cloud Storage versioning enabled (free for 30 days)
- Firestore point-in-time recovery (35 days retention)
- Export snapshots to GCS weekly
- Git repository as backup of code

### Recovery Time Objective (RTO)

- Full system restore: < 30 minutes
- Data loss: < 24 hours (last snapshot)

## Migration Path

### From GitHub Actions to GCP

1. Deploy infrastructure with Terraform
2. Test Cloud Functions locally
3. Migrate GitHub Actions workflows to Cloud Scheduler
4. Update scraper to use Cloud Storage
5. Switch change tracker to Firestore
6. Monitor costs for 1 week
7. Deactivate GitHub Actions

### Rollback Plan

- Keep GitHub Actions workflows for 30 days
- Maintain dual-write to both systems for 1 week
- Can revert by re-enabling workflows

## Performance Targets

- Scrape time: < 5 minutes (all sources)
- Change detection: < 1 minute
- API response: < 100ms
- Cold start: < 2 seconds (Cloud Functions)

## Development Workflow

1. **Local Development**: Use Cloud Functions Framework
2. **Testing**: Use Firestore emulator + Storage emulator
3. **CI/CD**: Cloud Build triggers on git push
4. **Deployment**: Terraform apply (infrastructure) + Cloud Build (code)
5. **Monitoring**: Cloud Monitoring dashboards

## Cost Tracking

### Daily Cost Breakdown

```
Scheduled scrape (1x/day)    : $0.002
Change tracking (1x/day)     : $0.001
Storage operations           : $0.001
Firestore operations         : $0.007
Cloud Scheduler              : $0.010
                             --------
TOTAL DAILY                  : $0.021 (~$0.63/month)
```

### Additional Usage Costs

```
API queries (per 1K)         : $0.0004
Manual scrapes (each)        : $0.002
Snapshot exports (each)      : $0.001
```

## Free Tier Coverage

With GCP Always Free tier, you get:

- Cloud Functions: 2M invocations/month FREE
- Cloud Storage: 5GB FREE
- Firestore: 1GB storage + 50K reads/day FREE
- Cloud Build: 120 build-minutes/day FREE
- Cloud Logging: 50GB/month FREE

**Effective cost with free tier**: **~$0.30-0.50/month** for Cloud Scheduler only!

## Next Steps for GCP Deployment

1. Create GCP project
2. Enable required APIs
3. Run Terraform to provision infrastructure
4. Deploy Cloud Functions
5. Configure Cloud Scheduler
6. Test end-to-end
7. Enable monitoring & alerts
8. Monitor costs for first month
