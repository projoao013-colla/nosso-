let data = loadData();
let draft = null;
let editing = false;
let timer;
let privateSiteReady=false;
let importing=false;
let loggingOut=false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function esc(value=""){
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[c]));
}

function uid(prefix="id"){
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function showToast(msg,duration=2200){
  const el=$("#toast");
  if(!el) return;
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t=setTimeout(()=>el.classList.remove("show"),duration);
}

function current(){
  return editing ? draft : data;
}

function initEntryScreen(){
  const d=data;
  const screen=$("#entryScreen");
  const photo=$("#entryPhoto");

  if(!screen) return;

  $("#entryName1").textContent=d.name1 || "Meu Nome";
  $("#entryName2").textContent=d.name2 || "Nome Dela";
  $("#entryTagline").textContent=d.tagline || "Nossa história, nosso lugar.";

  photo.src=imgSrc(d.mainPhoto) || placeholderDataURL("Nossa foto");
  photo.alt=`Foto de ${d.name1 || "vocês"} e ${d.name2 || "vocês"}`;

  document.body.classList.add("entry-locked");

  $("#enterSiteBtn").onclick=()=>{
    screen.classList.add("hidden");
    document.body.classList.remove("entry-locked");
    setTimeout(()=>screen.remove(),750);
  };
}

function bindBasics(){
  const d=current();

  $$("[data-bind]").forEach(el=>{
    const key=el.dataset.bind;
    if(d[key] !== undefined) el.textContent=d[key];
  });

  const photo=$("#mainPhoto");

  if(photo){
    photo.src=imgSrc(d.mainPhoto) || placeholderDataURL("Nossa foto");
    photo.alt=`Foto de ${d.name1 || "vocês"} e ${d.name2 || "vocês"}`;
  }
}

function placeholderDataURL(text){
  const svg=`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#24131b"/>
        <stop offset="1" stop-color="#10131d"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%"
      dominant-baseline="middle"
      text-anchor="middle"
      fill="#d95772"
      font-family="serif"
      font-size="52">
      ♥ ${text}
    </text>
  </svg>`;

  return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}

// Foto cuja URL não pôde ser gerada (ex.: arquivo apagado) continua no dado
// como "storage:fotos/..."; na tela mostramos um aviso em vez de tentar
// carregar esse valor como se fosse uma imagem.
function imgSrc(value){
  return isStoragePath(value)
    ? placeholderDataURL("Foto indisponível")
    : value;
}

function countUnavailablePhotos(d){
  let n=isStoragePath(d.mainPhoto) ? 1 : 0;

  ["timeline","memories","gallery"].forEach(k=>{
    (d[k]||[]).forEach(item=>{
      if(item && isStoragePath(item.image)) n++;
    });
  });

  return n;
}

function renderTimeline(){
  const el=$("#timeline");
  const d=current();

  if(!el) return;

  if(!d.timeline.length){
    el.innerHTML='<div class="no-data">Ainda não existem momentos. Entre no modo de edição para adicionar o primeiro. ♥</div>';
    return;
  }

  el.innerHTML=d.timeline.map(item=>`
    <article class="timeline-item">
      <span class="timeline-dot"></span>
      <span class="date-label">${esc(item.date)}</span>

      <h3>${esc(item.title)}</h3>
      <p>${esc(item.text)}</p>

      ${item.image ? `
        <img
          class="item-image"
          src="${imgSrc(item.image)}"
          alt="${esc(item.title)}"
        >
      ` : ""}

      <div class="item-actions edit-only">
        <button class="small-btn"
          onclick="openMomentForm('${item.id}')">
          ✏️ Editar
        </button>

        <button class="small-btn"
          onclick="removeItem('timeline','${item.id}')">
          🗑️ Excluir
        </button>
      </div>
    </article>
  `).join("");
}

function renderMemories(){
  const el=$("#memoriesGrid");
  const d=current();

  if(!el) return;

  if(!d.memories.length){
    el.innerHTML='<div class="no-data">Nenhuma memória ainda.</div>';
    return;
  }

  el.innerHTML=d.memories.map(m=>`
    <article class="memory-card">

      ${m.image ? `
        <img
          src="${imgSrc(m.image)}"
          alt="${esc(m.title)}"
        >
      ` : ""}

      <div class="card-body">
        <span class="date-label">${esc(m.date)}</span>

        <h3>${esc(m.title)}</h3>
        <p>${esc(m.description)}</p>

        <div class="item-actions edit-only">
          <button class="small-btn"
            onclick="openMemoryForm('${m.id}')">
            ✏️ Editar
          </button>

          <button class="small-btn"
            onclick="removeItem('memories','${m.id}')">
            🗑️ Excluir
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderGallery(){
  const el=$("#galleryGrid");
  const d=current();

  if(!el) return;

  if(!d.gallery.length){
    el.innerHTML='<div class="no-data">Adicione a primeira foto para começar nossa galeria. ♥</div>';
    return;
  }

  el.innerHTML=d.gallery.map(g=>`
    <article
      class="gallery-item"
      onclick="openImage('${g.id}')"
    >

      <img
        src="${imgSrc(g.image)}"
        alt="${esc(g.caption || "Foto do casal")}"
        loading="lazy"
      >

      <div class="gallery-caption">
        ${esc(g.caption || "")}
        <br>
        <small>${esc(g.date || "")}</small>
      </div>

      <div
        class="item-actions edit-only"
        style="position:absolute;top:8px;left:8px;z-index:2"
      >
        <button
          class="small-btn"
          onclick="event.stopPropagation();openPhotoForm('${g.id}')"
        >
          ✏️
        </button>

        <button
          class="small-btn"
          onclick="event.stopPropagation();removeItem('gallery','${g.id}')"
        >
          🗑️
        </button>
      </div>

    </article>
  `).join("");
}

function renderDates(){
  const el=$("#datesGrid");
  const d=current();
  const today=new Date();

  if(!el) return;

  if(!d.dates.length){
    el.innerHTML='<div class="no-data">Nenhuma data cadastrada.</div>';
    return;
  }

  el.innerHTML=d.dates.map(x=>{
    const [y,m,day]=x.date.split("-").map(Number);

    let next=new Date(
      today.getFullYear(),
      m-1,
      day
    );

    if(
      next < new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      )
    ){
      next.setFullYear(today.getFullYear()+1);
    }

    const days=Math.ceil(
      (next-new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      )) / 86400000
    );

    return `
      <article class="date-card">

        <div class="date-number">
          ${String(day).padStart(2,"0")}/${String(m).padStart(2,"0")}
        </div>

        <h3>${esc(x.title)}</h3>

        <p>
          ${days===0 ? "É hoje ♥" : `Faltam ${days} dias`}
        </p>

        <div class="item-actions edit-only">

          <button
            class="small-btn"
            onclick="openDateForm('${x.id}')"
          >
            ✏️ Editar
          </button>

          <button
            class="small-btn"
            onclick="removeItem('dates','${x.id}')"
          >
            🗑️ Excluir
          </button>

        </div>

      </article>
    `;
  }).join("");
}

function renderLetters(){
  const el=$("#lettersGrid");
  const d=current();

  if(!el) return;

  if(!d.letters.length){
    el.innerHTML='<div class="no-data">Nenhuma carta ainda.</div>';
    return;
  }

  el.innerHTML=d.letters.map(l=>`
    <article class="letter" id="letter-${l.id}">

      <p class="eyebrow">💌 PARA VOCÊ</p>

      <h3>${esc(l.title)}</h3>

      <div class="closed-text">
        Tenho uma coisa para te dizer...
      </div>

      <div class="letter-content">
        <p style="color:#351f28">
          ${esc(l.text)}
        </p>
      </div>

      <button onclick="toggleLetter('${l.id}')">
        Abrir ❤️
      </button>

      <div class="item-actions edit-only">

        <button
          class="small-btn"
          onclick="openLetterForm('${l.id}')"
        >
          ✏️ Editar
        </button>

        <button
          class="small-btn"
          onclick="removeItem('letters','${l.id}')"
        >
          🗑️ Excluir
        </button>

      </div>

    </article>
  `).join("");
}

function toggleLetter(id){
  const el=$("#letter-"+id);

  if(!el) return;

  el.classList.toggle("open");

  const button=el.querySelector("button");

  if(button){
    button.textContent=
      el.classList.contains("open")
        ? "Fechar ♥"
        : "Abrir ❤️";
  }
}

function renderThings(){
  const el=$("#thingsGrid");
  const d=current();

  if(!el) return;

  el.innerHTML=Object.entries(d.things).map(([key,vals])=>`
    <article class="thing-card">

      <h3>${esc(key)}</h3>

      <ul>
        ${(Array.isArray(vals)?vals:[])
          .map(v=>`<li>${esc(v)}</li>`)
          .join("")}
      </ul>

    </article>
  `).join("");
}

function renderDreams(){
  const el=$("#dreamsList");
  const d=current();

  if(!el) return;

  if(!d.dreams.length){
    el.innerHTML='<div class="no-data">Ainda não temos sonhos cadastrados.</div>';
    return;
  }

  el.innerHTML=d.dreams.map(x=>`
    <label class="dream ${x.done?"done":""}">

      <input
        type="checkbox"
        ${x.done?"checked":""}
        onchange="toggleDream('${x.id}',this.checked)"
      >

      <span>${esc(x.text)}</span>

      <button
        class="small-btn edit-only"
        style="margin-left:auto"
        onclick="event.preventDefault();removeItem('dreams','${x.id}')"
      >
        🗑️
      </button>

    </label>
  `).join("");
}

function renderAll(){
  bindBasics();
  renderTimeline();
  renderMemories();
  renderGallery();
  renderDates();
  renderLetters();
  renderThings();
  renderDreams();
  updateCounter();
  updateEditUI();
  renderToqueIdentity();
}

function updateCounter(){
  const start=new Date(current().relationshipDate);
  const now=new Date();

  if(isNaN(start.getTime())){
    ["years","months","days","hours","minutes","seconds"]
      .forEach(id=>{
        const el=$("#"+id);
        if(el) el.textContent="0";
      });

    const el=$("#daysTogether");
    if(el) el.textContent="Coloque a data do namoro ❤️";

    return;
  }

  if(start>now){
    ["years","months","days","hours","minutes","seconds"]
      .forEach(id=>{
        const el=$("#"+id);
        if(el) el.textContent="0";
      });

    const el=$("#daysTogether");
    if(el) el.textContent="A data do namoro ainda não chegou ❤️";

    return;
  }

  let cursor=new Date(start);
  let years=0;
  let months=0;

  while(
    new Date(
      cursor.getFullYear()+1,
      cursor.getMonth(),
      cursor.getDate(),
      cursor.getHours(),
      cursor.getMinutes(),
      cursor.getSeconds()
    ) <= now
  ){
    cursor.setFullYear(cursor.getFullYear()+1);
    years++;
  }

  while(
    new Date(
      cursor.getFullYear(),
      cursor.getMonth()+1,
      cursor.getDate(),
      cursor.getHours(),
      cursor.getMinutes(),
      cursor.getSeconds()
    ) <= now
  ){
    cursor.setMonth(cursor.getMonth()+1);
    months++;
  }

  const diff=now-cursor;

  const days=Math.floor(diff/86400000);
  const hours=Math.floor(diff%86400000/3600000);
  const minutes=Math.floor(diff%3600000/60000);
  const seconds=Math.floor(diff%60000/1000);

  const values={
    years,
    months,
    days,
    hours,
    minutes,
    seconds
  };

  Object.entries(values).forEach(([id,value])=>{
    const el=$("#"+id);
    if(el) el.textContent=value;
  });

  const el=$("#daysTogether");

  if(el){
    el.textContent=
      `${Math.floor((now-start)/86400000)} dias juntos ♥`;
  }
}

function updateEditUI(){
  document.body.classList.toggle("editing",editing);

  const bar=$("#editBar");
  const button=$("#editBtn");

  if(bar) bar.hidden=!editing;
  if(button) button.hidden=editing;
}

function enterEdit(){
  if(importing){
    showToast("Aguarde a importação terminar.",3500);
    return;
  }

  draft=JSON.parse(JSON.stringify(data));
  editing=true;

  renderAll();
  updateEditUI();

  openMainEditForm();
}

function cancelEdit(){
  editing=false;
  draft=null;

  renderAll();
  updateEditUI();

  showToast("Alterações canceladas");
}

async function saveEdit(){
  if(!draft) return;

  const saveButton=$("#saveBtn");

  if(saveButton){
    saveButton.disabled=true;
    saveButton.textContent="☁️ Salvando...";
  }

  try{
    const cloudData=await prepareImagesForCloud(draft);

    await saveCloudData(cloudData);

    data=await resolvePrivateImages(cloudData);

    editing=false;
    draft=null;

    renderAll();
    updateEditUI();

    showToast("Salvo online ❤️");

  }catch(error){

    console.error(
      "Erro ao salvar no Supabase:",
      error
    );

    showToast(
      "Não foi possível salvar online."
    );

  }finally{

    if(saveButton){
      saveButton.disabled=false;
      saveButton.textContent="💾 Salvar";
    }
  }
}

function fileField(name,label="Imagem"){
  return `
    <label>
      ${label}
      <input
        type="file"
        name="${name}"
        accept="image/*"
      >
    </label>
  `;
}

function fileToDataURL(file){
  return new Promise(resolve=>{
    if(!file){
      resolve("");
      return;
    }

    const reader=new FileReader();

    reader.onload=()=>{
      resolve(reader.result);
    };

    reader.onerror=()=>{
      resolve("");
    };

    reader.readAsDataURL(file);
  });
}

function formDialog(title,fields,onSubmit){
  const dialog=$("#formDialog");

  if(!dialog) return;

  dialog.innerHTML=`
    <form method="dialog" class="edit-form">

      <h2>${esc(title)}</h2>

      ${fields.join("")}

      <div class="form-actions">

        <button type="button" class="small-btn"
          onclick="this.closest('dialog').close()">
          Cancelar
        </button>

        <button type="submit" class="small-btn">
          Salvar
        </button>

      </div>

    </form>
  `;

  dialog.showModal();

  const form=dialog.querySelector("form");

  form.addEventListener("submit",async e=>{
    e.preventDefault();

    const fd=new FormData(form);

    await onSubmit(fd);

    dialog.close();

    renderAll();

    showToast(
      "Alteração preparada. Clique em Salvar ❤️"
    );
  },{once:true});
}

function openMainEditForm(){
  const d=current();

  formDialog(
    "Editar nosso cantinho",
    [
      `
      <label>
        Meu nome
        <input
          name="name1"
          value="${esc(d.name1||"")}"
          required
        >
      </label>
      `,

      `
      <label>
        Nome dela
        <input
          name="name2"
          value="${esc(d.name2||"")}"
          required
        >
      </label>
      `,

      `
      <label>
        Frase
        <input
          name="tagline"
          value="${esc(d.tagline||"")}"
        >
      </label>
      `,

      `
      <label>
        Data do namoro
        <input
          type="datetime-local"
          name="relationshipDate"
          value="${esc(d.relationshipDate||"")}"
          required
        >
      </label>
      `,

      fileField("mainPhoto","Nossa foto")
    ],

    async fd=>{
      draft.name1=fd.get("name1");
      draft.name2=fd.get("name2");
      draft.tagline=fd.get("tagline");
      draft.relationshipDate=fd.get("relationshipDate");

      const image=await fileToDataURL(
        fd.get("mainPhoto")
      );

      if(image){
        draft.mainPhoto=image;
      }
    }
  );
}

function openMomentForm(id){
  const old=id
    ? current().timeline.find(x=>x.id===id)
    : null;

  formDialog(
    id ? "Editar momento" : "Adicionar momento",
    [
      `
      <label>
        Título
        <input
          name="title"
          value="${esc(old?.title||"")}"
          required
        >
      </label>
      `,

      `
      <label>
        Data
        <input
          name="date"
          value="${esc(old?.date||"")}"
        >
      </label>
      `,

      `
      <label>
        Texto
        <textarea name="text">${esc(old?.text||"")}</textarea>
      </label>
      `,

      fileField("image")
    ],

    async fd=>{
      const image=await fileToDataURL(
        fd.get("image")
      );

      const item={
        id:old?.id||uid("t"),
        title:fd.get("title"),
        date:fd.get("date"),
        text:fd.get("text"),
        image:image||old?.image||""
      };

      if(old){
        draft.timeline=draft.timeline.map(
          x=>x.id===id ? item : x
        );
      }else{
        draft.timeline.push(item);
      }
    }
  );
}

function openMemoryForm(id){
  const old=id
    ? current().memories.find(x=>x.id===id)
    : null;

  formDialog(
    id ? "Editar memória" : "Adicionar memória",
    [
      `
      <label>
        Título
        <input
          name="title"
          value="${esc(old?.title||"")}"
          required
        >
      </label>
      `,

      `
      <label>
        Data
        <input
          name="date"
          value="${esc(old?.date||"")}"
        >
      </label>
      `,

      `
      <label>
        Descrição
        <textarea name="description">${esc(old?.description||"")}</textarea>
      </label>
      `,

      fileField("image")
    ],

    async fd=>{
      const image=await fileToDataURL(
        fd.get("image")
      );

      const item={
        id:old?.id||uid("m"),
        title:fd.get("title"),
        date:fd.get("date"),
        description:fd.get("description"),
        image:image||old?.image||""
      };

      if(old){
        draft.memories=draft.memories.map(
          x=>x.id===id ? item : x
        );
      }else{
        draft.memories.push(item);
      }
    }
  );
}

function openPhotoForm(id){
  const old=id
    ? current().gallery.find(x=>x.id===id)
    : null;

  formDialog(
    id ? "Editar foto" : "Adicionar foto",
    [
      fileField("image","Foto"),

      `
      <label>
        Legenda
        <input
          name="caption"
          value="${esc(old?.caption||"")}"
        >
      </label>
      `,

      `
      <label>
        Data
        <input
          name="date"
          value="${esc(old?.date||"")}"
        >
      </label>
      `
    ],

    async fd=>{
      const image=await fileToDataURL(
        fd.get("image")
      );

      if(!image && !old){
        showToast("Escolha uma foto.");
        return;
      }

      const item={
        id:old?.id||uid("g"),
        image:image||old?.image||"",
        caption:fd.get("caption"),
        date:fd.get("date")
      };

      if(old){
        draft.gallery=draft.gallery.map(
          x=>x.id===id ? item : x
        );
      }else{
        draft.gallery.push(item);
      }
    }
  );
}

function openDateForm(id){
  const old=id
    ? current().dates.find(x=>x.id===id)
    : null;

  formDialog(
    id ? "Editar data" : "Adicionar data",
    [
      `
      <label>
        Nome da data
        <input
          name="title"
          value="${esc(old?.title||"")}"
          required
        >
      </label>
      `,

      `
      <label>
        Data
        <input
          type="date"
          name="date"
          value="${esc(old?.date||"")}"
          required
        >
      </label>
      `
    ],

    fd=>{
      const item={
        id:old?.id||uid("d"),
        title:fd.get("title"),
        date:fd.get("date")
      };

      if(old){
        draft.dates=draft.dates.map(
          x=>x.id===id ? item : x
        );
      }else{
        draft.dates.push(item);
      }
    }
  );
}

function openLetterForm(id){
  const old=id
    ? current().letters.find(x=>x.id===id)
    : null;

  formDialog(
    id ? "Editar carta" : "Adicionar carta",
    [
      `
      <label>
        Título
        <input
          name="title"
          value="${esc(old?.title||"")}"
        >
      </label>
      `,

      `
      <label>
        Mensagem
        <textarea name="text">${esc(old?.text||"")}</textarea>
      </label>
      `
    ],

    fd=>{
      const item={
        id:old?.id||uid("l"),
        title:fd.get("title"),
        text:fd.get("text")
      };

      if(old){
        draft.letters=draft.letters.map(
          x=>x.id===id ? item : x
        );
      }else{
        draft.letters.push(item);
      }
    }
  );
}

function openThingsForm(){
  const keys=Object.keys(current().things);

  formDialog(
    "Editar nossas coisas",

    keys.map(k=>`
      <label>
        ${esc(k)}

        <textarea name="${esc(k)}">${esc(
          (current().things[k]||[]).join("\n")
        )}</textarea>
      </label>
    `),

    fd=>{
      keys.forEach(k=>{
        draft.things[k]=fd
          .get(k)
          .split("\n")
          .map(x=>x.trim())
          .filter(Boolean);
      });
    }
  );
}

function openDreamForm(){
  formDialog(
    "Adicionar sonho",

    [
      `
      <label>
        Sonho
        <input
          name="text"
          required
          placeholder="Viajar juntos"
        >
      </label>
      `
    ],

    fd=>{
      draft.dreams.push({
        id:uid("s"),
        text:fd.get("text"),
        done:false
      });
    }
  );
}

function removeItem(collection,id){
  if(!confirm("Excluir este item?")) return;

  draft[collection]=draft[collection].filter(
    x=>x.id!==id
  );

  renderAll();

  showToast(
    "Item removido. Clique em Salvar para confirmar."
  );
}

function toggleDream(id,done){
  const item=draft.dreams.find(x=>x.id===id);

  if(item){
    item.done=done;
  }

  renderAll();

  if(done){
    showToast("Mais um sonho vivido ✨");
  }
}

function openImage(id){
  const x=current().gallery.find(
    g=>g.id===id
  );

  if(!x) return;

  const image=$("#modalImage");

  if(image){
    image.src=imgSrc(x.image);
    image.alt=x.caption||"Foto do casal";
  }

  const caption=$("#modalCaption");

  if(caption){
    caption.textContent=[
      x.caption,
      x.date
    ].filter(Boolean).join(" • ");
  }

  $("#imageDialog")?.showModal();
}

function exportBackup(){
  downloadJSON(
    `nosso-site-backup-${new Date().toISOString().slice(0,10)}.json`,
    data
  );

  showToast("Backup exportado 📥");
}

// =====================================================
// IMPORTAÇÃO DE BACKUP
// =====================================================
const MAX_IMPORT_BYTES=5*1024*1024; // 5 MB

const BACKUP_STRING_KEYS=[
  "name1","name2","tagline","relationshipDate",
  "mainPhoto","songTitle","songDescription"
];

// lista -> prefixo usado para gerar IDs que faltam
const BACKUP_LISTS={
  timeline:"t",
  memories:"m",
  gallery:"g",
  dates:"d",
  letters:"l",
  dreams:"s"
};

const BACKUP_ITEM_STRING_FIELDS=[
  "id","title","date","text","description","caption","image"
];

const SAFE_ID=/^[A-Za-z0-9_-]{1,64}$/;

// imagem vazia, data:image, storage:fotos/..., ou http(s) — sem aspas/espaços/<>
const SAFE_IMAGE=/^(?:|data:image\/[a-z0-9.+-]+[;,][^\s"'<>`]*|storage:fotos\/[^\s"'<>`]+|https?:\/\/[^\s"'<>`]+)$/i;

function userError(message){
  const e=new Error(message);
  e.userFacing=true;
  return e;
}

function isPlainObject(v){
  return v!==null && typeof v==="object" && !Array.isArray(v);
}

function validateBackup(raw){
  if(!isPlainObject(raw)){
    throw userError("Formato de backup inválido.");
  }

  const known=Object.keys(defaultData);

  if(!known.some(k=>k in raw)){
    throw userError("Esse arquivo não parece ser um backup deste site.");
  }

  // só aceita campos conhecidos (ignora o resto)
  const picked={};

  known.forEach(k=>{
    if(raw[k]!==undefined && raw[k]!==null){
      picked[k]=raw[k];
    }
  });

  for(const k of BACKUP_STRING_KEYS){
    if(k in picked && typeof picked[k]!=="string"){
      throw userError(`Backup inválido: o campo "${k}" deveria ser texto.`);
    }
  }

  if(picked.mainPhoto && !SAFE_IMAGE.test(picked.mainPhoto)){
    throw userError("Backup inválido: a foto principal tem um formato não aceito.");
  }

  for(const [key,prefix] of Object.entries(BACKUP_LISTS)){
    if(!(key in picked)) continue;

    if(!Array.isArray(picked[key])){
      throw userError(`Backup inválido: "${key}" deveria ser uma lista.`);
    }

    const used=new Set();

    picked[key]=picked[key].map((item,i)=>{
      if(!isPlainObject(item)){
        throw userError(`Backup inválido: item ${i+1} de "${key}" está incorreto.`);
      }

      const out={...item};

      if(typeof out.id==="number") out.id=String(out.id);

      for(const f of BACKUP_ITEM_STRING_FIELDS){
        if(out[f]===undefined || out[f]===null){
          delete out[f];
          continue;
        }

        if(typeof out[f]!=="string"){
          throw userError(`Backup inválido: "${f}" no item ${i+1} de "${key}" deveria ser texto.`);
        }
      }

      if(out.image!==undefined && !SAFE_IMAGE.test(out.image)){
        throw userError(`Backup inválido: imagem do item ${i+1} de "${key}" tem formato não aceito.`);
      }

      if(key==="gallery" && !out.image){
        throw userError(`Backup inválido: foto ${i+1} da galeria está sem imagem.`);
      }

      if(key==="dates" && !/^\d{4}-\d{2}-\d{2}$/.test(out.date||"")){
        throw userError(`Backup inválido: data ${i+1} precisa estar no formato AAAA-MM-DD.`);
      }

      if(key==="dreams" && "done" in out && typeof out.done!=="boolean"){
        throw userError(`Backup inválido: sonho ${i+1} tem "done" incorreto.`);
      }

      // preenche ID faltando (ou inseguro/duplicado)
      if(!(typeof out.id==="string" && SAFE_ID.test(out.id) && !used.has(out.id))){
        let id;

        do{
          id=uid(prefix);
        }while(used.has(id));

        out.id=id;
      }

      used.add(out.id);

      return out;
    });
  }

  if("things" in picked){
    if(!isPlainObject(picked.things)){
      throw userError('Backup inválido: "things" deveria ser um objeto.');
    }

    for(const [k,v] of Object.entries(picked.things)){
      if(!Array.isArray(v) || v.some(x=>typeof x!=="string")){
        throw userError(`Backup inválido: a seção "${k}" deveria ser uma lista de textos.`);
      }
    }
  }

  return mergeData(cloneDefault(),picked);
}

$("#importInput")?.addEventListener(
  "change",
  async e=>{
    const input=e.target;
    const file=input.files[0];

    if(!file) return;

    const reset=()=>{ input.value=""; };

    if(!privateSiteReady){
      showToast("Entre no site antes de importar um backup.",4000);
      reset();
      return;
    }

    if(editing){
      showToast("Salve ou cancele a edição antes de importar um backup.",4500);
      reset();
      return;
    }

    if(importing){
      reset();
      return;
    }

    if(file.size>MAX_IMPORT_BYTES){
      showToast("Arquivo grande demais. O limite é 5 MB.",4500);
      reset();
      return;
    }

    importing=true;

    try{
      let imported;

      try{
        imported=JSON.parse(await file.text());
      }catch{
        throw userError("O arquivo não é um JSON válido.");
      }

      const clean=validateBackup(imported);

      if(editing){
        throw userError("Salve ou cancele a edição antes de importar um backup.");
      }

      const resumo=
        `${clean.timeline.length} momentos, `+
        `${clean.memories.length} memórias, `+
        `${clean.gallery.length} fotos, `+
        `${clean.dates.length} datas, `+
        `${clean.letters.length} cartas e `+
        `${clean.dreams.length} sonhos`;

      if(!confirm(
        "Importar este backup vai SUBSTITUIR todos os dados atuais do site.\n\n"+
        `O backup tem: ${resumo}.\n\n`+
        "Deseja continuar?"
      )){
        showToast("Importação cancelada.");
        return;
      }

      const prepared=
        await prepareImagesForCloud(clean);

      await saveCloudData(prepared);

      data=
        await resolvePrivateImages(prepared);

      renderAll();

      showToast(
        "Backup importado e sincronizado ❤️"
      );

    }catch(err){

      console.error(err);

      showToast(
        err?.userFacing
          ? err.message
          : "Não foi possível importar esse backup.",
        err?.userFacing ? 4500 : 2200
      );

    }finally{

      importing=false;
      reset();

    }
  }
);

$("#themeBtn")?.addEventListener(
  "click",
  ()=>{
    document.body.classList.toggle("light");

    const light=
      document.body.classList.contains("light");

    localStorage.setItem(
      "nosso_theme",
      light ? "light" : "dark"
    );

    $("#themeBtn").textContent=
      light ? "☀️" : "🌙";
  }
);

function loadTheme(){
  const light=
    localStorage.getItem("nosso_theme")==="light";

  document.body.classList.toggle(
    "light",
    light
  );

  if($("#themeBtn")){
    $("#themeBtn").textContent=
      light ? "☀️" : "🌙";
  }
}

$("#musicBtn")?.addEventListener(
  "click",
  ()=>{
    showToast(
      "Adicione sua incorporação de música permitida na versão personalizada."
    );
  }
);

// =====================================================
// BOTÕES DE EDIÇÃO — EVENT DELEGATION
// =====================================================
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  switch (button.id) {
    case "editBtn":
    case "mainEditBtn":
      event.preventDefault();
      enterEdit();
      break;

    case "saveBtn":
      event.preventDefault();
      saveEdit();
      break;

    case "cancelBtn":
      event.preventDefault();
      cancelEdit();
      break;
  }
});

// =====================================================
// SUPABASE PRIVADO — LOGIN E FLUXO DE ACESSO
// =====================================================
function showLoginScreen(message=""){
  let box=$("#privateLogin");

  if(!box){

    box=document.createElement("div");

    box.id="privateLogin";

    box.innerHTML=`
      <div class="private-login-card">

        <div style="font-size:42px">
          ❤️
        </div>

        <h2>Nosso cantinho</h2>

        <p>
          Este espaço é privado.
        </p>

        <form id="privateLoginForm">

          <input
            id="privateEmail"
            type="email"
            autocomplete="email"
            placeholder="Seu e-mail"
            required
          >

          <input
            id="privatePassword"
            type="password"
            autocomplete="current-password"
            placeholder="Sua senha"
            required
          >

          <button type="submit">
            Entrar ❤️
          </button>

          <small id="privateLoginMessage"></small>

        </form>

      </div>
    `;

    Object.assign(box.style,{
      position:"fixed",
      inset:"0",
      zIndex:"99999",
      display:"grid",
      placeItems:"center",
      background:"rgba(8,10,18,.98)",
      padding:"20px"
    });

    const style=document.createElement("style");

    style.textContent=`
      #privateLogin .private-login-card{
        width:min(390px,100%);
        padding:28px;
        border-radius:24px;
        background:#151824;
        color:#fff;
        text-align:center;
        box-shadow:0 20px 80px rgba(0,0,0,.5)
      }

      #privateLogin input,
      #privateLogin button{
        width:100%;
        box-sizing:border-box;
        padding:13px 14px;
        margin-top:10px;
        border-radius:12px;
        border:1px solid #34394a;
        font:inherit
      }

      #privateLogin input{
        background:#0d1018;
        color:#fff
      }

      #privateLogin button{
        border:0;
        background:#b83252;
        color:#fff;
        font-weight:700;
        cursor:pointer
      }

      #privateLogin small{
        display:block;
        min-height:20px;
        margin-top:10px;
        color:#ff9db2
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(box);

    $("#privateLoginForm").addEventListener(
      "submit",
      async e=>{
        e.preventDefault();

        const msg=$("#privateLoginMessage");

        msg.textContent="Entrando...";

        const {
          data:authData,
          error
        }=
        await supabaseClient.auth.signInWithPassword({
          email:$("#privateEmail").value.trim(),
          password:$("#privatePassword").value
        });

        if(error){
          msg.textContent=
            "E-mail ou senha incorretos.";

          return;
        }

        if(
          !AUTHORIZED_USER_IDS.has(
            authData.user.id
          )
        ){

          await supabaseClient.auth.signOut();

          msg.textContent=
            "Esta conta não tem acesso a este site.";

          return;
        }

        box.remove();

        await startPrivateSite();
      }
    );
  }

  if(message){
    $("#privateLoginMessage").textContent=
      message;
  }
}

async function startPrivateSite(){

  try{

    const cloud=
      await loadCloudData();

    if(cloud){

      data=
        await resolvePrivateImages(cloud);

      saveData(cloud);

    }else{

      const local=
        loadData();

      const prepared=
        await prepareImagesForCloud(
          local
        );

      await saveCloudData(
        prepared
      );

      data=
        await resolvePrivateImages(
          prepared
        );
    }

    initEntryScreen();

    renderAll();

    const unavailable=countUnavailablePhotos(data);

    showToast(
      unavailable
        ? `Área privada carregada 🔒 (${unavailable} foto(s) indisponível(is))`
        : "Área privada carregada 🔒",
      unavailable ? 4500 : 2200
    );

    // só chega aqui se o usuário está autenticado e o site carregou
    privateSiteReady=true;
    startTimer();

    // Toque (Realtime): isolado e sem await — uma falha aqui NUNCA derruba o site
    initToque().catch(e=>console.warn("Toque:",e));

  }catch(error){

    console.error(
      "Erro na área privada:",
      error
    );

    privateSiteReady=false;
    stopTimer();

    showLoginScreen(
      "Não foi possível carregar seus dados. Tente novamente."
    );
  }
}

// =====================================================
// TIMER (só roda com o site carregado e usuário autenticado)
// =====================================================
function startTimer(){
  if(timer) return;

  timer=setInterval(updateCounter,1000);
}

function stopTimer(){
  clearInterval(timer);
  timer=undefined;
}

// =====================================================
// RENOVAÇÃO AUTOMÁTICA DAS URLs TEMPORÁRIAS DAS FOTOS
// =====================================================
const PHOTO_REFRESH_COOLDOWN=30*1000;      // mesma foto: no máx. 1 renovação a cada 30s
const PHOTO_IMG_RETRY_COOLDOWN=60*1000;    // mesma <img>: no máx. 1 tentativa por minuto
const PHOTO_EXPIRY_MARGIN=5*60*1000;       // renova se faltar menos de 5 min

const photoRefreshState=new Map();         // caminho -> { promise, url, at }

const PHOTO_URL_RE=new RegExp(
  `/storage/v1/object/(?:sign|public)/${PRIVATE_BUCKET}/([^?#]+)`
);

function photoPathFromUrl(url){
  if(typeof url!=="string") return "";

  const m=url.match(PHOTO_URL_RE);

  if(!m) return "";

  try{
    return decodeURIComponent(m[1]);
  }catch{
    return m[1];
  }
}

// lê a data de expiração (claim "exp") do token da URL assinada
function photoUrlExpiry(url){
  try{
    const token=new URL(url).searchParams.get("token");

    if(!token) return 0;

    const payload=token.split(".")[1];

    const json=JSON.parse(
      atob(payload.replace(/-/g,"+").replace(/_/g,"/"))
    );

    return json.exp ? json.exp*1000 : 0;
  }catch{
    return 0;
  }
}

function refreshPhotoUrl(path){
  const state=photoRefreshState.get(path);

  if(state){
    if(state.promise) return state.promise;

    if(Date.now()-state.at<PHOTO_REFRESH_COOLDOWN){
      return Promise.resolve(state.url);
    }
  }

  const promise=(async()=>{
    try{
      const url=await signPrivatePath(path);

      photoRefreshState.set(path,{promise:null,url,at:Date.now()});

      return url;
    }catch(error){
      console.warn("Não foi possível renovar a foto:",path,error);

      photoRefreshState.set(path,{promise:null,url:null,at:Date.now()});

      return null;
    }
  })();

  photoRefreshState.set(path,{
    promise,
    url:state?.url||null,
    at:state?.at||0
  });

  return promise;
}

function applyPhotoUrl(path,newUrl){
  const swap=item=>{
    if(item && photoPathFromUrl(item.image)===path){
      item.image=newUrl;
    }
  };

  [data,draft].forEach(src=>{
    if(!src) return;

    if(photoPathFromUrl(src.mainPhoto)===path){
      src.mainPhoto=newUrl;
    }

    ["timeline","memories","gallery"].forEach(k=>{
      (src[k]||[]).forEach(swap);
    });
  });

  $$("img").forEach(img=>{
    const cur=img.getAttribute("src");

    if(photoPathFromUrl(cur)===path && cur!==newUrl){
      img.dataset.photoRetryAt=String(Date.now());
      img.src=newUrl;
    }
  });
}

async function renewPhoto(path){
  const url=await refreshPhotoUrl(path);

  if(url) applyPhotoUrl(path,url);
}

// foto falhou ao carregar -> gera nova URL (error não "borbulha", então usa captura)
document.addEventListener("error",event=>{
  const img=event.target;

  if(!(img instanceof HTMLImageElement)) return;

  const path=photoPathFromUrl(img.getAttribute("src"));

  if(!path) return;

  const last=Number(img.dataset.photoRetryAt||0);

  if(Date.now()-last<PHOTO_IMG_RETRY_COOLDOWN) return;

  img.dataset.photoRetryAt=String(Date.now());

  renewPhoto(path);
},true);

// voltou para a aba -> renova as fotos expiradas ou prestes a expirar
async function refreshExpiringPhotos(){
  if(!privateSiteReady) return;

  const now=Date.now();
  const paths=new Set();

  const check=url=>{
    const p=photoPathFromUrl(url);

    if(!p) return;

    const exp=photoUrlExpiry(url);

    if(exp && exp-now<PHOTO_EXPIRY_MARGIN){
      paths.add(p);
    }
  };

  [data,draft].forEach(src=>{
    if(!src) return;

    check(src.mainPhoto);

    ["timeline","memories","gallery"].forEach(k=>{
      (src[k]||[]).forEach(item=>check(item?.image));
    });
  });

  $$("img").forEach(img=>check(img.getAttribute("src")));

  await Promise.all([...paths].map(renewPhoto));
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    refreshExpiringPhotos();
  }
});

// =====================================================
// LOGOUT
// =====================================================
const SUPABASE_PROJECT_REF=(()=>{
  try{
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  }catch{
    return "";
  }
})();

function clearPrivateLocalData(){
  try{
    localStorage.removeItem(STORAGE_KEY);

    // sessão do Supabase deste projeto (não mexe em outros apps do mesmo domínio)
    if(SUPABASE_PROJECT_REF){
      const prefix=`sb-${SUPABASE_PROJECT_REF}-auth-token`;

      Object.keys(localStorage)
        .filter(k=>k.startsWith(prefix))
        .forEach(k=>localStorage.removeItem(k));
    }
  }catch(error){
    console.error("Erro ao limpar dados locais:",error);
  }
}

async function logout(){
  if(loggingOut) return;

  loggingOut=true;
  stopTimer();
  privateSiteReady=false;

  try{
    const {error}=await supabaseClient.auth.signOut();

    if(error) console.error("Erro no signOut:",error);
  }catch(error){
    console.error("Erro no signOut:",error);
  }

  clearPrivateLocalData();

  location.reload();
}

// qualquer botão/link com id="logoutBtn" ou data-logout dispara o logout
document.addEventListener("click",event=>{
  const el=event.target.closest("#logoutBtn, [data-logout]");

  if(!el) return;

  event.preventDefault();

  logout();
});

// =====================================================
// TOQUE — carinhos e desenhos em tempo real (Supabase Realtime)
// =====================================================
// Eventos ficam na tabela public.toques (RLS: só os 2 usuários autorizados).
// Desenhos vão como PNG para o bucket privado "fotos" (pasta toque/); o evento
// guarda só o caminho e quem recebe gera a Signed URL.
const TOQUE_COOLDOWN_MS=1500;
const TOQUE_STAGE_MS=4200;
const TOQUE_DRAW_PREFIX="storage:fotos/toque/";

const TOQUE_TIPOS={
  carinho:{emoji:"❤️",enviado:"Carinho enviado ❤️",msg:n=>`${n} mandou um carinho para você!`},
  abraco:{emoji:"🫂",enviado:"Abraço enviado 🫂",msg:n=>`${n} mandou um abraço para você!`},
  beijo:{emoji:"💋",enviado:"Beijo enviado 💋",msg:n=>`${n} mandou um beijo para você!`},
  saudade:{emoji:"🥰",enviado:"Saudade enviada 🥰",msg:n=>`${n} está com saudade de você!`},
  desenho:{emoji:"✏️",enviado:"Desenho enviado ❤️",msg:n=>`${n} desenhou algo para você!`}
};

const toque={
  me:"",other:"",channel:null,started:false,
  seen:new Set(),queue:[],running:false,
  lastSentAt:0,subscribedOnce:false,stageTimer:null,lastRow:null
};

const toqueDraw={
  ctx:null,w:0,h:0,pid:null,last:null,mid:null,
  ink:false,color:"#241a1f",size:5,ro:null,sending:false
};

function toqueReducedMotion(){
  return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// ---------- identidade (quem é você neste aparelho) ----------
function toqueIdentityKey(){ return `nosso_toque_eu_${toque.me}`; }

function toqueIdentity(){
  try{
    const v=localStorage.getItem(toqueIdentityKey());
    return v==="1"||v==="2" ? v : "";
  }catch{ return ""; }
}

function toqueNames(){
  return {
    "1":String(data?.name1||"").trim()||"Seu amor",
    "2":String(data?.name2||"").trim()||"Seu amor"
  };
}

function toqueSenderName(){
  const id=toqueIdentity();
  return (id ? toqueNames()[id] : "Seu amor").slice(0,40);
}

function toqueRowName(row){
  return String(row?.remetente_nome||"").trim().slice(0,40)||"Seu amor";
}

function renderToqueIdentity(){
  const box=$("#toqueWho");
  if(!box) return;

  const id=toque.me ? toqueIdentity() : "";

  $$("#toqueGrid [data-toque]").forEach(b=>{ b.disabled=!id; });

  if(!toque.me){
    box.hidden=true;
    return;
  }

  const names=toqueNames();
  box.hidden=false;
  box.replaceChildren();

  const q=document.createElement("span");
  q.className="toque-who-q";

  if(!id){
    q.textContent="Quem é você neste aparelho?";
    box.append(q);

    ["1","2"].forEach(k=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="secondary toque-who-btn";
      b.dataset.toqueWho=k;
      b.textContent=names[k];
      box.append(b);
    });
  }else{
    const strong=document.createElement("strong");
    strong.textContent=names[id];
    q.append("Você é ",strong);

    const change=document.createElement("button");
    change.type="button";
    change.className="small-btn";
    change.dataset.toqueWho="";
    change.textContent="Trocar";

    box.append(q,change);
  }
}

function setToqueIdentity(value){
  try{
    if(value==="1"||value==="2") localStorage.setItem(toqueIdentityKey(),value);
    else localStorage.removeItem(toqueIdentityKey());
  }catch{}

  renderToqueIdentity();
}

function setToqueStatus(state,text){
  const st=$("#toqueStatus");
  if(!st) return;

  st.dataset.state=state;
  $("#toqueStatusText").textContent=text;
}

// ---------- partículas ----------
function toqueBurst(layer,emoji,n=10,rise="-60vh"){
  if(!layer || toqueReducedMotion()) return;
  if(layer.childElementCount>40) return;

  for(let i=0;i<n;i++){
    const s=document.createElement("span");
    s.className="toque-p";
    s.textContent=emoji;
    s.setAttribute("aria-hidden","true");
    s.style.setProperty("--x",(6+Math.random()*88).toFixed(0)+"%");
    s.style.setProperty("--s",(1.1+Math.random()*1.6).toFixed(2)+"rem");
    s.style.setProperty("--d",(Math.random()*0.8).toFixed(2)+"s");
    s.style.setProperty("--t",(2+Math.random()*1.4).toFixed(2)+"s");
    s.style.setProperty("--dx",(Math.random()*70-35).toFixed(0)+"px");
    s.style.setProperty("--rise",rise);
    s.addEventListener("animationend",()=>s.remove(),{once:true});
    layer.append(s);
  }
}

// ---------- enviar ----------
function toqueErrorMessage(error){
  const code=String(error?.code||"");
  const msg=String(error?.message||"");

  if(code==="42P01"||code==="PGRST205"||/does not exist|Could not find the table/i.test(msg)){
    return "O Toque ainda não foi configurado no Supabase (falta rodar o SQL).";
  }

  if(code==="42501"||/row-level security|permission denied/i.test(msg)){
    return "Sem permissão para enviar o toque.";
  }

  if(!navigator.onLine) return "Sem internet. Tente de novo.";

  return "Não foi possível enviar agora. Tente de novo.";
}

async function sendToque(tipo,{btn=null,desenhoPath=null}={}){
  if(!TOQUE_TIPOS[tipo]) return false;

  if(!toque.me||!toque.other){
    showToast("O Toque ainda não está pronto.");
    return false;
  }

  if(!toqueIdentity()){
    showToast("Escolha quem você é primeiro.");
    return false;
  }

  const now=Date.now();

  // anti-spam: um toque a cada 1,5 s
  if(tipo!=="desenho" && now-toque.lastSentAt<TOQUE_COOLDOWN_MS) return false;

  toque.lastSentAt=now;

  const {error}=await supabaseClient.from("toques").insert({
    remetente:toque.me,
    destinatario:toque.other,
    remetente_nome:toqueSenderName(),
    tipo,
    desenho_path:desenhoPath
  });

  if(error){
    console.error("Toque: falha ao enviar",error);
    toque.lastSentAt=0;
    showToast(toqueErrorMessage(error),3800);
    return false;
  }

  showToast(TOQUE_TIPOS[tipo].enviado,2000);

  if(btn){
    btn.classList.remove("sent");
    void btn.offsetWidth;
    btn.classList.add("sent");
  }

  toqueBurst($("#toqueFx"),TOQUE_TIPOS[tipo].emoji,7,"-180px");

  return true;
}

// ---------- receber ----------
function toqueValidDrawingPath(p){
  return typeof p==="string" && p.startsWith(TOQUE_DRAW_PREFIX) && !p.includes("..");
}

function onToqueRow(row){
  if(!row||!row.id||toque.seen.has(row.id)) return;
  if(row.destinatario!==toque.me||row.remetente!==toque.other) return;
  if(!TOQUE_TIPOS[row.tipo]) return;
  if(row.tipo==="desenho" && !toqueValidDrawingPath(row.desenho_path)) return;

  toque.seen.add(row.id);

  if(toque.queue.length>=6) toque.queue.shift();
  toque.queue.push(row);

  toqueRun();
}

async function toqueRun(){
  if(toque.running) return;

  toque.running=true;

  try{
    while(toque.queue.length){
      const row=toque.queue.shift();

      try{
        if(row.tipo==="desenho") await toqueShowDrawing(row);
        else await toqueShowStage(row);
      }catch(error){
        console.warn("Toque: erro ao exibir",error);
      }
    }
  }finally{
    toque.running=false;
  }
}

function toqueStageOpen(st){
  st.classList.add("toque-open");

  try{
    if(st.showPopover && !st.matches(":popover-open")) st.showPopover();
  }catch{}
}

function toqueStageClose(st){
  try{
    if(st.hidePopover && st.matches(":popover-open")) st.hidePopover();
  }catch{}

  st.classList.remove("toque-open","in","out");
}

function toqueShowStage(row){
  return new Promise(resolve=>{
    const st=$("#toqueStage");

    if(!st){ resolve(); return; }

    const t=TOQUE_TIPOS[row.tipo];

    $("#toqueStageEmoji").textContent=t.emoji;
    $("#toqueStageText").textContent=t.msg(toqueRowName(row));

    st.classList.remove("in","out");
    void st.offsetWidth;

    toqueStageOpen(st);
    st.classList.add("in");

    toqueBurst($("#toqueStageFx"),t.emoji,16,"-70vh");

    try{ navigator.vibrate && navigator.vibrate([70,40,70]); }catch{}

    clearTimeout(toque.stageTimer);

    toque.stageTimer=setTimeout(()=>{
      st.classList.remove("in");
      st.classList.add("out");

      setTimeout(()=>{
        toqueStageClose(st);
        resolve();
      },450);
    },TOQUE_STAGE_MS);
  });
}

function toqueFormatWhen(iso){
  const d=new Date(iso);

  if(isNaN(d)) return "";

  return d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}

async function toqueSignDrawing(path){
  const p=storagePath(path);

  for(let i=0;i<2;i++){
    try{
      return await signPrivatePath(p);
    }catch(error){
      if(i===0) await new Promise(r=>setTimeout(r,700));
      else console.warn("Toque: não foi possível abrir o desenho",p,error?.message||error);
    }
  }

  return "";
}

function toqueLoadImage(url){
  return new Promise(resolve=>{
    const img=new Image();
    const t=setTimeout(()=>resolve(false),10000);

    img.onload=()=>{ clearTimeout(t); resolve(true); };
    img.onerror=()=>{ clearTimeout(t); resolve(false); };
    img.src=url;
  });
}

async function toqueSetLast(row,knownUrl=""){
  toque.lastRow=row;

  const box=$("#toqueLast");

  if(!box) return;

  box.hidden=false;

  $("#toqueLastCap").textContent=
    `Último desenho recebido · ${toqueRowName(row)} · ${toqueFormatWhen(row.created_at)}`;

  const img=$("#toqueLastImg");
  img.removeAttribute("src");

  const url=knownUrl||await toqueSignDrawing(row.desenho_path);

  if(toque.lastRow===row && url) img.src=url;
}

function toqueOpenViewer(row,url){
  return new Promise(resolve=>{
    const dlg=$("#toqueViewDialog");

    if(!dlg){ resolve(); return; }

    $("#toqueViewTitle").textContent=TOQUE_TIPOS.desenho.msg(toqueRowName(row));
    $("#toqueViewWhen").textContent=toqueFormatWhen(row.created_at);
    $("#toqueViewImg").src=url;

    const done=()=>{
      dlg.removeEventListener("close",done);
      resolve();
    };

    dlg.addEventListener("close",done);

    if(!dlg.open) dlg.showModal();

    toqueBurst($("#toqueViewFx"),"❤️",12,"-60dvh");

    try{ navigator.vibrate && navigator.vibrate([70,40,70]); }catch{}
  });
}

async function toqueShowDrawing(row){
  const url=await toqueSignDrawing(row.desenho_path);

  toqueSetLast(row,url);

  if(!url || !(await toqueLoadImage(url))){
    showToast("O desenho chegou, mas não carregou. Toque em “Último desenho recebido”.",4500);
    return;
  }

  await toqueOpenViewer(row,url);
}

async function toqueOpenLast(){
  const row=toque.lastRow;

  if(!row) return;

  const url=await toqueSignDrawing(row.desenho_path);

  if(!url){
    showToast("Não foi possível abrir o desenho agora.",3000);
    return;
  }

  toqueOpenViewer(row,url);
}

// ---------- buscar eventos (início e reconexão) ----------
async function toqueFetchRecent(limit){
  const {data:rows,error}=await supabaseClient
    .from("toques")
    .select("id,remetente,destinatario,remetente_nome,tipo,desenho_path,created_at")
    .eq("destinatario",toque.me)
    .order("created_at",{ascending:false})
    .limit(limit);

  if(error) throw error;

  return rows||[];
}

// ao abrir o site: eventos antigos são só marcados como vistos (sem animação)
async function toqueBaseline(){
  const rows=await toqueFetchRecent(20);

  rows.forEach(r=>toque.seen.add(r.id));

  const lastDraw=rows.find(r=>
    r.tipo==="desenho" && r.remetente===toque.other && toqueValidDrawingPath(r.desenho_path)
  );

  if(lastDraw) toqueSetLast(lastDraw);
}

// ao voltar para a aba / reconectar: mostra o que chegou enquanto estava fora
async function toqueCatchUp(){
  if(!toque.me) return;

  try{
    const rows=await toqueFetchRecent(10);

    rows.reverse().forEach(r=>onToqueRow(r));
  }catch(error){
    console.warn("Toque: não foi possível buscar eventos perdidos",error?.message||error);
  }
}

function toqueSubscribe(){
  if(toque.channel){
    try{ supabaseClient.removeChannel(toque.channel); }catch{}
    toque.channel=null;
  }

  setToqueStatus("connecting","Conectando…");

  toque.channel=supabaseClient
    .channel(`toque-${toque.me}`)
    .on(
      "postgres_changes",
      {event:"INSERT",schema:"public",table:"toques",filter:`destinatario=eq.${toque.me}`},
      payload=>onToqueRow(payload.new)
    )
    .subscribe((status,err)=>{
      if(status==="SUBSCRIBED"){
        setToqueStatus("on","Conectado · recebendo em tempo real");

        if(toque.subscribedOnce) toqueCatchUp();

        toque.subscribedOnce=true;
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
        console.warn("Toque: realtime",status,err?.message||err);
        setToqueStatus("off","Sem conexão em tempo real");
      }else if(status==="CLOSED"){
        setToqueStatus("off","Desconectado");
      }
    });
}

async function initToque(){
  if(toque.started || !$("#toque")) return;

  toque.started=true;

  try{
    const {data:sess,error}=await supabaseClient.auth.getSession();
    const user=sess?.session?.user;

    if(error||!user||!AUTHORIZED_USER_IDS.has(user.id)){
      throw new Error("sem sessão autorizada");
    }

    const others=[...AUTHORIZED_USER_IDS].filter(id=>id!==user.id);

    if(others.length!==1) throw new Error("usuários autorizados mal configurados");

    toque.me=user.id;
    toque.other=others[0];

    renderToqueIdentity();

    try{ await supabaseClient.realtime.setAuth(sess.session.access_token); }catch{}

    try{ await toqueBaseline(); }
    catch(error){ console.warn("Toque: não foi possível ler eventos",error?.message||error); }

    toqueSubscribe();

  }catch(error){
    console.warn("Toque indisponível:",error?.message||error);

    toque.started=false;
    setToqueStatus("off","Toque indisponível");
  }
}

// ---------- tela de desenho ----------
function toqueSizeCanvas(){
  const cv=$("#toqueCanvas"),wrap=$("#toqueCanvasWrap");

  if(!cv||!wrap) return;

  const r=wrap.getBoundingClientRect();
  const w=Math.floor(r.width),h=Math.floor(r.height);

  if(w<2||h<2) return;
  if(toqueDraw.ctx && w===toqueDraw.w && h===toqueDraw.h) return;

  const dpr=Math.min(window.devicePixelRatio||1,2);

  let snap=null;

  if(toqueDraw.ctx && toqueDraw.ink){
    snap=document.createElement("canvas");
    snap.width=cv.width;
    snap.height=cv.height;
    snap.getContext("2d").drawImage(cv,0,0);
  }

  const oldW=toqueDraw.w,oldH=toqueDraw.h;

  cv.width=Math.round(w*dpr);
  cv.height=Math.round(h*dpr);

  const ctx=cv.getContext("2d");

  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,w,h);

  if(snap && oldW && oldH){
    // mantém o desenho (sem distorcer) se a tela girar/redimensionar
    const k=Math.min(w/oldW,h/oldH);

    ctx.drawImage(snap,0,0,snap.width,snap.height,(w-oldW*k)/2,(h-oldH*k)/2,oldW*k,oldH*k);
  }

  toqueDraw.ctx=ctx;
  toqueDraw.w=w;
  toqueDraw.h=h;
}

function toqueClearCanvas(){
  if(toqueDraw.ctx){
    toqueDraw.ctx.save();
    toqueDraw.ctx.setTransform(1,0,0,1,0,0);
    toqueDraw.ctx.fillStyle="#fff";
    toqueDraw.ctx.fillRect(0,0,$("#toqueCanvas").width,$("#toqueCanvas").height);
    toqueDraw.ctx.restore();
  }

  toqueDraw.ink=false;
}

function openToqueDraw(){
  if(!toque.me){
    showToast("O Toque ainda não está pronto.");
    return;
  }

  if(!toqueIdentity()){
    showToast("Escolha quem você é primeiro.");
    return;
  }

  const dlg=$("#toqueDrawDialog");

  if(!dlg||dlg.open) return;

  document.documentElement.classList.add("toque-lock");
  dlg.showModal();

  requestAnimationFrame(toqueSizeCanvas);

  if(!toqueDraw.ro && "ResizeObserver" in window){
    toqueDraw.ro=new ResizeObserver(()=>toqueSizeCanvas());
    toqueDraw.ro.observe($("#toqueCanvasWrap"));
  }
}

function toqueExportBlob(){
  const cv=$("#toqueCanvas");
  const MAX=1000;

  let out=cv;

  if(cv.width>MAX){
    const k=MAX/cv.width;
    const t=document.createElement("canvas");

    t.width=MAX;
    t.height=Math.round(cv.height*k);

    const c=t.getContext("2d");

    c.fillStyle="#fff";
    c.fillRect(0,0,t.width,t.height);
    c.drawImage(cv,0,0,t.width,t.height);

    out=t;
  }

  return new Promise((resolve,reject)=>{
    out.toBlob(b=>b?resolve(b):reject(new Error("Não foi possível gerar a imagem")),"image/png");
  });
}

async function sendToqueDrawing(){
  if(toqueDraw.sending) return;

  if(!toqueDraw.ink){
    showToast("Desenhe algo primeiro ✏️");
    return;
  }

  const btn=$("#toqueDrawSend");

  toqueDraw.sending=true;
  btn.disabled=true;
  btn.textContent="Enviando…";

  let path="";

  try{
    const blob=await toqueExportBlob();

    const id=(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

    path=`toque/${id}.png`;

    const {error:upError}=await supabaseClient.storage
      .from(PRIVATE_BUCKET)
      .upload(path,blob,{contentType:"image/png",upsert:false});

    if(upError) throw upError;

    const ok=await sendToque("desenho",{desenhoPath:`storage:${PRIVATE_BUCKET}/${path}`});

    if(!ok){
      // evento não foi criado: remove o arquivo para não sobrar lixo
      try{ await supabaseClient.storage.from(PRIVATE_BUCKET).remove([path]); }catch{}
      return;
    }

    $("#toqueDrawDialog").close();
    toqueClearCanvas();

  }catch(error){
    console.error("Toque: falha ao enviar desenho",error);
    showToast("Não foi possível enviar o desenho. Tente de novo.",3800);
  }finally{
    toqueDraw.sending=false;
    btn.disabled=false;
    btn.textContent="Enviar ❤️";
  }
}

(function bindToque(){
  const section=$("#toque");

  section?.addEventListener("click",e=>{
    const who=e.target.closest("[data-toque-who]");

    if(who){
      setToqueIdentity(who.dataset.toqueWho);
      return;
    }

    if(e.target.closest("#toqueLast")){
      toqueOpenLast();
      return;
    }

    const btn=e.target.closest("[data-toque]");

    if(!btn||btn.disabled) return;

    if(btn.dataset.toque==="desenho") openToqueDraw();
    else sendToque(btn.dataset.toque,{btn});
  });

  const view=$("#toqueViewDialog");

  view?.addEventListener("click",e=>{
    if(e.target.closest("[data-toque-view-close]")) view.close();

    if(e.target.closest("[data-toque-reply]")){
      view.close();
      openToqueDraw();
    }
  });

  const dlg=$("#toqueDrawDialog");
  const cv=$("#toqueCanvas");
  const wrap=$("#toqueCanvasWrap");

  if(!dlg||!cv||!wrap) return;

  dlg.addEventListener("close",()=>{
    document.documentElement.classList.remove("toque-lock");
    toqueDraw.pid=null;
  });

  $("#toqueDrawClose").addEventListener("click",()=>dlg.close());
  $("#toqueDrawClear").addEventListener("click",toqueClearCanvas);
  $("#toqueDrawSend").addEventListener("click",sendToqueDrawing);

  dlg.querySelector(".toque-colors").addEventListener("click",e=>{
    const b=e.target.closest("[data-color]");

    if(!b) return;

    toqueDraw.color=b.dataset.color;

    dlg.querySelectorAll(".toque-color").forEach(x=>x.classList.toggle("is-on",x===b));
  });

  // desenho com dedo (celular) ou mouse (computador)
  const pos=ev=>{
    const r=cv.getBoundingClientRect();

    return {x:ev.clientX-r.left,y:ev.clientY-r.top};
  };

  const segment=p=>{
    const c=toqueDraw.ctx;

    if(!c) return;

    const m={x:(toqueDraw.last.x+p.x)/2,y:(toqueDraw.last.y+p.y)/2};

    c.strokeStyle=toqueDraw.color;
    c.lineWidth=toqueDraw.size;
    c.lineCap="round";
    c.lineJoin="round";
    c.beginPath();
    c.moveTo(toqueDraw.mid.x,toqueDraw.mid.y);
    c.quadraticCurveTo(toqueDraw.last.x,toqueDraw.last.y,m.x,m.y);
    c.stroke();

    toqueDraw.last=p;
    toqueDraw.mid=m;
    toqueDraw.ink=true;
  };

  cv.addEventListener("pointerdown",e=>{
    if(toqueDraw.pid!==null||!toqueDraw.ctx) return;
    if(e.pointerType==="mouse" && e.button!==0) return;

    e.preventDefault();

    toqueDraw.pid=e.pointerId;

    try{ cv.setPointerCapture(e.pointerId); }catch{}

    const p=pos(e);

    toqueDraw.last=p;
    toqueDraw.mid=p;

    const c=toqueDraw.ctx;

    c.fillStyle=toqueDraw.color;
    c.beginPath();
    c.arc(p.x,p.y,toqueDraw.size/2,0,Math.PI*2);
    c.fill();

    toqueDraw.ink=true;
  });

  cv.addEventListener("pointermove",e=>{
    if(e.pointerId!==toqueDraw.pid) return;

    e.preventDefault();

    const list=e.getCoalescedEvents ? e.getCoalescedEvents() : [];

    (list.length ? list : [e]).forEach(ev=>segment(pos(ev)));
  });

  const end=e=>{
    if(e.pointerId!==toqueDraw.pid) return;

    toqueDraw.pid=null;

    try{ cv.releasePointerCapture(e.pointerId); }catch{}
  };

  cv.addEventListener("pointerup",end);
  cv.addEventListener("pointercancel",end);
  cv.addEventListener("contextmenu",e=>e.preventDefault());

  // reforço p/ navegadores antigos: o dedo desenhando nunca rola a página
  ["touchstart","touchmove"].forEach(t=>{
    wrap.addEventListener(t,e=>e.preventDefault(),{passive:false});
  });
})();

// volta para a aba / internet voltou -> busca o que chegou enquanto estava fora
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" && toque.started) toqueCatchUp();
});

