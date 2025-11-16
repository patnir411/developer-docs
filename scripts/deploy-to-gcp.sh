#!/bin/bash

# Gemini Documentation Tracker - GCP Deployment Script
# This script automates the deployment of the entire system to Google Cloud Platform

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."

    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    fi

    # Check terraform
    if ! command -v terraform &> /dev/null; then
        error "Terraform not found. Install from: https://www.terraform.io/downloads"
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js not found. Install Node.js 20+ from: https://nodejs.org/"
    fi

    # Check Node version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js version must be 18 or higher. Current: $(node -v)"
    fi

    success "All prerequisites met"
}

# Configuration
get_configuration() {
    info "Configuration setup..."

    # Project ID
    read -p "Enter GCP Project ID (or press Enter to create new): " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        PROJECT_ID="gemini-docs-tracker-$(date +%s)"
        info "Generated project ID: $PROJECT_ID"
    fi

    # Region
    read -p "Enter GCP region [us-central1]: " REGION
    REGION=${REGION:-us-central1}

    # Notification email
    read -p "Enter email for notifications: " NOTIFICATION_EMAIL
    if [ -z "$NOTIFICATION_EMAIL" ]; then
        error "Notification email is required"
    fi

    # Billing account
    read -p "Enter billing account ID: " BILLING_ACCOUNT_ID
    if [ -z "$BILLING_ACCOUNT_ID" ]; then
        warn "No billing account provided. You'll need to link one manually."
    fi

    # Confirm
    echo ""
    info "Configuration:"
    echo "  Project ID: $PROJECT_ID"
    echo "  Region: $REGION"
    echo "  Email: $NOTIFICATION_EMAIL"
    echo "  Billing Account: ${BILLING_ACCOUNT_ID:-Not provided}"
    echo ""
    read -p "Proceed with deployment? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        error "Deployment cancelled"
    fi
}

# Create GCP project
create_project() {
    info "Setting up GCP project..."

    # Check if project exists
    if gcloud projects describe $PROJECT_ID &> /dev/null; then
        warn "Project $PROJECT_ID already exists"
    else
        info "Creating project $PROJECT_ID..."
        gcloud projects create $PROJECT_ID --name="Gemini Docs Tracker"
        success "Project created"
    fi

    # Set as default
    gcloud config set project $PROJECT_ID

    # Link billing account
    if [ -n "$BILLING_ACCOUNT_ID" ]; then
        info "Linking billing account..."
        gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID || warn "Failed to link billing account"
    fi
}

# Enable APIs
enable_apis() {
    info "Enabling required GCP APIs..."

    gcloud services enable \
        cloudfunctions.googleapis.com \
        cloudbuild.googleapis.com \
        cloudscheduler.googleapis.com \
        storage.googleapis.com \
        firestore.googleapis.com \
        secretmanager.googleapis.com \
        logging.googleapis.com \
        monitoring.googleapis.com \
        artifactregistry.googleapis.com \
        --project=$PROJECT_ID

    success "APIs enabled"
}

# Set up Firestore
setup_firestore() {
    info "Setting up Firestore..."

    # Check if Firestore already exists
    if gcloud firestore databases list --project=$PROJECT_ID 2>/dev/null | grep -q "(default)"; then
        warn "Firestore database already exists"
    else
        gcloud firestore databases create \
            --location=us-central \
            --type=firestore-native \
            --project=$PROJECT_ID

        success "Firestore database created"
    fi
}

