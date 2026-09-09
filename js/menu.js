import { cargarTemas, PREGUNTAS_POR_PRUEBA } from "./temas.js";

const rejilla = document.getElementById("rejilla");
const aviso = document.getElementById("aviso");
const bloqueTodas = document.getElementById("bloque-todas");

function tarjeta(tema, indice) {
  const n = tema.preguntas?.length || 0;
  const icono = tema.icono || String(indice + 1).padStart(2, "0");
  const articulo = document.createElement("article");
  articulo.className = "tarjeta";
  articulo.innerHTML = `
    <span class="badge">${icono}</span>
    <h2>${tema.titulo}</h2>
    <p class="subtitulo">${tema.subtitulo || ""}</p>
    <p>${tema.descripcion || ""}</p>
    <p class="meta">${n} en la carpeta · se eligen ${Math.min(PREGUNTAS_POR_PRUEBA, n)} al azar</p>
    <a class="boton" href="prueba.html?tema=${encodeURIComponent(tema.id)}">Empezar</a>
  `;
  return articulo;
}

try {
  const temas = await cargarTemas();
  if (!temas.length) {
    aviso.textContent =
      "No hay carpetas con PNG en preguntas/. Agrega una carpeta por tema y vuelve a generar preguntas/indice.json, o súbelo a GitHub Pages.";
    aviso.classList.remove("oculto");
  } else {
    temas.forEach((t, i) => rejilla.appendChild(tarjeta(t, i)));
    document.getElementById("btn-todas").href = "prueba.html?todas=1";
    bloqueTodas.classList.remove("oculto");
  }
} catch (err) {
  aviso.textContent =
    "No se pudieron cargar los temas. Abre el sitio con GitHub Pages o un servidor local (no como archivo file://).";
  aviso.classList.remove("oculto");
  console.error(err);
}
