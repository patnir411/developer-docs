# Gemini API Documentation Tracker

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Status](https://img.shields.io/badge/status-active-success)

**A comprehensive, automated documentation tracking system for Google's Gemini API**

This project automatically scrapes, tracks, and maintains up-to-date documentation for the Gemini API, Python SDK, Vertex AI, and Gemini CLI. It provides daily updates, change detection, changelog generation, and an interactive CLI for exploring the documentation.

**🌟 NEW: GCP Serverless Deployment** - Deploy to Google Cloud Platform for ~$0.50-3/month with full automation!

---

## 🚀 Features

### 🌐 Automated Web Scraping
- **Multi-source scraping**: Gemini API, Python SDK, Vertex AI, Gemini CLI, and GitHub releases
- **Gemini CLI Support**: Full documentation tracking for geminicli.com
- **Intelligent parsing**: Extracts methods, parameters, examples, and metadata
- **Rate limiting & retry logic**: Respectful, robust scraping with exponential backoff
- **Caching system**: Reduces redundant requests and improves performance

### 📸 Version Tracking
- **Snapshot system**: Creates point-in-time snapshots of all documentation
- **Diff generation**: Identifies added, modified, and deleted files
- **Change significance**: Automatically categorizes changes as major, minor, or patch
- **Historical tracking**: Full git-based version history

### 📝 Changelog Generation
- **Automatic changelogs**: Human-readable changelogs for every update
- **Breaking change detection**: Highlights API changes that may break existing code
- **Categorized changes**: Groups changes by type (breaking, features, fixes, docs)
- **Daily summaries**: Stay informed about API evolution

### 🖥️ Interactive CLI
- **Search documentation**: Full-text search across all docs with fuzzy matching
- **Method lookup**: Quick reference for API methods with examples
- **Model comparison**: Compare Gemini models side-by-side
- **Export functionality**: Export docs in JSON, Markdown, or HTML
- **Statistics dashboard**: View documentation statistics and trends

### ⚡ Real-time Monitoring
- **Daily automated scrapes**: Runs every day at 2 AM UTC
- **GitHub Actions integration**: Automated workflows for scraping and validation
- **Broken link detection**: Ensures documentation integrity
- **Issue creation**: Automatically creates GitHub issues for breaking changes

---

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [GCP Deployment](#-gcp-deployment)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🛠️ Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** (for version tracking)

### Clone the Repository

```bash
git clone https://github.com/your-org/gemini-docs-tracker.git
cd gemini-docs-tracker
```

### Install Dependencies

```bash
# Install scraper dependencies
cd scrapers && npm install

# Install change tracker dependencies
cd ../change-tracker && npm install

# Install CLI dependencies
cd ../cli && npm install
```

---

## ⚡ Quick Start

### 1. Run Your First Scrape

```bash
cd scrapers
npm run scrape:all
```

### 2. Track Changes

```bash
cd change-tracker
npm run track
```

### 3. Explore with CLI

```bash
cd cli
npm run build && npm link
gemini-docs search "generate content"
gemini-docs models --compare
```

---

## ☁️ GCP Deployment

Deploy to Google Cloud Platform for minimal cost (~$0.50-3/month) with full automation!

### One-Command Deployment

```bash
./scripts/deploy-to-gcp.sh
```

The script will:
1. Create GCP project
2. Enable required APIs
3. Set up Firestore database
4. Deploy Cloud Functions
5. Configure Cloud Scheduler for daily scraping
6. Set up monitoring and cost alerts

### Manual Deployment

See [docs/deployment-guide.md](docs/deployment-guide.md) for detailed step-by-step instructions.

### GCP Features

- **Serverless**: Cloud Functions (pay per execution)
- **Storage**: Cloud Storage (~$0.01/month for docs)
- **Database**: Firestore (free tier covers usage)
- **Automation**: Cloud Scheduler (daily scrapes)
- **Monitoring**: Built-in alerts and dashboards
- **Cost**: ~$0.50-3/month total

### Architecture

```
┌─────────────────┐
│ Cloud Scheduler │──── Triggers daily at 2 AM UTC
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cloud Function  │──── Scrapes documentation
│   (Scraper)     │
└────────┬────────┘
         │
         ├──────► Cloud Storage (docs)
         └──────► Firestore (metadata)
```

See [docs/gcp-deployment.md](docs/gcp-deployment.md) for full architecture details.

---

## 📖 Usage

See the full documentation in [ARCHITECTURE.md](ARCHITECTURE.md) for detailed usage instructions.

### Quick Commands

```bash
# Scraping
npm run scrape:all          # Scrape all sources
npm run scrape:gemini       # Scrape Gemini API only

# Change Tracking
npm run track              # Full tracking workflow
npm run snapshot           # Create snapshot
npm run diff               # Generate diff
npm run changelog          # Generate changelog

# CLI
gemini-docs search <query>
gemini-docs method <name>
gemini-docs models
gemini-docs changelog
gemini-docs stats
```

---

## 🏗️ Architecture

This project consists of three main components:

1. **Scrapers** (`/scrapers`): Web scraping system with intelligent parsing
2. **Change Tracker** (`/change-tracker`): Version tracking and changelog generation
3. **CLI** (`/cli`): Interactive command-line interface

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

---

## ⚙️ Configuration

- **Scraper**: `scrapers/config/scraper-config.json`
- **GitHub Actions**: `.github/workflows/`

---

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

---

## 📄 License

MIT License - see LICENSE file for details.

---

Made with ❤️ for the developer community
