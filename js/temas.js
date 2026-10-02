export const PREGUNTAS_POR_PRUEBA = 15;
export const MINUTOS_DEFAULT = 15;

const IMAGEN = /\.(png|jpe?g|webp|gif)$/i;

function repoDesdePages() {
  const host = location.hostname;
  if (!host.endsWith(".github.io")) return null;
  const owner = host.replace(/\.github\.io$/i, "");
  const partes = location.pathname.split("/").filter(Boolean);
  if (partes.length) return { owner, repo: partes[0] };
  return { owner, repo: `${owner}.github.io` };
}

function rutaCarpeta(id) {
  return `preguntas/${id.split("/").map(encodeURIComponent).join("/")}`;
}

export function urlPng(tema, archivo) {
  return `${rutaCarpeta(tema.id)}/${encodeURIComponent(archivo)}`;
}

function esCarpetaDeTema(nombre) {
  const base = String(nombre || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return !base.startsWith("sondeo");
}

function ordenarArchivos(nombres) {
  return [...nombres].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })
  );
}

/** Orden estable por icono (01, 02…), no por el orden que devuelve GitHub. */
function ordenarTemas(temas) {
  return [...temas].sort((a, b) => {
    const ia = String(a.icono ?? "");
    const ib = String(b.icono ?? "");
    if (ia !== ib) {
      return ia.localeCompare(ib, undefined, { numeric: true });
    }
    return String(a.titulo || a.id).localeCompare(String(b.titulo || b.id), "es");
  });
}

async function desdeGitHub() {
  const info = repoDesdePages();
  if (!info) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/contents/preguntas`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const items = await res.json();
    if (!Array.isArray(items)) return null;
    const dirs = items.filter((x) => x.type === "dir" && esCarpetaDeTema(x.name));
    const temas = [];
    for (let i = 0; i < dirs.length; i += 1) {
      const d = dirs[i];
      const filesRes = await fetch(d.url, { cache: "no-store" });
      if (!filesRes.ok) continue;
      const files = await filesRes.json();
      if (!Array.isArray(files)) continue;
      const imagenes = ordenarArchivos(
        files.filter((f) => IMAGEN.test(f.name)).map((f) => f.name)
      );
      if (!imagenes.length) continue;
      let meta = {};
      const temaFile = files.find((f) => f.name.toLowerCase() === "tema.json");
      if (temaFile?.download_url) {
        const mj = await fetch(`${temaFile.download_url}?t=${Date.now()}`, { cache: "no-store" });
        if (mj.ok) meta = await mj.json();
      }
      temas.push({
        id: d.name,
        titulo: meta.titulo || d.name.replace(/_/g, " "),
        subtitulo: meta.subtitulo || "Matemáticas Saber 11",
        descripcion: meta.descripcion || `${imagenes.length} preguntas en esta carpeta.`,
        icono: meta.icono || String(i + 1).padStart(2, "0"),
        carpeta: `preguntas/${d.name}`,
        preguntas: imagenes,
        respuestas: meta.respuestas || {},
        explicaciones: meta.explicaciones || {},
      });
    }
    return temas.length ? temas : null;
  } catch {
    return null;
  }
}

async function leerIndice() {
  try {
    const r = await fetch(`preguntas/indice.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.temas) ? data.temas : [];
  } catch {
    return [];
  }
}

/** En GitHub la lista viva de imágenes manda, para que una pregunta nueva se vea aunque indice.json esté viejo. */
function fusionar(indice, vivos) {
  const porId = new Map(indice.map((t) => [t.id, t]));
  const vistos = new Set();
  const temas = vivos.map((vivo) => {
    vistos.add(vivo.id);
    const base = porId.get(vivo.id) || {};
    const preguntas = vivo.preguntas?.length ? vivo.preguntas : base.preguntas || [];
    return {
      ...base,
      ...vivo,
      titulo: vivo.titulo || base.titulo,
      subtitulo: vivo.subtitulo || base.subtitulo || "Matemáticas Saber 11",
      descripcion:
        base.descripcion || vivo.descripcion || `${preguntas.length} preguntas en esta carpeta.`,
      icono: vivo.icono || base.icono,
      preguntas,
      respuestas: { ...(base.respuestas || {}), ...(vivo.respuestas || {}) },
      explicaciones: { ...(base.explicaciones || {}), ...(vivo.explicaciones || {}) },
    };
  });
  for (const base of indice) {
    if (!vistos.has(base.id) && esCarpetaDeTema(base.id)) temas.push(base);
  }
  return ordenarTemas(temas);
}

export async function cargarTemas() {
  const indice = await leerIndice();
  const github = await desdeGitHub();
  if (github?.length) return fusionar(indice, github);
  if (indice.length) return ordenarTemas(indice.filter((t) => esCarpetaDeTema(t.id)));
  throw new Error("No se pudo leer preguntas/indice.json");
}

export function mezclar(lista) {
  const arr = [...lista];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function elegirPreguntas(tema) {
  const todas = tema.preguntas || [];
  const n = Math.min(PREGUNTAS_POR_PRUEBA, todas.length);
  return mezclar(todas).slice(0, n);
}

export async function cargarContacto() {
  try {
    const r = await fetch(`contacto.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function htmlContacto(info) {
  if (!info) return "";
  const lineas = [];
  if (info.correo) {
    lineas.push(`<p>Correo: <a href="mailto:${info.correo}">${info.correo}</a></p>`);
  }
  if (info.telefono) {
    lineas.push(`<p>Teléfono: <a href="tel:${info.telefono}">${info.telefono}</a></p>`);
  }
  if (info.whatsapp) {
    const raw = String(info.whatsapp).trim();
    const href = raw.startsWith("http") ? raw : `https://wa.me/${raw.replace(/\D/g, "")}`;
    lineas.push(
      `<p>WhatsApp: <a href="${href}" target="_blank" rel="noopener">${href}</a></p>`
    );
  }
  if (info.instagram) {
    const user = String(info.instagram).replace(/^@/, "");
    lineas.push(
      `<p>Instagram: <a href="https://instagram.com/${user}" target="_blank" rel="noopener">@${user}</a></p>`
    );
  }
  return `
    <section class="panel contacto">
      <p class="etiqueta">Contacto</p>
      <h2>${info.titulo || "Información de contacto"}</h2>
      ${info.nombre ? `<p><strong>${info.nombre}</strong></p>` : ""}
      ${info.mensaje ? `<p>${info.mensaje}</p>` : ""}
      ${lineas.join("")}
    </section>`;
}