# Create Terraform state bucket
setup_terraform_state() {
    info "Setting up Terraform state backend..."

    TERRAFORM_BUCKET="${PROJECT_ID}-terraform-state"

    # Check if bucket exists
    if gsutil ls -b gs://$TERRAFORM_BUCKET &> /dev/null; then
        warn "Terraform state bucket already exists"
    else
        gsutil mb -p $PROJECT_ID -l $REGION gs://$TERRAFORM_BUCKET
        gsutil versioning set on gs://$TERRAFORM_BUCKET
        success "Terraform state bucket created"
    fi
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    info "Deploying infrastructure with Terraform..."

    cd infrastructure/terraform

    # Create tfvars file
    cat > terraform.tfvars <<EOF
project_id         = "$PROJECT_ID"
region             = "$REGION"
firestore_location = "us-central"
notification_email = "$NOTIFICATION_EMAIL"
billing_account_id = "$BILLING_ACCOUNT_ID"
deployment_version = "1.0.0"
environment        = "production"
EOF

    # Initialize Terraform
    terraform init \
        -backend-config="bucket=${PROJECT_ID}-terraform-state"

    # Plan
    info "Generating Terraform plan..."
    terraform plan -out=tfplan

    # Apply
    read -p "Apply Terraform plan? (yes/no): " APPLY_CONFIRM
    if [ "$APPLY_CONFIRM" = "yes" ]; then
        terraform apply tfplan
        success "Infrastructure deployed"
    else
        warn "Terraform apply skipped"
    fi

    cd ../..
}

# Deploy Cloud Functions
deploy_functions() {
    info "Deploying Cloud Functions..."

    cd cloud-functions/scraper

    # Install dependencies
    npm install --production

    # Deploy scraper function
    gcloud functions deploy gemini-docs-scraper \
        --gen2 \
        --runtime=nodejs20 \
        --region=$REGION \
        --source=. \
        --entry-point=scrapeHandler \
        --trigger-http \
        --service-account=gemini-docs-scraper@$PROJECT_ID.iam.gserviceaccount.com \
        --set-env-vars="DOCS_BUCKET=${PROJECT_ID}-gemini-docs,SNAPSHOTS_BUCKET=${PROJECT_ID}-gemini-snapshots,PROJECT_ID=${PROJECT_ID}" \
        --memory=512Mi \
        --timeout=540s \
        --max-instances=1 \
        --min-instances=0 \
        --project=$PROJECT_ID

    success "Cloud Functions deployed"

    cd ../..
}

# Test deployment
test_deployment() {
    info "Testing deployment..."

    # Get function URL
    SCRAPER_URL=$(gcloud functions describe gemini-docs-scraper \
        --gen2 \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format='value(serviceConfig.uri)')

    info "Scraper function URL: $SCRAPER_URL"

    # Test invocation
    info "Testing scraper function..."
    curl -X POST $SCRAPER_URL \
        -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
        -H "Content-Type: application/json" \
        -d '{"source": "gemini"}' \
        -w "\nHTTP Status: %{http_code}\n"

    success "Deployment test complete"
}

# Print summary
print_summary() {
    echo ""
    success "==================================================================="
    success "         Deployment Complete!"
    success "==================================================================="
    echo ""
    info "Project Details:"
    echo "  Project ID: $PROJECT_ID"
    echo "  Region: $REGION"
    echo "  Environment: production"
    echo ""
    info "Resources Created:"
    echo "  ✓ Cloud Functions (scraper)"
    echo "  ✓ Cloud Storage (docs, snapshots)"
    echo "  ✓ Firestore database"
    echo "  ✓ Cloud Scheduler (daily scrape at 2 AM UTC)"
    echo "  ✓ Monitoring & Alerts"
    echo ""
    info "Next Steps:"
    echo "  1. View logs: gcloud functions logs read gemini-docs-scraper --gen2 --region=$REGION"
    echo "  2. View docs: gsutil ls gs://${PROJECT_ID}-gemini-docs/"
    echo "  3. Check scheduler: gcloud scheduler jobs list --location=$REGION"
    echo "  4. Monitor costs: https://console.cloud.google.com/billing"
    echo "  5. View dashboard: https://console.cloud.google.com/monitoring"
    echo ""
    info "Estimated Monthly Cost: ~\$0.50 - \$3.00"
    echo ""
    success "==================================================================="
}

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "  Gemini Docs Tracker - GCP Deployment"
    echo "=========================================="
    echo ""

    check_prerequisites
    get_configuration
    create_project
    enable_apis
    setup_firestore
    setup_terraform_state
    deploy_infrastructure
    deploy_functions
    test_deployment
    print_summary

    success "All done! 🚀"
}

# Run main
main "$@"
