import { renderMarkdown, toggleTask } from "./markdown.js";
import {
  allTags, createNote, duplicateNote, filterNotes, notePreview, noteTitle,
  parseBackup, sortNotes, toBackup,
} from "./notes.js";
import { openStore } from "./storage.js";

const $ = (id) => document.getElementById(id);
const app = $("app");
const textarea = $("content");
const preview = $("preview");

const WELCOME = `# Bem-vindo ao Dev Notes

Notas em **Markdown**, salvas no seu navegador e disponíveis **offline**.

## O que dá para fazer
- [x] Escrever com \`código\`, **negrito**, *itálico* e [links](https://github.com/wagnerglongo/Dev-notes)
- [ ] Marcar tarefas clicando na caixinha em *Visualizar*
- [ ] Organizar com etiquetas: #ideias #trabalho

\`\`\`js
// blocos de código mantêm a formatação
const soma = (a, b) => a + b;
\`\`\`

> Atalhos: **Alt+N** nova nota, **Ctrl+K** buscar, **Ctrl+E** alterna escrever/visualizar.
`;

const state = {
  notes: [],
  activeId: null,
  query: "",
  tag: null,
  mode: "edit",
};

let store;
const active = () => state.notes.find((n) => n.id === state.activeId) ?? null;

/* -------------------------------------------------------------------------
   Renderização
   ------------------------------------------------------------------------- */
function renderList() {
  const visible = sortNotes(filterNotes(state.notes, { query: state.query, tag: state.tag }));
  const list = $("note-list");

  list.replaceChildren(
    ...visible.map((note) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "note-item";
      button.dataset.id = note.id;
      if (note.id === state.activeId) button.setAttribute("aria-current", "true");

      const title = document.createElement("span");
      title.className = "note-item__title";
      title.textContent = noteTitle(note.content);
      if (note.pinned) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "fixada";
        title.append(" ", badge);
      }

      const meta = document.createElement("span");
      meta.className = "note-item__meta";
      meta.textContent = notePreview(note.content) || formatDate(note.updatedAt);

      button.append(title, meta);
      const li = document.createElement("li");
      li.append(button);
      return li;
    }),
  );

  const empty = $("empty-list");
  empty.hidden = visible.length > 0;
  empty.textContent = state.notes.length ? "Nenhuma nota encontrada." : "Nenhuma nota ainda.";
}

function renderTags() {
  const tags = allTags(state.notes);
  if (state.tag && !tags.includes(state.tag)) state.tag = null;
  $("tags").replaceChildren(
    ...tags.map((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = `#${tag}`;
      chip.setAttribute("aria-pressed", String(state.tag === tag));
      chip.addEventListener("click", () => {
        state.tag = state.tag === tag ? null : tag;
        renderTags();
        renderList();
      });
      return chip;
    }),
  );
}

function renderEditor() {
  const note = active();
  $("placeholder").hidden = Boolean(note);
  $("panes").hidden = !note;
  document.querySelectorAll(".toolbar button:not(#back)").forEach((b) => (b.disabled = !note));
  if (!note) return;

  if (textarea.value !== note.content) textarea.value = note.content;
  preview.innerHTML = renderMarkdown(note.content); // seguro: renderMarkdown escapa todo o texto
  $("pin").setAttribute("aria-pressed", String(note.pinned));
  $("pin").textContent = note.pinned ? "Desafixar" : "Fixar";
  $("panes").dataset.mode = state.mode;
  $("mode-edit").setAttribute("aria-pressed", String(state.mode === "edit"));
  $("mode-preview").setAttribute("aria-pressed", String(state.mode === "preview"));
}

function render() {
  renderTags();
  renderList();
  renderEditor();
}

const formatDate = (ts) => new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/* -------------------------------------------------------------------------
   Ações
   ------------------------------------------------------------------------- */
async function save(note) {
  $("save-status").textContent = "Salvando…";
  await store.put(note);
  $("save-status").textContent = "Salvo";
}

function open(id) {
  state.activeId = id;
  app.dataset.view = "editor";
  render();
  if (state.mode === "edit") textarea.focus();
}

async function newNote(content = "") {
  const note = createNote(content);
  state.notes.push(note);
  await save(note);
  state.mode = "edit";
  state.query = "";
  $("search").value = "";
  open(note.id);
}

let saveTimer;
textarea.addEventListener("input", () => {
  const note = active();
  if (!note) return;
  note.content = textarea.value;
  note.updatedAt = Date.now();
  $("save-status").textContent = "Editando…";
  preview.innerHTML = renderMarkdown(note.content); // atualiza a visualização ao vivo
  renderList();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    save(note);
    renderTags();
  }, 400);
});

