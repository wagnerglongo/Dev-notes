/**
 * Renderizador de Markdown pequeno e seguro.
 *
 * Estratégia contra XSS: o texto inteiro é escapado ANTES de qualquer
 * transformação. Assim, nenhum HTML digitado na nota chega ao navegador como
 * HTML; só as tags que este arquivo gera. Links só aceitam http, https e mailto.
 *
 * Suporta: títulos (#, ##, ###), parágrafos, **negrito**, *itálico*, ~~riscado~~,
 * `código`, blocos ``` com linguagem, listas (com - [ ] tarefas), listas
 * numeradas, citações, linha horizontal, [links](https://...) e #etiquetas.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** Formatação dentro de uma linha. Recebe texto JÁ escapado. */
export function renderInline(escaped) {
  const codes = [];
  // Código inline sai primeiro, para nada dentro dele ser formatado
  let out = escaped.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = out
    // URL aceita um nível de parênteses, como em links da Wikipédia
    .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (match, label, url) =>
      SAFE_LINK.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : label,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, '$1<span class="tag">#$2</span>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

/** Markdown → HTML. */
export function renderMarkdown(source = "") {
  const lines = escapeHtml(source.replace(/\r\n?/g, "\n")).split("\n");
  const html = [];
  let paragraph = [];
  let list = null; // { type: "ul" | "ol", items: [] }
  let taskIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.join("")}</${list.type}>`);
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bloco de código ```lang
    const fence = line.match(/^```\s*([\w+#.-]*)\s*$/);
    if (fence) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      const lang = fence[1] ? ` data-lang="${fence[1]}"` : "";
      html.push(`<pre${lang}><code>${code.join("\n")}</code></pre>`);
      continue;
    }

    if (!line.trim()) { flush(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flush(); html.push("<hr>"); continue; }

    const quote = line.match(/^&gt;\s?(.*)$/); // ">" já foi escapado
    if (quote) { flush(); html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`); continue; }

    const task = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);

    if (task || bullet || ordered) {
      flushParagraph();
      const type = ordered ? "ol" : "ul";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };

      if (task) {
        const checked = task[1].toLowerCase() === "x";
        list.items.push(
          `<li class="task"><label><input type="checkbox" data-task="${taskIndex++}"${checked ? " checked" : ""}> <span>${renderInline(task[2])}</span></label></li>`,
        );
      } else {
        list.items.push(`<li>${renderInline((ordered ?? bullet)[1])}</li>`);
      }
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flush();
  return html.join("\n");
}

/** Marca/desmarca a n-ésima tarefa (- [ ]) no texto original. */
export function toggleTask(source, index) {
  let current = -1;
  return source.replace(/^([-*+]\s+\[)([ xX])(\])/gm, (match, open, mark, close) => {
    current += 1;
    if (current !== index) return match;
    return `${open}${mark === " " ? "x" : " "}${close}`;
  });
}
