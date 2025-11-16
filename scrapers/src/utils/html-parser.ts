import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import chalk from 'chalk';

export interface ParserSelectors {
  mainContent: string;
  title: string;
  sections: string;
  codeBlocks: string;
  tables: string;
  links: string;
}

export interface ParsedContent {
  title: string;
  markdown: string;
  html: string;
  sections: Section[];
  codeBlocks: CodeBlock[];
  links: Link[];
  metadata: ContentMetadata;
}

export interface Section {
  level: number;
  title: string;
  id?: string;
  content: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  caption?: string;
}

export interface Link {
  text: string;
  href: string;
  title?: string;
}

export interface ContentMetadata {
  wordCount: number;
  codeBlockCount: number;
  linkCount: number;
  lastUpdated?: string;
  author?: string;
}

export class HtmlParser {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Add custom rules
    this.setupTurndownRules();
  }

  private setupTurndownRules() {
    // Preserve data attributes in code blocks
    this.turndownService.addRule('codeBlocks', {
      filter: (node) => {
        return node.nodeName === 'PRE' && node.querySelector('code') !== null;
      },
      replacement: (content, node) => {
        const codeNode = node.querySelector('code');
        const language = codeNode?.getAttribute('class')?.match(/language-(\w+)/)?.[1] || '';
        const code = codeNode?.textContent || '';
        return '\n\n```' + language + '\n' + code + '\n```\n\n';
      },
    });

    // Better table handling
    this.turndownService.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  }

  parse(html: string, selectors: ParserSelectors, exclusions: string[] = []): ParsedContent {
    console.log(chalk.blue('🔍 Parsing HTML content...'));

    const $ = cheerio.load(html);

    // Remove excluded elements
    exclusions.forEach(selector => {
      $(selector).remove();
    });

    // Extract main content
    const mainContent = $(selectors.mainContent).first();
    if (mainContent.length === 0) {
      console.warn(chalk.yellow('⚠️  Main content selector not found, using body'));
    }

    const content = mainContent.length > 0 ? mainContent : $('body');

    // Extract title
    const title = this.extractTitle($, selectors.title);

    // Extract sections
    const sections = this.extractSections($, content, selectors.sections);

    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks($, content, selectors.codeBlocks);

    // Extract links
    const links = this.extractLinks($, content, selectors.links);

    // Convert to markdown
    const markdown = this.turndownService.turndown(content.html() || '');

    // Extract metadata
    const metadata = this.extractMetadata($, markdown, codeBlocks, links);

    console.log(chalk.green(`✓ Parsed: ${sections.length} sections, ${codeBlocks.length} code blocks, ${links.length} links`));

    return {
      title,
      markdown,
      html: content.html() || '',
      sections,
      codeBlocks,
      links,
      metadata,
    };
  }

  private extractTitle($: cheerio.CheerioAPI, selector: string): string {
    const titleElement = $(selector).first();
    return titleElement.text().trim() || 'Untitled';
  }

  private extractSections(
    $: cheerio.CheerioAPI,
    content: cheerio.Cheerio<any>,
    selector: string
  ): Section[] {
    const sections: Section[] = [];

    content.find(selector).each((_, element) => {
      const $el = $(element);
      const tagName = element.tagName.toLowerCase();
      const level = parseInt(tagName.replace('h', ''), 10);

      sections.push({
        level,
        title: $el.text().trim(),
        id: $el.attr('id'),
        content: $el.next().text().trim(),
      });
    });

    return sections;
  }

  private extractCodeBlocks(
    $: cheerio.CheerioAPI,
    content: cheerio.Cheerio<any>,
    selector: string
  ): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];

    content.find(selector).each((_, element) => {
      const $el = $(element);
      const className = $el.attr('class') || '';
      const language = className.match(/language-(\w+)/)?.[1] ||
                       className.match(/lang-(\w+)/)?.[1] ||
                       'plaintext';

      codeBlocks.push({
        language,
        code: $el.text().trim(),
        caption: $el.closest('figure').find('figcaption').text().trim() || undefined,
      });
    });

    return codeBlocks;
  }

  private extractLinks(
    $: cheerio.CheerioAPI,
    content: cheerio.Cheerio<any>,
    selector: string
  ): Link[] {
    const links: Link[] = [];

    content.find(selector).each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href');

      if (href && !href.startsWith('#')) {
        links.push({
          text: $el.text().trim(),
          href,
          title: $el.attr('title'),
        });
      }
    });

    return links;
  }

  private extractMetadata(
    $: cheerio.CheerioAPI,
    markdown: string,
    codeBlocks: CodeBlock[],
    links: Link[]
  ): ContentMetadata {
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    // Try to extract dates from meta tags
    const lastUpdated = $('meta[property="article:modified_time"]').attr('content') ||
                        $('meta[name="date"]').attr('content') ||
                        $('time[datetime]').attr('datetime');

    const author = $('meta[name="author"]').attr('content') ||
                   $('meta[property="article:author"]').attr('content');

    return {
      wordCount,
      codeBlockCount: codeBlocks.length,
      linkCount: links.length,
      lastUpdated,
      author,
    };
  }

  static sanitizeContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
