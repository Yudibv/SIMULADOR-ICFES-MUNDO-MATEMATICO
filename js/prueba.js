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
function mostrarResultadosFinales(st, tema) {
  let aciertos = 0;
  let totalPreguntas = st.seleccion.length;

  // Evaluar cuántas respuestas fueron correctas
  st.seleccion.forEach((archivo, index) => {
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas[index];

    if (typeof respuestaCorrecta === "object") {
      // Manejo de preguntas múltiples en una misma imagen
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) {
          todasCorrectas = false;
        }
      }
      if (todasCorrectas) aciertos++;
    } else {
      // Pregunta única
      if (respuestaUsuario === respuestaCorrecta) {
        aciertos++;
      }
    }
  });

  const porcentaje = Math.round((aciertos / totalPreguntas) * 100);
  const root = document.getElementById("vista") || document.getElementById("root");

  // Renderizar la vista de resultados y monetización
  root.innerHTML = `
    <section class="panel" style="text-align: center; padding: 30px;">
      <h2 style="color: var(--azul);">Diagnóstico de Aritmética - ICFES Saber 11</h2>
      <p class="lead" style="margin: 0 auto 20px auto;">Has completado el simulador focalizado de este módulo.</p>
      
      <div class="puntaje" style="margin: 20px 0;">
        <span class="num">${aciertos} / ${totalPreguntas}</span>
        <p style="margin: 5px 0; font-weight: 600; color: #555;">Respuestas correctas (${porcentaje}%)</p>
      </div>

      <div style="background: var(--suave); border: 1px solid var(--borde); padding: 20px; margin: 20px 0; border-radius: 6px; text-align: left;">
        <h3 style="color: var(--rojo); margin-top: 0;">Análisis de tu desempeño:</h3>
        <p>${porcentaje >= 70 ? 
          "¡Buen trabajo! Tienes bases sólidas en Aritmética, pero para asegurar los primeros puestos en el ICFES necesitas pulir velocidad y ejercicios tipo trampa." : 
          "Identificamos vacíos importantes en operaciones básicas y proporciones. Este puntaje en el ICFES real te restaría puntos clave para tu carrera."}
        </p>
      </div>

      <!-- SECCIÓN DE MONETIZACIÓN / LLAMADO A LA ACCIÓN (CTA) -->
      <div style="border: 2px dashed var(--rojo); padding: 20px; margin-top: 25px; border-radius: 6px; background: #fffcfc;">
        <h3 style="color: var(--azul); margin-top: 0;">¿Quieres asegurar tu cupo en la universidad?</h3>
        <p style="margin-bottom: 15px;">No dejes que la aritmética te baje el puntaje global. Refuerza con nuestro equipo en <strong>Mundo Matemático</strong>.</p>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <a class="boton" href="https://wa.me/573000000000?text=Hola,%20hice%20el%20simulador%20de%20Aritmética%20y%20quiero%20información%20sobre%20las%20clases%20personalizadas" target="_blank" style="background: #25d366; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">
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

function mostrarResultadosFinales(st, tema) {
  let aciertos = 0;
  let totalPreguntas = st.seleccion.length;

  // Evaluar cuántas respuestas fueron correctas
  st.seleccion.forEach((archivo, index) => {
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas[index];

    if (typeof respuestaCorrecta === "object") {
      // Manejo de preguntas múltiples en una misma imagen
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) {
          todasCorrectas = false;
        }
      }
      if (todasCorrectas) aciertos++;
    } else {
      // Pregunta única
      if (respuestaUsuario === respuestaCorrecta) {
        aciertos++;
      }
    }
  });

  const porcentaje = Math.round((aciertos / totalPreguntas) * 100);
  const root = document.getElementById("vista") || document.getElementById("root");

  // Renderizar la vista de resultados y monetización
  root.innerHTML = `
    <section class="panel" style="text-align: center; padding: 30px;">
      <h2 style="color: var(--azul);">Diagnóstico de Aritmética - ICFES Saber 11</h2>
      <p class="lead" style="margin: 0 auto 20px auto;">Has completado el simulador focalizado de este módulo.</p>
      
      <div class="puntaje" style="margin: 20px 0;">
        <span class="num">${aciertos} / ${totalPreguntas}</span>
        <p style="margin: 5px 0; font-weight: 600; color: #555;">Respuestas correctas (${porcentaje}%)</p>
      </div>

      <div style="background: var(--suave); border: 1px solid var(--borde); padding: 20px; margin: 20px 0; border-radius: 6px; text-align: left;">
        <h3 style="color: var(--rojo); margin-top: 0;">Análisis de tu desempeño:</h3>
        <p>${porcentaje >= 70 ? 
          "¡Buen trabajo! Tienes bases sólidas en Aritmética, pero para asegurar los primeros puestos en el ICFES necesitas pulir velocidad y ejercicios tipo trampa." : 
          "Identificamos vacíos importantes en operaciones básicas y proporciones. Este puntaje en el ICFES real te restaría puntos clave para tu carrera."}
        </p>
      </div>

      <!-- SECCIÓN DE MONETIZACIÓN / LLAMADO A LA ACCIÓN (CTA) -->
      <div style="border: 2px dashed var(--rojo); padding: 20px; margin-top: 25px; border-radius: 6px; background: #fffcfc;">
        <h3 style="color: var(--azul); margin-top: 0;">¿Quieres asegurar tu cupo en la universidad?</h3>
        <p style="margin-bottom: 15px;">No dejes que la aritmética te baje el puntaje global. Refuerza con nuestro equipo en <strong>Mundo Matemático</strong>.</p>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <a class="boton" href="https://wa.me/573000000000?text=Hola,%20hice%20el%20simulador%20de%20Aritmética%20y%20quiero%20información%20sobre%20las%20clases%20personalizadas" target="_blank" style="background: #25d366; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">
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
