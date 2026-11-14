/**
 * ==============================================================================
 * MÓDULO DE PRUEBAS Y SIMULADOR - MUNDO MATEMÁTICO
 * Selecciona exactamente 10 preguntas al azar por tema, con navegación
 * limpia (Pregunta X de 10) y evaluación diagnóstica.
 * ==============================================================================
 */

import { cargarTemas, urlPng } from "./temas.js";

// Estado global de la prueba actual
let state = {
  temas: [],          // Lista completa de temas cargados desde indice.json
  cola: [],           // Cola de temas activos
  indiceTema: 0,      // Índice del tema actual
  seleccion: [],      // Archivos seleccionados para la prueba (exactamente 10)
  seleccionGlobal: [],// Metadata detallada para simulacro global
  item: 0,            // Pregunta actual (de 0 a 9)
  respuestas: {},     // Respuestas dadas por el estudiante
  todas: false        // Bandera de simulacro global
};

function obtenerContenedor() {
  let root = document.getElementById("vista") || document.getElementById("root") || document.getElementById("panel") || document.querySelector("main");
  if (!root) {
    root = document.createElement("main");
    root.id = "vista";
    document.body.appendChild(root);
  }
  return root;
}

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

/**
 * Prepara las preguntas seleccionando EXACTAMENTE 10 al azar de la carpeta.
 * Si la carpeta tiene menos de 10, toma las que tenga.
 */
function prepararTemaActual() {
  if (state.todas) {
    let todasLasSeleccionadas = [];
    state.temas.forEach(tema => {
      const preguntasTema = tema.preguntas || [];
      const preguntasMezcladas = [...preguntasTema].sort(() => Math.random() - 0.5);
      const subConjunto = preguntasMezcladas.slice(0, 3);
      subConjunto.forEach(p => {
        todasLasSeleccionadas.push({ carpetaId: tema.id, archivo: p });
      });
    });

    state.seleccionGlobal = todasLasSeleccionadas.sort(() => Math.random() - 0.5);
    state.seleccion = state.seleccionGlobal.map(item => item.archivo);
    state.item = 0;
    state.respuestas = {};
  } else {
    const tema = temaPorId(state.cola[state.indiceTema]);
    const todasLasPreguntas = tema.preguntas || [];
    
    // Mezcla aleatoriamente y limita estrictamente a 10 preguntas máximo
    const preguntasMezcladas = [...todasLasPreguntas].sort(() => Math.random() - 0.5);
    state.seleccion = preguntasMezcladas.slice(0, 10);
    
    state.item = 0;
    state.respuestas = {};
  }
}

