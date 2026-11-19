/**
 * ==========================================================================
 * MUNDO MATEMÁTICO - GESTIÓN DE TEMAS, RUTAS E ÍNDICE (temas.js)
 * ==========================================================================
 * Provee las constantes base y funciones auxiliares para cargar el índice
 * de carpetas/preguntas, ordenar los módulos y construir las rutas de imagen.
 */

// Cantidad predeterminada de preguntas en prácticas por tema
export const PREGUNTAS_POR_PRUEBA = 10;

// Duración predeterminada en minutos para módulos focalizados
export const MINUTOS_DEFAULT = 15;

/**
 * Construye la ruta relativa hacia la imagen PNG de una pregunta.
 * Limpia el prefijo "preguntas/" si ya viene incluido en la carpeta del tema
 * y codifica caracteres especiales en el nombre del archivo.
 */
export function urlPng(tema, archivo) {
  let carpetaTema = String(tema?.carpeta || tema?.id || "").trim();

  if (carpetaTema.startsWith("preguntas/")) {
    carpetaTema = carpetaTema.replace(/^preguntas\//, "");
  }

  let nombreArchivo = String(archivo || "").trim();
  if (nombreArchivo && !/\.(png|jpg|jpeg|webp)$/i.test(nombreArchivo)) {
    nombreArchivo = `${nombreArchivo}.png`;
  }

  return `preguntas/${carpetaTema}/${encodeURIComponent(nombreArchivo)}`;
}

/**
 * Ordena los temas de forma natural usando 'icono' (si existe) y luego por título.
 */
function ordenarTemas(temas) {
  return [...temas].sort((a, b) => {
    const ia = String(a?.icono ?? "");
    const ib = String(b?.icono ?? "");
    if (ia !== ib) {
      return ia.localeCompare(ib, undefined, { numeric: true });
    }
    return String(a?.titulo || a?.id || "").localeCompare(
      String(b?.titulo || b?.id || ""),
      "es"
    );
  });
}

/**
 * Descarga y parsea el archivo indice.json desde la raíz del proyecto.
 * Soporta tanto un arreglo directo como un objeto con propiedad { temas: [...] }.
 */
export async function cargarTemas() {
  try {
    const respuesta = await fetch("indice.json", { cache: "no-store" });
    if (!respuesta.ok) {
      throw new Error(`Error al cargar el índice: ${respuesta.status} ${respuesta.statusText}`);
    }
    const datos = await respuesta.json();
    const temasCrudos = Array.isArray(datos) ? datos : (datos.temas || []);
    return ordenarTemas(temasCrudos);
  } catch (error) {
    console.error("Error en cargarTemas:", error);
    return [];
  }
}

/**
 * Devuelve una copia mezclada aleatoriamente de una lista (algoritmo Fisher-Yates).
 */
export function mezclar(lista) {
  const arr = [...(lista || [])];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Selecciona hasta PREGUNTAS_POR_PRUEBA preguntas aleatorias de un tema dado.
 */
export function elegirPreguntas(tema) {
  const todas = Array.isArray(tema?.preguntas) ? tema.preguntas : [];
  const n = Math.min(PREGUNTAS_POR_PRUEBA, todas.length);
  return mezclar(todas).slice(0, n);
}
