import {
  cargarContacto,
  cargarTemas,
  elegirPreguntas,
  htmlContacto,
  MINUTOS_DEFAULT,
  urlPng,
} from "./temas.js?v=4";

const CLAVE = "simuladorIcfes";
const params = new URLSearchParams(location.search);
const root = document.getElementById("vista");
const etiquetaModo = document.getElementById("modo-todas");
const reloj = document.getElementById("temporizador");

let temas = [];
let contacto = null;
let timerId = null;

function estado() {
  return JSON.parse(sessionStorage.getItem(CLAVE) || "null");
}

function guardar(data) {
  sessionStorage.setItem(CLAVE, JSON.stringify(data));
}

function fmt(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function detenerTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  reloj.classList.add("oculto");
}

function iniciarTimer(st) {
  detenerTimer();
  reloj.classList.remove("oculto");
  const tick = () => {
    const ahora = Date.now();
    const queda = Math.max(0, Math.ceil((st.fin - ahora) / 1000));
    reloj.textContent = fmt(queda);
    reloj.classList.toggle("aviso", queda <= 60);
    if (queda <= 0) {
      detenerTimer();
      terminarPrueba(st, true);
    }
  };
  tick();
  timerId = setInterval(tick, 250);
}

function temaPorId(id) {
  return temas.find((t) => t.id === id);
}

