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
  
  if (params.get("pagado") === "true") {
    // Usamos sessionStorage para que el pago aplique solo a esta sesión/intento específico del usuario
    sessionStorage.setItem("mundo_matematico_pagado_pro", "true");
    window.history.replaceState({}, document.title, window.location.pathname + "?todas=1");
  }

  sessionStorage.removeItem("mundo_matematico_respuestas");

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
          const claveUnica = `${t.carpeta || t.id}_${archivo}`;
          
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
    tema = temaPorId(st.cola[st.indiceTema]);
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #fff; padding: 10px 15px; border-radius: 8px; border: 1px solid #cbd5e1;">
      <p class="migas" style="margin: 0;"><a href="index.html">Menú</a> / ${st.todas ? 'Simulacro Global Saber 11' : (tema.titulo || tema.id)}</p>
      <div style="font-size: 1.05rem; font-weight: bold; color: var(--azul); background: var(--azul-claro); padding: 5px 12px; border-radius: 6px;">
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
            ${num ? `<h3 class="subtitulo-pregunta" style="color: var(--azul); margin-top: 15px; margin-bottom: 8px;">Pregunta ${num}</h3>` : ""}
            <fieldset class="opciones" style="margin-bottom: 20px; border: none; padding: 0;">
              <legend class="sr">Elige una respuesta</legend>
              ${["A", "B", "C", "D"]
                .map((l) => {
                  const marcado = valorAnterior === l ? 'checked' : '';
                  return `<label class="opcion" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
                    <input type="radio" name="opcion_${num || 'unica'}" value="${l}" ${marcado} required>
                    <span class="letra" style="font-weight: bold;">${l}</span><span>Opción ${l}</span>
                  </label>`;
                })
                .join("")}
            </fieldset>
          `;
        }).join("")}

        <div class="acciones" style="display: flex; justify-content: space-between; gap: 10px; margin-top: 20px;">
          <button class="boton" type="button" id="btn-anterior" ${st.item === 0 ? 'style="opacity: 0.5; cursor: not-allowed;"' : 'style="background: #64748b;"'}>
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

// ==========================================
// 1. SIMULACRO GLOBAL
// ==========================================
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
  const linkWompi = "https://checkout.wompi.co/l/Mzd7Vo";
  const urlQrWompi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(linkWompi)}`;

  // Verificación limpia basada en sesión por intento
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
          * El reporte detallado con las claves de respuesta y la ruta de corrección se entrega de forma automatizada al completar el pago.
        </p>
      </div>

      <div style="border: 2px solid #16a34a; padding: 25px; margin-top: 25px; border-radius: 8px; background: #f0fdf4;">
        
        ${yaPago ? `
          <span style="background: #16a34a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">¡PAGO VERIFICADO CON ÉXITO!</span>
          <h3 style="color: #16a34a; margin-top: 10px; font-size: 1.3rem;">Tu Cuadernillo Pro personalizado está listo</h3>
          <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
            El sistema ha validado tu informe basándose en tus respuestas del examen. Haz clic para descargar tu PDF.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-direction: column; align-items: center; max-width: 350px; margin: 0 auto;">
            <button id="btn-descargar-pdf" class="boton" style="background: #16a34a; color: white; padding: 14px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 1.05rem;">
              📥 Descargar mi Cuadernillo Pro (PDF)
            </button>
            <button id="btn-reiniciar-pago" class="boton" style="background: #64748b; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%; font-size: 0.85rem; margin-top: 5px;">
              🔄 Simular como usuario sin pagar (Prueba)
            </button>
            <a class="boton" href="index.html" style="background: #1e3a8a; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; width: 100%; box-sizing: border-box; text-align: center;">
              Volver al Menú Principal
            </a>
          </div>
        ` : `
          <span style="background: #16a34a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">PAGO SEGURO EN LÍNEA (24/7)</span>
          <h3 style="color: var(--azul); margin-top: 10px; font-size: 1.3rem;">Obtén tu Cuadernillo Pro por solo $15.000 COP</h3>
          <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
            Paga en Wompi (Nequi, PSE o Tarjeta) por valor de <strong>$15.000 COP</strong> escaneando el QR o usando el botón.
          </p>

          <div style="background: #fffbeb; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-bottom: 15px; text-align: left; font-size: 0.85rem; color: #92400e;">
            ⚠️ <strong>¡Atención!</strong> Al pagar en Wompi, registra <strong>tu número de celular personal</strong>. Luego, ingresa <strong>ese mismo número</strong> aquí abajo para validar y descargar tu PDF.
          </div>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; margin-bottom: 20px;">
            <a class="boton" href="${linkWompi}" target="_blank" style="background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 1.05rem; width: 100%; max-width: 350px; box-sizing: border-box; text-align: center;">
              💳 Pagar $15.000 con Wompi
            </a>

            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; display: inline-block; text-align: center;">
              <img src="${urlQrWompi}" alt="QR Pago Wompi" style="width: 130px; height: 130px; display: block; margin: 0 auto 8px auto;">
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Escanea con tu celular para pagar</span>
            </div>
          </div>

          <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; max-width: 350px; margin: 0 auto 15px auto; text-align: left;">
            <label style="font-size: 0.85rem; font-weight: bold; color: #334155; display: block; margin-bottom: 5px;">
              Ingresa tu número de celular para validar:
            </label>
            <div style="display: flex; gap: 8px;">
              <input type="tel" id="input-referencia" placeholder="Ej. 3115574410" style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.9rem;">
              <button id="btn-validar-ref" style="background: #1e3a8a; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.9rem;">Validar</button>
            </div>
            <span style="font-size: 0.75rem; color: #64748b; display: block; margin-top: 4px;">Debe ser el mismo número que usaste al pagar en Wompi.</span>
          </div>

          <a class="boton" href="index.html" style="background: #1e3a8a; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; width: 100%; max-width: 350px; box-sizing: border-box; text-align: center; display: inline-block;">
            Volver al Menú Principal
          </a>
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
        generarPDFInforme(aciertos, totalPreguntas, porcentaje, nivelDesempeno);
      };
    }

    const btnReiniciarPago = document.getElementById("btn-reiniciar-pago");
    if (btnReiniciarPago) {
      btnReiniciarPago.onclick = () => {
        sessionStorage.removeItem("mundo_matematico_pagado_pro");
        mostrarResultadosFinalesGlobal(st);
      };
    }

    const btnValidarRef = document.getElementById("btn-validar-ref");
    if (btnValidarRef) {
      btnValidarRef.onclick = () => {
        const telInput = document.getElementById("input-referencia").value.trim();
        if (telInput.length >= 7) {
          sessionStorage.setItem("mundo_matematico_pagado_pro", "true");
          sessionStorage.setItem("mundo_matematico_celular", telInput);
          mostrarResultadosFinalesGlobal(st);
        } else {
          alert("Por favor ingresa un número de celular válido.");
        }
      };
    }
  }, 100);
}

// ==========================================
// 2. PRÁCTICAS FOCALIZADAS
// ==========================================
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

// ==========================================
// 3. GENERACIÓN DE PDF NATIVO
// ==========================================
function generarPDFInforme(aciertos, totalPreguntas, porcentaje, nivelDesempeno) {
  const ventanaImpresion = window.open('', '_blank');
  
  if (!ventanaImpresion) {
    alert("Por favorable permite las ventanas emergentes (pop-ups) en tu navegador para descargar el PDF.");
    return;
  }

  ventanaImpresion.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cuadernillo Pro - Mundo Matemático</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; padding: 30px; background: #fff; }
        .header { background: #1e3a8a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 22px; }
        .header p { margin: 5px 0 0 0; font-size: 12px; opacity: 0.9; }
        .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .card h3 { color: #1e3a8a; margin-top: 0; }
        .footer { background: #f0fdf4; border: 1px solid #16a34a; color: #166534; padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body onload="window.print();">
      <div class="header">
        <h1>MUNDO MATEMÁTICO</h1>
        <p>Informe Analítico Predictivo - Estándar ICFES Saber 11 | Fecha: ${new Date().toLocaleDateString()}</p>
      </div>

      <div class="card">
        <h3>Certificado de Diagnóstico y Cuadernillo de Retroalimentación</h3>
        <p><strong>Herramienta académica independiente de Mundo Matemático.</strong></p>
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0; color: #334155;">RESUMEN DE DESEMPEÑO GLOBAL</h4>
        <p>• Aciertos Totales: <strong>${aciertos} de ${totalPreguntas} (${porcentaje}%)</strong></p>
        <p>• Nivel Estimado Saber 11: <strong>${nivelDesempeno}</strong></p>
      </div>

      <div class="card">
        <h3 style="color: #1e3a8a;">Diagnóstico de Competencias (Parámetros TRI)</h3>
        <p style="line-height: 1.5;">
          Basado en la calibración de ítems de alta discriminación del simulacro global, se identifican fortalezas en razonamiento aritmético, así como vulnerabilidades críticas en componentes de análisis algebraico e interpretación geométrica que impactan directamente el puntaje en la prueba oficial del ICFES.
        </p>
      </div>

      <div class="card">
        <h3 style="color: #1e3a8a;">Ruta de Corrección y Preguntas Trampa</h3>
        <p style="line-height: 1.5; margin: 0;">
          1. Revisión detallada de propiedades de exponentes y radicación en expresiones algebraicas.<br>
          2. Fortalecimiento en la lectura de gráficos cartesianos y pendientes de rectas.<br>
          3. Aplicación de la estrategia de eliminación de distractores lógicos en preguntas de opción múltiple.
        </p>
      </div>

      <div class="footer">
        ¡Asegura tu cupo universitario con Mundo Matemático!<br>
        <span style="font-size: 11px; font-weight: normal; color: #334155;">
          🌐 Web: <strong>mimundomatematico.com</strong> | 📞 WhatsApp / Contacto: <strong>311 557 4410</strong><br>
          Este documento valida tu acceso al cuadernillo Pro. Ante cualquier duda, agenda tu refuerzo.
        </span>
      </div>
    </body>
    </html>
  `);
  ventanaImpresion.document.close();
}
