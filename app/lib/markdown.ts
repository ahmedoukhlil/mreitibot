import { createElement, ReactNode } from "react";
import CodeBlock from "../components/CodeBlock";

function esc(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(t: string) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\bNon disponible\b/g, '<span class="table-na">Non disponible</span>')
    .replace(/\[(\d+)\](?!\()/g, '<a class="source-ref" href="#source-$1">[$1]</a>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function inline(t: string, key: string): ReactNode {
  return createElement("span", {
    key,
    dangerouslySetInnerHTML: { __html: inlineHtml(t) },
  });
}

interface CodeBlockToken {
  type: "code";
  language: string;
  code: string;
  closed: boolean;
}

interface TableToken {
  type: "table";
  header: string[];
  rows: string[][];
}

type Block = CodeBlockToken | TableToken;

const BLOCK_MARKER = /^@@BLOCK(\d+)@@$/;

/** Extrait les blocs de code fenced (```) et tableaux GFM, laisse un placeholder à leur place. */
function extractBlocks(raw: string): { text: string; blocks: Block[] } {
  const blocks: Block[] = [];
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const fenceMatch = lines[i].match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || "";
      const codeLines: string[] = [];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        if (/^```\s*$/.test(lines[j])) {
          closed = true;
          break;
        }
        codeLines.push(lines[j]);
        j++;
      }
      blocks.push({ type: "code", language, code: codeLines.join("\n"), closed });
      out.push(`@@BLOCK${blocks.length - 1}@@`);
      i = closed ? j + 1 : lines.length;
      continue;
    }

    // Table GFM : ligne d'en-tête suivie d'une ligne de séparateurs |---|---|
    const headerMatch = lines[i].match(/^\|(.+)\|\s*$/);
    const sepMatch = lines[i + 1]?.match(/^\|?[\s:|-]+\|[\s:|-]*\|?\s*$/);
    if (headerMatch && sepMatch && /-/.test(lines[i + 1])) {
      const header = headerMatch[1].split("|").map((c) => c.trim());
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && /^\|(.+)\|\s*$/.test(lines[j])) {
        const cells = lines[j]
          .match(/^\|(.+)\|\s*$/)![1]
          .split("|")
          .map((c) => c.trim());
        rows.push(cells);
        j++;
      }
      blocks.push({ type: "table", header, rows });
      out.push(`@@BLOCK${blocks.length - 1}@@`);
      i = j;
      continue;
    }

    out.push(lines[i]);
    i++;
  }

  return { text: out.join("\n"), blocks };
}

function renderBlock(block: Block, i: number): ReactNode {
  if (block.type === "code") {
    return createElement(CodeBlock, {
      key: `codeblock-${i}`,
      code: block.code,
      language: block.language,
      closed: block.closed,
    });
  }
  return createElement(
    "table",
    { key: `table-${i}`, className: "md-table" },
    createElement(
      "thead",
      null,
      createElement(
        "tr",
        null,
        block.header.map((h, hi) => createElement("th", { key: hi }, h)),
      ),
    ),
    createElement(
      "tbody",
      null,
      block.rows.map((row, ri) =>
        createElement(
          "tr",
          { key: ri },
          row.map((cell, ci) => createElement("td", { key: ci }, cell)),
        ),
      ),
    ),
  );
}

function renderLines(text: string, blocks: Block[]): ReactNode[] {
  const lines = text.split(/\r?\n/);
  const out: ReactNode[] = [];
  let key = 0;

  let inOl = false;
  let inUl = false;
  let inSubUl = false;
  let olItems: ReactNode[] = [];
  let ulItems: ReactNode[] = [];
  let subUlItems: ReactNode[] = [];

  const flushSubUl = () => {
    if (inSubUl) {
      olItems.push(createElement("ul", { className: "sub-list", key: `subul-${key++}` }, subUlItems));
      subUlItems = [];
      inSubUl = false;
    }
  };
  const flushOl = () => {
    flushSubUl();
    if (inOl) {
      out.push(createElement("ol", { key: `ol-${key++}` }, olItems));
      olItems = [];
      inOl = false;
    }
  };
  const flushUl = () => {
    if (inUl) {
      out.push(createElement("ul", { key: `ul-${key++}` }, ulItems));
      ulItems = [];
      inUl = false;
    }
  };
  const flushAll = () => {
    flushOl();
    flushUl();
  };

  for (const line of lines) {
    // Placeholder de bloc extrait (code/table) : flush les listes en cours, insère le composant réel.
    const blockMatch = line.match(BLOCK_MARKER);
    if (blockMatch) {
      flushAll();
      const block = blocks[parseInt(blockMatch[1], 10)];
      if (block) out.push(renderBlock(block, key++));
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = !h2 && line.match(/^###?\s+(.+)$/);
    const olTop = line.match(/^\d+\.\s+(.+)$/);
    const isSub = !olTop && line.match(/^\s{2,}(.+)$/);
    const ulTop = !olTop && !isSub && line.match(/^[-*•]\s+(.+)$/);

    if (h2) {
      flushAll();
      out.push(createElement("h2", { key: `h2-${key++}` }, inline(h2[1], `h2i-${key}`)));
    } else if (h3) {
      flushAll();
      out.push(createElement("h3", { key: `h3-${key++}` }, inline(h3[1], `h3i-${key}`)));
    } else if (olTop) {
      flushSubUl();
      flushUl();
      inOl = true;
      olItems.push(createElement("li", { key: `oli-${key++}` }, inline(olTop[1], `olic-${key}`)));
    } else if (isSub) {
      const content = isSub[1]
        .replace(/^[-–—*•·]\s*/, "")
        .replace(/^[a-z]\.\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .trimStart();
      flushUl();
      inOl = true;
      inSubUl = true;
      subUlItems.push(createElement("li", { key: `subli-${key++}` }, inline(content, `subc-${key}`)));
    } else if (ulTop) {
      flushOl();
      inUl = true;
      ulItems.push(createElement("li", { key: `uli-${key++}` }, inline(ulTop[1], `ulic-${key}`)));
    } else if (line.trim() === "") {
      flushSubUl();
      flushUl();
      if (!inOl) out.push(createElement("p", { key: `sp-${key++}`, style: { margin: 0, height: 6 } }));
    } else {
      flushAll();
      out.push(createElement("p", { key: `p-${key++}` }, inline(line, `pc-${key}`)));
    }
  }
  flushAll();
  return out;
}

/**
 * Parse un texte markdown brut en ReactNode[]. Gère le streaming partiel : un bloc de code
 * non fermé (nombre impair de ```) est rendu ouvert, sans bouton copier, plutôt que de casser
 * la mise en page.
 */
export function parseMarkdown(raw: string): ReactNode[] {
  const { text, blocks } = extractBlocks(String(raw || ""));
  return renderLines(text, blocks);
}
