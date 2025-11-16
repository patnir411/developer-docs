# Documentation Sources Tracked

## ✅ Active Tracking

This system actively tracks the following documentation sources:

### 1. 🔷 Gemini API (Google Official)

**Source**: https://ai.google.dev/gemini-api/docs

**Provider**: Google (Official)

**What it documents**:
- REST API endpoints (`/v1beta/models/gemini-*:generateContent`)
- Python SDK (`google.generativeai`)
- JavaScript SDK
- Model capabilities and specifications
- API parameters and configuration
- Authentication and API keys
- Rate limits and quotas

**Scraper**: `scrapers/src/scrapers/gemini-api-scraper.ts`

**Output Directory**: `gemini-api/`

**Pages Scraped** (~9 key pages):
- Overview and getting started
- Models (Gemini 1.5 Pro, Flash, 2.0 Flash, etc.)
- Function calling
- Vision capabilities
- Audio capabilities
- Structured output
- Thinking mode
- Caching
- Tuning/fine-tuning

**Update Frequency**: Daily at 2:00 AM UTC

---

### 2. 🔶 Gemini CLI (Third-Party Tool)

**Source**: https://geminicli.com/docs

**Provider**: Third-party open source project

**What it documents**:
- Command-line interface commands
- CLI installation and setup
- Command syntax and options
- Configuration file format
- Authentication methods
- Usage examples and workflows
- Shell integration

**Scraper**: `scrapers/src/scrapers/gemini-cli-scraper.ts`

**Output Directory**: `gemini-cli/`

**Commands Documented** (typical):
- `gemini chat` - Interactive chat
- `gemini generate` - Generate content
- `gemini models` - List models
- `gemini config` - Configuration
- `gemini auth` - Authentication
- `gemini embed` - Generate embeddings
- `gemini count-tokens` - Token counting

**Update Frequency**: Daily at 2:05 AM UTC

---

### 3. 🐍 Python SDK Reference

**Source**: https://ai.google.dev/api/python/google/generativeai

**Provider**: Google (Official)

**What it documents**:
- Python package reference
- Method signatures
- Parameter types
- Return values
- Usage examples
- Type definitions

**Scraper**: `scrapers/src/scrapers/python-sdk-scraper.ts`

**Output Directory**: `sdks/python/`

**Update Frequency**: Daily at 2:10 AM UTC

---

### 4. ☁️ Vertex AI (Google Cloud)

**Source**: https://cloud.google.com/vertex-ai/generative-ai/docs

**Provider**: Google Cloud (Official)

**What it documents**:
- Vertex AI Gemini API
- Cloud deployment options
- Enterprise features
- Grounding capabilities
- Multimodal features

**Scraper**: To be implemented (configuration ready)

**Output Directory**: `vertex-ai/`

**Update Frequency**: To be configured

---

## 🔍 Key Differences: API vs CLI

| Aspect | Gemini API | Gemini CLI |
|--------|------------|------------|
| **Purpose** | Programmatic integration | Command-line usage |
| **Interface** | REST API + SDKs | Shell commands |
| **Auth** | API keys, OAuth | Config file + API key |
| **Examples** | Code snippets | Shell commands |
| **Users** | Developers | CLI users, automation |
| **Docs Format** | Technical specs | Usage guides |
| **Installation** | pip/npm install SDK | npm install -g gemini-cli |

---

## 📊 Scraping Schedule

```
Daily Schedule (UTC):
├── 02:00 - Scrape Gemini API (ai.google.dev)
├── 02:05 - Scrape Gemini CLI (geminicli.com)
├── 02:10 - Scrape Python SDK Reference
├── 02:15 - Scrape Vertex AI (when enabled)
├── 03:00 - Run change detection
├── 03:15 - Generate changelogs
└── 03:30 - Commit and push updates
```

---

## 💾 Storage Organization

```
developer-docs/
├── gemini-api/          # 🔷 Google Gemini API
│   ├── overview/
│   ├── models/
│   ├── methods/
│   ├── parameters/
│   └── guides/
│
├── gemini-cli/          # 🔶 Gemini CLI Tool
│   ├── README.md
│   └── commands/
│       ├── chat.md
│       ├── generate.md
│       ├── models.md
│       └── ...
│
├── sdks/                # 🐍 SDK References
│   ├── python/
│   ├── node/
│   └── rest/
│
└── vertex-ai/           # ☁️ Vertex AI
    ├── overview/
    └── deployment/
```

---

## 🔧 CLI Tool Access

Query each source separately:

```bash
# Gemini API (Google official)
gemini-docs api --action list
gemini-docs api --action models
gemini-docs api --action methods

# Gemini CLI (CLI tool)
gemini-docs cli --action list
gemini-docs cli --action commands
gemini-docs cli --action categories

# Search across both
gemini-docs search "generate content"
```

---

## 📈 Change Tracking

Both sources are tracked for changes:

### API Changes:
- New endpoints
- Parameter changes
- Model additions
- Capability updates
- Deprecations

### CLI Changes:
- New commands
- Option changes
- Configuration updates
- Command deprecations
- Feature additions

---

## 🚀 GCP Deployment

When deployed to GCP, both sources are scraped by Cloud Functions:

```javascript
// Cloud Function configuration
const CONFIG = {
  sources: {
    gemini: {
      baseUrl: 'https://ai.google.dev',
      paths: ['/gemini-api/docs', ...]
    },
    geminiCLI: {
      baseUrl: 'https://geminicli.com',
      paths: ['/docs']
    },
    pythonSDK: {
      baseUrl: 'https://ai.google.dev/api/python/...',
      paths: ['', '/models', '/types']
    }
  }
}
```

Results stored in:
- **Cloud Storage**: `gs://PROJECT-gemini-docs/`
- **Firestore**: Metadata and change history

---

## ✅ Verification

To verify dual tracking is working:

```bash
# Local verification
ls -la gemini-api/    # Should have API docs
ls -la gemini-cli/    # Should have CLI docs

# Check scrape results
cat .scrape-summary.json | jq '.gemini, .geminiCLI'

# GCP verification
gsutil ls gs://PROJECT-gemini-docs/gemini/
gsutil ls gs://PROJECT-gemini-docs/geminiCLI/
```

---

## 📝 Summary

**Total Sources Tracked**: 4 (with 2 more configurable)

**Primary Focus**:
- ✅ Gemini API (Google official)
- ✅ Gemini CLI (third-party tool)

**Secondary**:
- ✅ Python SDK Reference
- ⏳ Vertex AI (configurable)

**Future Additions**:
- Node.js SDK
- Go SDK
- REST API Reference

---

*Last Updated: 2025-01-16*
