export const PREGUNTAS_POR_PRUEBA = 15;
export const MINUTOS_DEFAULT = 15;

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
      `https://api.github.com/repos/${info.owner}/${info.repo}/contents/preguntas`
    );
    if (!res.ok) return null;
    const items = await res.json();
    if (!Array.isArray(items)) return null;
    const dirs = items.filter((x) => x.type === "dir");
    const temas = [];
    for (let i = 0; i < dirs.length; i += 1) {
      const d = dirs[i];
      const filesRes = await fetch(d.url);
      if (!filesRes.ok) continue;
      const files = await filesRes.json();
      const pngs = files
        .filter((f) => /\.png$/i.test(f.name))
        .map((f) => f.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (!pngs.length) continue;
      let meta = {};
      const temaFile = files.find((f) => f.name.toLowerCase() === "tema.json");
      if (temaFile?.download_url) {
        const mj = await fetch(temaFile.download_url);
        if (mj.ok) meta = await mj.json();
      }
      temas.push({
        id: d.name,
        titulo: meta.titulo || d.name.replace(/_/g, " "),
        subtitulo: meta.subtitulo || "Matemáticas Saber 11",
        descripcion: meta.descripcion || `${pngs.length} preguntas en esta carpeta.`,
        icono: meta.icono || String(i + 1).padStart(2, "0"),
        carpeta: `preguntas/${d.name}`,
        preguntas: pngs,
        respuestas: meta.respuestas || {},
        explicaciones: meta.explicaciones || {},
      });
    }
    return temas.length ? ordenarTemas(temas) : null;
  } catch {
    return null;
  }
}

export async function cargarTemas() {
  // Preferir indice.json: conserva el orden pedagógico (icono 01, 02…).
  // En GitHub Pages la API lista carpetas en desorden alfabético.
  try {
    const r = await fetch("preguntas/indice.json");
    if (r.ok) {
      const data = await r.json();
      const temas = data.temas || [];
      if (temas.length) return ordenarTemas(temas);
    }
  } catch {
    /* fallback a la API de GitHub */
  }
  const github = await desdeGitHub();
  if (github) return github;
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
    const r = await fetch("contacto.json");
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
