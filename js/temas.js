export const PREGUNTAS_POR_PRUEBA = 15;
export const MINUTOS_DEFAULT = 15;

export function urlPng(tema, archivo) {
  // Apunta directamente al id o carpeta en la raíz
  return `${tema.carpeta || tema.id}/${encodeURIComponent(archivo)}`;
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

export async function cargarTemas() {
  try {
    const respuesta = await fetch('indice.json');
    if (!respuesta.ok) {
      throw new Error(`Error al cargar el índice: ${respuesta.statusText}`);
    }
    const datos = await respuesta.json();
    const temasCrudos = Array.isArray(datos) ? datos : (datos.temas || []);
    return ordenarTemas(temasCrudos);
  } catch (error) {
    console.error("Error en cargarTemas:", error);
    return [];
  }
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
