variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = "Firestore location"
  type        = string
  default     = "us-central"
}

variable "notification_email" {
  description = "Email for notifications and alerts"
  type        = string
}

variable "billing_account_id" {
  description = "GCP Billing Account ID"
  type        = string
}

variable "deployment_version" {
  description = "Deployment version for source code"
  type        = string
  default     = "1.0.0"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}
