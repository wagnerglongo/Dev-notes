// Selecionar elementos

const notesContainer = document.querySelector("#notes-container");

const noteInput = document.querySelector("#note-content");

const addNoteBtn = document.querySelector(".add-note");

const searchInput = document.querySelector("#search-input");

const exportBtn = document.querySelector("#export-notes");


// Funções

function showNotes(){
  cleanNotes();

  getNotes().forEach((note) => {
    const noteElement = createNote(note.id, note.content, note.fixed);

    notesContainer.appendChild(noteElement);
  });
}

function cleanNotes(){
  notesContainer.replaceChildren([])
}


// Adicionar notas
function addNote() {
  const notes = getNotes();

  const noteObject = {
    id: generateId(),
    content: noteInput.value,
    fixed: false,
  };

  const noteElement = createNote(noteObject.id, noteObject.content);

  notesContainer.appendChild(noteElement);

  notes.push(noteObject);

  saveNotes(notes);

  noteInput.value = "";
}


// gerar Id
function generateId() {
  return Math.floor(Math.random() * 5000);
}

// criar notas
function createNote(id, content, fixed){

  const element = document.createElement("note");

  element.classList.add("note");

  const texterea = document.createElement("textarea");

  texterea.value = content;

  texterea.placeholder = "adicione algum texto";

  element.appendChild(texterea);


  // icones
  const pinIcon = document.createElement("i");

  pinIcon.classList.add(...["bi", "bi-pin"])

  element.appendChild(pinIcon);
// 
  const deleteIcon = document.createElement("i");

  deleteIcon.classList.add(...["bi", "bi-x-lg"]);

  element.appendChild(deleteIcon);
// 
  const duplicateIcon = document.createElement("i");

  duplicateIcon.classList.add(...["bi", "bi-file-earmark-plus"]);

  element.appendChild(duplicateIcon);


  if(fixed){
    element.classList.add("fixed");
  }


  // Eventos do elemento icon
  element.querySelector("textarea").addEventListener("keyup", (e)=> {

    const noteContent = e.target.value;

    updateNote(id, noteContent);
  })

  // fixar
  element.querySelector(".bi-pin").addEventListener("click", () => {
    toggleFixNote(id);
  });
  // deletar
  element.querySelector(".bi-x-lg").addEventListener("click", () => {
    deleteNote(id, element);
  });
  // copiar
  element.querySelector(".bi-file-earmark-plus").addEventListener("click", () => {
    copyNote(id);
  });
 

  return element;
}

function toggleFixNote(id){
  const notes = getNotes();

  const targetNote = notes.filter((note) => note.id === id)[0];

  targetNote.fixed = !targetNote.fixed;

  saveNotes(notes);
  showNotes();
  
}

function deleteNote(id, element){
  const notes = getNotes().filter((note) => note.id !== id)

  saveNotes(notes);
  notesContainer.removeChild(element);
}

function copyNote(id){
  const notes =getNotes();

  const targetNote = notes.filter((note) => note.id ===id)[0];

  const noteObject = {
    id:generateId(),
    content:targetNote.content,
    fixed:false,
  };

  const noteElement = createNote(noteObject.id, noteObject.content, noteObject.fixed);

  notesContainer.appendChild(noteElement);

  notes.push(noteObject);

  saveNotes(notes);
}

// fuction para atualizar

function updateNote(id, conteudo){
  const notes = getNotes()

  const targetNote = notes.filter((note) => note.id === id)[0];

  targetNote.content = conteudo;

  saveNotes(notes);
}


// pegar notas do storage
function getNotes(){
  const notes =  JSON.parse(localStorage.getItem("notes") || "[]");

  const orderdNotes = notes.sort((a, b) => (a.fixed > b.fixed ? -1 :1))

  return notes;
}

// salvar no local storage
function saveNotes(notes){
  localStorage.setItem("notes", JSON.stringify(notes));
}


function searchNotes(search){

  const searchResults = getNotes().filter((note) =>  note.content.includes(search));

  if(search !==""){
    cleanNotes();

    searchResults.forEach((note) => {
      const noteElement = createNote(note.id, note.content);
      notesContainer.appendChild(noteElement);
    });
    return;
  }

  cleanNotes();
  showNotes();
}

// exportando csv 
function exportData(){

  // pegando as notas
  const notes = getNotes();

  // criando padrao csv
  const csvString = [
    ["ID", "Conteudo", "fixado"],
    ...notes.map((note) => [note.id, note.content, note.fixed]),
  ].map((e) => e.join(",")).join("\n");

  const element = document.createElement("a");

  element.href = "data:text/csv;charset=utf-8," + encodeURI(csvString);


  element.target = "_blank"

  element.download ="notes.csv";

  element.click();
}




// Eventos

// adicionar nota
addNoteBtn.addEventListener("click", () => addNote());

// busca
searchInput.addEventListener("keyup", (e) =>{

  const search = e.target.value;

  searchNotes(search);

   
});

// adicionar nota apertando enter
noteInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){
    addNote();
  }
})


exportBtn.addEventListener("click", ()=> {
  exportData();
})


// inicializaçao
showNotes();