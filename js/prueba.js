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

function obtenerContenedor() {
  let root = document.getElementById("root") || document.getElementById("panel") || document.getElementById("app") || document.querySelector("main");
  if (!root) {
    root = document.createElement("main");
    root.id = "root";
    document.body.appendChild(root);
  }
  return root;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const temaId = params.get("tema");
  const esTodas = params.get("todas") === "1";

  state.temas = aliasTemas(await cargarTemas());
  const root = obtenerContenedor();
  
  if (!state.temas.length) {
    root.innerHTML = `<p class="alerta" style="padding: 20px; color: red;">No se pudieron cargar los temas. Revisa el archivo indice.json.</p>`;
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

function aliasTemas(temas) {
  return temas.map(t => ({
    ...t,
    id: t.id || t.carpeta
  }));
}

function temaPorId(id) {
  return state.temas.find(t => t.id === id || t.carpeta === id) || state.temas[0];
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
  const root = obtenerContenedor();

  if (!archivo) {
    root.innerHTML = `
      <section class="panel" style="text-align: center; padding: 30px;">
        <h2>¡Prueba finalizada!</h2>
        <p>Has completado las preguntas de este módulo con éxito.</p>
        <br>
        <a class="boton" href="index.html">Volver al Menú Principal</a>
      </section>
    `;
    return;
  }

  const rutaImagenFinal = urlPng(tema, archivo);

  // Verificamos si este archivo tiene respuestas múltiples en el objeto
  const respuestasClave = (tema.respuestas || {})[archivo];
  const esMulti = respuestasClave && typeof respuestasClave === "object";

  // Si es un objeto con varias preguntas (ej: {"2": "B", "3": "B"}), tomamos las claves
  // Si no, manejamos la única pregunta asociada al archivo
  const subPreguntas = esMulti ? Object.keys(respuestasClave) : [null];

  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo || tema.id} / Ejercicio ${st.item + 1}</p>
    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Ejercicio ${st.item + 1} de ${total}</p>
    <section class="panel">
      <div style="text-align: center; margin-bottom: 20px;">
        <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}" onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';">
        <p id="img-error" style="display:none; color: red; font-size: 0.9rem;">[No se pudo cargar la imagen: ${archivo}]</p>
      </div>
      <p id="error" class="alerta oculto" style="margin-bottom: 15px; color: red;">Por favor responde la pregunta para continuar.</p>
      
      <form id="form-opciones">
        ${subPreguntas.map((num) => `
          ${num ? `<h3 class="subtitulo-pregunta" style="color: var(--azul); margin-top: 15px; margin-bottom: 8px;">Pregunta ${num}</h3>` : ""}
          <fieldset class="opciones" style="margin-bottom: 20px; border: none; padding: 0;">
            <legend class="sr">Elige una respuesta</legend>
            ${["A", "B", "C", "D"]
              .map(
                (l) => `<label class="opcion" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
                  <input type="radio" name="opcion_${num || 'unica'}" value="${l}" required>
                  <span class="letra" style="font-weight: bold;">${l}</span><span>Opción ${l}</span>
                </label>`
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
      root.innerHTML = `
        <section class="panel" style="text-align: center; padding: 30px;">
          <h2>¡Has completado este módulo!</h2>
          <p>Tus respuestas han sido registradas correctamente.</p>
          <br>
          <a class="boton" href="index.html">Volver al Menú Principal</a>
        </section>
      `;
    }
  };
}

init();
