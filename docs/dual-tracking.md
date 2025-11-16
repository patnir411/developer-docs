# Dual Tracking: Gemini API vs Gemini CLI

## Overview

This system tracks **TWO DISTINCT** documentation sources:

### 1. 🔷 Gemini API (Official Google Documentation)
- **Source**: https://ai.google.dev/gemini-api/docs
- **What it is**: Google's official Gemini API documentation
- **Content**: REST API, Python SDK, model references, parameters
- **Scraper**: `scrapers/src/scrapers/gemini-api-scraper.ts`
- **Output**: `gemini-api/` directory

### 2. 🔶 Gemini CLI (Third-Party CLI Tool)
- **Source**: https://geminicli.com/docs
- **What it is**: Command-line interface tool for Gemini API
- **Content**: CLI commands, usage, options, examples
- **Scraper**: `scrapers/src/scrapers/gemini-cli-scraper.ts`
- **Output**: `gemini-cli/` directory

## Key Differences

| Aspect | Gemini API | Gemini CLI |
|--------|------------|------------|
| **Provider** | Google (Official) | Third-party tool |
| **Type** | API Documentation | CLI Tool Documentation |
| **Content** | REST endpoints, SDK methods | Command-line commands |
| **Examples** | Code snippets (Python, JS, curl) | Shell commands |
| **Use Case** | Programmatic API integration | Command-line usage |
| **URL** | ai.google.dev | geminicli.com |

## Documentation Structure

```
developer-docs/
├── gemini-api/                 # GOOGLE GEMINI API DOCS
│   ├── overview/
│   ├── models/
│   │   ├── gemini-1.5-pro.md
│   │   ├── gemini-1.5-flash.md
│   │   └── gemini-2.0-flash.md
│   ├── methods/
│   │   ├── generateContent.md
│   │   ├── streamGenerateContent.md
│   │   └── embedContent.md
│   ├── parameters/
│   └── guides/
│
├── gemini-cli/                 # GEMINI CLI TOOL DOCS
│   ├── README.md
│   └── commands/
│       ├── chat.md
│       ├── generate.md
│       ├── models.md
│       ├── config.md
│       └── auth.md
│
├── sdks/                       # SDK-SPECIFIC DOCS
│   ├── python/
│   ├── node/
│   └── rest/
│
└── vertex-ai/                  # VERTEX AI DOCS
```

## Scraping Configuration

Both sources are configured in `scrapers/config/scraper-config.json`:

```json
{
  "sources": {
    "gemini": {
      "baseUrl": "https://ai.google.dev",
      "paths": ["/gemini-api/docs", ...],
      "enabled": true,
      "priority": 1
    },
    "geminiCLI": {
      "baseUrl": "https://geminicli.com",
      "paths": ["/docs"],
      "enabled": true,
      "priority": 2.5
    }
  }
}
```

## Scraping Process

### Daily Automated Scrape
1. **2:00 AM UTC**: Scrape Gemini API (ai.google.dev)
2. **2:05 AM UTC**: Scrape Gemini CLI (geminicli.com)
3. **2:10 AM UTC**: Scrape Python SDK
4. **3:00 AM UTC**: Run change detection
5. **3:15 AM UTC**: Generate changelogs

### What Gets Tracked

#### Gemini API Tracking:
- ✅ API endpoints (REST)
- ✅ Method signatures
- ✅ Parameters and types
- ✅ Model capabilities
- ✅ Code examples (Python, JS, curl)
- ✅ Response formats
- ✅ Error codes

#### Gemini CLI Tracking:
- ✅ Command syntax
- ✅ Command options/flags
- ✅ Usage examples
- ✅ Configuration options
- ✅ Authentication methods
- ✅ Output formats
- ✅ Environment variables

## CLI Tool Commands

The documentation CLI has separate commands for each:

```bash
# Search Gemini API docs
gemini-docs search "generateContent" --type api

# Search Gemini CLI docs
gemini-docs search "chat" --type cli

# List all API methods
gemini-docs api methods

# List all CLI commands
gemini-docs cli commands

# Compare API vs CLI
gemini-docs compare generateContent chat
```

## Change Detection

The system tracks changes separately:

### API Changes
- New endpoints
- Method signature changes
- Parameter additions/removals
- Deprecated methods
- Model updates

### CLI Changes
- New commands
- Option changes
- Flag additions
- Command deprecations
- Configuration changes

## Example Changelog

```markdown
# Changelog - 2025-01-15

## Gemini API Changes
- ✨ Added: `gemini-2.0-flash-thinking` model
- 🔧 Updated: `generateContent` now supports `thinking` parameter
- ⚠️ Deprecated: `gemini-1.0-pro-vision`

## Gemini CLI Changes
- ✨ Added: `gemini chat --thinking` flag
- 🔧 Updated: `gemini config` now supports model aliases
- 📚 Docs: Added examples for streaming responses
```

## Use Cases

### When to use Gemini API docs:
- Building applications that integrate Gemini
- Using Python/JS/Go SDKs
- Understanding API parameters
- Implementing custom clients

### When to use Gemini CLI docs:
- Command-line automation
- Quick testing and prototyping
- Shell scripting with Gemini
- CI/CD integrations
- Learning Gemini features quickly

## Integration

Both documentation sources are:
- ✅ Scraped daily
- ✅ Version tracked
- ✅ Change detected
- ✅ Searchable via CLI
- ✅ Exportable (JSON/MD/HTML)
- ✅ Stored in Cloud Storage (GCP deployment)
- ✅ Indexed in Firestore (metadata)

## Verification

To verify both are being tracked:

```bash
# Check scraped files
ls -la gemini-api/
ls -la gemini-cli/

# View scrape summary
cat .scrape-summary.json | jq '.gemini, .geminiCLI'

# Check Cloud Storage (GCP)
gsutil ls gs://your-project-gemini-docs/gemini/
gsutil ls gs://your-project-gemini-docs/geminiCLI/

# Query Firestore
gcloud firestore collections list
```

## Why Track Both?

1. **Comprehensive Coverage**: Users may use API directly OR via CLI
2. **Different Audiences**: Developers vs CLI users
3. **Cross-Reference**: CLI commands map to API methods
4. **Complete Documentation**: Full Gemini ecosystem coverage
5. **Change Correlation**: See when CLI updates follow API changes

## Relationship

```
┌─────────────────────────────────────────┐
│         Gemini API (Google)             │
│  - REST Endpoints                       │
│  - Python/JS/Go SDKs                   │
│  - Direct API Integration               │
└──────────────────┬──────────────────────┘
                   │
                   │ Uses/Wraps
                   │
                   ▼
┌─────────────────────────────────────────┐
│       Gemini CLI (geminicli.com)        │
│  - Command-line Interface               │
│  - Shell Commands                       │
│  - Automation Scripts                   │
└─────────────────────────────────────────┘

Both tracked separately but documented together
```

## Summary

This system provides **complete dual tracking**:
- ✅ Gemini API (official Google docs)
- ✅ Gemini CLI (third-party CLI tool)
- ✅ Separate scrapers for each
- ✅ Separate output directories
- ✅ Separate change tracking
- ✅ Unified CLI for querying both
- ✅ Comprehensive coverage of Gemini ecosystem
