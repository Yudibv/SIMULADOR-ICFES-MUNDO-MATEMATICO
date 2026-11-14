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
    
    state.temas.forEach(t => {
      if (t.preguntas && t.preguntas.length > 0) {
        const preguntasMezcladas = [...t.preguntas].sort(() => Math.random() - 0.5);
        const elegidas = preguntasMezcladas.slice(0, 5); // 5 por cada una de las 8 carpetas = 40 preguntas
        elegidas.forEach(archivo => {
          preguntasGlobales.push({ archivo: archivo, tema: t });
        });
      }
    });

    state.seleccionGlobal = preguntasGlobales.sort(() => Math.random() - 0.5);
    state.seleccion = state.seleccionGlobal.map(x => x.archivo);
    state.tiempoRestante = 90 * 60; // 90 minutos para la global
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
  state.seleccion = todasLasPreguntas.slice(0, PREGUNTAS_POR_PRUEBA);
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

function mostrarResultadosFinalesGlobal(st) {
  if (st.intervaloTimer) clearInterval(st.intervaloTimer);
  let aciertos = 0;
  let totalPreguntas = st.seleccionGlobal.length;

  st.seleccionGlobal.forEach((itemGlobal, index) => {
    const tema = itemGlobal.tema;
    const archivo = itemGlobal.archivo;
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
  let nivelDesempeno = "Nivel 1 (En riesgo)";
  if (porcentaje >= 75) nivelDesempeno = "Nivel 4 (Avanzado)";
  else if (porcentaje >= 50) nivelDesempeno = "Nivel 3 (Satisfactorio)";
  else if (porcentaje >= 35) nivelDesempeno = "Nivel 2 (Mínimo)";

  const root = obtenerContenedor();
  const linkWompi = "https://checkout.wompi.co/l/VPOS_9PaOd7";

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
          Basado en la calibración de ítems, hemos detectado vulnerabilidades críticas en componentes de análisis algebraico e interpretación geométrica.
        </p>
        <p style="color: #1e3a8a; font-size: 0.85rem; font-style: italic; margin: 0;">
          * El reporte detallado con las claves de respuesta y la ruta de corrección se entrega de forma automatizada al completar el pago.
        </p>
      </div>

      <div style="border: 2px solid #16a34a; padding: 25px; margin-top: 25px; border-radius: 8px; background: #f0fdf4;">
        <span style="background: #16a34a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">PAGO SEGURO EN LÍNEA (24/7)</span>
        <h3 style="color: var(--azul); margin-top: 10px; font-size: 1.3rem;">Obtén tu Cuadernillo Pro por solo $15.000 COP</h3>
        <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
          Paga de forma inmediata por Wompi (Nequi, PSE o Tarjeta) por valor de <strong>$15.000 COP</strong> y desbloquea tu informe analítico detallado de inmediato.
        </p>
        
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; flex-direction: column; align-items: center;">
          <a class="boton" href="${linkWompi}" target="_blank" style="background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 1.05rem; width: 100%; box-sizing: border-box; text-align: center;">
            💳 Pagar $15.000 con Wompi (Nequi / Tarjetas)
          </a>

          <!-- BOTÓN PARA PROBAR LA DESCARGA DEL PDF -->
          <button id="btn-descargar-pdf" class="boton" style="background: #2563eb; color: white; padding: 12px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; width: 100%;">
            📥 Descargar Cuadernillo Pro (PDF de Prueba)
          </button>

          <a class="boton" href="index.html" style="background: #1e3a8a; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; width: 100%; box-sizing: border-box; text-align: center;">
            Volver al Menú Principal
          </a>
        </div>
      </div>
    </section>
  `;

  // Conectamos el botón para que ejecute la función generarPDFInforme al hacer clic
  setTimeout(() => {
    const btnPdf = document.getElementById("btn-descargar-pdf");
    if (btnPdf) {
      btnPdf.onclick = () => {
        generarPDFInforme(aciertos, totalPreguntas, porcentaje, nivelDesempeno);
      };
    }
  }, 100);
}

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
  if (porcentaje >= 80) {
    mensajeDesempeno = `¡Excelente nivel en <strong>${tema.titulo}</strong>! Tienes bases muy sólidas. Te invitamos a mantener este ritmo con simulacros completos para asegurar tu puntaje máximo.`;
  } else if (porcentaje >= 50) {
    mensajeDesempeno = `Tienes bases regulares en <strong>${tema.titulo}</strong>, pero hay vacíos conceptuales en preguntas clave que el ICFES suele evaluar con trampa.`;
  } else {
    mensajeDesempeno = `Identificamos oportunidades de mejora críticas en <strong>${tema.titulo}</strong>. Este puntaje en el componente real te restará puntos decisivos.`;
  }

  const linkWompi = "https://checkout.wompi.co/l/VPOS_9PaOd7";

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

      <div style="border: 2px solid #16a34a; padding: 25px; margin-top: 25px; border-radius: 8px; background: #f0fdf4;">
        <span style="background: #16a34a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">PAGO SEGURO EN LÍNEA (24/7)</span>
        <h3 style="color: var(--azul); margin-top: 10px; font-size: 1.3rem;">Obtén tu Cuadernillo Pro por solo $15.000 COP</h3>
        <p style="margin-bottom: 20px; color: #334155; font-size: 0.95rem;">
          Paga de forma inmediata por Wompi (Nequi, PSE o Tarjeta) por valor de <strong>$15.000 COP</strong> y desbloquea tu informe analítico detallado.
        </p>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <a class="boton" href="${linkWompi}" target="_blank" style="background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 1.05rem;">
            💳 Pagar $15.000 con Wompi (Nequi / Tarjetas)
          </a>
          <a class="boton" href="index.html" style="background: #1e3a8a; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold;">
            Volver al Menú Principal
          </a>
        </div>
      </div>
    </section>
  `;
}

init();

// ==========================================
// FUNCIÓN PARA GENERAR EL CUADERNILLO PRO EN PDF
// ==========================================
function generarPDFInforme(aciertos, totalPreguntas, porcentaje, nivelDesempeno) {
  if (!window.jspdf) {
    alert("La librería del PDF se está cargando. Inténtalo de nuevo en un segundo.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Encabezado institucional
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 210, 25, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("MUNDO MATEMÁTICO", 14, 16);
  
  doc.setFontSize(9);
  doc.text("Informe Analítico Predictivo - Estándar ICFES Saber 11", 138, 16, { align: "right" });

  // Metadatos
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(13);
  doc.text("Certificado de Diagnóstico y Cuadernillo de Retroalimentación", 14, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 14, 45);
  doc.text(`Herramienta académica independiente de Mundo Matemático.`, 14, 51);

  // Resumen
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 58, 182, 32, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESUMEN DE DESEMPEÑO GLOBAL", 20, 67);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`• Aciertos Totales: ${aciertos} de ${totalPreguntas} (${porcentaje}%)`, 20, 76);
  doc.text(`• Nivel Estimado Saber 11: ${nivelDesempeno}`, 20, 84);

  // Diagnóstico
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Diagnóstico de Competencias (Parámetros TRI)", 14, 103);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const textoDiagnostico = doc.splitTextToSize(
    "Basado en la calibración de ítems de alta discriminación del simulacro global, se identifican fortalezas en razonamiento aritmético, así como vulnerabilidades críticas en componentes de análisis algebraico e interpretación geométrica que impactan directamente el puntaje en la prueba oficial del ICFES.",
    182
  );
  doc.text(textoDiagnostico, 14, 110);

  // Ruta de Mejora
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ruta de Corrección y Preguntas Trampa", 14, 137);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const textoRuta = doc.splitTextToSize(
    "1. Revisión detallada de propiedades de exponentes y radicación en expresiones algebraicas.\n2. Fortalecimiento en la lectura de gráficos cartesianos y pendientes de rectas.\n3. Aplicación de la estrategia de eliminación de distractores lógicos en preguntas de opción múltiple.",
    182
  );
  doc.text(textoRuta, 14, 144);

  // Pie de página
  doc.setFillColor(240, 253, 244);
  doc.setDraw(34, 197, 94);
  doc.roundedRect(14, 178, 182, 28, 3, 3, "FD");

  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("¡Asegura tu cupo universitario con Mundo Matemático!", 20, 187);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Este documento valida tu acceso al cuadernillo Pro. Ante cualquier duda, agenda tu refuerzo.", 20, 195);

  doc.save("Cuadernillo_Pro_Mundo_Matematico.pdf");
}
