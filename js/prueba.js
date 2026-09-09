import {
  cargarContacto,
  cargarTemas,
  elegirPreguntas,
  htmlContacto,
  MINUTOS_DEFAULT,
  urlPng,
} from "./temas.js";

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
        <li>Se eligen 15 preguntas al azar de este tema.</li>
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
  const detalle = seleccion.map((archivo, i) => {
    const clave = tema.respuestas || {};
    const buena = clave[archivo];
    const marcada = respuestas[i] || null;
    const ok = Boolean(buena) && marcada === buena;
    if (ok) correctas += 1;
    return {
      archivo,
      marcada,
      buena: buena || null,
      ok,
      explicacion: (tema.explicaciones || {})[archivo] || "",
    };
  });
  const hayClave = detalle.some((d) => d.buena);
  return {
    titulo: tema.titulo,
    id: tema.id,
    correctas,
    total: seleccion.length,
    porcentaje: seleccion.length ? Math.round((100 * correctas) / seleccion.length) : 0,
    hayClave,
    detalle,
  };
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
      const cls = !res.hayClave ? "" : d.ok ? "ok" : "mal";
      const claveTxt = d.buena
        ? ` · Correcta: <strong>${d.buena}</strong>`
        : " · (esta carpeta no trae clave de respuestas)";
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

function renderResultado(st) {
  etiquetaModo.classList.add("oculto");
  const bloques = st.historico || [];
  const totalOk = bloques.reduce((a, b) => a + (b.hayClave ? b.correctas : 0), 0);
  const totalPreg = bloques.reduce((a, b) => a + (b.hayClave ? b.total : 0), 0);
  const pct = totalPreg ? Math.round((100 * totalOk) / totalPreg) : 0;
  const titulo = st.todas ? "Resultado de todas las pruebas" : bloques[0]?.titulo || "Resultado";
  root.innerHTML = `
    <section class="panel resultado-cabecera">
      <p class="etiqueta">${st.todas ? "Recorrido completo" : "Prueba"}</p>
      <h1>${titulo}</h1>
      ${
        totalPreg
          ? `<p class="puntaje"><span class="num">${totalOk}</span> / ${totalPreg} correctas · ${pct}%</p>`
          : "<p>Marcaste tus opciones. Esta carpeta no incluye clave para calificar.</p>"
      }
    </section>
    ${bloques
      .map(
        (b) => `
      <section class="panel">
        <h2>${b.titulo}</h2>
        <p class="puntaje-mini">${b.hayClave ? `${b.correctas} / ${b.total} (${b.porcentaje}%)` : `${b.total} preguntas`}</p>
      </section>
      ${bloqueRevision(b)}`
      )
      .join("")}
    <div id="caja-contacto"></div>
    <div class="acciones">
      <a class="boton" href="index.html">Volver al menú</a>
    </div>
  `;
  document.getElementById("caja-contacto").innerHTML = htmlContacto(contacto);
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