export function renderPregunta(st) {
  let tema = temaPorId(st.cola[st.indiceTema]);
  if (st.todas && st.seleccionGlobal && st.seleccionGlobal[st.item]) {
    tema = temaPorId(st.seleccionGlobal[st.item].carpetaId);
  }

  const archivo = st.seleccion[st.item];
  const total = st.seleccion.length; // Será 10 (o menos si la carpeta tiene poquitas)
  const root = obtenerContenedor();

  if (!archivo) {
    mostrarResultadosFinales(st, tema);
    return;
  }

  const rutaImagenFinal = urlPng(tema, archivo);
  const respuestasClave = (tema.respuestas || {})[archivo];
  const esMulti = respuestasClave && typeof respuestasClave === "object";
  const subPreguntas = esMulti ? Object.keys(respuestasClave) : [null];
  const respuestaPrevia = st.respuestas[st.item];

  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo || tema.id} / Pregunta ${st.item + 1}</p>
    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Pregunta ${st.item + 1} de ${total}</p>
    <section class="panel">
      <div style="text-align: center; margin-bottom: 20px;">
        <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}" onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';">
        <p id="img-error" style="display:none; color: red; font-size: 0.9rem; font-weight: bold;">[⚠️ No se pudo cargar la imagen de la pregunta]</p>
      </div>
      <p id="error" class="alerta oculto" style="margin-bottom: 15px; color: red;">Por favor responde la pregunta para continuar.</p>
      
      <form id="form-opciones">
        ${subPreguntas.map((num) => {
          const valorPrevioSub = esMulti ? (respuestaPrevia?.[num] || '') : '';
          return `
            ${num ? `<h3 class="subtitulo-pregunta" style="color: var(--azul); margin-top: 15px; margin-bottom: 8px;">Pregunta ${num}</h3>` : ""}
            <fieldset class="opciones" style="margin-bottom: 20px; border: none; padding: 0;">
              <legend class="sr">Elige una respuesta</legend>
              ${["A", "B", "C", "D"]
                .map((l) => {
                  const seleccionado = (!esMulti && respuestaPrevia === l) || (esMulti && valorPrevioSub === l) ? 'checked' : '';
                  return `<label class="opcion" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
                    <input type="radio" name="opcion_${num || 'unica'}" value="${l}" ${seleccionado} required>
                    <span class="letra" style="font-weight: bold;">${l}</span><span>Opción ${l}</span>
                  </label>`;
                })
                .join("")}
            </fieldset>
          `;
        }).join("")}

        <div class="acciones" style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-top: 20px;">
          ${st.item > 0 ? '<button class="boton" type="button" id="btn-anterior" style="background: #6b7280; padding: 10px 20px; cursor: pointer;">Anterior</button>' : ''}
          <button class="boton" type="submit" style="padding: 10px 20px; cursor: pointer;">${st.item + 1 < total ? 'Siguiente' : 'Ver Resultados'}</button>
        </div>
      </form>
    </section>
  `;

  // Botón Anterior
  const btnAnterior = document.getElementById("btn-anterior");
  if (btnAnterior) {
    btnAnterior.onclick = () => {
      if (st.item > 0) {
        const formEl = document.getElementById("form-opciones");
        const formData = new FormData(formEl);
        if (esMulti) {
          const respuestasObj = {};
          for (const num of subPreguntas) {
            const marcada = formData.get(`opcion_${num}`);
            if (marcada) respuestasObj[num] = marcada;
          }
          if (Object.keys(respuestasObj).length > 0) st.respuestas[st.item] = respuestasObj;
        } else {
          const marcada = formData.get("opcion_unica");
          if (marcada) st.respuestas[st.item] = marcada;
        }

        st.item -= 1;
        renderPregunta(st);
      }
    };
  }

  // Envío del formulario (Siguiente / Ver Resultados)
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
      mostrarResultadosFinales(st, tema);
    }
  };
}

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

  let mensajeDesempeno = "";
  if (porcentaje >= 80) {
    mensajeDesempeno = `¡Excelente nivel en <strong>${tema.titulo || 'esta categoría'}</strong>! Tienes bases muy sólidas. Te invitamos a mantener este ritmo para asegurar tu puntaje máximo en el ICFES.`;
  } else if (porcentaje >= 50) {
    mensajeDesempeno = `Tienes bases regulares en <strong>${tema.titulo || 'esta categoría'}</strong>, pero hay vacíos conceptuales en preguntas clave que el ICFES suele evaluar con trampa.`;
  } else {
    mensajeDesempeno = `Identificamos oportunidades de mejora críticas en <strong>${tema.titulo || 'esta categoría'}</strong>. Este puntaje en el componente real te restará puntos decisivos para tu ingreso a la universidad.`;
  }
  
  root.innerHTML = `
    <section class="panel" style="text-align: center; padding: 30px;">
      <h2 style="color: var(--azul);">Diagnóstico: ${tema.titulo || 'Simulador'}</h2>
      <p class="lead" style="margin: 0 auto 20px auto;">Resultados de tu práctica de 10 preguntas.</p>
      
      <div class="puntaje" style="margin: 20px 0;">
        <span class="num">${aciertos} / ${totalPreguntas}</span>
        <p style="margin: 5px 0; font-weight: 600; color: #555;">Aciertos logrados (${porcentaje}%)</p>
      </div>

      <div style="background: var(--suave, #eff6ff); border: 1px solid var(--borde, #bfdbfe); padding: 20px; margin: 20px 0; border-radius: 6px; text-align: left;">
        <h3 style="color: var(--rojo, #dc2626); margin-top: 0;">Análisis personalizado:</h3>
        <p style="margin: 0; line-height: 1.6; color: #333;">${mensajeDesempeno}</p>
      </div>

      <div style="border: 2px dashed var(--rojo, #dc2626); padding: 20px; margin-top: 25px; border-radius: 6px; background: #fffcfc;">
        <h3 style="color: var(--azul, #1e3a8a); margin-top: 0;">¿Quieres asegurar tu cupo en la universidad?</h3>
        <p style="margin-bottom: 15px; color: #444;">No dejes tu puntaje al azar. Recibe acompañamiento profesional con las clases y tutorías de <strong>Mundo Matemático</strong>.</p>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <a class="boton" href="https://wa.me/573115574410?text=Hola,%20hice%20el%20simulador%20en%20el%20módulo%20de%20${encodeURIComponent(tema.titulo || 'Matemáticas')}%20y%20quiero%20información%20sobre%20las%20clases%20personalizadas" target="_blank" style="background: #25d366; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">
            💬 Agendar Tutoría de Refuerzo
          </a>
          <a class="boton" href="index.html" style="text-decoration: none; padding: 10px 20px;">
            Volver al Menú Principal
          </a>
        </div>
      </div>
    </section>
  `;
}

init();
