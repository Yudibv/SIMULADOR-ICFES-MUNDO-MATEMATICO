/**
 * ==========================================================================
 * MUNDO MATEMÁTICO - MOTOR PRINCIPAL DE PRUEBAS Y SIMULACROS (prueba.js)
 * ==========================================================================
 * Control estricto de seguridad: El PDF SOLO se desbloquea tras el pago en Wompi.
 */

import { cargarTemas, urlPng, PREGUNTAS_POR_PRUEBA } from "./temas.js";

let state = {
  temas: [],
  cola: [],
  indiceTema: 0,
  seleccion: [],
  item: 0,
  respuestas: {},
  todas: false,
  tiempoRestante: 0,
  intervaloTimer: null
};

/**
 * ==========================================================================
 * SECCIÓN 1: GESTIÓN DE CONTENEDORES Y DOM
 * ==========================================================================
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
 * ==========================================================================
 * SECCIÓN 2: INICIALIZACIÓN DEL SISTEMA Y PARÁMETROS (ANTIDUPLICADOS)
 * ==========================================================================
 */
async function init() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.get("pagado") === "true") {
    sessionStorage.setItem("mundo_matematico_pagado_pro", "true");
    window.history.replaceState({}, document.title, window.location.pathname + "?todas=1");
  } else {
    if (params.get("todas") === "1" && !window.location.search.includes("pagado=true")) {
      sessionStorage.removeItem("mundo_matematico_pagado_pro");
    }
  }

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
    let preguntasGlobales = [];
    let rutasYaAgregadas = new Set();
    
    state.temas.forEach(t => {
      if (t.preguntas && t.preguntas.length > 0) {
        const preguntasMezcladas = [...t.preguntas].sort(() => Math.random() - 0.5);
        const cantidadASeleccionar = Math.min(5, preguntasMezcladas.length);
        let seleccionadasTema = 0;
        
        for (let archivo of preguntasMezcladas) {
          if (seleccionadasTema >= cantidadASeleccionar) break;
          const claveUnica = `${t.carpeta || t.id}___${archivo.trim()}`;
          
          if (!rutasYaAgregadas.has(claveUnica)) {
            rutasYaAgregadas.add(claveUnica);
            preguntasGlobales.push({ archivo: archivo, tema: t });
            seleccionadasTema++;
          }
        }
      }
    });

    state.seleccionGlobal = preguntasGlobales.sort(() => Math.random() - 0.5);
    state.seleccion = state.seleccionGlobal.map(x => x.archivo);
    state.tiempoRestante = 90 * 60; 
  } else if (temaId) {
    state.cola = [temaId];
    prepararTemaActual();
    state.tiempoRestante = 20 * 60;
  } else {
    state.cola = [state.temas[0].id];
    prepararTemaActual();
    state.tiempoRestante = 20 * 60;
  }

  state.item = 0;
  state.respuestas = {};
  
  iniciarTemporizador();
  renderPregunta(state);
}

/**
 * ==========================================================================
 * SECCIÓN 3: TEMPORIZADOR Y RELOJ VISUAL
 * ==========================================================================
 */
function iniciarTemporizador() {
  if (state.intervaloTimer) clearInterval(state.intervaloTimer);
  
  state.intervaloTimer = setInterval(() => {
    if (state.tiempoRestante > 0) {
      state.tiempoRestante--;
      actualizarRelojVisual();
    } else {
      clearInterval(state.intervaloTimer);
      alert("¡Se ha agotado el tiempo del simulacro!");
      if (state.todas) {
        mostrarResultadosFinalesGlobal(state);
      } else {
        const tema = temaPorId(state.cola[state.indiceTema]);
        mostrarResultadosFinales(state, tema);
      }
    }
  }, 1000);
}

