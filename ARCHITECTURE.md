# Gemini API Documentation Tracker - Architecture

## Overview

This system is a comprehensive, automated documentation tracker for Google's Gemini API. It scrapes official documentation sources daily, tracks changes in real-time, and provides a CLI for exploring the documentation.

## Core Components

### 1. Web Scraping System (`/scrapers`)

**Purpose**: Fetch and parse documentation from official Gemini sources

**Sources**:
- https://ai.google.dev/gemini-api/docs (Primary Gemini API docs)
- https://ai.google.dev/api/python/google/generativeai (Python SDK reference)
- https://cloud.google.com/vertex-ai/generative-ai/docs (Vertex AI docs)
- https://ai.google.dev/api/rest (REST API reference)
- GitHub releases for SDK updates

**Technologies**:
- **Cheerio**: Lightweight HTML parsing for static pages
- **Puppeteer**: Browser automation for JavaScript-rendered content
- **Axios**: HTTP requests with retry logic
- **Rate Limiting**: Respectful scraping with configurable delays

**Modules**:
- `scrapers/gemini-api-scraper.ts` - Main API documentation
- `scrapers/python-sdk-scraper.ts` - Python SDK reference
- `scrapers/vertex-ai-scraper.ts` - Vertex AI documentation
- `scrapers/rest-api-scraper.ts` - REST API endpoints
- `scrapers/release-scraper.ts` - GitHub releases and changelogs
- `scrapers/utils/` - Shared utilities (rate limiting, caching, parsing)

### 2. Documentation Parser (`/parsers`)

**Purpose**: Transform scraped HTML/JSON into structured markdown and JSON

**Functionality**:
- Extract API methods, parameters, return types
- Parse code examples in multiple languages
- Generate markdown documentation with proper formatting
- Create JSON schemas for programmatic access
- Cross-reference related methods and parameters

**Outputs**:
- Markdown files for GitBook rendering
- JSON files for CLI and programmatic access
- Metadata files for change tracking

### 3. Change Detection System (`/change-tracker`)

**Purpose**: Identify and track all changes in Gemini API documentation

**Features**:
- **Diff Generation**: Compare current vs. previous documentation states
- **Method Tracking**: Detect new, modified, or deprecated methods
- **Parameter Changes**: Track parameter additions, removals, type changes
- **Version Tracking**: Maintain historical versions in git
- **Changelog Generation**: Auto-generate human-readable changelogs

**Storage**:
- Git commits for version history
- JSON snapshots for quick comparison
- Markdown changelogs in `/changelog` directory

### 4. CLI Tool (`/cli`)

**Purpose**: Interactive command-line interface for exploring documentation

**Commands**:
```bash
# Search for methods
gemini-docs search <query>

# Show method details
gemini-docs method <method-name>

# List all models
gemini-docs models

# Show recent changes
gemini-docs changelog [--since=date]

# Compare versions
gemini-docs diff <version1> <version2>

# Trigger manual scrape
gemini-docs scrape [--source=all|gemini|vertex]

# Show parameter details
gemini-docs param <parameter-name>

# Export documentation
gemini-docs export [--format=json|md|html]
```

**Features**:
- Rich terminal UI with colors and formatting
- Fuzzy search across all documentation
- Offline access to latest scraped docs
- JSON/Markdown/HTML export
- Interactive mode for exploration

### 5. Automation System (`/.github/workflows`)

**Purpose**: Daily automated scraping and updates

**Workflows**:
- **Daily Scrape** (cron: 0 2 * * *):
  - Scrape all documentation sources
  - Generate diffs and changelogs
  - Commit changes with detailed messages
  - Create issues for breaking changes

- **Real-time Monitor** (on push):
  - Validate documentation integrity
  - Run CLI tests
  - Check for broken links

- **Weekly Summary** (cron: 0 0 * * 0):
  - Generate weekly summary report
  - Analyze trends in API changes
  - Update statistics

### 6. Documentation Structure

