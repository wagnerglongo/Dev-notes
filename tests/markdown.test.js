import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, toggleTask } from "../src/markdown.js";

test("títulos, parágrafos e formatação inline", () => {
  const html = renderMarkdown("# Título\n\nTexto **forte**, *leve*, ~~velho~~ e `code`.");
  assert.match(html, /<h1>Título<\/h1>/);
  assert.match(html, /<strong>forte<\/strong>/);
  assert.match(html, /<em>leve<\/em>/);
  assert.match(html, /<del>velho<\/del>/);
  assert.match(html, /<code>code<\/code>/);
});

test("bloco de código preserva o conteúdo e a linguagem, sem formatar", () => {
  const html = renderMarkdown("```js\nconst a = **b** < c;\n```");
  assert.equal(html, '<pre data-lang="js"><code>const a = **b** &lt; c;</code></pre>');
});

test("listas, tarefas e listas numeradas", () => {
  const html = renderMarkdown("- um\n- [ ] fazer\n- [x] feito\n\n1. primeiro\n2. segundo");
  assert.match(html, /<ul><li>um<\/li><li class="task">.*data-task="0">.*fazer.*<\/li><li class="task">.*data-task="1" checked>.*feito/);
  assert.match(html, /<ol><li>primeiro<\/li><li>segundo<\/li><\/ol>/);
});

test("etiquetas viram destaque, mas título com espaço não", () => {
  const html = renderMarkdown("# Deploy\nRevisar #docker e #ci-cd");
  assert.match(html, /<h1>Deploy<\/h1>/);
  assert.match(html, /<span class="tag">#docker<\/span>/);
  assert.match(html, /<span class="tag">#ci-cd<\/span>/);
});

test("HTML digitado na nota é exibido como texto, nunca executado", () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)"> <script>alert(2)</script>');
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("links só aceitam http, https e mailto", () => {
  assert.match(renderMarkdown("[site](https://wglsoftware.com)"), /<a href="https:\/\/wglsoftware.com" target="_blank" rel="noopener noreferrer">site<\/a>/);
  assert.equal(renderMarkdown("[clique](javascript:alert(1))"), "<p>clique</p>");
  assert.doesNotMatch(renderMarkdown('[x](https://a.com"onmouseover="alert(1))'), /"onmouseover/);
});

test("formatação não acontece dentro de código inline", () => {
  assert.match(renderMarkdown("`**não negrito**`"), /<code>\*\*não negrito\*\*<\/code>/);
});

test("toggleTask marca e desmarca a tarefa certa", () => {
  const source = "- [ ] a\n- [x] b\n- [ ] c";
  assert.equal(toggleTask(source, 0), "- [x] a\n- [x] b\n- [ ] c");
  assert.equal(toggleTask(source, 1), "- [ ] a\n- [ ] b\n- [ ] c");
  assert.equal(toggleTask(source, 9), source);
});
