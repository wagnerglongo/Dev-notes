/**
 * Regras das notas: criação, título, etiquetas, busca, ordenação e backup.
 * Funções puras, sem DOM nem armazenamento, testadas em tests/notes.test.js.
 */

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createNote(content = "", now = Date.now()) {
  return { id: newId(), content, pinned: false, createdAt: now, updatedAt: now };
}

export const duplicateNote = (note, now = Date.now()) => ({
  ...createNote(note.content, now),
});

/** Título = primeira linha com texto, sem marcações de Markdown. */
export function noteTitle(content) {
  const first = content.split("\n").find((line) => line.trim()) ?? "";
  const clean = first
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "")
    .replace(/[*_~`]/g, "")
    .trim();
  return clean.slice(0, 80) || "Nota sem título";
}

/** Prévia: o texto depois do título, sem marcações. */
export function notePreview(content) {
  const lines = content
    .replace(/```[\s\S]*?```/g, "") // blocos de código não entram na prévia
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.replace(/^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/, ""));
  return lines.slice(1).join(" ").replace(/[#*_~`[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Etiquetas no formato #palavra (não pega títulos "# Texto" nem código). */
export function extractTags(content) {
  const withoutCode = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  const tags = new Set();
  for (const match of withoutCode.matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu)) tags.add(match[2].toLowerCase());
  return [...tags].sort();
}

/** Minúsculas e sem acento: "Função" e "funcao" se encontram. */
export const normalize = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Busca por palavras (todas precisam aparecer) e filtro opcional por etiqueta. */
export function filterNotes(notes, { query = "", tag = null } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return notes.filter((note) => {
    if (tag && !extractTags(note.content).includes(tag)) return false;
    const haystack = normalize(note.content);
    return words.every((w) => haystack.includes(w));
  });
}

/** Fixadas primeiro; dentro de cada grupo, a editada por último vem antes. Não altera o array original. */
export const sortNotes = (notes) =>
  [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

export const allTags = (notes) => [...new Set(notes.flatMap((n) => extractTags(n.content)))].sort();

/* --- Backup ----------------------------------------------------------- */

export const BACKUP_VERSION = 1;

export const toBackup = (notes, now = Date.now()) =>
  JSON.stringify({ app: "dev-notes", version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), notes }, null, 2);

/** Lê um backup e devolve só notas válidas. Lança erro com mensagem amigável. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const list = Array.isArray(data) ? data : data?.notes;
  if (!Array.isArray(list)) throw new Error("O arquivo não tem uma lista de notas.");

  const now = Date.now();
  return list
    .filter((n) => n && typeof n.content === "string")
    .map((n) => ({
      id: typeof n.id === "string" && n.id ? n.id : newId(),
      content: n.content.slice(0, 200_000),
      pinned: Boolean(n.pinned ?? n.fixed),
      createdAt: Number.isFinite(n.createdAt) ? n.createdAt : now,
      updatedAt: Number.isFinite(n.updatedAt) ? n.updatedAt : now,
    }));
}

/**
 * Converte as notas da versão antiga do app (localStorage "notes",
 * formato { id: number, content, fixed }) para o formato novo.
 */
export function migrateLegacy(raw, now = Date.now()) {
  try {
    const list = JSON.parse(raw ?? "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter((n) => n && typeof n.content === "string" && n.content.trim())
      .map((n, i) => ({ ...createNote(n.content, now - i), pinned: Boolean(n.fixed) }));
  } catch {
    return [];
  }
}
