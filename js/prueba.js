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
    mostrarResultadosFinales(st, tema);
    return;
  }

  const rutaImagenFinal = urlPng(tema, archivo);
  
  const respuestasClave = (tema.respuestas || {})[archivo];
  const esMulti = respuestasClave && typeof respuestasClave === "object";
  const subPreguntas = esMulti ? Object.keys(respuestasClave) : [null];

  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo || tema.id} / Ejercicio ${st.item + 1}</p>
    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Ejercicio ${st.item + 1} de ${total}</p>
    <section class="panel">
      <div style="text-align: center; margin-bottom: 20px;">
        <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}" onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';">
        <p id="img-error" style="display:none; color: red; font-size: 0.9rem;">[No se pudo cargar la imagen: ${archivo} en la carpeta ${tema.carpeta}]</p>
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
          <button class="boton" type="submit">${st.item + 1 < total ? 'Siguiente' : 'Ver Resultados'}</button>
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
      mostrarResultadosFinales(st, tema);
    }
  };
}

function mostrarResultadosFinales(st, tema) {
  let aciertos = 0;
  let totalPreguntas = st.seleccion.length;

  st.seleccion.forEach((archivo, index) => {
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
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
        <h2 style="color: var(--azul);">Resultados del Simulacro Global ICFES</h2>
        <p class="lead" style="margin: 0 auto 20px auto;">Has completado la prueba integral de todas las áreas.</p>
        
        <div class="puntaje" style="margin: 20px 0;">
          <span class="num">${aciertos} / ${totalPreguntas}</span>
          <p style="margin: 5px 0; font-weight: 600; color: #555;">Aciertos totales logrados (${porcentaje}%)</p>
        </div>

        <div style="background: #eff6ff; border: 1px solid var(--azul); padding: 20px; margin: 20px 0; border-radius: 8px; text-align: left;">
          <h3 style="color: var(--azul); margin-top: 0;">🔒 Informe Analítico Predictivo Bloqueado</h3>
          <p style="margin: 0; line-height: 1.6; color: #333;">
            Para ver tu desglose detallado por componentes, la detección exacta de tus preguntas trampa falladas y tu ruta de estudio personalizada orientada al ICFES Saber 11, debes adquirir el reporte especializado.
          </p>
        </div>

        <div style="border: 2px dashed var(--rojo); padding: 25px; margin-top: 25px; border-radius: 8px; background: #fffcfc;">
          <h3 style="color: var(--azul); margin-top: 0;">Obtén tu Informe Predictivo Pro</h3>
          <p style="margin-bottom: 20px; color: #444;">Realiza el pago seguro y desbloquea el análisis completo de inmediato a través de nuestro canal de atención.</p>
          
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <a class="boton" href="https://wa.me/573000000000?text=Hola,%20acabo%20de%20terminar%20el%20Simulacro%20Global%20en%20Mundo%20Matemático%20y%20quiero%20pagar%20para%20obtener%20mi%20Informe%20Analítico%20Predictivo." target="_blank" style="background: #25d366; color: white; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; font-size: 1rem;">
              💳 Pagar Informe Analítico (WhatsApp)
            </a>
            <a class="boton" href="index.html" style="text-decoration: none; padding: 12px 25px; border-radius: 6px;">
              Volver al Menú Principal
            </a>
          </div>
        </div>
      </section>
    `;
  } else {
    let mensajeDesempeno = "";
    if (porcentaje >= 80) {
      mensajeDesempeno = `¡Excelente nivel en <strong>${tema.titulo}</strong>! Tienes bases muy sólidas. Te invitamos a mantener este ritmo con simulacros completos para asegurar tu puntaje máximo en el ICFES.`;
    } else if (porcentaje >= 50) {
      mensajeDesempeno = `Tienes bases regulares en <strong>${tema.titulo}</strong>, pero hay vacíos conceptuales en preguntas clave que el ICFES suele evaluar con trampa.`;
    } else {
      mensajeDesempeno = `Identificamos oportunidades de mejora críticas en <strong>${tema.titulo}</strong>. Este puntaje en el componente real te restará puntos decisivos para tu ingreso a la universidad.`;
    }

    root.innerHTML = `
      <section class="panel" style="text-align: center; padding: 30px;">
        <h2 style="color: var(--azul);">Diagnóstico: ${tema.titulo}</h2>
        <p class="lead" style="margin: 0 auto 20px auto;">Reporte de resultados del simulador focalizado.</p>
        
        <div class="puntaje" style="margin: 20px 0;">
          <span class="num">${aciertos} / ${totalPreguntas}</span>
          <p style="margin: 5px 0; font-weight: 600; color: #555;">Aciertos logrados (${porcentaje}%)</p>
        </div>

        <div style="background: var(--suave); border: 1px solid var(--borde); padding: 20px; margin: 20px 0; border-radius: 6px; text-align: left;">
          <h3 style="color: var(--rojo); margin-top: 0;">Análisis personalizado:</h3>
          <p style="margin: 0; line-height: 1.6;">${mensajeDesempeno}</p>
        </div>

        <div style="border: 2px dashed var(--rojo); padding: 20px; margin-top: 25px; border-radius: 6px; background: #fffcfc;">
          <h3 style="color: var(--azul); margin-top: 0;">¿Quieres asegurar tu cupo en la universidad?</h3>
          <p style="margin-bottom: 15px;">No dejes tu puntaje al azar. Recibe acompañamiento profesional con las clases y tutorías de <strong>Mundo Matemático</strong>.</p>
          
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <a class="boton" href="https://wa.me/573000000000?text=Hola,%20hice%20el%20simulador%20en%20el%20módulo%20de%20${encodeURIComponent(tema.titulo)}%20y%20quiero%20información%20sobre%20las%20clases%20personalizadas" target="_blank" style="background: #25d366; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">
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
}

init();