window.addEventListener("online",()=>{
  if(toque.started) toqueCatchUp();
});

async function bootstrap(){

  loadTheme();

  try{

    const {
      data:sessionData
    }=
    await supabaseClient
      .auth
      .getSession();

    const user=
      sessionData?.session?.user;

    if(
      !user ||
      !AUTHORIZED_USER_IDS.has(
        user.id
      )
    ){

      if(user){
        await supabaseClient.auth.signOut();
      }

      showLoginScreen();

      return;
    }

    await startPrivateSite();

  }catch(error){

    console.error(
      "Supabase indisponível:",
      error
    );

    showLoginScreen(
      "Não foi possível conectar ao site privado."
    );
  }
}

if(document.readyState === "loading"){

  document.addEventListener("DOMContentLoaded", () => {
    bootstrap();
  }, { once: true });

}else{

  bootstrap();

}

// =====================================================
// MENU MOBILE (hamburger)
// =====================================================
(function initMobileNav(){

  const navToggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");

  if(!navToggle || !nav) return;

  function closeNav(){
    nav.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.textContent = "☰";
  }

  function toggleNav(){
    const isOpen = nav.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    navToggle.textContent = isOpen ? "✕" : "☰";
  }

  navToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNav();
  });

  nav.addEventListener("click", (event) => {
    if(event.target.tagName === "A") closeNav();
  });

  document.addEventListener("click", (event) => {
    if(nav.classList.contains("nav-open") && !nav.contains(event.target) && event.target !== navToggle){
      closeNav();
    }
  });

  window.addEventListener("resize", () => {
    if(window.innerWidth > 900) closeNav();
  });

})();

// =====================================================
// ANIMAÇÃO AO ROLAR A TELA (scroll reveal)
// =====================================================
(function initScrollReveal(){

  if(!("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("reveal-ready");

  const targets = document.querySelectorAll(".section:not(.hero)");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if(entry.isIntersecting){
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  targets.forEach((el) => observer.observe(el));

})();
