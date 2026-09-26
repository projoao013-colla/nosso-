const STORAGE_KEY = "nosso_site_casal_v1";

// =====================================================
// SUPABASE
// =====================================================

const SUPABASE_URL =
  "https://xumyfdtkhhbcsqswpqab.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_FrKGk2IcBFE3YJtBaLgGow_Wb_RlNky";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

const SITE_STATE_ID = 1;
const PRIVATE_BUCKET = "fotos";

// =====================================================
// USUÁRIOS AUTORIZADOS
// =====================================================

const AUTHORIZED_USER_IDS = new Set([
  "70206c47-8fa4-46be-a8a8-49cad9c3fce2",
  "e9df605d-e4be-41d4-b73e-676afaff8688"
]);

// =====================================================
// DADOS PADRÃO
// =====================================================

const defaultData = {
  name1: "Meu Nome",
  name2: "Nome Dela",

  tagline:
    "Nosso cantinho, nossa história.",

  relationshipDate:
    "2025-01-01T20:00",

  mainPhoto: "",

  songTitle:
    "Uma música especial",

  songDescription:
    "Adicione aqui uma música que vocês tenham direito de usar ou uma incorporação permitida.",

  timeline: [
    {
      id: "t1",
      date: "01/01/2025",
      title: "Quando nos conhecemos",
      text:
        "O começo de uma história que ainda estamos escrevendo.",
      image: ""
    },

    {
      id: "t2",
      date: "15/01/2025",
      title: "Quando começamos a conversar",
      text:
        "As primeiras conversas, risadas e descobertas.",
      image: ""
    },

    {
      id: "t3",
      date: "14/02/2025",
      title: "Primeiro momento especial",
      text:
        "Um daqueles dias que merecem ficar guardados.",
      image: ""
    }
  ],

  memories: [
    {
      id: "m1",
      title: "Nosso primeiro passeio",
      date: "14/02/2025",
      description:
        "Um dia simples que acabou se tornando uma lembrança especial.",
      image: ""
    }
  ],

  gallery: [],

  dates: [
    {
      id: "d1",
      title: "Início do namoro",
      date: "2025-01-01"
    }
  ],

  letters: [
    {
      id: "l1",
      title: "Leia quando sentir saudade",
      text:
        "Mesmo quando estivermos longe, quero que você lembre que nossa história continua sendo importante para mim."
    }
  ],

  things: {
    "Apelidos": [
      "Meu amor",
      "Amor"
    ],

    "Frases internas": [
      "Essa é só nossa."
    ],

    "Piadas internas": [
      "Nossa piada secreta"
    ],

    "Lugares favoritos": [
      "Nosso lugar favorito"
    ],

    "Comidas favoritas": [
      "Nossa comida favorita"
    ],

    "Filmes e séries": [
      "Nosso filme especial"
    ],

    "Músicas especiais": [
      "Nossa música"
    ],

    "Sonhos": [
      "Tudo o que ainda queremos viver."
    ]
  },

  dreams: [
    {
      id: "s1",
      text: "Viajar juntos",
      done: false
    },

    {
      id: "s2",
      text: "Conhecer um lugar especial",
      done: false
    }
  ]
};

// =====================================================
// UTILITÁRIOS
// =====================================================

function cloneDefault() {
  return JSON.parse(
    JSON.stringify(defaultData)
  );
}

function mergeData(base, saved) {

  if (
    !saved ||
    typeof saved !== "object"
  ) {
    return base;
  }

  return {
    ...base,
    ...saved,

    timeline:
      Array.isArray(saved.timeline)
        ? saved.timeline
        : base.timeline,

    memories:
      Array.isArray(saved.memories)
        ? saved.memories
        : base.memories,

    gallery:
      Array.isArray(saved.gallery)
        ? saved.gallery
        : base.gallery,

    dates:
      Array.isArray(saved.dates)
        ? saved.dates
        : base.dates,

    letters:
      Array.isArray(saved.letters)
        ? saved.letters
        : base.letters,

    dreams:
      Array.isArray(saved.dreams)
        ? saved.dreams
        : base.dreams,

    things:
      saved.things &&
      typeof saved.things === "object"
        ? saved.things
        : base.things
  };
}

// =====================================================
// LOCAL STORAGE
// =====================================================

function loadData() {

  try {

    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return cloneDefault();
    }

    return mergeData(
      cloneDefault(),
      JSON.parse(raw)
    );

  } catch (error) {

    console.error(
      "Erro ao carregar dados locais:",
      error
    );

    return cloneDefault();
  }
}

function saveData(data) {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

  } catch (error) {

    console.error(
      "Erro ao salvar dados locais:",
      error
    );
  }
}

// =====================================================
// STORAGE PATH
// =====================================================
//
// No banco ficará:
//
// storage:fotos/site/abc.jpg
//
// E NÃO uma URL assinada temporária.
//

