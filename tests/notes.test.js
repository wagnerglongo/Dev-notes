import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNote, duplicateNote, extractTags, filterNotes, migrateLegacy,
  noteTitle, notePreview, parseBackup, sortNotes, toBackup,
} from "../src/notes.js";

test("cada nota recebe um ID único", () => {
  const ids = new Set(Array.from({ length: 2000 }, () => createNote("x").id));
  assert.equal(ids.size, 2000);
});

test("título vem da primeira linha, sem marcações", () => {
  assert.equal(noteTitle("\n\n## Configurar **Docker**\nresto"), "Configurar Docker");
  assert.equal(noteTitle("- [ ] comprar café"), "comprar café");
  assert.equal(noteTitle("   "), "Nota sem título");
  assert.equal(notePreview("# Título\nLinha *dois*\nLinha três"), "Linha dois Linha três");
  assert.equal(notePreview("# Lista\n- [x] feito\n1. passo\n```\ncodigo\n```\n> citação"), "feito passo citação");
});

test("etiquetas ignoram títulos e código", () => {
  const content = "# Título\nUsar #Docker e #ci\n`#naoconta`\n```\n#tambemnao\n```";
  assert.deepEqual(extractTags(content), ["ci", "docker"]);
});

test("busca ignora acentos e maiúsculas e exige todas as palavras", () => {
  const notes = [createNote("Função de deploy com Docker"), createNote("Funcao de teste"), createNote("Outra coisa")];
  assert.equal(filterNotes(notes, { query: "funcao" }).length, 2);
  assert.equal(filterNotes(notes, { query: "FUNÇÃO docker" }).length, 1);
  assert.equal(filterNotes(notes, { query: "" }).length, 3);
});

test("filtro por etiqueta", () => {
  const notes = [createNote("a #php"), createNote("b #python"), createNote("c #php #sql")];
  assert.equal(filterNotes(notes, { tag: "php" }).length, 2);
});

test("ordenação: fixadas primeiro, depois mais recentes, sem alterar o original", () => {
  const a = { ...createNote("a", 1), updatedAt: 1 };
  const b = { ...createNote("b", 3), updatedAt: 3 };
  const c = { ...createNote("c", 2), updatedAt: 2, pinned: true };
  const original = [a, b, c];
  assert.deepEqual(sortNotes(original).map((n) => n.content), ["c", "b", "a"]);
  assert.deepEqual(original.map((n) => n.content), ["a", "b", "c"]);
});

test("duplicar cria nota nova com o mesmo conteúdo", () => {
  const note = { ...createNote("texto"), pinned: true };
  const copy = duplicateNote(note);
  assert.notEqual(copy.id, note.id);
  assert.equal(copy.content, "texto");
  assert.equal(copy.pinned, false);
});

test("backup vai e volta", () => {
  const notes = [createNote("um"), { ...createNote("dois"), pinned: true }];
  assert.deepEqual(parseBackup(toBackup(notes)), notes);
});

test("backup inválido gera mensagem clara e itens ruins são descartados", () => {
  assert.throws(() => parseBackup("não é json"), /JSON válido/);
  assert.throws(() => parseBackup('{"x":1}'), /lista de notas/);
  const parsed = parseBackup(JSON.stringify({ notes: [{ content: "ok" }, { content: 42 }, null] }));
  assert.equal(parsed.length, 1);
  assert.equal(typeof parsed[0].id, "string");
});

test("migra notas da versão antiga (localStorage)", () => {
  const legacy = JSON.stringify([
    { id: 123, content: "nota antiga", fixed: true },
    { id: 123, content: "outra com o mesmo id", fixed: false },
    { id: 9, content: "   ", fixed: false },
  ]);
  const migrated = migrateLegacy(legacy);
  assert.equal(migrated.length, 2);
  assert.notEqual(migrated[0].id, migrated[1].id, "o bug de ID repetido não passa para a versão nova");
  assert.equal(migrated[0].pinned, true);
  assert.deepEqual(migrateLegacy("{quebrado"), []);
});