// Tab insere 2 espaços (útil para código), Shift+Tab sai do campo normalmente
textarea.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || event.shiftKey) return;
  event.preventDefault();
  const { selectionStart: start, selectionEnd: end } = textarea;
  textarea.setRangeText("  ", start, end, "end");
  textarea.dispatchEvent(new Event("input"));
});

// Clicar numa tarefa no modo visualizar atualiza o texto da nota
preview.addEventListener("change", async (event) => {
  const index = event.target.dataset?.task;
  const note = active();
  if (index === undefined || !note) return;
  note.content = toggleTask(note.content, Number(index));
  note.updatedAt = Date.now();
  await save(note);
  render();
});

$("note-list").addEventListener("click", (event) => {
  const item = event.target.closest(".note-item");
  if (item) open(item.dataset.id);
});

$("new-note").addEventListener("click", () => newNote());
$("back").addEventListener("click", () => {
  app.dataset.view = "list";
  $("note-list").querySelector(`[data-id="${state.activeId}"]`)?.focus();
});

const setMode = (mode) => {
  state.mode = mode;
  renderEditor();
  (mode === "edit" ? textarea : preview).focus();
};
$("mode-edit").addEventListener("click", () => setMode("edit"));
$("mode-preview").addEventListener("click", () => setMode("preview"));

$("pin").addEventListener("click", async () => {
  const note = active();
  note.pinned = !note.pinned;
  await save(note);
  render();
});

$("duplicate").addEventListener("click", async () => {
  const copy = duplicateNote(active());
  state.notes.push(copy);
  await save(copy);
  open(copy.id);
  toast("Nota duplicada.");
});

$("download").addEventListener("click", () => {
  const note = active();
  const name = noteTitle(note.content).toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "nota";
  download(new Blob([note.content], { type: "text/markdown" }), `${name}.md`);
});

// Exclusão com "Desfazer" em vez de caixa de confirmação
$("delete").addEventListener("click", async () => {
  const note = active();
  state.notes = state.notes.filter((n) => n.id !== note.id);
  await store.delete(note.id);
  state.activeId = sortNotes(state.notes)[0]?.id ?? null;
  app.dataset.view = "list";
  render();
  toast("Nota excluída.", "Desfazer", async () => {
    state.notes.push(note);
    await store.put(note);
    open(note.id);
  });
});

$("search").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderList();
});

/* --- Backup ----------------------------------------------------------- */
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("export").addEventListener("click", () => {
  const date = new Date().toISOString().slice(0, 10);
  download(new Blob([toBackup(state.notes)], { type: "application/json" }), `dev-notes-${date}.json`);
  toast(`Backup com ${state.notes.length} nota(s) baixado.`);
});

$("import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const imported = parseBackup(await file.text());
    const ids = new Set(state.notes.map((n) => n.id));
    const fresh = imported.filter((n) => !ids.has(n.id)); // não duplica o que já existe
    await store.putMany(fresh);
    state.notes.push(...fresh);
    render();
    toast(`${fresh.length} nota(s) importada(s).`);
  } catch (error) {
    toast(error.message);
  }
});

/* --- Toast ------------------------------------------------------------ */
let toastTimer;
function toast(message, actionLabel, action) {
  const box = $("toast");
  const button = $("toast-action");
  $("toast-text").textContent = message;
  button.hidden = !actionLabel;
  button.textContent = actionLabel ?? "";
  button.onclick = async () => {
    box.hidden = true;
    await action?.();
  };
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 6000);
}

/* --- Atalhos ---------------------------------------------------------- */
document.addEventListener("keydown", (event) => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === "k") {
    event.preventDefault();
    app.dataset.view = "list";
    $("search").focus();
  } else if (event.altKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    newNote();
  } else if (mod && event.key.toLowerCase() === "e" && active()) {
    event.preventDefault();
    setMode(state.mode === "edit" ? "preview" : "edit");
  }
});

/* --- PWA -------------------------------------------------------------- */
let installPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("install").hidden = false;
});
$("install").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("install").hidden = true;
});

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js");
}

/* --- Início ----------------------------------------------------------- */
store = await openStore();
state.notes = await store.all();
if (!state.notes.length) {
  const welcome = createNote(WELCOME);
  await store.put(welcome);
  state.notes = [welcome];
}
state.activeId = sortNotes(state.notes)[0].id;
// Telas largas abrem direto na nota; no celular, começa pela lista
if (matchMedia("(min-width: 48rem)").matches) app.dataset.view = "editor";
render();