function isStoragePath(value) {
  return (
    typeof value === "string" &&
    value.startsWith(
      "storage:fotos/"
    )
  );
}

function storagePath(value) {
  if (!isStoragePath(value)) {
    return "";
  }

  return value.slice(
    "storage:fotos/".length
  );
}

// =====================================================
// URL ASSINADA
// =====================================================

async function signPrivatePath(path) {

  if (!path) {
    return "";
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(
        path,
        3600
      );

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

// =====================================================
// TRANSFORMAR STORAGE PATH EM URL TEMPORÁRIA
// =====================================================

async function resolvePrivateImages(obj) {

  const result =
    JSON.parse(
      JSON.stringify(obj)
    );

  async function resolveItem(item) {

    if (
      item &&
      isStoragePath(item.image)
    ) {
      item.image =
        await signPrivatePath(
          storagePath(item.image)
        );
    }
  }

  if (
    isStoragePath(
      result.mainPhoto
    )
  ) {
    result.mainPhoto =
      await signPrivatePath(
        storagePath(
          result.mainPhoto
        )
      );
  }

  for (
    const item of result.timeline || []
  ) {
    await resolveItem(item);
  }

  for (
    const item of result.memories || []
  ) {
    await resolveItem(item);
  }

  for (
    const item of result.gallery || []
  ) {
    await resolveItem(item);
  }

  return result;
}

// =====================================================
// UPLOAD DE DATA URL
// =====================================================

async function uploadDataUrl(
  dataUrl,
  folder = "site"
) {

  if (
    !dataUrl ||
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:")
  ) {
    return dataUrl;
  }

  const response =
    await fetch(dataUrl);

  const blob =
    await response.blob();

  const ext =
    blob.type.includes("png")
      ? "png"
      : "jpg";

  const randomId =
    crypto.randomUUID
      ? crypto.randomUUID()
      : (
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2)
        );

  const path =
    `${folder}/${randomId}.${ext}`;

  const {
    error
  } =
    await supabaseClient
      .storage
      .from(PRIVATE_BUCKET)
      .upload(
        path,
        blob,
        {
          contentType:
            blob.type ||
            "image/jpeg",

          upsert: false
        }
      );

  if (error) {
    throw error;
  }

  // IMPORTANTE:
  // não usamos getPublicUrl().
  //
  // O bucket é privado.
  //
  // Guardamos apenas o caminho permanente.

  return (
    `storage:fotos/${path}`
  );
}

// =====================================================
// PREPARAR TODAS AS IMAGENS
// =====================================================

async function prepareImagesForCloud(obj) {

  const result =
    JSON.parse(
      JSON.stringify(obj)
    );

  async function upload(value) {

    if (
      !value ||
      isStoragePath(value)
    ) {
      return value;
    }

    if (
      typeof value !== "string"
    ) {
      return value;
    }

    if (
      !value.startsWith("data:")
    ) {
      return value;
    }

    return await uploadDataUrl(
      value,
      "site"
    );
  }

  result.mainPhoto =
    await upload(
      result.mainPhoto
    );

  for (
    const item of result.timeline || []
  ) {

    item.image =
      await upload(
        item.image
      );
  }

  for (
    const item of result.memories || []
  ) {

    item.image =
      await upload(
        item.image
      );
  }

  for (
    const item of result.gallery || []
  ) {

    item.image =
      await upload(
        item.image
      );
  }

  return result;
}

// =====================================================
// CARREGAR DO SUPABASE
// =====================================================
//
// IMPORTANTE:
// Aqui NÃO criamos URL assinada.
//
// O banco retorna:
//
// storage:fotos/site/arquivo.jpg
//
// O app resolve isso somente para mostrar na tela.
//

async function loadCloudData() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("site_state")
      .select("data")
      .eq(
        "id",
        SITE_STATE_ID
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.data) {
    return null;
  }

  return mergeData(
    cloneDefault(),
    data.data
  );
}

// =====================================================
// SALVAR NO SUPABASE
// =====================================================

async function saveCloudData(value) {

  if (!value) {
    return;
  }

  const prepared =
    await prepareImagesForCloud(
      value
    );

  const stored =
    JSON.parse(
      JSON.stringify(prepared)
    );

  const {
    error
  } =
    await supabaseClient
      .from("site_state")
      .upsert(
        {
          id: SITE_STATE_ID,

          data: stored,

          updated_at:
            new Date().toISOString()
        },

        {
          onConflict: "id"
        }
      );

  if (error) {
    throw error;
  }

  // Guarda no navegador a versão permanente.
  saveData(stored);

  return stored;
}

// =====================================================
// BACKUP
// =====================================================

function downloadJSON(
  filename,
  data
) {

  const blob =
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    100
  );
}

// =====================================================
// EXPORTAR FUNÇÕES
// =====================================================
//
// Não precisa de export/import ES Module.
// O app.js consegue usar diretamente.
//

console.log(
  "storage.js carregado corretamente."
);