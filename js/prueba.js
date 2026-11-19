/**
 * ==========================================================================
 * MUNDO MATEMÁTICO - MOTOR PRINCIPAL DE PRUEBAS Y SIMULACROS (prueba.js)
 * ==========================================================================
 * Controla:
 * - Inicialización de simulacro global (?todas=1), minisimulacro (?todas=1&demo=1)
 *   o práctica por tema (?tema=...).
 * - Cronómetro visual y cierre automático al agotarse el tiempo.
 * - Renderizado de preguntas con imagen amplia y opciones en cuadrícula 2x2.
 * - Resultados globales (Pago con Wompi/QR -> Verificación con celular ->
 *   PDF Analítico por intento + sesión de 20 min / $15.000).
 * - Resultados focalizados por carpeta/tema con botones en cajoncitos dos a dos.
 */

import { cargarTemas, urlPng, PREGUNTAS_POR_PRUEBA } from "./temas.js";

function crearIdIntento() {
  return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Estado global de la sesión de evaluación
let state = {
  temas: [],           // Lista completa de temas cargados desde temas.js / indice.json
  cola: [],            // Cola de temas cuando se practica por carpeta individual
  indiceTema: 0,       // Índice del tema activo dentro de la cola
  seleccion: [],       // Arreglo de archivos de pregunta seleccionados para la prueba actual
  seleccionGlobal: [], // Preguntas mezcladas para el Simulacro Global
  item: 0,             // Índice de la pregunta actual (0 = primera pregunta)
  respuestas: {},      // Respuestas marcadas por el estudiante según el índice de pregunta
  todas: false,        // true = Simulacro Global | false = Práctica por tema
  tiempoRestante: 0,   // Tiempo restante en segundos
  intervaloTimer: null,// Referencia del setInterval del cronómetro
  idIntento: crearIdIntento()
};

function normalizarCelular(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function obtenerDatosPagoIntento(idIntento) {
  if (!idIntento) return null;
  try {
    const raw = sessionStorage.getItem(`mundo_matematico_pago_data_${idIntento}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function guardarDatosPagoIntento(idIntento, datos) {
  if (!idIntento) return;
  sessionStorage.setItem(`mundo_matematico_pago_data_${idIntento}`, JSON.stringify(datos));
}

function limpiarEstadoPagosAnteriores() {
  sessionStorage.removeItem("mundo_matematico_pagado_pro");
  const claves = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (
      k &&
      (k.startsWith("mundo_matematico_pagado_") ||
        k.startsWith("mundo_matematico_pago_data_") ||
        k.startsWith("mundo_matematico_pdf_descargado_"))
    ) {
      claves.push(k);
    }
  }
  claves.forEach((k) => sessionStorage.removeItem(k));
}

// Bloque HTML reutilizable: sesión de 20 minutos ($15.000) + descuento en clases personalizadas
function bloqueSesionYDescuentoHTML() {
  return `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; text-align: left;">
      <p style="margin: 0; line-height: 1.55; color: #1e293b; font-size: 0.92rem;">
        <strong style="color: #1e3a8a;">Sesión de revisión de 20 minutos ($15.000) y descuento en clases personalizadas:</strong>
        los $15.000 abarcan una sesión de 20 minutos para analizar tus resultados, resolver dudas clave y ofrecerte un
        <strong style="color: #dc2626;">descuento especial en clases personalizadas</strong> de Mundo Matemático.
      </p>
    </div>
  `;
}

/**
 * ==========================================================================
 * SECCIÓN 1: GESTIÓN DE CONTENEDORES Y DOM
 * ==========================================================================
 */
function obtenerContenedor() {
  let root =
    document.getElementById("vista") ||
    document.getElementById("root") ||
    document.getElementById("panel") ||
    document.querySelector("main");

  if (!root) {
    root = document.createElement("main");
    root.id = "vista";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * ==========================================================================
 * SECCIÓN 2: INICIALIZACIÓN DEL SISTEMA Y PARÁMETROS
 * ==========================================================================
 */
async function init() {
  const params = new URLSearchParams(window.location.search);
  limpiarEstadoPagosAnteriores();
  state.idIntento = crearIdIntento();

  const temaId = params.get("tema");
  const esTodas = params.get("todas") === "1";
  const esMinisimulacro = params.get("demo") === "1" || params.get("mini") === "1";

  state.temas = aliasTemas(await cargarTemas());
  const root = obtenerContenedor();

  if (!Array.isArray(state.temas) || !state.temas.length) {
    root.innerHTML = `
      <div class="tarjeta">
        <h2>Error al cargar módulos</h2>
        <p>No se pudieron cargar los temas. Revisa el archivo <code>indice.json</code> y <code>js/temas.js</code>.</p>
        <a href="index.html" class="boton">Volver al Menú</a>
      </div>
    `;
    return;
  }

  state.indiceTema = 0;

  if (esTodas) {
    state.todas = true;
    const preguntasGlobales = [];
    const rutasYaAgregadas = new Set();

    // 1 pregunta aleatoria por cada carpeta/tema en modo demo/minisimulacro; hasta 5 en global normal
    const maxPorTema = esMinisimulacro ? 1 : 5;

    state.temas.forEach((t) => {
      if (Array.isArray(t.preguntas) && t.preguntas.length > 0) {
        const preguntasMezcladas = [...t.preguntas].sort(() => Math.random() - 0.5);
        const cantidadASeleccionar = Math.min(maxPorTema, preguntasMezcladas.length);
        let seleccionadasTema = 0;

        for (const archivo of preguntasMezcladas) {
          if (seleccionadasTema >= cantidadASeleccionar) break;
          const claveUnica = `${t.carpeta || t.id}___${String(archivo).trim()}`;

          if (!rutasYaAgregadas.has(claveUnica)) {
            rutasYaAgregadas.add(claveUnica);
            preguntasGlobales.push({ archivo, tema: t });
            seleccionadasTema++;
          }
        }
      }
    });

    // Mezcla el orden general de las preguntas seleccionadas para que no salgan siempre igual
    state.seleccionGlobal = preguntasGlobales.sort(() => Math.random() - 0.5);
    state.seleccion = state.seleccionGlobal.map((x) => x.archivo);

    // 10 minutos para la demo de sustentación; 90 minutos para el Simulacro Global completo
    state.tiempoRestante = esMinisimulacro ? 10 * 60 : 90 * 60;
  } else if (temaId) {
    state.todas = false;
    state.cola = [temaId];
    prepararTemaActual();
    state.tiempoRestante = 20 * 60;
  } else {
    state.todas = false;
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
 * SECCIÓN 3: TEMPORIZADOR, RELOJ Y PREPARACIÓN DE TEMAS
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
    elReloj.textContent = `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
    if (state.tiempoRestante < 300) {
      elReloj.style.color = "#dc2626";
      elReloj.style.fontWeight = "800";
    }
  }
}

function aliasTemas(temas) {
  return (temas || []).map((t) => ({
    ...t,
    id: t.id || t.carpeta
  }));
}

function temaPorId(id) {
  return state.temas.find((t) => t.id === id || t.carpeta === id) || state.temas[0];
}

function prepararTemaActual() {
  const tema = temaPorId(state.cola[state.indiceTema]);
  const todasLasPreguntas = Array.isArray(tema?.preguntas) ? tema.preguntas : [];

  if (todasLasPreguntas.length > 0) {
    const preguntasMezcladas = [...todasLasPreguntas].sort(() => Math.random() - 0.5);
    const cantidadDeseada = Math.min(PREGUNTAS_POR_PRUEBA || 10, preguntasMezcladas.length);

    const unicas = [];
    const vistas = new Set();

    for (const archivo of preguntasMezcladas) {
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
 * SECCIÓN 4: RENDERIZADO DE PREGUNTAS (IMAGEN AMPLIA + CAJONES 2x2)
 * ==========================================================================
 */
export function renderPregunta(st) {
  let tema, archivo;

  if (st.todas) {
    const actualGlobal = st.seleccionGlobal?.[st.item];
    if (!actualGlobal) {
      if (st.intervaloTimer) clearInterval(st.intervaloTimer);
      mostrarResultadosFinalesGlobal(st);
      return;
    }
    tema = actualGlobal.tema;
    archivo = actualGlobal.archivo;
  } else {
    tema = temaPorId(st.cola?.[st.indiceTema || 0]);
    archivo = st.seleccion?.[st.item];
  }

  const total = st.todas ? (st.seleccionGlobal?.length || 0) : (st.seleccion?.length || 0);
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

  const minInicial = Math.floor(st.tiempoRestante / 60).toString().padStart(2, "0");
  const segInicial = (st.tiempoRestante % 60).toString().padStart(2, "0");

  root.innerHTML = `
    <div style="max-width: 960px; width: 100%; margin: 0 auto; padding: 5px; box-sizing: border-box;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <p class="migas" style="margin: 0; font-size: 0.82rem;"><a href="index.html">Menú</a> / ${st.todas ? "Simulacro Global" : (tema.titulo || tema.id)}</p>
        <div style="font-size: 0.85rem; font-weight: bold; color: #1e3a8a; background: #eff6ff; padding: 3px 8px; border-radius: 4px;">
          Tiempo: <span id="reloj-tiempo">${minInicial}:${segInicial}</span>
        </div>
      </div>

      <div style="height: 5px; background: #e2e8f0; border-radius: 3px; margin-bottom: 4px; overflow: hidden;">
        <div style="height: 100%; background: #1e3a8a; border-radius: 3px; width: ${total > 0 ? ((st.item + 1) / total) * 100 : 0}%"></div>
      </div>
      <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px; font-weight: 600;">Ejercicio ${st.item + 1} de ${total}</p>
      
      <section class="panel-pregunta" style="margin: 0 auto; width: 100%; padding: 15px;">
        
        <div style="text-align: center; margin-bottom: 15px; width: 100%;">
          <img
            class="pregunta-img"
            alt="Pregunta ${st.item + 1}"
            src="${rutaImagenFinal}"
            style="width: 100%; height: auto; max-height: none; display: block; margin: 0 auto; border-radius: 4px;"
            onerror="this.style.display='none'; document.getElementById('img-error').style.display='block';"
          />
          <p id="img-error" style="display: none; color: #dc2626; font-size: 0.82rem;">[No se pudo cargar la imagen: ${archivo}]</p>
        </div>

        <p id="error" class="alerta oculto" style="margin-bottom: 10px; color: #dc2626; font-size: 0.82rem; font-weight: bold; text-align: center;">
          Por favor responde la pregunta para continuar.
        </p>
        
        <form id="form-opciones" style="width: 100%;">
          ${subPreguntas.map((num) => {
            const valorAnterior = esMulti ? respuestaPrevia[num] : respuestaPrevia;
            return `
              ${num ? `<h3 style="color: #1e3a8a; margin-top: 10px; margin-bottom: 6px; font-size: 0.95rem; font-weight: bold; border-bottom: 1px solid #eff6ff; padding-bottom: 3px;">Pregunta ${num}</h3>` : ""}
              
              <div style="margin-bottom: 12px;">
                <p style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Elige una respuesta:</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                  ${["A", "B", "C", "D"].map((l) => {
                    const marcado = valorAnterior === l ? "checked" : "";
                    const bgSeleccionado = marcado ? "#eff6ff" : "#f8fafc";
                    const borderSeleccionado = marcado ? "#2563eb" : "#cbd5e1";
                    return `
                      <label style="display: flex; align-items: center; justify-content: center; gap: 8px; background: ${bgSeleccionado}; border: 1.5px solid ${borderSeleccionado}; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold; transition: all 0.1s;">
                        <input type="radio" name="opcion_${num || "unica"}" value="${l}" ${marcado} required style="cursor: pointer; accent-color: #1e3a8a; margin: 0;" />
                        <span style="color: #1e293b; font-size: 0.95rem;">${l}</span>
                      </label>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}

          <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            <button
              class="boton boton-gris"
              type="button"
              id="btn-anterior"
              ${st.item === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 8px 14px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;"' : 'style="padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.85rem;"'}
            >
              ← Anterior
            </button>
            <button
              class="boton"
              type="submit"
              style="flex: 1; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 0.9rem;"
            >
              ${st.item + 1 < total ? "Siguiente →" : "Ver Resultados"}
            </button>
          </div>
        </form>
      </section>
    </div>
  `;

  const btnAnterior = document.getElementById("btn-anterior");
  if (btnAnterior) {
    btnAnterior.onclick = () => {
      if (st.item > 0) {
        st.item -= 1;
        renderPregunta(st);
      }
    };
  }

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
 * SECCIÓN 5: RESULTADOS GLOBALES (PAGO -> VERIFICACIÓN CELULAR -> PDF)
 * ==========================================================================
 */
function mostrarResultadosFinalesGlobal(st) {
  if (st.intervaloTimer) clearInterval(st.intervaloTimer);

  let aciertos = 0;
  const preguntasGlobales = Array.isArray(st.seleccionGlobal) ? st.seleccionGlobal : [];
  const totalPreguntas = preguntasGlobales.length;

  const erroresPorTema = {};
  const aciertosPorCompetencia = {};
  const totalPorCompetencia = {};

  preguntasGlobales.forEach((itemGlobal, index) => {
    const tema = itemGlobal.tema || {};
    const nombreTema = tema.titulo || tema.carpeta || "General";
    const archivo = itemGlobal.archivo;
    const respuestaCorrecta = (tema.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas?.[index];

    totalPorCompetencia[nombreTema] = (totalPorCompetencia[nombreTema] || 0) + 1;
    if (!aciertosPorCompetencia[nombreTema]) aciertosPorCompetencia[nombreTema] = 0;

    let esAcierto = false;
    if (respuestaCorrecta && typeof respuestaCorrecta === "object") {
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) {
          todasCorrectas = false;
        }
      }
      if (todasCorrectas) esAcierto = true;
    } else if (respuestaCorrecta !== undefined) {
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

  const incorrectas = Math.max(0, totalPreguntas - aciertos);
  const porcentaje = totalPreguntas > 0 ? Math.round((aciertos / totalPreguntas) * 100) : 0;

  let nivelDesempeno = "1";
  if (porcentaje >= 75) nivelDesempeno = "4";
  else if (porcentaje >= 50) nivelDesempeno = "3";
  else if (porcentaje >= 35) nivelDesempeno = "2";

  const root = obtenerContenedor();
  const linkWompi = "https://checkout.wompi.co/l/Mzd7Vo";
  const urlQrWompi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(linkWompi)}`;
  const datosPago = obtenerDatosPagoIntento(st.idIntento);
  const yaPago = Boolean(datosPago && datosPago.verificado && datosPago.celular);
  const pdfDescargado = Boolean(datosPago && datosPago.pdfDescargado);
  const celularGuardado = datosPago?.celular || "";
  const textoAgendaWhatsApp = encodeURIComponent(
    `Hola Mundo Matemático, ya realicé el pago del Simulacro Global (${porcentaje}%), verifiqué mi celular (${celularGuardado}) y quiero agendar mi sesión de análisis de 20 minutos ($15.000).`
  );

  let htmlCompetencias = "";
  let contadorComp = 1;
  for (const [comp, totalComp] of Object.entries(totalPorCompetencia)) {
    const okComp = aciertosPorCompetencia[comp] || 0;
    htmlCompetencias += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 12px 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
        <span style="font-size: 0.9rem; color: #334155; font-weight: 500;">${contadorComp}. ${comp}</span>
        <span style="font-size: 0.95rem; font-weight: bold; color: #1e3a8a;">${okComp}/${totalComp}</span>
      </div>
    `;
    contadorComp++;
  }

  root.innerHTML = `
    <div style="max-width: 820px; width: 100%; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 30px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); box-sizing: border-box;">
      
      <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px;">
        <span style="background: #eff6ff; color: #1e3a8a; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
          Simulacro Global Saber 11
        </span>
        <h2 style="color: #1e3a8a; font-size: 1.6rem; margin: 10px 0 5px 0;">Puntaje Obtenido</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin: 0;">Evaluación bajo estándares analíticos TRI</p>
      </div>

      <div style="text-align: center; margin-bottom: 25px;">
        <div style="width: 110px; height: 110px; border: 6px solid #e2e8f0; border-top-color: #ef4444; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 10px auto;">
          <span style="font-size: 2rem; font-weight: 800; color: #1e293b; line-height: 1;">${porcentaje}%</span>
        </div>
        <span style="font-size: 0.8rem; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Puntaje de la prueba (${aciertos}/${totalPreguntas})</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px;">
        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">CORRECTAS:</span>
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 200px; margin: 0 15px;">
            <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${totalPreguntas > 0 ? (aciertos / totalPreguntas) * 100 : 0}%; height: 100%; background: #10b981;"></div>
            </div>
          </div>
          <span style="font-size: 1rem; font-weight: bold; color: #10b981; min-width: 25px; text-align: right;">${aciertos}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">INCORRECTAS:</span>
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 200px; margin: 0 15px;">
            <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${totalPreguntas > 0 ? (incorrectas / totalPreguntas) * 100 : 0}%; height: 100%; background: #ef4444;"></div>
            </div>
          </div>
          <span style="font-size: 1rem; font-weight: bold; color: #ef4444; min-width: 25px; text-align: right;">${incorrectas}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <span style="font-size: 0.9rem; color: #64748b; font-weight: 600;">NIVEL ESTIMADO:</span>
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; max-width: 200px; margin: 0 15px;">
            <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${(nivelDesempeno / 4) * 100}%; height: 100%; background: #8b5cf6;"></div>
            </div>
          </div>
          <span style="font-size: 1rem; font-weight: bold; color: #8b5cf6; min-width: 25px; text-align: right;">${nivelDesempeno}</span>
        </div>
      </div>

      ${bloqueSesionYDescuentoHTML()}

      <div style="margin-bottom: 25px;">
        <h4 style="color: #1e3a8a; font-size: 0.95rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Desempeño por Componentes:</h4>
        ${htmlCompetencias}
      </div>

      <div id="bloque-pago-pro" style="border: 2px solid ${yaPago ? "#10b981" : "#1e3a8a"}; background: ${yaPago ? "#f0fdf4" : "#eff6ff"}; padding: 20px; border-radius: 12px; text-align: center;">
        ${yaPago ? `
          <span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">PAGO Y CELULAR VERIFICADOS (${celularGuardado})</span>
          <h3 style="color: #10b981; margin: 10px 0 5px 0; font-size: 1.2rem;">Tu Informe Analítico PDF está listo</h3>
          <p style="color: #334155; font-size: 0.85rem; margin-bottom: 12px;">
            ${pdfDescargado
              ? "El informe analítico en PDF correspondiente a este simulacro ya fue generado. Si deseas presentar otro simulacro con un nuevo informe, inicia un nuevo intento."
              : "Descarga tu informe analítico completo en PDF con gráfica por componente, matriz diagnóstica y ruta de estudio, y agenda tu sesión de 20 minutos ($15.000)."}
          </p>
          <button id="btn-descargar-pdf" class="boton boton-verde" style="padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1rem; margin-bottom: 10px;">
            ${pdfDescargado ? "Volver a abrir el PDF Analítico de este Simulacro" : "Descargar Informe Analítico (PDF)"}
          </button>
          <a
            href="https://wa.me/573115574410?text=${textoAgendaWhatsApp}"
            target="_blank"
            rel="noopener noreferrer"
            class="boton"
            style="padding: 12px 20px; border-radius: 8px; font-weight: bold; width: 100%; font-size: 0.95rem; margin-top: 0; box-sizing: border-box; text-align: center;"
          >
            Agendar Sesión de Análisis (20 min · WhatsApp)
          </a>
        ` : `
          <span style="background: #1e3a8a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">SESIÓN DE 20 MIN · $15.000</span>
          <h3 style="color: #1e3a8a; margin: 10px 0 5px 0; font-size: 1.2rem;">Informe Analítico PDF + Sesión de 20 minutos ($15.000)</h3>
          <p style="color: #334155; font-size: 0.85rem; margin-bottom: 12px;">Los $15.000 abarcan tu informe analítico en PDF, una sesión de 20 minutos para revisar tus resultados y acceso a un descuento en clases personalizadas.</p>

          <div style="background: #fffbeb; border: 1px solid #f59e0b; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 14px; text-align: left;">
            <strong>Importante:</strong> Para desbloquear y descargar tu informe analítico PDF después de pagar, debes ingresar aquí el <strong>mismo número de celular</strong> con el que realizaste el pago.
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
            <a href="${linkWompi}" target="_blank" rel="noopener noreferrer" class="boton boton-verde" style="padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 1rem; width: 100%; box-sizing: border-box; text-align: center;">
              Pagar $15.000 con Wompi
            </a>
            <div style="background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; display: inline-block;">
              <img src="${urlQrWompi}" alt="QR Wompi" style="width: 110px; height: 110px; display: block; margin: 0 auto 5px auto;" />
              <span style="font-size: 0.7rem; color: #64748b; font-weight: bold;">Escanea para pagar</span>
            </div>

            <div style="width: 100%; max-width: 420px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; text-align: left; box-sizing: border-box;">
              <label for="input-celular-pago" style="display: block; font-size: 0.82rem; font-weight: bold; color: #1e3a8a; margin-bottom: 6px;">
                Verifica tu pago con el número de celular:
              </label>
              <input
                id="input-celular-pago"
                type="tel"
                inputmode="numeric"
                placeholder="Ej: 3115574410"
                style="width: 100%; padding: 10px 12px; border: 1px solid #94a3b8; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 8px;"
              />
              <p id="error-celular-pago" style="display: none; color: #dc2626; font-size: 0.78rem; font-weight: bold; margin: 0 0 8px 0;">
                Ingresa un número de celular válido de 10 dígitos (ej. 3115574410).
              </p>
              <button
                id="btn-verificar-celular-pago"
                type="button"
                class="boton"
                style="padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 0.9rem; margin-top: 0;"
              >
                Verificar Pago y Desbloquear PDF Analítico
              </button>
            </div>
          </div>
        `}

        <button id="btn-nuevo-examen" class="boton boton-gris" style="padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 0.9rem; margin-top: 12px;">
          Presentar Otro Examen (Nuevo Intento)
        </button>

        <div style="margin-top: 12px; text-align: center;">
          <a href="prueba.html?todas=1&demo=1" class="boton boton-gris" style="width: 100%; margin-top: 0; box-sizing: border-box;">
            Probar Mini-Simulacro Demo (Sustentación)
          </a>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const btnVerificarCelular = document.getElementById("btn-verificar-celular-pago");
    const inputCelular = document.getElementById("input-celular-pago");
    const errorCelular = document.getElementById("error-celular-pago");

    if (btnVerificarCelular && inputCelular) {
      btnVerificarCelular.onclick = () => {
        const limpio = normalizarCelular(inputCelular.value);
        if (!/^3\d{9}$/.test(limpio)) {
          if (errorCelular) {
            errorCelular.textContent = "Ingresa un número de celular válido de 10 dígitos (ej. 3115574410).";
            errorCelular.style.display = "block";
          }
          inputCelular.focus();
          return;
        }
        if (errorCelular) errorCelular.style.display = "none";
        guardarDatosPagoIntento(st.idIntento, {
          verificado: true,
          celular: limpio,
          pdfDescargado: false
        });
        mostrarResultadosFinalesGlobal(st);
      };
    }

    const btnPdf = document.getElementById("btn-descargar-pdf");
    if (btnPdf) {
      btnPdf.onclick = () => {
        const actual = obtenerDatosPagoIntento(st.idIntento) || { verificado: true, celular: celularGuardado };
        guardarDatosPagoIntento(st.idIntento, {
          ...actual,
          pdfDescargado: true
        });
        generarPDFInformePersonalizado(
          aciertos,
          totalPreguntas,
          porcentaje,
          nivelDesempeno,
          erroresPorTema,
          st.idIntento,
          aciertosPorCompetencia,
          totalPorCompetencia,
          actual.celular || celularGuardado
        );
        mostrarResultadosFinalesGlobal(st);
      };
    }

    const btnNuevoExamen = document.getElementById("btn-nuevo-examen");
    if (btnNuevoExamen) {
      btnNuevoExamen.onclick = () => {
        limpiarEstadoPagosAnteriores();
        window.location.href = "prueba.html?todas=1";
      };
    }
  }, 50);
}

/**
 * ==========================================================================
 * SECCIÓN 6: PRÁCTICAS FOCALIZADAS (CARPETAS / MÓDULOS INDIVIDUALES)
 * ==========================================================================
 */
function bloqueBeneficiosYClasesHTML() {
  const urlWhatsApp = "https://wa.me/573115574410?text=" + encodeURIComponent(
    "Hola Mundo Matemático, quiero agendar una clase personalizada."
  );

  return `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; text-align: left;">
      <p style="margin: 0; line-height: 1.55; color: #1e293b; font-size: 0.92rem;">
        <strong style="color: #1e3a8a;">Un buen puntaje en el ICFES te abre muchas puertas:</strong>
        acceso a universidades, becas, apoyos y oportunidades académicas. Con
        <strong style="color: #dc2626;">clases personalizadas</strong> en Mundo Matemático puedes fortalecer tus bases, corregir vacíos y lograr un gran resultado.
        <a href="${urlWhatsApp}" target="_blank" rel="noopener noreferrer" style="color: #1e3a8a; font-weight: 700; text-decoration: underline;">
          ¡Agenda tu clase ahora!
        </a>
      </p>
    </div>
  `;
}

function mostrarResultadosFinales(st, tema) {
  if (st.intervaloTimer) clearInterval(st.intervaloTimer);

  const temaActual = tema || temaPorId(st.cola?.[st.indiceTema || 0]);
  const preguntasTema = Array.isArray(st.seleccion) ? st.seleccion : [];
  const totalPreguntas = preguntasTema.length;
  let aciertos = 0;

  preguntasTema.forEach((archivo, index) => {
    const respuestaCorrecta = (temaActual?.respuestas || {})[archivo];
    const respuestaUsuario = st.respuestas?.[index];

    if (respuestaCorrecta && typeof respuestaCorrecta === "object") {
      let todasCorrectas = true;
      for (const subKey in respuestaCorrecta) {
        if (respuestaUsuario?.[subKey] !== respuestaCorrecta[subKey]) {
          todasCorrectas = false;
        }
      }
      if (todasCorrectas) aciertos++;
    } else if (respuestaCorrecta !== undefined) {
      if (respuestaUsuario === respuestaCorrecta) {
        aciertos++;
      }
    }
  });

  const porcentaje = totalPreguntas > 0 ? Math.round((aciertos / totalPreguntas) * 100) : 0;
  const incorrectas = Math.max(0, totalPreguntas - aciertos);
  const root = obtenerContenedor();

  let mensajeDesempeno = "";
  let alertaColor = "#dc2626";
  let fondoCaja = "#fff5f5";

  if (porcentaje >= 80) {
    alertaColor = "#16a34a";
    fondoCaja = "#f0fdf4";
    mensajeDesempeno = `Excelente nivel en <strong>${temaActual?.titulo || temaActual?.id || "este módulo"}</strong>. Mantén este ritmo de práctica para consolidar tu desempeño en el Saber 11.`;
  } else if (porcentaje >= 50) {
    alertaColor = "#d97706";
    fondoCaja = "#fffbeb";
    mensajeDesempeno = `Nivel intermedio en <strong>${temaActual?.titulo || temaActual?.id || "este módulo"}</strong>. Revisar los distractores y las condiciones del enunciado te ayudará a subir tu puntaje.`;
  } else {
    alertaColor = "#dc2626";
    fondoCaja = "#fff5f5";
    mensajeDesempeno = `Se detectaron oportunidades de mejora en <strong>${temaActual?.titulo || temaActual?.id || "este módulo"}</strong>. Conviene repasar los conceptos clave y practicar de nuevo.`;
  }

  const tituloModulo = temaActual?.titulo || temaActual?.id || "Módulo";
  const linkSimulacroGlobal = "prueba.html?todas=1";
  const numeroWhatsApp = "573115574410";
  const mensajeWhatsApp = encodeURIComponent(
    `Hola Mundo Matemático, terminé la práctica de ${tituloModulo} y quiero agendar una clase personalizada`
  );

  root.innerHTML = `
    <div style="max-width: 820px; width: 100%; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 28px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); box-sizing: border-box;">
      <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 18px; margin-bottom: 20px;">
        <span style="background: #eff6ff; color: #1e3a8a; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
          Práctica Focalizada
        </span>
        <h2 style="color: #1e3a8a; font-size: 1.5rem; margin: 10px 0 5px 0;">${tituloModulo}</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin: 0;">Resumen de desempeño del módulo</p>
      </div>

      <div style="text-align: center; margin-bottom: 22px;">
        <div style="width: 105px; height: 105px; border: 6px solid #e2e8f0; border-top-color: ${alertaColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto;">
          <span style="font-size: 1.8rem; font-weight: 800; color: #1e293b;">${porcentaje}%</span>
        </div>
        <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">${aciertos} correctas de ${totalPreguntas} ejercicios (${incorrectas} por reforzar)</span>
      </div>

      <div style="background: ${fondoCaja}; border: 1px solid ${alertaColor}; padding: 18px; margin-bottom: 18px; border-radius: 10px; text-align: left;">
        <h3 style="color: ${alertaColor}; margin: 0 0 8px 0; font-size: 1rem;">Diagnóstico del módulo</h3>
        <p style="margin: 0; line-height: 1.55; color: #334155; font-size: 0.92rem;">${mensajeDesempeno}</p>
      </div>

      ${bloqueBeneficiosYClasesHTML()}

      <!-- Cuatro botones en cajoncitos paralelos dos a dos -->
      <div class="rejilla-dos-a-dos" style="margin-bottom: 0;">
        <button id="btn-repetir-tema" class="boton" style="margin-top: 0; width: 100%;">
          Repetir este Módulo
        </button>

        <a class="boton boton-rojo" href="${linkSimulacroGlobal}" style="margin-top: 0; width: 100%;">
          Presentar Simulacro Global
        </a>

        <a class="boton boton-verde" href="https://wa.me/${numeroWhatsApp}?text=${mensajeWhatsApp}" target="_blank" rel="noopener noreferrer" style="margin-top: 0; width: 100%;">
          Solicitar Tutoría por WhatsApp
        </a>

        <a class="boton boton-gris" href="index.html" style="margin-top: 0; width: 100%;">
          Volver al Menú Principal
        </a>
      </div>
    </div>
  `;

  setTimeout(() => {
    const btnRepetir = document.getElementById("btn-repetir-tema");
    if (btnRepetir) {
      btnRepetir.onclick = () => {
        prepararTemaActual();
        iniciarTemporizador();
        renderPregunta(state);
      };
    }
  }, 50);
}

/**
 * ==========================================================================
 * SECCIÓN 7: GENERACIÓN DE PDF ANALÍTICO (INFORME PREDICTIVO SABER 11)
 * ==========================================================================
 */
function limpiarNombreComponente(nombre) {
  return String(nombre || "Componente")
    .replace(/^\s*\d+\s*[\.\-\)]\s*/u, "")
    .trim();
}

function generarPDFInformePersonalizado(
  aciertos,
  totalPreguntas,
  porcentaje,
  nivelDesempeno,
  erroresPorTema,
  idIntento = "",
  aciertosPorCompetencia = {},
  totalPorCompetencia = {},
  celularVerificado = ""
) {
  const ventanaImpresion = window.open("", "_blank");

  if (!ventanaImpresion) {
    alert("Por favor permite las ventanas emergentes (pop-ups) en tu navegador para descargar el PDF.");
    return;
  }

  const listaCompetencias = Object.keys(totalPorCompetencia || {});
  const temasOrdenados = listaCompetencias
    .map((comp) => {
      const compLimpio = limpiarNombreComponente(comp);
      const tot = totalPorCompetencia[comp] || 0;
      const ok = aciertosPorCompetencia[comp] || 0;
      const err = erroresPorTema?.[comp] ?? Math.max(0, tot - ok);
      const pctComp = tot > 0 ? Math.round((ok / tot) * 100) : 0;

      let prioridad = "Estable";
      let colorPrioridad = "#16a34a";
      if (pctComp < 50) {
        prioridad = "Prioridad alta";
        colorPrioridad = "#dc2626";
      } else if (pctComp < 75) {
        prioridad = "Refuerzo medio";
        colorPrioridad = "#d97706";
      }

      return { comp: compLimpio, ok, tot, err, pctComp, prioridad, colorPrioridad };
    })
    .sort((a, b) => a.pctComp - b.pctComp || b.err - a.err);

  const sinAciertos = temasOrdenados.filter((t) => t.ok === 0).map((t) => t.comp);
  const enDesarrollo = temasOrdenados.filter((t) => t.ok > 0 && t.pctComp < 75).map((t) => `${t.comp} (${t.pctComp}%)`);
  const consolidados = temasOrdenados.filter((t) => t.pctComp >= 75).map((t) => `${t.comp} (${t.pctComp}%)`);

  const resumenSinAciertos = sinAciertos.length
    ? sinAciertos.join(", ")
    : "ninguno (hubo al menos un acierto por área)";
  const resumenEnDesarrollo = enDesarrollo.length
    ? enDesarrollo.join(", ")
    : "ninguno en franja intermedia";
  const resumenConsolidados = consolidados.length
    ? consolidados.join(", ")
    : "ninguno aún por encima del 75%";

  const topCriticos = temasOrdenados.slice(0, 3).map((t) => `${t.comp} (${t.ok}/${t.tot})`).join(", ");

  const analisisCompetencias = `
    <p style="margin: 0 0 10px 0;">
      En esta evaluación de <strong>${aciertos} aciertos sobre ${totalPreguntas} ítems (${porcentaje}% · Nivel ${nivelDesempeno})</strong>, el comportamiento por ejes muestra una distribución desigual de la habilidad matemática estimada:
    </p>
    <ul style="margin: 0 0 10px 0; padding-left: 18px;">
      <li style="margin-bottom: 6px;"><strong>Áreas sin aciertos en el intento:</strong> ${resumenSinAciertos}. En estos componentes el error no es un descuido aislado: suele indicar vacíos en la lectura de condiciones del problema o en la elección del modelo matemático adecuado.</li>
      <li style="margin-bottom: 6px;"><strong>Áreas en desarrollo (parciales):</strong> ${resumenEnDesarrollo}. Aquí existen bases funcionales, pero el procedimiento falla al cambiar el contexto, las unidades o la estructura de las opciones.</li>
      <li style="margin-bottom: 0;"><strong>Áreas con mayor estabilidad (≥ 75%):</strong> ${resumenConsolidados}.</li>
    </ul>
    <p style="margin: 0; color: #475569; font-size: 12px;">
      <em>Nota metodológica: este diagnóstico se construye a partir del rendimiento real por tema en la sesión y no sustituye la revisión paso a paso de cada ejercicio en la sesión de 20 minutos.</em>
    </p>
  `;

  const recomendacionTemas = `
    <p style="margin: 0 0 10px 0;">
      <strong>1. Diagnóstico de causa raíz en ${topCriticos || "los temas de menor puntaje"}:</strong> antes de acumular más simulacros, conviene identificar si el fallo ocurre al <em>interpretar el enunciado</em> (qué piden y qué restricciones dan), al <em>plantear la relación</em> (proporcionalidad, álgebra, geometría, conteo o probabilidad) o al <em>ejecutar el cálculo</em>.
    </p>
    <p style="margin: 0 0 10px 0;">
      <strong>2. Trabajo por bloques según el nivel de dominio:</strong> en las áreas sin aciertos, retoma primero la definición operativa y ejemplos resueltos guiados; en las áreas intermedias, practica contrastando opciones distractoras para detectar dónde se rompe la lógica.
    </p>
    <p style="margin: 0;">
      <strong>3. Preparación para tu sesión de 20 minutos:</strong> llega con tus dudas sobre los temas críticos de este informe para priorizar los ajustes de mayor impacto en tu puntaje y definir un plan de clases personalizadas si lo necesitas.
    </p>
  `;

  const htmlGraficaBarras = temasOrdenados.length
    ? temasOrdenados
        .map((item) => {
          const colorBarra =
            item.pctComp >= 75 ? "#16a34a" : item.pctComp >= 50 ? "#d97706" : "#dc2626";
          return `
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                <span>${item.comp}</span>
                <span style="color: ${colorBarra};">${item.ok}/${item.tot} (${item.pctComp}%)</span>
              </div>
              <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="width: ${item.pctComp}%; height: 100%; background: ${colorBarra}; border-radius: 999px;"></div>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p style="font-size: 12px; color: #64748b; margin: 0;">No hay desglose por componentes disponible para este intento.</p>`;

  const htmlFilasMatriz = temasOrdenados.length
    ? temasOrdenados
        .map(
          (item) => `
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #1e293b;">${item.comp}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; color: #16a34a; font-weight: 700;">${item.ok}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; color: #dc2626; font-weight: 700;">${item.err}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; font-weight: 700;">${item.pctComp}%</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; color: ${item.colorPrioridad}; font-weight: 700;">${item.prioridad}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="5" style="padding: 10px; font-size: 12px; color: #64748b; text-align: center;">Sin datos por componente.</td></tr>`;

  ventanaImpresion.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Informe Analítico PDF - Mundo Matemático</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 36px; background: #fff; line-height: 1.55; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 22px; }
        .header-left h1 { margin: 0; font-size: 24px; color: #1e3a8a; font-weight: 800; letter-spacing: 0.5px; }
        .header-left p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600; }
        .header-right { text-align: right; font-size: 12px; color: #334155; }
        .header-right span { display: block; font-weight: bold; color: #1e3a8a; }
        .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px 20px; margin-bottom: 18px; }
        .card h3 { color: #1e3a8a; margin-top: 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px; }
        .metric-box { background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; text-align: center; }
        .metric-box .num { font-size: 20px; font-weight: bold; color: #1e3a8a; }
        .metric-box .label { font-size: 11px; color: #64748b; font-weight: bold; margin-top: 2px; }
        table.matriz { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; }
        table.matriz th { background: #eff6ff; color: #1e3a8a; font-size: 11px; text-transform: uppercase; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
        .footer { background: #f0fdf4; border: 1px solid #16a34a; color: #166534; padding: 16px; border-radius: 8px; text-align: center; margin-top: 24px; }
        .footer-title { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
        .footer-info { font-size: 12px; color: #334155; font-weight: normal; }
        @media print {
          body { padding: 18px; }
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
          <span>INFORME ANALÍTICO SABER 11</span>
          Fecha: ${new Date().toLocaleDateString()}${idIntento ? `<br><small style="color:#64748b;">Ref: ${idIntento}</small>` : ""}${celularVerificado ? `<br><small style="color:#64748b;">Cel: ${celularVerificado}</small>` : ""}
        </div>
      </div>

      <div class="card">
        <h3>Certificado de Diagnóstico y Métricas (Estándar TRI)</h3>
        <div class="grid">
          <div class="metric-box">
            <div class="num">${aciertos} / ${totalPreguntas}</div>
            <div class="label">Aciertos Totales (${porcentaje}%)</div>
          </div>
          <div class="metric-box">
            <div class="num" style="font-size: 16px; color: #dc2626; margin-top: 4px;">Nivel ${nivelDesempeno}</div>
            <div class="label">Desempeño Estimado</div>
          </div>
        </div>
        <p style="font-size: 13px; color: #334155; margin: 0;">
          Evaluación analítica independiente basada en parámetros de discriminación de ítems para aspirantes a educación superior.
        </p>
      </div>

      <div class="card">
        <h3>Gráfica de Rendimiento por Componente</h3>
        ${htmlGraficaBarras}
      </div>

      <div class="card">
        <h3>Matriz Diagnóstica por Componente</h3>
        <table class="matriz">
          <thead>
            <tr>
              <th style="text-align: left;">Componente / Tema</th>
              <th style="text-align: center;">Aciertos</th>
              <th style="text-align: center;">Fallos</th>
              <th style="text-align: center;">Dominio</th>
              <th style="text-align: right;">Prioridad</th>
            </tr>
          </thead>
          <tbody>
            ${htmlFilasMatriz}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>Análisis de Competencias Latentes</h3>
        <div style="font-size: 13px; color: #334155; text-align: justify;">
          ${analisisCompetencias}
        </div>
      </div>

      <div class="card">
        <h3>Ruta de Corrección y Recomendaciones Académicas</h3>
        <div style="font-size: 13px; color: #334155; text-align: justify;">
          ${recomendacionTemas}
        </div>
      </div>

      <div class="footer">
        <div class="footer-title">Asegura tu cupo universitario con tutorías especializadas</div>
        <div class="footer-info">
          Web oficial: <strong>www.mimundomatematico.com</strong> &nbsp;|&nbsp; WhatsApp / Contacto directo: <strong>311 557 4410</strong><br>
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

// Arranque del simulacro una vez declaradas todas las funciones
init();
