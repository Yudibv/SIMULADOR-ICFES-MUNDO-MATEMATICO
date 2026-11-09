import { cargarTemas, urlPng, PREGUNTAS_POR_PRUEBA } from "./temas.js";

let state = {
  temas: [],
  cola: [],
  indiceTema: 0,
  seleccion: [],
  item: 0,
  respuestas: {},
  todas: false
};

async function init() {
  const params = new URLSearchParams(window.location.search);
  const temaId = params.get("tema");
  const esTodas = params.get("todas") === "1";

  state.temas = await cargarTemas();
  
  if (!state.temas.length) {
    document.getElementById("root").innerHTML = `<p class="alerta">No se pudieron cargar los temas. Revisa el archivo indice.json.</p>`;
    return;
  }

  if (esTodas) {
    state.todas = true;
    state.cola = state.temas.map(t => t.id);
  } else if (temaId) {
    state.cola = [temaId];
  } else {
    state.cola = [state.temas[0].id];
  }

  prepararTemaActual();
  renderPregunta(state);
}

function temaPorId(id) {
  return state.temas.find(t => t.id === id) || state.temas[0];
}

function prepararTemaActual() {
  const tema = temaPorId(state.cola[state.indiceTema]);
  const todasLasPreguntas = tema.preguntas || [];
  state.seleccion = todasLasPreguntas.slice(0, PREGUNTAS_POR_PRUEBA);
  state.item = 0;
  state.respuestas = {};
}

export function renderPregunta(st) {
  const tema = temaPorId(st.cola[st.indiceTema]);
  const archivo = st.seleccion[st.item];
  const total = st.seleccion.length;

  if (!archivo) {
    document.getElementById("root").innerHTML = `
      <section class="panel" style="text-align: center;">
        <h2>¡Prueba finalizada!</h2>
        <p>Has completado las preguntas de este módulo con éxito.</p>
        <br>
        <a class="boton" href="index.html">Volver al Menú Principal</a>
      </section>
    `;
    return;
  }

  const rutaImagenFinal = urlPng(tema, archivo);

  // Detecta si la imagen contiene varias preguntas internas (ej. {"4": "C", "5": "B"})
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
      <p id="error" class="alerta oculto" style="margin-bottom: 15px;">Por favor responde todas las preguntas de la imagen.</p>
      
      <form id="form-opciones">
        ${subPreguntas.map((num) => `
          ${num ? `<h3 class="subtitulo-pregunta" style="color: var(--azul); margin-top: 15px;">Pregunta ${num}</h3>` : ""}
          <fieldset class="opciones" style="margin-bottom: 20px;">
            <legend class="sr">Elige una respuesta</legend>
            ${["A", "B", "C", "D"]
              .map(
                (l) => `<label class="opcion"><input type="radio" name="opcion_${num || 'unica'}" value="${l}">
                <span class="letra">${l}</span><span>Opción ${l}</span></label>`
              )
              .join("")}
          </fieldset>
        `).join("")}

        <div class="acciones">
          <button class="boton" type="submit">${st.item + 1 < total ? 'Siguiente' : 'Finalizar'}</button>
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
      renderPregunta(st);
    } else {
      st.item += 1;
      renderPregunta(st); // Llama al finalizador
    }
  };
}

init();
