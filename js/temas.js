export const PREGUNTAS_POR_PRUEBA = 15;
export const MINUTOS_DEFAULT = 15;

export function urlPng(tema, archivo) {
  // Asegura que tome la carpeta del tema y limpie espacios
  const carpetaTema = tema.carpeta || tema.id;
  const nombreArchivo = String(archivo).trim();
  // Retorna la ruta exacta y limpia
  return `preguntas/${carpetaTema}/${encodeURIComponent(nombreArchivo)}`;
}

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