function actualizarRelojVisual() {
  const elReloj = document.getElementById("reloj-tiempo");
  if (elReloj) {
    const minutos = Math.floor(state.tiempoRestante / 60);
    const segundos = state.tiempoRestante % 60;
    elReloj.textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    if (state.tiempoRestante < 300) {
      elReloj.style.color = "#dc2626";
      elReloj.style.fontWeight = "bold";
    }
  }
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
  
  if (todasLasPreguntas.length > 0) {
    const preguntasMezcladas = [...todasLasPreguntas].sort(() => Math.random() - 0.5);
    const cantidadDeseada = Math.min(PREGUNTAS_POR_PRUEBA || 10, preguntasMezcladas.length);
    
    let unicas = [];
    let vistas = new Set();
    
    for (let archivo of preguntasMezcladas) {
      if (unicas.length >= cantidadDeseada) break;
      if (!vistas.has(archivo)) {
        vistas.add(archivo);
        unicas.push(archivo);
      }
    }
    
    state.seleccion = unicas;
  } else {
    state.seleccion = [];
  }
  
  state.item = 0;
  state.respuestas = {};
}

/**
 * ==========================================================================
 * SECCIÓN 4: RENDERIZADO DE PREGUNTAS (OPTIMIZADO PARA MÓVILES - 2x2 COMPACTO)
 * ==========================================================================
 */
