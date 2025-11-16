# GCP Deployment Guide

Complete guide to deploying the Gemini Documentation Tracker on Google Cloud Platform.

## Prerequisites

- Google Cloud account
- gcloud CLI installed and configured
- Terraform installed (v1.0+)
- Node.js 20+ installed locally

## Step 1: Set Up GCP Project

### Create a New Project

```bash
# Set your project ID (must be globally unique)
export PROJECT_ID="gemini-docs-tracker-$(date +%s)"
export REGION="us-central1"
export BILLING_ACCOUNT_ID="your-billing-account-id"

# Create project
gcloud projects create $PROJECT_ID --name="Gemini Docs Tracker"

# Set as default project
gcloud config set project $PROJECT_ID

# Link billing account
gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID
```

### Enable Required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  artifactregistry.googleapis.com
```

## Step 2: Configure Firestore

```bash
# Create Firestore database in Native mode
gcloud firestore databases create \
  --location=us-central \
  --type=firestore-native
```

## Step 3: Set Up Terraform State Backend

```bash
# Create bucket for Terraform state
gsutil mb -p $PROJECT_ID -l $REGION gs://$PROJECT_ID-terraform-state

# Enable versioning
gsutil versioning set on gs://$PROJECT_ID-terraform-state
```

## Step 4: Configure Terraform Variables

Create `infrastructure/terraform/terraform.tfvars`:

```hcl
project_id          = "your-project-id"
region              = "us-central1"
firestore_location  = "us-central"
notification_email  = "your-email@example.com"
billing_account_id  = "your-billing-account-id"
deployment_version  = "1.0.0"
environment         = "prod"
```

## Step 5: Deploy Infrastructure with Terraform

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review the execution plan
terraform plan

# Apply the infrastructure
terraform apply

# Save outputs
terraform output > outputs.txt
```

## Step 6: Build and Deploy Cloud Functions

### Build Scraper Function

```bash
cd cloud-functions/scraper

# Install dependencies
npm install --production

# Create deployment package
zip -r deploy.zip . -x "*.git*" -x "node_modules/.cache/*"

# Copy to source bucket
SOURCE_BUCKET="${PROJECT_ID}-function-source"
gsutil cp deploy.zip gs://$SOURCE_BUCKET/source/scraper-1.0.0.zip
```

### Deploy Manually (Alternative to Terraform)

```bash
gcloud functions deploy gemini-docs-scraper \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=. \
  --entry-point=scrapeHandler \
  --trigger-http \
  --service-account=gemini-docs-scraper@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="DOCS_BUCKET=${PROJECT_ID}-gemini-docs,PROJECT_ID=${PROJECT_ID}" \
  --memory=512Mi \
  --timeout=540s \
  --max-instances=1
```

## Step 7: Test the Deployment

### Test Scraper Function

```bash
# Get function URL
SCRAPER_URL=$(gcloud functions describe gemini-docs-scraper \
  --gen2 \
  --region=$REGION \
  --format='value(serviceConfig.uri)')

# Invoke function
curl -X POST $SCRAPER_URL \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"source": "gemini"}'
```

### Verify Storage

```bash
# List scraped documents
gsutil ls gs://${PROJECT_ID}-gemini-docs/

# Check Firestore
gcloud firestore export gs://${PROJECT_ID}-gemini-snapshots/firestore-backup/
```

## Step 8: Configure Cloud Scheduler

### Manual Setup (if not using Terraform)

```bash
# Daily scrape job
gcloud scheduler jobs create http daily-gemini-scrape \
  --location=$REGION \
  --schedule="0 2 * * *" \
  --uri=$SCRAPER_URL \
  --http-method=POST \
  --message-body='{"source":"all"}' \
  --oidc-service-account-email=gemini-docs-scraper@$PROJECT_ID.iam.gserviceaccount.com \
  --time-zone="UTC"

# Test the job
gcloud scheduler jobs run daily-gemini-scrape --location=$REGION
```

## Step 9: Set Up Monitoring

### Create Dashboard

```bash
# Create monitoring dashboard
gcloud monitoring dashboards create --config-from-file=- <<EOF
{
  "displayName": "Gemini Docs Tracker",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Function Execution Count",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_function\" resource.labels.function_name=\"gemini-docs-scraper\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        }
      }
    ]
  }
}
EOF
```

### Set Up Alerts

Already configured in Terraform, but you can view them:

```bash
gcloud alpha monitoring policies list
```

## Step 10: Verify End-to-End

