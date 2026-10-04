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

  photo.src=d.mainPhoto || placeholderDataURL("Nossa foto");
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
    photo.src=d.mainPhoto || placeholderDataURL("Nossa foto");
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
          src="${item.image}"
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
          src="${m.image}"
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
        src="${g.image}"
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
    image.src=x.image;
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

    showToast(
      "Área privada carregada 🔒"
    );

    // só chega aqui se o usuário está autenticado e o site carregou
    privateSiteReady=true;
    startTimer();

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
