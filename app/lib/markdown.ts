function esc(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(t: string) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderMarkdown(raw: string): string {
  const lines = String(raw || "").split(/\r?\n/);
  const out: string[] = [];
  let inOl = false;
  let inUl = false;
  let inSubUl = false;

  const closeSubUl = () => { if (inSubUl) { out.push("</ul>"); inSubUl = false; } };
  const closeOl    = () => { closeSubUl(); if (inOl) { out.push("</ol>"); inOl = false; } };
  const closeUl    = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  const closeAll   = () => { closeOl(); closeUl(); };

  for (const line of lines) {
    const h2    = line.match(/^##\s+(.+)$/);
    const h3    = !h2 && line.match(/^###?\s+(.+)$/);
    const olTop = line.match(/^\d+\.\s+(.+)$/);
    const isSub = !olTop && line.match(/^\s{2,}(.+)$/);
    const ulTop = !olTop && !isSub && line.match(/^[-*•]\s+(.+)$/);

    if (h2) {
      closeAll();
      out.push(`<h2>${inline(h2[1])}</h2>`);
    } else if (h3) {
      closeAll();
      out.push(`<h3>${inline(h3[1])}</h3>`);
    } else if (olTop) {
      closeSubUl();
      closeUl();
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(olTop[1])}</li>`);
    } else if (isSub) {
      const raw2 = isSub[1];
      const content = raw2
        .replace(/^[-–—*•·]\s*/, "")
        .replace(/^[a-z]\.\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .trimStart();
      closeUl();
      if (!inOl) { out.push("<ol>"); inOl = true; }
      if (!inSubUl) { out.push('<ul class="sub-list">'); inSubUl = true; }
      out.push(`<li>${inline(content)}</li>`);
    } else if (ulTop) {
      closeOl();
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(ulTop[1])}</li>`);
    } else if (line.trim() === "") {
      closeSubUl();
      closeUl();
      if (!inOl) out.push('<p style="margin:0;height:6px"></p>');
    } else {
      closeAll();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeAll();
  return out.join("");
}