### Check Logs

```bash
# View scraper logs
gcloud functions logs read gemini-docs-scraper \
  --gen2 \
  --region=$REGION \
  --limit=50

# View scheduler logs
gcloud scheduler jobs describe daily-gemini-scrape \
  --location=$REGION
```

### Check Costs

```bash
# View current billing
gcloud billing accounts list

# Check budget
gcloud billing budgets list --billing-account=$BILLING_ACCOUNT_ID
```

## Maintenance

### Update Function Code

```bash
cd cloud-functions/scraper

# Make changes
# ...

# Redeploy
gcloud functions deploy gemini-docs-scraper \
  --gen2 \
  --region=$REGION \
  --source=.
```

### View Documentation

```bash
# List all scraped docs
gsutil ls -r gs://${PROJECT_ID}-gemini-docs/ | head -20

# Download a document
gsutil cp gs://${PROJECT_ID}-gemini-docs/gemini/_gemini-api_docs.json ./
cat _gemini-api_docs.json | jq .
```

### Cleanup Old Snapshots

```bash
# List old snapshots
gsutil ls gs://${PROJECT_ID}-gemini-snapshots/

# Delete snapshots older than 90 days (lifecycle policy does this automatically)
# Manual deletion if needed:
gsutil -m rm -r gs://${PROJECT_ID}-gemini-snapshots/$(date -d '90 days ago' +%Y%m%d)*
```

## Troubleshooting

### Function Not Executing

```bash
# Check IAM permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:gemini-docs-scraper"

# Check function status
gcloud functions describe gemini-docs-scraper --gen2 --region=$REGION
```

### High Costs

```bash
# Check function invocations
gcloud logging read "resource.type=cloud_function resource.labels.function_name=gemini-docs-scraper" \
  --limit=100 \
  --format="table(timestamp, severity, textPayload)"

# Reduce scraping frequency
gcloud scheduler jobs update http daily-gemini-scrape \
  --location=$REGION \
  --schedule="0 2 * * 0"  # Weekly instead of daily
```

### Firestore Quota Exceeded

```bash
# Check Firestore usage
gcloud firestore operations list

# Increase quotas (requires billing)
# Go to: https://console.cloud.google.com/apis/api/firestore.googleapis.com/quotas
```

## Cost Optimization Tips

1. **Use Cloud Functions 2nd Gen**: Better performance, lower cost
2. **Minimize dependencies**: Smaller bundle = faster cold starts
3. **Enable caching**: Reduce redundant scrapes
4. **Use lifecycle policies**: Auto-delete old data
5. **Monitor regularly**: Set up budget alerts
6. **Use Spot/Preemptible**: For non-critical batch jobs (if using VMs)
7. **Compress data**: Use gzip for storage

## Security Best Practices

1. **Use service accounts**: Least privilege principle
2. **Enable audit logging**: Track all access
3. **Use VPC**: For private communication (if needed)
4. **Rotate secrets**: Use Secret Manager, rotate regularly
5. **Enable DDoS protection**: Use Cloud Armor (if exposing APIs)
6. **Review IAM**: Regular audits of permissions

## Backup & Disaster Recovery

### Backup Firestore

```bash
# Export Firestore
gcloud firestore export gs://${PROJECT_ID}-gemini-snapshots/firestore-backup/$(date +%Y%m%d)
```

### Backup Cloud Storage

```bash
# Enable versioning (already done)
gsutil versioning get gs://${PROJECT_ID}-gemini-docs

# Create snapshot
gsutil -m rsync -r gs://${PROJECT_ID}-gemini-docs/ gs://${PROJECT_ID}-gemini-snapshots/backup-$(date +%Y%m%d)/
```

## Monitoring Costs

### View Current Spend

```bash
# Via CLI
gcloud billing projects describe $PROJECT_ID

# Via API (requires jq)
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://cloudbilling.googleapis.com/v1/projects/${PROJECT_ID}/billingInfo" | jq .
```

### Set Up Cost Alerts

Already configured in Terraform at:
- 50% of budget
- 80% of budget
- 100% of budget
- 120% of forecasted spend

## Next Steps

1. Test the system end-to-end
2. Monitor costs for first week
3. Adjust scraping frequency as needed
4. Set up additional data sources
5. Configure custom alerts
6. Integrate with your CI/CD pipeline
7. Add custom analytics

## Support

- **GCP Issues**: https://cloud.google.com/support
- **Project Issues**: GitHub Issues
- **Documentation**: `docs/` directory
