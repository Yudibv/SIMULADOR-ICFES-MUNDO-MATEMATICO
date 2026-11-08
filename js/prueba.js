import { cargarTemas, PREGUNTAS_POR_PRUEBA } from "./temas.js";

// Puedes pegar este código completo en tu archivo prueba.js
export function renderPregunta(st) {
  const tema = temaPorId(st.cola[st.indiceTema]);
  const archivo = st.seleccion[st.item];
  const total = st.seleccion.length;
  
  if (typeof etiquetaModo !== 'undefined' && etiquetaModo) {
    etiquetaModo.classList.toggle("oculto", !st.todas);
  }
  
  if (typeof iniciarTimer === 'function') {
    iniciarTimer(st);
  }
  
  const rutaImagenFinal = typeof obtenerRutaImagen === 'function' ? obtenerRutaImagen(tema, archivo) : archivo;

  // Verificamos si la respuesta es un objeto (múltiples preguntas internas) o una sola letra
  const respuestasClave = (tema.respuestas || {})[archivo];
  const esMulti = respuestasClave && typeof respuestasClave === "object";
  const subPreguntas = esMulti ? Object.keys(respuestasClave) : [null];

  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo} / Ejercicio ${st.item + 1}</p>
    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Ejercicio ${st.item + 1} de ${total}</p>
    <section class="panel">
      <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}">
      <p id="error" class="alerta oculto">Por favor responde todas las preguntas de la imagen para continuar.</p>
      
      <form id="form-opciones">
        ${subPreguntas.map((num) => `
          ${num ? `<h3 class="subtitulo-pregunta" style="color: var(--azul); margin-top: 15px;">Pregunta ${num}</h3>` : ""}
          <fieldset class="opciones" style="margin-bottom: 20px;">
            <legend class="sr">Elige una respuesta</legend>
            ${["A", "B", "C", "D"]
              .map(
                (l) => `<label class="opcion"><input type="radio" name="opcion_${num || 'unica'}" value="${l}" required>
                <span class="letra">${l}</span><span>Opción ${l}</span></label>`
              )
              .join("")}
          </fieldset>
        `).join("")}

        <div class="acciones">
          <button class="boton" type="submit">${typeof textoBoton === 'function' ? textoBoton(st) : 'Siguiente'}</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById("form-opciones").onsubmit = (ev) => {
    ev.preventDefault();
    const formData = new FormData(ev.target);
    
    if (esMulti) {
      const respuestasObj = {};
      for (const num of subPreguntas) {
        const marcada = formData.get(`opcion_${num}`);
        if (!marcada) {
          document.getElementById("error").classList.remove("oculto");
          return;
        }
        respuestasObj[num] = marcada;
      }
      st.respuestas[st.item] = respuestasObj;
    } else {
      const marcada = formData.get("opcion_unica");
      if (!marcada) {
        document.getElementById("error").classList.remove("oculto");
        return;
      }
      st.respuestas[st.item] = marcada;
    }

    if (st.item + 1 < total) {
      st.item += 1;
      if (typeof guardar === 'function') guardar(st);
      renderPregunta(st);
    } else {
      if (typeof terminarPrueba === 'function') terminarPrueba(st, false);
    }
  };
}