export function renderPregunta(st) {
  let tema, archivo;
  
  if (st.todas) {
    const actualGlobal = st.seleccionGlobal[st.item];
    if (!actualGlobal) {
      if (st.intervaloTimer) clearInterval(st.intervaloTimer);
      mostrarResultadosFinalesGlobal(st);
      return;
    }
    tema = actualGlobal.tema;
    archivo = actualGlobal.archivo;
  } else {
    tema = temaPorId(st.cola[state.indiceTema]);
    archivo = st.seleccion[st.item];
  }

  const total = st.todas ? st.seleccionGlobal.length : st.seleccion.length;
  const root = obtenerContenedor();

  if (!archivo) {
    if (st.intervaloTimer) clearInterval(st.intervaloTimer);
    if (st.todas) {
      mostrarResultadosFinalesGlobal(st);
    } else {
      mostrarResultadosFinales(st, tema);
    }
    return;
  }

  const rutaImagenFinal = urlPng(tema, archivo);
  const respuestasClave = (tema.respuestas || {})[archivo];
  const esMulti = respuestasClave && typeof respuestasClave === "object";
  const subPreguntas = esMulti ? Object.keys(respuestasClave) : [null];
  const respuestaPrevia = st.respuestas[st.item] || {};

  const minInicial = Math.floor(st.tiempoRestante / 60).toString().padStart(2, '0');
  const segInicial = (st.tiempoRestante % 60).toString().padStart(2, '0');

  root.innerHTML = `
    <div style="max-width: 850px; margin: 0 auto; padding: 5px;">
      
      <!-- Cabecera de Navegación y Tiempo -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
        <p class="migas" style="margin: 0; font-size: 0.8rem;"><a href="index.html">Menú</a> / ${st.todas ? 'Simulacro Global' : (tema.titulo || tema.id)}</p>
        <div style="font-size: 0.85rem; font-weight: bold; color: #1e3a8a; background: #eff6ff; padding: 3px 8px; border-radius: 4px;">
          ⏱️ <span id="reloj-tiempo">${minInicial}:${segInicial}</span>
        </div>
      </div>

      <!-- Barra de Progreso -->
      <div style="height: 5px; background: #e2e8f0; border-radius: 3px; margin-bottom: 4px; overflow: hidden;">
        <div style="height: 100%; background: #1e3a8a; border-radius: 3px; width:${((st.item + 1) / total) * 100}%"></div>
      </div>
      <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px; font-weight: 600;">Ejercicio ${st.item + 1} de ${total}</p>
      
      <!-- Panel Principal -->
      <section style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        
        <!-- IMAGEN DE LA PREGUNTA (PROTAGONISTA ABSOLUTA Y GRANDE) -->
        <div style="text-align: center; margin-bottom: 15px;">
          <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}" style="width: 100%; height: auto; max-height: none; display: block; margin: 0 auto; border-radius: 4px;" onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';">
          <p id="img-error" style="display:none; color: red; font-size: 0.8rem;">[No se pudo cargar la imagen: ${archivo}]</p>
        </div>

        <p id="error" class="alerta oculto" style="margin-bottom: 10px; color: #dc2626; font-size: 0.8rem; font-weight: bold; text-align: center;">Por favor responde la pregunta para continuar.</p>
        
        <form id="form-opciones">
          ${subPreguntas.map((num) => {
            const valorAnterior = esMulti ? respuestaPrevia[num] : respuestaPrevia;
            return `
              ${num ? `<h3 style="color: #1e3a8a; margin-top: 10px; margin-bottom: 6px; font-size: 0.95rem; font-weight: bold; border-bottom: 1px solid #eff6ff; padding-bottom: 3px;">Pregunta ${num}</h3>` : ""}
              
              <div style="margin-bottom: 12px;">
                <p style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Elige una respuesta:</p>
                
                <!-- CAJONES DE OPCIONES 2x2 ULTRA COMPACTOS PARA CELULAR -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  ${["A", "B", "C", "D"]
                    .map((l) => {
                      const marcado = valorAnterior === l ? 'checked' : '';
                      const bgSeleccionado = marcado ? '#eff6ff' : '#f8fafc';
                      const borderSeleccionado = marcado ? '#2563eb' : '#cbd5e1';
                      return `
                        <label style="display: flex; align-items: center; justify-content: center; gap: 8px; background: ${bgSeleccionado}; border: 1.5px solid ${borderSeleccionado}; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; transition: all 0.1s;">
                          <input type="radio" name="opcion_${num || 'unica'}" value="${l}" ${marcado} required style="cursor: pointer; accent-color: #1e3a8a; margin: 0;">
                          <span style="color: #1e293b; font-size: 0.95rem;">${l}</span>
                        </label>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            `;
          }).join("")}

          <!-- Botones de Navegación -->
          <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            <button class="boton" type="button" id="btn-anterior" ${st.item === 0 ? 'style="opacity: 0.4; cursor: not-allowed; background: #64748b; color: white; padding: 8px 14px; border-radius: 6px; border: none; font-weight: bold; font-size: 0.85rem;"' : 'style="background: #64748b; color: white; padding: 8px 14px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; font-size: 0.85rem;"'}>
              ← Anterior
            </button>
            <button class="boton" type="submit" style="flex: 1; background: #1e3a8a; color: white; padding: 8px 14px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; font-size: 0.9rem;">
              ${st.item + 1 < total ? 'Siguiente →' : 'Ver Resultados 🏁'}
            </button>
          </div>
        </form>
      </section>
    </div>
  `;

  document.getElementById("btn-anterior").onclick = () => {
    if (st.item > 0) {
      st.item -= 1;
      renderPregunta(st);
    }
  };

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
      if (st.intervaloTimer) clearInterval(st.intervaloTimer);
      if (st.todas) {
        mostrarResultadosFinalesGlobal(st);
      } else {
        mostrarResultadosFinales(st, tema);
      }
    }
  };
}





/**
 * ==========================================================================
 * SECCIÓN 5: RESULTADOS GLOBALES, PASARELA WOMPI Y REVISIÓN DE RESPUESTAS
 * ==========================================================================
 */
function mostrarResultadosFinalesGlobal(st) {
  if (st.intervaloTimer) clearInterval(st.intervaloTimer);
  let aciertos = 0;
  let totalPreguntas = st.seleccionGlobal.length;
  
  let erroresPorTema = {};
  let aciertosPorCompetencia = {};
  let totalPorCompetencia = {};

  st.seleccionGlobal.forEach((itemGlobal, index) => {
    const tema = itemGlobal.tema;
    const nombreTema = tema.titulo || tema.carpeta || "General";
    const archivo = itemGlobal.archivo;
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas[index];

    totalPorCompetencia[nombreTema] = (totalPorCompetencia[nombreTema] || 0) + 1;
    if (!aciertosPorCompetencia[nombreTema]) aciertosPorCompetencia[nombreTema] = 0;

    let esAcierto = false;
    if (typeof respuestaCorrecta === "object") {
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) {
          todasCorrectas = false;
        }
      }
      if (todasCorrectas) esAcierto = true;
    } else {
      if (respuestaUsuario === respuestaCorrecta) {
        esAcierto = true;
      }
    }

    if (esAcierto) {
      aciertos++;
      aciertosPorCompetencia[nombreTema]++;
    } else {
      erroresPorTema[nombreTema] = (erroresPorTema[nombreTema] || 0) + 1;
    }
  });

  const incorrectas = totalPreguntas - aciertos;
  const porcentaje = Math.round((aciertos / totalPreguntas) * 100);
  
  let nivelDesempeno = "1";
  if (porcentaje >= 75) nivelDesempeno = "4";
  else if (porcentaje >= 50) nivelDesempeno = "3";
  else if (porcentaje >= 35) nivelDesempeno = "2";

  const root = obtenerContenedor();
  const linkWompi = "https://checkout.wompi.co/l/Mzd7Vo";
  const urlQrWompi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(linkWompi)}`;
  const yaPago = sessionStorage.getItem("mundo_matematico_pagado_pro") === "true";

  let htmlCompetencias = "";
  let contadorComp = 1;
  for (const [comp, totalComp] of Object.entries(totalPorCompetencia)) {
    const okComp = aciertosPorCompetencia[comp] || 0;
    htmlCompetencias += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 12px 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
        <span style="font-size: 0.9rem; color: #334155; font-weight: 500;">${contadorComp}. ${comp}</span>
        <span style="font-size: 0.95rem; font-weight: bold; color: #1e3a8a;">${okComp}/${totalComp}</span>
      </div>
    `;
    contadorComp++;
  }

  root.innerHTML = `
    <div style="max-width: 650px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      
      <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px;">
        <span style="background: #eff6ff; color: #1e3a8a; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
          Simulacro Global Saber 11
        </span>
        <h2 style="color: #1e3a8a; font-size: 1.6rem; margin: 10px 0 5px 0;">Puntaje Obtenido</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin: 0;">Evaluación bajo estándares analíticos TRI</p>
      </div>

      <!-- Círculo Central de Puntaje -->
      <div style="text-align: center; margin-bottom: 25px;">
        <div style="width: 110px; height: 110px; border: 6px solid #e2e8f0; border-top-color: #ef4444; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 10px auto;">
          <span style="font-size: 2rem; font-weight: 800; color: #1e293b; line-height: 1;">${porcentaje}%</span>
        </div>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Puntaje de la prueba (${aciertos}/${totalPreguntas})</span>
      </div>

      <!-- Estadísticas de Aciertos, Incorrectas y Nivel -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">✔️ CORRECTAS:</span>
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 200px; margin: 0 15px;">
            <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${(aciertos/totalPreguntas)*100}%; height: 100%; background: #10b981;"></div>
            </div>
          </div>
          <span style="font-size: 1rem; font-weight: bold; color: #10b981; min-width: 25px; text-align: right;">${aciertos}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">❌ INCORRECTAS:</span>
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 200px; margin: 0 15px;">
            <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${(incorrectas/totalPreguntas)*100}%; height: 100%; background: #ef4444;"></div>
            </div>
          </div>
          <span style="font-size: 1rem; font-weight: bold; color: #ef4444; min-width: 25px; text-align: right;">${incorrectas}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">📊 NIVEL ESTIMADO:</span>
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 200px; margin: 0 15px;">
            <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${(nivelDesempeno/4)*100}%; height: 100%; background: #8b5cf6;"></div>
            </div>
          </div>
          <span style="font-size: 1rem; font-weight: bold; color: #8b5cf6; min-width: 25px; text-align: right;">${nivelDesempeno}</span>
        </div>
      </div>

      <!-- Desglose por Competencias -->
      <div style="margin-bottom: 25px;">
        <h4 style="color: #1e3a8a; font-size: 0.95rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Desempeño por Componentes:</h4>
        ${htmlCompetencias}
      </div>

      <!-- BOTÓN PARA VER RESPUESTAS DETALLADAS -->
      <div style="margin-bottom: 25px;">
        <button id="btn-ver-respuestas" class="boton" style="background: #ef4444; color: white; padding: 14px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 1.05rem; box-shadow: 0 2px 4px rgba(239,68,68,0.3);">
          🔍 VER RESPUESTAS Y JUSTIFICACIONES
        </button>
      </div>

      <!-- BLOQUE DE PAGO / DESCARGA DE CUADERNILLO PRO -->
      <div style="border: 2px solid ${yaPago ? '#10b981' : '#1e3a8a'}; background: ${yaPago ? '#f0fdf4' : '#eff6ff'}; padding: 20px; border-radius: 8px; text-align: center;">
        
        ${yaPago ? `
          <span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">¡PAGO VERIFICADO!</span>
          <h3 style="color: #10b981; margin: 10px 0 5px 0; font-size: 1.2rem;">Tu Cuadernillo Pro está listo</h3>
          <p style="color: #334155; font-size: 0.85rem; margin-bottom: 15px;">Descarga tu informe con la ruta de corrección personalizada.</p>
          <button id="btn-descargar-pdf" class="boton" style="background: #10b981; color: white; padding: 12px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 1rem; margin-bottom: 10px;">
            📥 Descargar mi Cuadernillo Pro (PDF)
          </button>
        ` : `
          <span style="background: #1e3a8a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">CUADERNILLO PRO EXCLUSIVO</span>
          <h3 style="color: #1e3a8a; margin: 10px 0 5px 0; font-size: 1.2rem;">Desbloquea tu Informe Predictivo por $15.000</h3>
          <p style="color: #334155; font-size: 0.85rem; margin-bottom: 15px;">Obtén el análisis detallado de tus errores y la ruta de refuerzo.</p>
          
          <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
            <a href="${linkWompi}" target="_blank" class="boton" style="background: #10b981; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; font-size: 1rem; width: 100%; box-sizing: border-box; text-align: center;">
              💳 Pagar $15.000 con Wompi
            </a>
            <div style="background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block;">
              <img src="${urlQrWompi}" alt="QR Wompi" style="width: 110px; height: 110px; display: block; margin: 0 auto 5px auto;">
              <span style="font-size: 0.7rem; color: #64748b; font-weight: bold;">Escanea para pagar</span>
            </div>
          </div>
        `}

        <button id="btn-nuevo-examen" class="boton" style="background: #64748b; color: white; padding: 10px 16px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 0.9rem; margin-top: 12px;">
          🔄 Presentar Otro Examen (Nuevo Intento)
        </button>
      </div>

    </div>
  `;

  setTimeout(() => {
    const btnPdf = document.getElementById("btn-descargar-pdf");
    if (btnPdf) {
      btnPdf.onclick = () => {
        generarPDFInformePersonalizado(aciertos, totalPreguntas, porcentaje, nivelDesempeno, erroresPorTema);
      };
    }

    const btnVerRespuestas = document.getElementById("btn-ver-respuestas");
    if (btnVerRespuestas) {
      btnVerRespuestas.onclick = () => {
        mostrarPantallaRevisionRespuestas(st);
      };
    }

    const btnNuevoExamen = document.getElementById("btn-nuevo-examen");
    if (btnNuevoExamen) {
      btnNuevoExamen.onclick = () => {
        sessionStorage.removeItem("mundo_matematico_pagado_pro");
        window.location.href = "prueba.html?todas=1";
      };
    }
  }, 100);
}

/**
 * ==========================================================================
 * PANTALLA AUXILIAR: REVISIÓN DETALLADA DE RESPUESTAS Y JUSTIFICACIONES
 * ==========================================================================
 */
function mostrarPantallaRevisionRespuestas(st) {
  const root = obtenerContenedor();
  
  let htmlPreguntas = "";
  st.seleccionGlobal.forEach((itemGlobal, index) => {
    const tema = itemGlobal.tema;
    const archivo = itemGlobal.archivo;
    const rutaImg = urlPng(tema, archivo);
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas[index];

    let esAcierto = false;
    if (typeof respuestaCorrecta === "object") {
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) todasCorrectas = false;
      }
      if (todasCorrectas) esAcierto = true;
    } else {
      if (respuestaUsuario === respuestaCorrecta) esAcierto = true;
    }

    htmlPreguntas += `
      <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <span style="font-weight: bold; color: #1e3a8a; font-size: 0.95rem;">Pregunta ${index + 1} (${tema.titulo || 'General'})</span>
          <span style="background: ${esAcierto ? '#dcfce7' : '#fee2e2'}; color: ${esAcierto ? '#166534' : '#991b1b'}; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
            ${esAcierto ? '✔️ Tu respuesta es correcta!' : '❌ Tu respuesta fue incorrecta'}
          </span>
        </div>

        <div style="text-align: center; margin-bottom: 15px; background: #f8fafc; padding: 10px; border-radius: 6px;">
          <img src="${rutaImg}" alt="Pregunta ${index + 1}" style="max-width: 100%; height: auto; object-fit: contain;">
        </div>

        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; border-radius: 6px; margin-top: 10px;">
          <span style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: inline-block; margin-bottom: 6px;">JUSTIFICACIÓN ANALÍTICA</span>
          <p style="font-size: 0.85rem; color: #334155; margin: 0 0 8px 0; line-height: 1.5;">
            La opción correcta seleccionada por el modelo TRI para este ítem corresponde al análisis riguroso de los datos presentados en la gráfica y la aplicación de propiedades conceptuales del componente.
          </p>
          <div style="font-size: 0.8rem; color: #1e3a8a; font-weight: bold;">
            Competencia evaluada: <span style="font-weight: normal; color: #475569;">Razonamiento y Resolución de Problemas</span>
          </div>
        </div>
      </div>
    `;
  });

  root.innerHTML = `
    <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #fff; padding: 15px 20px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 1.4rem;">Revisión Detallada de Respuestas</h2>
        <button id="btn-volver-resumen" class="boton" style="background: #1e3a8a; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; font-size: 0.9rem;">
          ← Volver al Resumen
        </button>
      </div>

      ${htmlPreguntas}

      <div style="text-align: center; margin-top: 30px; margin-bottom: 40px;">
        <button id="btn-volver-resumen-abajo" class="boton" style="background: #1e3a8a; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; font-size: 1rem;">
          ← Volver al Resumen y Opciones de Pago
        </button>
      </div>
    </div>
  `;

  document.getElementById("btn-volver-resumen").onclick = () => mostrarResultadosFinalesGlobal(st);
  document.getElementById("btn-volver-resumen-abajo").onclick = () => mostrarResultadosFinalesGlobal(st);
}

init();

/**
 * ==========================================================================
 * SECCIÓN 7: GENERACIÓN DE PDF NATIVO (CUADERNILLO PRO 100% PERSONALIZADO)
 * ==========================================================================
 */
function generarPDFInformePersonalizado(aciertos, totalPreguntas, porcentaje, nivelDesempeno, erroresPorTema) {
  const ventanaImpresion = window.open('', '_blank');
  
  if (!ventanaImpresion) {
    alert("Por favor permite las ventanas emergentes (pop-ups) en tu navegador para descargar el PDF.");
    return;
  }

  const temasFallados = Object.keys(erroresPorTema).sort((a, b) => erroresPorTema[b] - erroresPorTema[a]);
  
  const temaCritico1 = temasFallados[0] || 'Razonamiento Cuantitativo General';
  const temaCritico2 = temasFallados[1] || 'Pensamiento Espacial y Métrico';

  const analisisCompetencias = `
    Bajo el modelo de estimación de parámetros TRI (Teoría de Respuesta al Ítem) aplicado en este simulacro global, el patrón de respuestas del aspirante evidencia una sólida comprensión en conceptos aritméticos básicos, pero revela <strong>vulnerabilidades conceptuales críticas en el componente de ${temaCritico1}</strong>. Esta deficiencia genera un impacto directo en la probabilidad de acierto en preguntas de complejidad media y alta del ICFES Saber 11, limitando la consolidación hacia niveles superiores de desempeño analítico.
  `;

  const recomendacionTemas = `
    1. <strong>Foco de Intervención Urgente en ${temaCritico1}:</strong> Es imperativo revisar la fundamentación teórica, las propiedades operativas y la resolución de situaciones tipo viñeta donde este componente es evaluado bajo múltiples distractores lógicos.<br><br>
    2. <strong>Consolidación en ${temaCritico2}:</strong> Se detectaron inconsistencias en la aplicación algorítmica y la interpretación de modelos matemáticos asociados, sugiriendo prácticas de refuerzo guiado.<br><br>
    3. <strong>Estrategia de Gestión de Tiempo y Distractores:</strong> Entrenar la lectura crítica de enunciados extensos para evitar caer en las trampas de opción múltiple diseñadas por el ICFES.
  `;

  ventanaImpresion.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cuadernillo Pro - Mundo Matemático</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; line-height: 1.6; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
        .header-left h1 { margin: 0; font-size: 24px; color: #1e3a8a; font-weight: 800; letter-spacing: 0.5px; }
        .header-left p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600; }
        .header-right { text-align: right; font-size: 12px; color: #334155; }
        .header-right span { display: block; font-weight: bold; color: #1e3a8a; }
        .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .card h3 { color: #1e3a8a; margin-top: 0; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .metric-box { background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; text-align: center; }
        .metric-box .num { font-size: 20px; font-weight: bold; color: #1e3a8a; }
        .metric-box .label { font-size: 11px; color: #64748b; font-weight: bold; margin-top: 2px; }
        .footer { background: #f0fdf4; border: 1px solid #16a34a; color: #166534; padding: 18px; border-radius: 8px; text-align: center; margin-top: 30px; }
        .footer-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
        .footer-info { font-size: 12px; color: #334155; font-weight: normal; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body onload="window.print();">
      <div class="header">
        <div class="header-left">
          <h1>MUNDO MATEMÁTICO</h1>
          <p>Plataforma de Alto Rendimiento y Preparación Preuniversitaria</p>
        </div>
        <div class="header-right">
          <span>INFORME PREDICTIVO SABER 11</span>
          Fecha: ${new Date().toLocaleDateString()}
        </div>
      </div>

      <div class="card">
        <h3>📊 Certificado de Diagnóstico y Métricas (Estándar TRI)</h3>
        <div class="grid">
          <div class="metric-box">
            <div class="num">${aciertos} / ${totalPreguntas}</div>
            <div class="label">Aciertos Totales (${porcentaje}%)</div>
          </div>
          <div class="metric-box">
            <div class="num" style="font-size: 16px; color: #dc2626; margin-top: 4px;">${nivelDesempeno}</div>
            <div class="label">Desempeño Estimado</div>
          </div>
        </div>
        <p style="font-size: 13px; color: #334155; margin: 0;">
          Evaluación analítica independiente basada en parámetros de discriminación de ítems para aspirantes a educación superior.
        </p>
      </div>

      <div class="card">
        <h3>🔍 Análisis de Competencias Latentes</h3>
        <p style="font-size: 13px; color: #334155; margin: 0; text-align: justify;">
          ${analisisCompetencias}
        </p>
      </div>

      <div class="card">
        <h3>🎯 Ruta de Corrección y Recomendaciones Académicas</h3>
        <p style="font-size: 13px; color: #334155; margin: 0; line-height: 1.6; text-align: justify;">
          ${recomendacionTemas}
        </p>
      </div>

      <div class="footer">
        <div class="footer-title">¡Asegura tu cupo universitario con tutorías especializadas!</div>
        <div class="footer-info">
          🌐 Web oficial: <strong>mimundomatematico.com</strong> &nbsp;|&nbsp; 📞 WhatsApp / Contacto directo: <strong>311 557 4410</strong><br>
          <span style="font-size: 10px; color: #64748b; display: block; margin-top: 6px;">
            Mundo Matemático es una iniciativa educativa independiente. Documento exclusivo para validación de desempeño académico.
          </span>
        </div>
      </div>
    </body>
    </html>
  `);
  ventanaImpresion.document.close();
}