function renderInstrucciones(st) {
  const tema = temaPorId(st.cola[st.indiceTema]);
  const n = st.seleccion.length;
  etiquetaModo.classList.toggle("oculto", !st.todas);
  if (st.todas) {
    etiquetaModo.textContent = `Recorrido completo · ${st.indiceTema + 1} de ${st.cola.length}`;
  }
  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo}</p>
    <section class="panel">
      <p class="etiqueta">Prueba ${st.indiceTema + 1} de ${st.cola.length}</p>
      <h1>${tema.titulo}</h1>
      <p class="lead">${tema.subtitulo || ""}</p>
      <h2 class="h-seccion">Instrucciones</h2>
      <ol class="lista-instrucciones">
        <li>Las imágenes salen del cuadernillo de práctica Icfes Saber 11 (marzo 2026), para uso académico. El Icfes es el titular de esos ítems.</li>
        <li>Se eligen ${n} preguntas al azar de este tema.</li>
        <li>Cada ítem es de selección múltiple con única respuesta (A, B, C o D).</li>
        <li>Hay un temporizador. Por defecto dura 15 minutos; puedes cambiarlo abajo.</li>
        <li>Si se acaba el tiempo, la prueba se cierra con lo que hayas alcanzado a responder.</li>
        ${st.todas ? "<li>Al terminar este tema pasarás al siguiente, hasta completar todas las carpetas.</li>" : ""}
      </ol>
      <label class="campo-tiempo">
        Tiempo en minutos
        <input id="minutos" type="number" min="1" max="180" value="${st.minutos || MINUTOS_DEFAULT}">
      </label>
      <div class="acciones">
        <button class="boton" type="button" id="btn-comenzar">Comenzar los ${n} ejercicios</button>
        <a class="enlace" href="index.html">Volver al menú</a>
      </div>
    </section>
  `;
  document.getElementById("btn-comenzar").onclick = () => {
    const mins = Number(document.getElementById("minutos").value);
    st.minutos = Number.isFinite(mins) && mins >= 1 ? Math.floor(mins) : MINUTOS_DEFAULT;
    st.paso = "pregunta";
    st.item = 0;
    st.respuestas = [];
    st.fin = Date.now() + st.minutos * 60 * 1000;
    guardar(st);
    renderPregunta(st);
  };
}

function renderPregunta(st) {
  const tema = temaPorId(st.cola[st.indiceTema]);
  const archivo = st.seleccion[st.item];
  const total = st.seleccion.length;
  etiquetaModo.classList.toggle("oculto", !st.todas);
  iniciarTimer(st);
  root.innerHTML = `
    <p class="migas"><a href="index.html">Menú</a> / ${tema.titulo} / Ejercicio ${st.item + 1}</p>
    <div class="progreso"><div class="progreso-barra" style="width:${((st.item + 1) / total) * 100}%"></div></div>
    <p class="progreso-texto">Ejercicio ${st.item + 1} de ${total}</p>
    <section class="panel">
      <img class="pregunta-img" alt="Pregunta ${st.item + 1}" src="${urlPng(tema, archivo)}">
      <p id="error" class="alerta oculto">Selecciona una opción para continuar.</p>
      <form id="form-opciones">
        <fieldset class="opciones">
          <legend class="sr">Elige una respuesta</legend>
          ${["A", "B", "C", "D"]
            .map(
              (l) => `<label class="opcion"><input type="radio" name="opcion" value="${l}" required>
              <span class="letra">${l}</span><span>Opción ${l}</span></label>`
            )
            .join("")}
        </fieldset>
        <div class="acciones">
          <button class="boton" type="submit">${textoBoton(st)}</button>
        </div>
      </form>
    </section>
  `;
  document.getElementById("form-opciones").onsubmit = (ev) => {
    ev.preventDefault();
    const marcada = new FormData(ev.target).get("opcion");
    if (!marcada) {
      document.getElementById("error").classList.remove("oculto");
      return;
    }
    st.respuestas[st.item] = marcada;
    if (st.item + 1 < total) {
      st.item += 1;
      guardar(st);
      renderPregunta(st);
    } else {
      terminarPrueba(st, false);
    }
  };
}

function textoBoton(st) {
  const ultima = st.item + 1 >= st.seleccion.length;
  if (!ultima) return "Siguiente ejercicio";
  if (st.todas && st.indiceTema + 1 < st.cola.length) return "Terminar y pasar al siguiente tema";
  if (st.todas) return "Ver resultado de todas las pruebas";
  return "Ver resultado";
}

function resumenTema(st, tema, seleccion, respuestas) {
  let correctas = 0;
  let incorrectas = 0;
  let blancos = 0;
  const detalle = seleccion.map((archivo, i) => {
    const clave = tema.respuestas || {};
    const buena = clave[archivo];
    const marcada = respuestas[i] || null;
    const calificable = Boolean(buena);
    const ok = calificable && marcada === buena;
    if (ok) correctas += 1;
    else if (calificable && !marcada) blancos += 1;
    else if (calificable) incorrectas += 1;
    return {
      archivo,
      marcada,
      buena: buena || null,
      ok,
      calificable,
      explicacion: (tema.explicaciones || {})[archivo] || "",
    };
  });
  const total = correctas + incorrectas + blancos;
  return {
    titulo: tema.titulo,
    id: tema.id,
    subtitulo: tema.subtitulo || "",
    correctas,
    incorrectas,
    blancos,
    fallos: incorrectas + blancos,
    sinClave: seleccion.length - total,
    total,
    presentadas: seleccion.length,
    porcentaje: total ? Math.round((100 * correctas) / total) : 0,
    hayClave: total > 0,
    detalle,
  };
}

function nivelDe(pct) {
  if (pct >= 80) return "Alto";
  if (pct >= 60) return "Medio";
  return "Bajo";
}

function consejoArea(bloque) {
  if (bloque.porcentaje < 40) {
    return "Conviene volver a estudiar este tema antes de otra práctica.";
  }
  if (bloque.porcentaje < 70) {
    return "Refuerza los ejercicios de este tema: ya tienes una base, pero todavía hay fallos.";
  }
  return "Vas bien; revisa solo los ítems que marcaste mal.";
}

function terminarPrueba(st, porTiempo) {
  detenerTimer();
  const tema = temaPorId(st.cola[st.indiceTema]);
  const res = resumenTema(st, tema, st.seleccion, st.respuestas || []);
  st.historico = st.historico || [];
  st.historico.push({ ...res, porTiempo });
  if (st.todas && st.indiceTema + 1 < st.cola.length) {
    st.indiceTema += 1;
    const siguiente = temaPorId(st.cola[st.indiceTema]);
    st.seleccion = elegirPreguntas(siguiente);
    st.paso = "instrucciones";
    st.item = 0;
    st.respuestas = [];
    st.fin = null;
    guardar(st);
    renderInstrucciones(st);
    return;
  }
  st.paso = "resultado";
  guardar(st);
  renderResultado(st);
}

function bloqueRevision(res) {
  return res.detalle
    .map((d, i) => {
      const cls = !d.calificable ? "" : d.ok ? "ok" : "mal";
      const claveTxt = d.buena
        ? ` · Correcta: <strong>${d.buena}</strong>`
        : " · Sin clave de respuesta, no entra en el puntaje";
      const tema = temaPorId(res.id);
      return `
        <article class="panel revision ${cls}">
          <p class="meta">Ejercicio ${i + 1}</p>
          <img class="pregunta-img" alt="" src="${urlPng(tema, d.archivo)}">
          <p>Tu respuesta: <strong>${d.marcada || "sin marcar"}</strong>${claveTxt}</p>
          ${d.explicacion ? `<p class="explicacion">${d.explicacion}</p>` : ""}
        </article>`;
    })
    .join("");
}

function htmlAreas(bloques) {
  const debiles = bloques
    .filter((b) => b.hayClave && b.porcentaje < 70)
    .sort((a, b) => a.porcentaje - b.porcentaje || b.fallos - a.fallos);
  if (!bloques.some((b) => b.hayClave)) return "";
  if (!debiles.length) {
    return `
      <section class="panel">
        <h2>Áreas para mejorar</h2>
        <p>No hay un área por debajo del 70%. Mantén el repaso en todas para no bajar ese nivel.</p>
      </section>`;
  }
  return `
    <section class="panel">
      <h2>Áreas para mejorar</h2>
      <p>Empieza por la de menor puntaje.</p>
      <ul class="lista-areas">
        ${debiles
          .map(
            (b) => `<li>
              <strong>${b.titulo}</strong> · ${b.correctas} aciertos y ${b.fallos} fallos (${b.porcentaje}%).
              ${b.subtitulo ? `${b.subtitulo}. ` : ""}${consejoArea(b)}
            </li>`
          )
          .join("")}
      </ul>
    </section>`;
}

function escaparPdf(texto) {
  let salida = "";
  for (const ch of String(texto)) {
    const code = ch.codePointAt(0);
    if (ch === "\\") salida += "\\\\";
    else if (ch === "(") salida += "\\(";
    else if (ch === ")") salida += "\\)";
    else if (code >= 32 && code <= 126) salida += ch;
    else if (code <= 255) salida += `\\${code.toString(8).padStart(3, "0")}`;
    else salida += "?";
  }
  return salida;
}

function partirLinea(texto, max) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const siguiente = actual ? `${actual} ${palabra}` : palabra;
    if (siguiente.length > max && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = siguiente;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
}

function pdfResultados(info) {
  const fecha = new Date().toLocaleString("es-CO");
  const crudas = [
    { texto: "Resultados del simulador de Matemáticas", tam: 16 },
    { texto: fecha, tam: 11 },
    { texto: info.titulo, tam: 14 },
    { texto: "" },
  ];
  if (info.totalPreg) {
    crudas.push(
      { texto: `Aciertos: ${info.aciertos}`, tam: 12 },
      { texto: `Fallos: ${info.fallos}`, tam: 12 },
      { texto: `Puntaje general: ${info.pct}%`, tam: 12 },
      { texto: `Desempeño ${nivelDe(info.pct).toLowerCase()}`, tam: 12 },
      { texto: "El puntaje es de esta práctica y no es el puntaje oficial del Icfes.", tam: 11 }
    );
    if (info.blancos) crudas.push({ texto: `De los fallos, ${info.blancos} quedaron sin responder.`, tam: 11 });
    if (info.sinClave) {
      crudas.push({
        texto: `${info.sinClave} ${info.sinClave === 1 ? "pregunta no tiene" : "preguntas no tienen"} clave y no entran en el puntaje.`,
        tam: 11,
      });
    }
  } else {
    crudas.push({ texto: "Estas preguntas no tienen clave, así que no se puede calcular el puntaje.", tam: 12 });
  }

  const debiles = info.bloques.filter((b) => b.hayClave && b.porcentaje < 70);
  crudas.push({ texto: "" }, { texto: "Áreas para mejorar", tam: 14 });
  if (!info.bloques.some((b) => b.hayClave)) {
    crudas.push({ texto: "No hay áreas calificadas.", tam: 12 });
  } else if (!debiles.length) {
    crudas.push({ texto: "No hay un área por debajo del 70%.", tam: 12 });
  } else {
    for (const b of debiles) {
      crudas.push({
        texto: `${b.titulo}: ${b.correctas} aciertos, ${b.fallos} fallos (${b.porcentaje}%). ${consejoArea(b)}`,
        tam: 12,
      });
    }
  }

  for (const b of info.bloques) {
    crudas.push({ texto: "" }, { texto: b.titulo, tam: 14 });
    crudas.push({
      texto: b.hayClave
        ? `${b.correctas} aciertos, ${b.fallos} fallos, ${b.porcentaje}%`
        : `${b.presentadas || b.detalle.length} preguntas sin clave`,
      tam: 12,
    });
    b.detalle.forEach((d, i) => {
      const marcada = d.marcada || "sin marcar";
      const clave = d.buena ? `Correcta: ${d.buena}` : "Sin clave";
      crudas.push({ texto: `Ejercicio ${i + 1}. Tu respuesta: ${marcada}. ${clave}.`, tam: 11 });
    });
  }

  const lineas = [];
  for (const item of crudas) {
    const tam = item.tam || 12;
    const max = tam >= 14 ? 62 : 88;
    const partes = item.texto ? partirLinea(item.texto, max) : [""];
    partes.forEach((texto, i) => lineas.push({ texto, tam: i === 0 ? tam : 12 }));
  }

  const ancho = 595;
  const alto = 842;
  const margen = 48;
  const paginas = [];
  let ops = [];
  let y = alto - margen;
  const cerrar = () => {
    if (ops.length) paginas.push(ops.join("\n"));
    ops = [];
    y = alto - margen;
  };
  for (const linea of lineas) {
    const salto = linea.tam + 6;
    if (y < margen) cerrar();
    if (linea.texto) {
      ops.push(`BT /F1 ${linea.tam} Tf ${margen} ${y} Td (${escaparPdf(linea.texto)}) Tj ET`);
    }
    y -= salto;
  }
  cerrar();
  if (!paginas.length) paginas.push("");

  const objetos = [];
  const agregar = (cuerpo) => {
    objetos.push(cuerpo);
    return objetos.length;
  };
  agregar("<< /Type /Catalog /Pages 2 0 R >>");
  agregar("<< /Type /Pages /Kids [] /Count 0 >>");
  agregar("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids = [];
  for (const contenido of paginas) {
    const flujo = `BT /F1 12 Tf ET\n${contenido}`;
    const streamId = agregar(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`);
    const pageId = agregar(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] /Contents ${streamId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    );
    kids.push(`${pageId} 0 R`);
  }
  objetos[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objetos.forEach((cuerpo, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function descargarResultados(info) {
  const blob = new Blob([pdfResultados(info)], { type: "application/pdf" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = "resultados-matematicas.pdf";
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

function renderResultado(st) {
  etiquetaModo.classList.add("oculto");
  const bloques = st.historico || [];
  const aciertos = bloques.reduce((a, b) => a + (b.hayClave ? b.correctas : 0), 0);
  const fallos = bloques.reduce((a, b) => a + (b.hayClave ? b.fallos : 0), 0);
  const blancos = bloques.reduce((a, b) => a + (b.hayClave ? b.blancos || 0 : 0), 0);
  const sinClave = bloques.reduce((a, b) => a + (b.sinClave || 0), 0);
  const totalPreg = aciertos + fallos;
  const pct = totalPreg ? Math.round((100 * aciertos) / totalPreg) : 0;
  const titulo = st.todas ? "Resultado de todas las pruebas" : bloques[0]?.titulo || "Resultado";
  const notaBlancos = blancos
    ? `<p class="nota-puntaje">De los fallos, ${blancos} quedaron sin responder.</p>`
    : "";
  const notaSinClave = sinClave
    ? `<p class="nota-puntaje">${sinClave} ${sinClave === 1 ? "pregunta no tiene" : "preguntas no tienen"} clave todavía, así que no entran en el puntaje.</p>`
    : "";
  root.innerHTML = `
    <section class="panel resultado-cabecera">
      <p class="etiqueta">${st.todas ? "Recorrido completo" : "Prueba"}</p>
      <h1>${titulo}</h1>
      ${
        totalPreg
          ? `<div class="tablero">
              <article>
                <p class="tablero-num acierto">${aciertos}</p>
                <p>Aciertos</p>
              </article>
              <article>
                <p class="tablero-num fallo">${fallos}</p>
                <p>Fallos</p>
              </article>
              <article>
                <p class="tablero-num">${pct}%</p>
                <p>Puntaje general</p>
                <p class="nivel">Desempeño ${nivelDe(pct).toLowerCase()}</p>
              </article>
            </div>
            <p class="nota-puntaje">El puntaje es de esta práctica: aciertos sobre las preguntas que tienen clave. No es el puntaje oficial del Icfes.</p>
            ${notaBlancos}
            ${notaSinClave}`
          : "<p>Marcaste tus opciones. Estas preguntas no tienen clave, así que no se puede calcular el puntaje.</p>"
      }
    </section>
    ${htmlAreas(bloques)}
    ${bloques
      .map(
        (b) => `
      <section class="panel">
        <h2>${b.titulo}</h2>
        <p class="puntaje-mini">${
          b.hayClave
            ? `${b.correctas} aciertos · ${b.fallos} fallos · ${b.porcentaje}%`
            : `${b.presentadas || b.detalle.length} preguntas sin clave`
        }</p>
      </section>
      ${bloqueRevision(b)}`
      )
      .join("")}
    <div id="caja-contacto"></div>
    <div class="acciones">
      <button class="boton boton-rojo" type="button" id="btn-pdf">Descargar resultados</button>
      <a class="boton" href="index.html">Volver al menú</a>
    </div>
  `;
  document.getElementById("caja-contacto").innerHTML = htmlContacto(contacto);
  document.getElementById("btn-pdf").onclick = () => {
    descargarResultados({ titulo, aciertos, fallos, blancos, sinClave, pct, totalPreg, bloques });
  };
  sessionStorage.removeItem(CLAVE);
}

async function iniciar() {
  temas = await cargarTemas();
  contacto = await cargarContacto();
  if (!temas.length) {
    root.innerHTML = `<p class="alerta">No hay temas. Agrega carpetas con PNG en <strong>preguntas/</strong>.</p>`;
    return;
  }

  let st = estado();
  const quiereTodas = params.get("todas") === "1";
  const temaParam = params.get("tema");

  const debeNuevo =
    !st ||
    (quiereTodas && !st.todas) ||
    (!quiereTodas && temaParam && (!st.cola || st.cola[0] !== temaParam || st.todas));

  if (debeNuevo) {
    if (quiereTodas) {
      st = {
        todas: true,
        cola: temas.map((t) => t.id),
        indiceTema: 0,
        minutos: MINUTOS_DEFAULT,
        paso: "instrucciones",
        historico: [],
      };
    } else {
      const id = temaParam || temas[0].id;
      if (!temaPorId(id)) {
        location.href = "index.html";
        return;
      }
      st = {
        todas: false,
        cola: [id],
        indiceTema: 0,
        minutos: MINUTOS_DEFAULT,
        paso: "instrucciones",
        historico: [],
      };
    }
    st.seleccion = elegirPreguntas(temaPorId(st.cola[0]));
    guardar(st);
  }

  if (st.paso === "pregunta") renderPregunta(st);
  else if (st.paso === "resultado") renderResultado(st);
  else renderInstrucciones(st);
}

iniciar().catch((err) => {
  root.innerHTML = `<p class="alerta">No se pudo cargar la prueba. Usa GitHub Pages o un servidor local.</p>`;
  console.error(err);
});
