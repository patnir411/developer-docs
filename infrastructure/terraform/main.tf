terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "gemini-docs-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "storage.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# Cloud Storage Buckets
resource "google_storage_bucket" "docs_storage" {
  name          = "${var.project_id}-gemini-docs"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age                = 7
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "snapshots" {
  name          = "${var.project_id}-gemini-snapshots"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "function_source" {
  name          = "${var.project_id}-function-source"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true
}

# Firestore Database
resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required_apis]
}

# Service Account for Cloud Functions
resource "google_service_account" "scraper_sa" {
  account_id   = "gemini-docs-scraper"
  display_name = "Gemini Docs Scraper Service Account"
}

resource "google_project_iam_member" "scraper_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.scraper_sa.email}"
}

resource "google_project_iam_member" "scraper_firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.scraper_sa.email}"
}

resource "google_project_iam_member" "scraper_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.scraper_sa.email}"
}

# Cloud Function - Scraper
resource "google_cloudfunctions2_function" "scraper" {
  name        = "gemini-docs-scraper"
  location    = var.region
  description = "Scrapes Gemini API documentation"

  build_config {
    runtime     = "nodejs20"
    entry_point = "scrapeHandler"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.scraper_source.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    min_instance_count    = 0
    available_memory      = "512Mi"
    timeout_seconds       = 540
    service_account_email = google_service_account.scraper_sa.email

    environment_variables = {
      DOCS_BUCKET      = google_storage_bucket.docs_storage.name
      SNAPSHOTS_BUCKET = google_storage_bucket.snapshots.name
      PROJECT_ID       = var.project_id
    }
  }
}

# Cloud Function - Change Tracker
resource "google_cloudfunctions2_function" "tracker" {
  name        = "gemini-docs-tracker"
  location    = var.region
  description = "Tracks documentation changes and generates diffs"

  build_config {
    runtime     = "nodejs20"
    entry_point = "trackHandler"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.tracker_source.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    min_instance_count    = 0
    available_memory      = "512Mi"
    timeout_seconds       = 300
    service_account_email = google_service_account.scraper_sa.email

    environment_variables = {
      DOCS_BUCKET      = google_storage_bucket.docs_storage.name
      SNAPSHOTS_BUCKET = google_storage_bucket.snapshots.name
      PROJECT_ID       = var.project_id
    }
  }
}

# Cloud Scheduler - Daily Scrape
resource "google_cloud_scheduler_job" "daily_scrape" {
  name             = "daily-gemini-scrape"
  description      = "Triggers daily Gemini documentation scrape"
  schedule         = "0 2 * * *"
  time_zone        = "UTC"
  attempt_deadline = "600s"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.scraper.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.scraper_sa.email
    }

    body = base64encode(jsonencode({
      source = "all"
    }))

    headers = {
      "Content-Type" = "application/json"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Scheduler - Daily Change Tracking
resource "google_cloud_scheduler_job" "daily_track" {
  name             = "daily-change-tracking"
  description      = "Triggers daily change tracking and diff generation"
  schedule         = "0 3 * * *"
  time_zone        = "UTC"
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.tracker.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.scraper_sa.email
    }

    body = base64encode(jsonencode({
      action = "track"
    }))

    headers = {
      "Content-Type" = "application/json"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Scheduler - Weekly Cleanup
resource "google_cloud_scheduler_job" "weekly_cleanup" {
  name             = "weekly-snapshot-cleanup"
  description      = "Cleans up old snapshots weekly"
  schedule         = "0 4 * * 0"
  time_zone        = "UTC"
  attempt_deadline = "120s"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.tracker.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.scraper_sa.email
    }

    body = base64encode(jsonencode({
      action = "cleanup"
    }))

    headers = {
      "Content-Type" = "application/json"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Monitoring Alert Policy - High Error Rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate - Gemini Docs Scraper"
  combiner     = "OR"

  conditions {
    display_name = "Error rate > 10%"

    condition_threshold {
      filter          = "resource.type = \"cloud_function\" AND metric.type = \"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status != \"ok\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.1

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "1800s"
  }
}

# Notification Channel
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification"
  type         = "email"

  labels = {
    email_address = var.notification_email
  }
}

# Budget Alert
resource "google_billing_budget" "monthly_budget" {
  billing_account = var.billing_account_id
  display_name    = "Gemini Docs Monthly Budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "10"
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.8
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  threshold_rules {
    threshold_percent = 1.2
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.id
    ]
  }
}

# Placeholder for source upload (actual deployment handled by Cloud Build)
resource "google_storage_bucket_object" "scraper_source" {
  name   = "source/scraper-${var.deployment_version}.zip"
  bucket = google_storage_bucket.function_source.name
  source = "${path.module}/../../cloud-functions/scraper/deploy.zip"
}

resource "google_storage_bucket_object" "tracker_source" {
  name   = "source/tracker-${var.deployment_version}.zip"
  bucket = google_storage_bucket.function_source.name
  source = "${path.module}/../../cloud-functions/tracker/deploy.zip"
}

# Outputs
output "scraper_function_url" {
  value       = google_cloudfunctions2_function.scraper.service_config[0].uri
  description = "URL of the scraper Cloud Function"
}

output "tracker_function_url" {
  value       = google_cloudfunctions2_function.tracker.service_config[0].uri
  description = "URL of the tracker Cloud Function"
}

output "docs_bucket" {
  value       = google_storage_bucket.docs_storage.name
  description = "Documentation storage bucket"
}

output "snapshots_bucket" {
  value       = google_storage_bucket.snapshots.name
  description = "Snapshots storage bucket"
}