```
/
├── ARCHITECTURE.md              # This file
├── README.md                    # Project overview and setup
├── SUMMARY.md                   # GitBook table of contents
│
├── gemini-api/                  # Main Gemini API documentation
│   ├── overview/
│   │   ├── getting-started.md
│   │   ├── authentication.md
│   │   └── quickstart.md
│   ├── models/
│   │   ├── gemini-1.5-pro.md
│   │   ├── gemini-1.5-flash.md
│   │   ├── gemini-1.0-pro.md
│   │   └── model-comparison.md
│   ├── methods/
│   │   ├── generateContent.md
│   │   ├── streamGenerateContent.md
│   │   ├── embedContent.md
│   │   ├── countTokens.md
│   │   └── ...
│   ├── parameters/
│   │   ├── generation-config.md
│   │   ├── safety-settings.md
│   │   ├── tools.md
│   │   └── ...
│   ├── guides/
│   │   ├── function-calling.md
│   │   ├── multimodal-input.md
│   │   ├── streaming.md
│   │   ├── safety.md
│   │   └── ...
│   └── examples/
│       ├── python/
│       ├── javascript/
│       ├── curl/
│       └── ...
│
├── vertex-ai/                   # Vertex AI specific docs
│   ├── overview/
│   ├── models/
│   ├── deployment/
│   └── ...
│
├── sdks/                        # SDK-specific documentation
│   ├── python/
│   ├── node/
│   ├── go/
│   └── rest/
│
├── changelog/                   # Auto-generated changelogs
│   ├── 2025/
│   ├── 2024/
│   └── latest.md
│
├── cli/                         # CLI source code
│   ├── src/
│   │   ├── commands/
│   │   ├── utils/
│   │   └── index.ts
│   ├── package.json
│   └── README.md
│
├── scrapers/                    # Web scraping modules
│   ├── src/
│   │   ├── scrapers/
│   │   ├── parsers/
│   │   ├── utils/
│   │   └── index.ts
│   ├── config/
│   │   └── scraper-config.json
│   └── package.json
│
├── change-tracker/              # Change detection system
│   ├── src/
│   │   ├── diff-generator.ts
│   │   ├── changelog-generator.ts
│   │   └── version-manager.ts
│   └── snapshots/
│       └── [date]-snapshot.json
│
└── .github/
    └── workflows/
        ├── daily-scrape.yml
        ├── real-time-monitor.yml
        └── weekly-summary.yml
```

## Data Flow

1. **Scraping** → Scrapers fetch HTML/JSON from sources
2. **Parsing** → Parsers extract structured data
3. **Change Detection** → Compare with previous versions
4. **Documentation Generation** → Generate markdown + JSON
5. **Git Commit** → Version control and history
6. **CLI Access** → Users query via command line
7. **GitBook Render** → Web-based documentation

## Technologies

- **Node.js/TypeScript**: Core runtime and language
- **Cheerio**: HTML parsing
- **Puppeteer**: Browser automation
- **Commander.js**: CLI framework
- **Chalk**: Terminal colors
- **Inquirer**: Interactive prompts
- **GitBook**: Documentation platform
- **GitHub Actions**: CI/CD automation
- **Jest**: Testing framework

## Robustness Features

1. **Error Handling**:
   - Retry logic with exponential backoff
   - Graceful degradation on partial failures
   - Detailed error logging

2. **Validation**:
   - Schema validation for scraped data
   - Link checking
   - Markdown linting
   - Type checking with TypeScript

3. **Performance**:
   - Concurrent scraping with limits
   - Caching layer for frequently accessed data
   - Incremental updates (only changed content)

4. **Reliability**:
   - Multiple source verification
   - Checksum validation
   - Rollback capability on errors
   - Health monitoring

## Configuration

All configuration in `/config/`:
- `scraper-config.json`: Scraping sources and settings
- `cli-config.json`: CLI preferences
- `changelog-config.json`: Changelog generation rules

## Future Enhancements

- [ ] Multi-language support (translations)
- [ ] API playground integration
- [ ] Code example validation (run and test examples)
- [ ] Community contributions tracking
- [ ] Slack/Discord notifications for changes
- [ ] Web dashboard for visualization
- [ ] ML-powered change impact analysis
