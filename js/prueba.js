/**
 * ==============================================================================
 * MÓDULO DE PRUEBAS Y SIMULADOR - MUNDO MATEMÁTICO
 * Maneja la lógica de visualización de preguntas, selección secuencial por carpetas (modo auditoría),
 * evaluación de respuestas y la monetización del informe predictivo global.
 * ==============================================================================
 */

import { cargarTemas, urlPng, PREGUNTAS_POR_PRUEBA } from "./temas.js";

// Estado global de la prueba actual
let state = {
  temas: [],          // Lista completa de temas cargados desde indice.json
  cola: [],           // Cola de temas activos
  indiceTema: 0,      // Índice del tema actual
  seleccion: [],      // Archivos de preguntas seleccionados para la prueba
  seleccionGlobal: [],// Metadata detallada para el modo de prueba global (mixto)
  item: 0,            // Pregunta actual en la que va el estudiante
  respuestas: {},     // Respuestas dadas por el usuario
  todas: false        // Bandera para saber si es el Simulacro Global (Todas las áreas)
};

/**
 * Obtiene o crea dinámicamente el contenedor principal en el DOM donde se renderiza la prueba.
 */
function obtenerContenedor() {
  let root = document.getElementById("vista") || document.getElementById("root") || document.getElementById("panel") || document.querySelector("main");
  if (!root) {
    root = document.createElement("main");
    root.id = "vista";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Función de inicialización asíncrona: Lee los parámetros de la URL, 
 * carga los temas y define si se ejecuta una carpeta individual o el simulacro global.
 */
async function init() {
  const params = new URLSearchParams(window.location.search);
  const temaId = params.get("tema");
  const esTodas = params.get("todas") === "1";

  const datosCrudos = await cargarTemas();
  state.temas = aliasTemas(datosCrudos);
  
  const root = obtenerContenedor();
  
  if (!state.temas.length) {
    root.innerHTML = `<p class="alerta" style="padding: 20px; color: red;">No se pudieron cargar los temas. Revisa el archivo indice.json.</p>`;
    return;
  }

  // Configurar modo de prueba según los parámetros de la URL
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

/**
 * Asegura que cada tema tenga un ID válido basado en su identificador o carpeta.
 */
function aliasTemas(temas) {
  return temas.map(t => ({
    ...t,
    id: t.id || t.carpeta
  }));
}

/**
 * Busca y retorna un objeto tema específico utilizando su ID o carpeta.
 */
function temaPorId(id) {
  return state.temas.find(t => t.id === id || t.carpeta === id) || state.temas[0];
}

/**
 * Prepara las preguntas que se van a mostrar en orden estricto (Modo Auditoría):
 * - Carga todas las preguntas tal como están escritas en el indice.json para poder revisarlas una por una.
 */
function prepararTemaActual() {
  if (state.todas) {
    let todasLasSeleccionadas = [];
    
    // Recorre cada carpeta extrayendo todas las preguntas en orden
    state.temas.forEach(tema => {
      const preguntasTema = tema.preguntas || [];
      preguntasTema.forEach(p => {
        todasLasSeleccionadas.push({ carpetaId: tema.id, archivo: p });
      });
    });

    state.seleccionGlobal = todasLasSeleccionadas;
    state.seleccion = state.seleccionGlobal.map(item => item.archivo);
    state.item = 0;
    state.respuestas = {};
  } else {
    // MODO AUDITORÍA: Carga TODAS las preguntas de la carpeta seleccionada en orden exacto
    const tema = temaPorId(state.cola[state.indiceTema]);
    state.seleccion = tema.preguntas || [];
    state.item = 0;
    state.respuestas = {};
  }
}

/**
 * Renderiza la interfaz de la pregunta actual, manejando imágenes, opciones de respuesta 
 * y la barra de progreso con botones de Navegación Secuencial (Anterior / Siguiente).
 */
export function renderPregunta(st) {
  // Identifica el tema actual
  let tema = temaPorId(st.cola[st.indiceTema]);
  if (st.todas && st.seleccionGlobal && st.seleccionGlobal[st.item]) {
    tema = temaPorId(st.seleccionGlobal[st.item].carpetaId);
  }

  const archivo = st.seleccion[st.item];
  const total = st.seleccion.length;
  const root = obtenerContenedor();

  // Si ya no hay más preguntas, pasa a la pantalla de resultados
  if (!archivo) {
    mostrarResultadosFinales(st, tema);
    return;
  }

  const rutaImagenFinal = urlPng(tema, archivo);
  
  // Soporte para preguntas con múltiples incisos (subpreguntas) o única respuesta
  const respuestasClave = (tema.respuestas || {})[archivo];
  const esMulti = respuestasClave && typeof respuestasClave === "object";
  const subPreguntas = esMulti ? Object.keys(respuestasClave) : [null];

  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo || tema.id} / Ejercicio ${st.item + 1}</p>
    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Ejercicio ${st.item + 1} de ${total} (Archivo: ${archivo})</p>
    <section class="panel">
      <div style="text-align: center; margin-bottom: 20px;">
        <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}" onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';">
        <p id="img-error" style="display:none; color: red; font-size: 0.9rem; font-weight: bold;">[⚠️ No se pudo cargar la imagen: ${archivo} en la carpeta "${tema.carpeta}". Revisa el nombre o extensión en GitHub o en indice.json]</p>
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

        <div class="acciones" style="display: flex; gap: 10px; justify-content: center; align-items: center;">
          ${st.item > 0 ? '<button class="boton" type="button" id="btn-anterior" style="background: #6b7280; padding: 10px 20px;">Anterior</button>' : ''}
          <button class="boton" type="submit" style="padding: 10px 20px;">${st.item + 1 < total ? 'Siguiente' : 'Ver Resultados'}</button>
        </div>
      </form>
    </section>
  `;

  // Funcionalidad para retroceder y auditar la pregunta anterior
  const btnAnterior = document.getElementById("btn-anterior");
  if (btnAnterior) {
    btnAnterior.onclick = () => {
      if (st.item > 0) {
        st.item -= 1;
        renderPregunta(st);
      }
    };
  }

  // Manejador del envío del formulario (validación y avance secuencial)
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

    // Avanza a la siguiente pregunta en orden estricto
    if (st.item + 1 < total) {
      st.item += 1;
      renderPregunta(st);
    } else {
      mostrarResultadosFinales(st, tema);
    }
  };
}

/**
 * Calcula los resultados finales y genera la vista correspondiente.
 */
function mostrarResultadosFinales(st, tema) {
  let aciertos = 0;
  let totalPreguntas = st.seleccion.length;

  st.seleccion.forEach((archivo, index) => {
    let temaActual = tema;
    if (st.todas && st.seleccionGlobal && st.seleccionGlobal[index]) {
      temaActual = temaPorId(st.seleccionGlobal[index].carpetaId);
    }

    const respuestaCorrecta = (temaActual.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas[index];

    if (typeof respuestaCorrecta === "object") {
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) {
          todasCorrectas = false;
        }
      }
      if (todasCorrectas) aciertos++;
    } else {
      if (respuestaUsuario === respuestaCorrecta) {
        aciertos++;
      }
    }
  });

  const porcentaje = Math.round((aciertos / totalPreguntas) * 100);
  const root = obtenerContenedor();
  const esSimulacroGlobal = st.todas;

  if (esSimulacroGlobal) {
    root.innerHTML = `
      <section class="panel" style="text-align: center; padding: 30px;">
        <h2 style="color: var(--azul);">Resultados de la Auditoría Global</h2>
        <p class="lead" style="margin: 0 auto 20px auto;">Has recorrido todas las carpetas del simulador.</p>
        <div class="puntaje" style="margin: 20px 0;">
          <span class="num">${aciertos} / ${totalPreguntas}</span>
          <p style="margin: 5px 0; font-weight: 600; color: #555;">Aciertos totales (${porcentaje}%)</p>
        </div>
        <a class="boton" href="index.html" style="text-decoration: none; padding: 12px 25px; border-radius: 6px;">
          Volver al Menú Principal
        </a>
      </section>
    `;
  } else {
    root.innerHTML = `
      <section class="panel" style="text-align: center; padding: 30px;">
        <h2 style="color: var(--azul);">Fin de revisión: ${tema.titulo}</h2>
        <p class="lead" style="margin: 0 auto 20px auto;">Has auditado todas las imágenes de esta carpeta.</p>
        <div class="puntaje" style="margin: 20px 0;">
          <span class="num">${aciertos} / ${totalPreguntas}</span>
          <p style="margin: 5px 0; font-weight: 600; color: #555;">Aciertos (${porcentaje}%)</p>
        </div>
        <a class="boton" href="index.html" style="text-decoration: none; padding: 10px 20px;">
          Volver al Menú Principal
        </a>
      </section>
    `;
  }
}

// Ejecutar la aplicación al cargar
init();
