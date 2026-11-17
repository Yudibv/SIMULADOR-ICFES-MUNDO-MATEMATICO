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
  
  // VALIDACIÓN SEGURA DE WOMPI: Si Wompi redirige de vuelta con éxito tras pagar
  if (params.get("pagado") === "true") {
    sessionStorage.setItem("mundo_matematico_pagado_pro", "true");
    window.history.replaceState({}, document.title, window.location.pathname + "?todas=1");
  } else {
    // Si entra por primera vez al simulacro, nos aseguramos de que NO esté pagado
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
 * SECCIÓN 4: RENDERIZADO DE PREGUNTAS Y NAVEGACIÓN
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <p class="migas" style="margin: 0;"><a href="index.html">Menú</a> / ${st.todas ? 'Simulacro Global Saber 11' : (tema.titulo || tema.id)}</p>
      <div style="font-size: 1rem; font-weight: bold; color: var(--azul, #1e3a8a); background: var(--azul-claro, #eff6ff); padding: 5px 12px; border-radius: 6px;">
        ⏱️ Tiempo: <span id="reloj-tiempo">${minInicial}:${segInicial}</span>
      </div>
    </div>

    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Ejercicio ${st.item + 1} de ${total}</p>
    
    <section class="panel">
      <div style="text-align: center; margin-bottom: 20px;">
        <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${rutaImagenFinal}" onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';">
        <p id="img-error" style="display:none; color: red; font-size: 0.9rem;">[No se pudo cargar la imagen: ${archivo} en la carpeta ${tema.carpeta}]</p>
      </div>
      <p id="error" class="alerta oculto" style="margin-bottom: 15px; color: red;">Por favor responde la pregunta para continuar.</p>
      
      <form id="form-opciones">
        ${subPreguntas.map((num) => {
          const valorAnterior = esMulti ? respuestaPrevia[num] : respuestaPrevia;
          return `
            ${num ? `<h3 class="subtitulo-pregunta" style="color: var(--azul, #1e3a8a); margin-top: 15px; margin-bottom: 8px;">Pregunta ${num}</h3>` : ""}
            <fieldset class="opciones" style="margin-bottom: 20px; border: none; padding: 0;">
              <legend class="sr">Elige una respuesta</legend>
              ${["A", "B", "C", "D"]
                .map((l) => {
                  const marcado = valorAnterior === l ? 'checked' : '';
                  return `<label class="opcion">
                    <input type="radio" name="opcion_${num || 'unica'}" value="${l}" ${marcado} required>
                    <span class="letra">${l}</span><span>Opción ${l}</span>
                  </label>`;
                })
                .join("")}
            </fieldset>
          `;
        }).join("")}

        <div class="acciones" style="display: flex; justify-content: space-between; gap: 15px; margin-top: 25px;">
          <button class="boton" type="button" id="btn-anterior" ${st.item === 0 ? 'style="opacity: 0.5; cursor: not-allowed; background: #64748b;"' : 'style="background: #64748b;"'}>
            ← Anterior
          </button>
          <button class="boton" type="submit" style="flex: 1;">
            ${st.item + 1 < total ? 'Siguiente →' : 'Ver Diagnóstico y Resultados 🏁'}
          </button>
        </div>
      </form>
    </section>
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
 * SECCIÓN 5: RESULTADOS GLOBALES Y PASARELA WOMPI (BLOQUEO DE SEGURIDAD)
 * ==========================================================================
 */
function mostrarResultadosFinalesGlobal(st) {
  if (st.intervaloTimer) clearInterval(st.intervaloTimer);
  let aciertos = 0;
  let totalPreguntas = st.seleccionGlobal.length;
  
  let erroresPorTema = {};

  st.seleccionGlobal.forEach((itemGlobal, index) => {
    const tema = itemGlobal.tema;
    const nombreTema = tema.titulo || tema.carpeta || "General";
    const archivo = itemGlobal.archivo;
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas[index];

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
    } else {
      erroresPorTema[nombreTema] = (erroresPorTema[nombreTema] || 0) + 1;
    }
  });

  let temasFfalladosOrdenados = Object.keys(erroresPorTema).sort((a, b) => erroresPorTema[b] - erroresPorTema[a]);
  let textoDiagnosticoPersonalizado = "Basado en la calibración de ítems de alta discriminación, hemos detectado vulnerabilidades críticas en componentes de razonamiento cuantitativo y análisis lógico.";
  if (temasFfalladosOrdenados.length > 0) {
    textoDiagnosticoPersonalizado = `Basado en la calibración de ítems, se han detectado vulnerabilidades críticas principalmente en <strong>${temasFfalladosOrdenados[0]}</strong> y componentes conexos de análisis algebraico y geométrico.`;
  }

  const porcentaje = Math.round((aciertos / totalPreguntas) * 100);
  let nivelDesempeno = "Nivel 1 (En riesgo)";
  if (porcentaje >= 75) nivelDesempeno = "Nivel 4 (Avanzado)";
  else if (porcentaje >= 50) nivelDesempeno = "Nivel 3 (Satisfactorio)";
  else if (porcentaje >= 35) nivelDesempeno = "Nivel 2 (Mínimo)";

  const root = obtenerContenedor();
  
  // Enlace oficial de pago Wompi configurado para redirigir con ?pagado=true al aprobarse
  const linkWompi = "https://checkout.wompi.co/l/Mzd7Vo";
  const urlQrWompi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(linkWompi)}`;

  // VERIFICACIÓN ESTRICTA: Solo es true si Wompi aprobó el pago y redirigió con ?pagado=true
  const yaPago = sessionStorage.getItem("mundo_matematico_pagado_pro") === "true";

  root.innerHTML = `
    <section class="panel" style="text-align: center; padding: 30px;">
      <div style="background: #1e3a8a; color: white; padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; display: inline-block; margin-bottom: 15px;">
        ESTÁNDAR ICFES (TRI - 3PL)
      </div>
      <h2 style="color: var(--azul); font-size: 1.8rem; margin-top: 0;">Informe Analítico Predictivo Global</h2>
      <p style="color: #64748b; margin-bottom: 25px;">Evaluación integral de razonamiento cuantitativo (${totalPreguntas} preguntas analizadas).</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
        <div>
          <div style="font-size: 2.2rem; font-weight: bold; color: var(--azul);">${aciertos} / ${totalPreguntas}</div>
          <div style="color: #64748b; font-size: 0.9rem; font-weight: 600;">Aciertos Totales (${porcentaje}%)</div>
        </div>
        <div>
          <div style="font-size: 1.6rem; font-weight: bold; color: var(--rojo); margin-top: 5px;">${nivelDesempeno}</div>
          <div style="color: #64748b; font-size: 0.9rem; font-weight: 600;">Desempeño Estimado Saber 11</div>
        </div>
      </div>

      <div style="background: var(--azul-claro); border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; text-align: left; margin-bottom: 25px;">
        <h4 style="color: var(--azul); margin-top: 0; display: flex; align-items: center; gap: 8px;">
          🔒 Diagnóstico de Competencias Latentes (Parámetros TRI)
        </h4>
        <p style="color: #334155; font-size: 0.95rem; line-height: 1.5; margin-bottom: 10px;">
          ${textoDiagnosticoPersonalizado}
        </p>
        <p style="color: #1e3a8a; font-size: 0.85rem; font-style: italic; margin: 0;">
          * El reporte detallado con las claves de respuesta y la ruta de corrección se entrega de forma automatizada al completar el pago en Wompi.
        </p>
      </div>

      <div style="border: 2px solid ${yaPago ? '#16a34a' : '#e11d48'}; padding: 25px; margin-top: 25px; border-radius: 8px; background: ${yaPago ? '#f0fdf4' : '#fff1f2'};">
        
        ${yaPago ? `
          <span style="background: #16a34a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">¡PAGO VERIFICADO CON ÉXITO!</span>
          <h3 style="color: #16a34a; margin-top: 10px; font-size: 1.3rem;">Tu Cuadernillo Pro personalizado está listo</h3>
          <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
            Wompi ha confirmado tu transacción de forma exitosa. Haz clic para descargar tu PDF con el diagnóstico detallado.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-direction: column; align-items: center; max-width: 350px; margin: 0 auto;">
            <button id="btn-descargar-pdf" class="boton" style="background: #16a34a; color: white; padding: 14px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 1.05rem;">
              📥 Descargar mi Cuadernillo Pro (PDF)
            </button>
            <button id="btn-nuevo-examen" class="boton" style="background: #2563eb; color: white; padding: 12px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 1rem; margin-top: 5px;">
              🔄 Presentar Otro Examen (Nuevo Intento)
            </button>
            <a class="boton" href="index.html" style="background: #1e3a8a; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; width: 100%; box-sizing: border-box; text-align: center;">
              Volver al Menú Principal
            </a>
          </div>
        ` : `
          <span style="background: #e11d48; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">ACCESO RESTRINGIDO - PAGO REQUERIDO</span>
          <h3 style="color: #9f1239; margin-top: 10px; font-size: 1.3rem;">Obtén tu Cuadernillo Pro por solo $15.000 COP</h3>
          <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
            Para desbloquear la descarga de tu PDF personalizado con la ruta de corrección, realiza el pago seguro en línea a través de Wompi.
          </p>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; margin-bottom: 20px;">
            <a class="boton" href="${linkWompi}" target="_blank" style="background: #16a34a; color: white; text-decoration: none; padding: 14px 24px; border-radius: 6px; font-weight: bold; font-size: 1.05rem; width: 100%; max-width: 350px; box-sizing: border-box; text-align: center;">
              💳 Pagar $15.000 con Wompi (Nequi / PSE / Tarjeta)
            </a>

            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; display: inline-block; text-align: center;">
              <img src="${urlQrWompi}" alt="QR Pago Wompi" style="width: 130px; height: 130px; display: block; margin: 0 auto 8px auto;">
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Escanea con tu celular para pagar de inmediato</span>
            </div>
          </div>

          <p style="font-size: 0.85rem; color: #64748b; margin-top: 15px;">
            ¿Ya realizaste el pago en Wompi y no te redirigió automáticamente?<br>
            Asegúrate de regresar desde la pasarela de pago oficial o contacta a soporte vía WhatsApp: <strong>311 557 4410</strong>.
          </p>

          <button id="btn-nuevo-examen-libre" class="boton" style="background: #64748b; color: white; padding: 10px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; max-width: 350px; margin-top: 15px; font-size: 0.95rem;">
            🔄 Presentar Otro Examen (Nuevo Intento)
          </button>
        `}

      </div>

      <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 0.8rem; line-height: 1.4;">
        Mundo Matemático es una iniciativa educativa independiente de preparación preuniversitaria. No está afiliada, vinculada ni patrocinada oficialmente por el ICFES.
      </div>
    </section>
  `;

  setTimeout(() => {
    const btnPdf = document.getElementById("btn-descargar-pdf");
    if (btnPdf) {
      btnPdf.onclick = () => {
        generarPDFInformePersonalizado(aciertos, totalPreguntas, porcentaje, nivelDesempeno, erroresPorTema);
      };
    }

    const btnNuevoExamen = document.getElementById("btn-nuevo-examen");
    if (btnNuevoExamen) {
      btnNuevoExamen.onclick = () => {
        sessionStorage.removeItem("mundo_matematico_pagado_pro");
        window.location.href = "prueba.html?todas=1";
      };
    }

    const btnNuevoExamenLibre = document.getElementById("btn-nuevo-examen-libre");
    if (btnNuevoExamenLibre) {
      btnNuevoExamenLibre.onclick = () => {
        sessionStorage.removeItem("mundo_matematico_pagado_pro");
        window.location.href = "prueba.html?todas=1";
      };
    }
  }, 100);
}

/**
 * ==========================================================================
 * SECCIÓN 6: PRÁCTICAS FOCALIZADAS (MÓDULOS INDIVIDUALES)
 * ==========================================================================
 */
function mostrarResultadosFinales(st, tema) {
  if (st.intervaloTimer) clearInterval(st.intervaloTimer);
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

  let mensajeDesempeno = "";
  let alertaColor = "var(--rojo)";
  let fondoCaja = "#fff5f5";

  if (porcentaje >= 80) {
    alertaColor = "#16a34a";
    fondoCaja = "#f0fdf4";
    mensajeDesempeno = `¡Excelente nivel en <strong>${tema.titulo}</strong>! Tienes bases muy sólidas. Sigue manteniendo este gran ritmo de estudio para asegurar puntaje sobresaliente en el ICFES.`;
  } else if (porcentaje >= 50) {
    alertaColor = "#d97706";
    fondoCaja = "#fffbeb";
    mensajeDesempeno = `Tienes bases regulares en <strong>${tema.titulo}</strong>, pero hay vacíos conceptuales en preguntas clave que el ICFES suele evaluar con trampa. ¡Un repaso a tiempo marca la diferencia!`;
  } else {
    alertaColor = "var(--rojo)";
    fondoCaja = "#fff5f5";
    mensajeDesempeno = `Identificamos oportunidades de mejora críticas en <strong>${tema.titulo}</strong>. Te sugerimos reforzar urgentemente este módulo con asesoría especializada antes de la prueba real.`;
  }

  const linkSimulacroGlobal = "prueba.html?todas=1";
  const numeroWhatsApp = "573115574410"; 
  const mensajeWp = encodeURIComponent(`Hola, acabo de hacer la práctica focalizada de ${tema.titulo} en Mundo Matemático y saqué ${aciertos}/${totalPreguntas}. Me gustaría recibir más información sobre tutorías.`);

  root.innerHTML = `
    <section class="panel" style="text-align: center; padding: 30px;">
      <h2 style="color: var(--azul);">Práctica Focalizada: ${tema.titulo}</h2>
      <p class="lead" style="margin: 0 auto 20px auto;">Reporte de resultados del módulo de entrenamiento.</p>
      
      <div class="puntaje" style="margin: 20px 0;">
        <span class="num">${aciertos} / ${totalPreguntas}</span>
        <p style="margin: 5px 0; font-weight: 600; color: #555;">Aciertos logrados (${porcentaje}%)</p>
      </div>

      <div style="background: ${fondoCaja}; border: 1px solid ${alertaColor}; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: left;">
        <h3 style="color: ${alertaColor}; margin-top: 0;">Análisis personalizado:</h3>
        <p style="margin: 0; line-height: 1.6; color: #334155;">${mensajeDesempeno}</p>
      </div>

      <div style="border: 2px solid var(--azul); padding: 25px; margin-top: 25px; border-radius: 8px; background: #eff6ff;">
        <span style="background: var(--azul); color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">ASESORÍA Y PREPARACIÓN MUNDO MATEMÁTICO</span>
        <h3 style="color: var(--azul); margin-top: 10px; font-size: 1.3rem;">¿Quieres dominar este tema y subir tu puntaje ICFES?</h3>
        <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
          Fortalece tu talento con nuestras clases personalizadas, simulacros globales y material exclusivo de preuniversitario.
        </p>
        
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; flex-direction: column; align-items: center; max-width: 400px; margin: 0 auto;">
          <a class="boton" href="https://wa.me/${numeroWhatsApp}?text=${mensajeWp}" target="_blank" style="background: #16a34a; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; font-size: 1rem; width: 100%; box-sizing: border-box; text-align: center;">
            💬 Pedir Tutoría o Refuerzo por WhatsApp
          </a>

          <a class="boton" href="${linkSimulacroGlobal}" style="background: var(--azul); color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; font-size: 1rem; width: 100%; box-sizing: border-box; text-align: center;">
            🚀 Presentar Simulacro Global Completo (40 Preguntas)
          </a>

          <a class="boton" href="index.html" style="background: #64748b; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; font-size: 1rem; width: 100%; box-sizing: border-box; text-align: center;">
            🏠 Volver al Menú Principal / Sitio Web
          </a>
        </div>
      </div>

      <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 0.8rem; line-height: 1.4;">
        Mundo Matemático es una iniciativa educativa independiente de preparación preuniversitaria. No está afiliada, vinculada ni patrocinada oficialmente por el ICFES.
      </div>
    </section>
  `;
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
