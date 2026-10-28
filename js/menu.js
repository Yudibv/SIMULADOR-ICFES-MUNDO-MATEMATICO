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

async function inicializarMenu() {
  try {
    const temas = await cargarTemas();
    if (!temas || !temas.length) {
      if (aviso) {
        aviso.textContent = "No se encontraron temas en el índice. Verifica el archivo indice.json.";
        aviso.classList.remove("oculto");
      }
      return;
    }
    
    if (rejilla) {
      rejilla.innerHTML = "";
      temas.forEach((t, i) => rejilla.appendChild(tarjeta(t, i)));
    }
    
    const btnTodas = document.getElementById("btn-todas");
    if (btnTodas) btnTodas.href = "prueba.html?todas=1";
    if (bloqueTodas) bloqueTodas.classList.remove("oculto");
    
  } catch (err) {
    if (aviso) {
      aviso.textContent = "No se pudieron cargar los temas. Revisa la consola para más detalles.";
      aviso.classList.remove("oculto");
    }
    console.error("Error al inicializar el menú:", err);
  }
}

inicializarMenu();
