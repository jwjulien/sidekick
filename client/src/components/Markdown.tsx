import { createMemo, Show, type JSX } from "solid-js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./Markdown.css";

export interface MarkdownProps {
  content?: string | null;
  fallback?: string | JSX.Element;
  class?: string;
  compact?: boolean;
}

// Map of icons for callouts / admonitions
const ADMONITION_ICONS: Record<string, string> = {
  note: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  tip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  important: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  caution: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
};

/**
 * Pre-processes markdown source text to extract abbreviations and handle container syntax.
 */
function preprocessMarkdown(src: string): { processedSrc: string; abbrMap: Map<string, string> } {
  const abbrMap = new Map<string, string>();
  let lines = src.split(/\r?\n/);
  const remainingLines: string[] = [];

  // Extract abbreviation definitions `*[ABBR]: Full text`
  const abbrRegex = /^\*\[([^\]]+)\]:\s*(.+)$/;
  for (const line of lines) {
    const match = line.trim().match(abbrRegex);
    if (match) {
      abbrMap.set(match[1].trim(), match[2].trim());
    } else {
      remainingLines.push(line);
    }
  }

  let text = remainingLines.join("\n");

  // Transform ::: admonition container syntax to GitHub style callout blockquotes
  // e.g., ::: note \n Content \n ::: -> > [!NOTE]\n > Content
  text = text.replace(/:::\s*(note|tip|important|warning|caution)\s*\n([\s\S]*?)\n:::/gi, (_, type, content) => {
    const upperType = type.toUpperCase();
    const quotedContent = content
      .split("\n")
      .map((l: string) => `> ${l}`)
      .join("\n");
    return `> [!${upperType}]\n${quotedContent}`;
  });

  return { processedSrc: text, abbrMap };
}

/**
 * Post-processes rendered HTML to wrap tables and insert <abbr> elements.
 */
function postprocessHtml(html: string, abbrMap: Map<string, string>): string {
  let result = html;

  // Wrap tables in responsive container if not already wrapped
  result = result.replace(/<table>[\s\S]*?<\/table>/g, (match) => {
    return `<div class="markdown-table-wrapper">${match}</div>`;
  });

  // Transform GitHub callout blockquotes (> [!NOTE]) into styled admonition divs
  // e.g. <blockquote><p>[!NOTE]<br>Content</p></blockquote>
  const calloutRegex = /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*<br\s*\/?>?([\s\S]*?)<\/p>\s*<\/blockquote>/gi;
  result = result.replace(calloutRegex, (_, type, content) => {
    const lowerType = type.toLowerCase();
    const icon = ADMONITION_ICONS[lowerType] || ADMONITION_ICONS.note;
    return `
      <div class="admonition admonition-${lowerType}">
        <div class="admonition-title">
          ${icon}
          <span>${type}</span>
        </div>
        <div class="admonition-content">
          <p>${content.trim()}</p>
        </div>
      </div>
    `;
  });

  // Replace GitHub callout blockquotes with multiple paragraphs/elements
  const calloutMultiRegex = /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*<\/p>([\s\S]*?)<\/blockquote>/gi;
  result = result.replace(calloutMultiRegex, (_, type, content) => {
    const lowerType = type.toLowerCase();
    const icon = ADMONITION_ICONS[lowerType] || ADMONITION_ICONS.note;
    return `
      <div class="admonition admonition-${lowerType}">
        <div class="admonition-title">
          ${icon}
          <span>${type}</span>
        </div>
        <div class="admonition-content">
          ${content.trim()}
        </div>
      </div>
    `;
  });

  // Apply abbreviation replacements safely outside HTML tags
  if (abbrMap.size > 0) {
    abbrMap.forEach((definition, term) => {
      // Escape special regex chars in term
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Replace term outside of HTML tags and code blocks
      const regex = new RegExp(`(?<=[^\\w>]|^)(${escapedTerm})(?=[^\\w<]|$)`, "g");
      
      // Split html by tags to avoid replacing text inside attributes or tags
      const tokens = result.split(/(<[^>]+>)/g);
      for (let i = 0; i < tokens.length; i++) {
        // If not inside an HTML tag or <code/pre> block
        if (!tokens[i].startsWith("<") && !tokens[i].includes("code>")) {
          tokens[i] = tokens[i].replace(regex, `<abbr title="${definition}">$1</abbr>`);
        }
      }
      result = tokens.join("");
    });
  }

  return result;
}

export default function Markdown(props: MarkdownProps) {
  const renderedHtml = createMemo(() => {
    const rawContent = props.content;
    if (!rawContent || !rawContent.trim()) {
      return null;
    }

    try {
      const { processedSrc, abbrMap } = preprocessMarkdown(rawContent);

      // Parse with marked (synchronous GFM parsing)
      const rawParsed = marked.parse(processedSrc, {
        gfm: true,
        breaks: true,
        async: false,
      }) as string;

      // Post-process HTML for admonitions, tables, and abbreviations
      const processedHtml = postprocessHtml(rawParsed, abbrMap);

      // Sanitize with DOMPurify to prevent XSS vulnerabilities
      const cleanHtml = DOMPurify.sanitize(processedHtml, {
        ADD_ATTR: ["target", "title", "class"],
        ADD_TAGS: ["abbr", "svg", "path", "circle", "line", "polygon"],
      });

      return cleanHtml;
    } catch (err) {
      console.error("Failed to render markdown:", err);
      return String(rawContent);
    }
  });

  return (
    <Show
      when={renderedHtml()}
      fallback={
        props.fallback ? (
          typeof props.fallback === "string" ? (
            <span class="italic text-gray-500">{props.fallback}</span>
          ) : (
            props.fallback
          )
        ) : null
      }
    >
      <div
        class={`markdown-body ${props.compact ? "compact" : ""} ${props.class || ""}`}
        innerHTML={renderedHtml()!}
      />
    </Show>
  );
}
