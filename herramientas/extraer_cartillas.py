"""Recorta UNA pregunta por imagen, solo la cartilla Saber 11 marzo 2026."""
import io
import json
import re
import shutil
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PREGUNTAS = ROOT / "preguntas"
ZOOM = 2.5
PDF_2026 = Path(
    r"c:\Users\jpmcm\Downloads\09-Marzo_Cuadernillo-de-Preguntas-Matematicas-Saber-11-2026 (1).pdf"
)

TEMAS_META = {
    "Aritmetica": {
        "titulo": "Aritmética",
        "subtitulo": "Números, operaciones y situaciones cuantitativas",
        "descripcion": "Ítems del cuadernillo Icfes Saber 11 (marzo 2026). Uso académico.",
        "icono": "01",
    },
    "Porcentajes y proporcionalidad": {
        "titulo": "Porcentajes y proporcionalidad",
        "subtitulo": "Razones, porcentajes y variaciones",
        "descripcion": "Ítems del cuadernillo Icfes Saber 11 (marzo 2026). Uso académico.",
        "icono": "02",
    },
    "Algebra": {
        "titulo": "Álgebra",
        "subtitulo": "Relaciones, expresiones y funciones",
        "descripcion": "Ítems del cuadernillo Icfes Saber 11 (marzo 2026). Uso académico.",
        "icono": "03",
    },
    "Geometria": {
        "titulo": "Geometría",
        "subtitulo": "Figuras, medidas y argumentación espacial",
        "descripcion": "Ítems del cuadernillo Icfes Saber 11 (marzo 2026). Uso académico.",
        "icono": "04",
    },
    "Estadistica y probabilidad": {
        "titulo": "Estadística y probabilidad",
        "subtitulo": "Datos, azar e interpretación",
        "descripcion": "Ítems del cuadernillo Icfes Saber 11 (marzo 2026). Uso académico.",
        "icono": "05",
    },
}

PALABRAS = {
    "Geometria": [
        "triángul", "triangul", "rectángul", "rectangul", "círcul", "circul",
        "circunfer", "ángulo", "angulo", "perímetro", "perimetro", "pitágor",
        "cuadrado", "trapecio", "paralelogram", "escalera", "cartab",
        "vértice", "vertice", "diagonal", "prisma", "polígono", "poligono",
        "isósceles", "cancha", "volumen", "radio", "diámetro", "diametro",
        "portalápices", "portalapices", "figura", "coordenad", "simetr",
        "cuadrilátero", "hexágono", "área de", "area de",
    ],
    "Estadistica y probabilidad": [
        "probabil", "promedio", "mediana", "moda", "encuest", "muestra",
        "aleator", "dado", "moneda", "baraja", "cartas", "frecuen",
        "desviaci", "azar", "balota", "urna", "gráfico", "grafico",
        "histograma", "cursos", "tabla",
    ],
    "Porcentajes y proporcionalidad": [
        "%", "por ciento", "porcentaje", "descuento", "iva", "interés",
        "interes", "proporci", "razón", "razon", "tasa de cambio",
        "aumento", "relación", "relacion",
    ],
    "Algebra": [
        "ecuaci", "función", "funcion", "f(x)", "variable", "inecuaci",
        "pendiente", "expresión", "expresion", "despej",
    ],
    "Aritmetica": [
        "residuo", "múltiplo", "multiplo", "divisor", "fracción", "fraccion",
        "cociente", "entero", "máximo común", "mínimo común", "operaci",
        "tonelada", "pesos",
    ],
}

HEADER = 112
FOOTER = 748
LEFT = 38
RIGHT = 574


def clasificar(texto):
    t = (texto or "").lower()
    puntos = {k: 0 for k in PALABRAS}
    for tema, palabras in PALABRAS.items():
        for p in palabras:
            if p in t:
                puntos[tema] += 1
    mejor = max(puntos, key=puntos.get)
    return mejor if puntos[mejor] else "Aritmetica"


def claves_oficiales(doc):
    texto = "\n".join(doc[i].get_text() for i in range(len(doc)))
    if "Tabla de respuestas correctas" in texto:
        texto = texto.split("Tabla de respuestas correctas", 1)[1]
    pares = re.findall(r"(?m)^(\d{1,2})\s*\n([ABCD])\s*$", texto)
    return {int(n): letra for n, letra in pares if 1 <= int(n) <= 50}


def marcadores(doc):
    marcas = []
    patron = re.compile(r"^Pregunta\s+(\d+)\s*$")
    for i, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                t = "".join(s["text"] for s in line["spans"]).strip()
                m = patron.match(t)
                if m:
                    marcas.append({"pag": i, "y": line["bbox"][1], "num": int(m.group(1))})
    marcas.sort(key=lambda x: (x["pag"], x["y"]))
    return marcas


def pixmap_a_pil(pix):
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def recorte(page, y0, y1):
    y0 = max(HEADER - 4, y0)
    y1 = min(FOOTER, y1)
    if y1 - y0 < 28:
        return None
    clip = pymupdf.Rect(LEFT, y0, RIGHT, y1)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=clip, alpha=False)
    return pixmap_a_pil(pix)


def unir(imagenes):
    imagenes = [im for im in imagenes if im is not None]
    if not imagenes:
        return None
    if len(imagenes) == 1:
        return imagenes[0]
    ancho = max(im.width for im in imagenes)
    alto = sum(im.height for im in imagenes)
    out = Image.new("RGB", (ancho, alto), (255, 255, 255))
    y = 0
    for im in imagenes:
        out.paste(im, (0, y))
        y += im.height
    return out


def tramos_pregunta(marcas, idx):
    actual = marcas[idx]
    partes = []
    if idx + 1 < len(marcas):
        nxt = marcas[idx + 1]
        if nxt["pag"] == actual["pag"]:
            partes.append((actual["pag"], actual["y"], nxt["y"] - 6))
        else:
            partes.append((actual["pag"], actual["y"], FOOTER))
            for p in range(actual["pag"] + 1, nxt["pag"]):
                partes.append((p, HEADER, FOOTER))
            if nxt["y"] - HEADER > 40:
                partes.append((nxt["pag"], HEADER, nxt["y"] - 6))
    else:
        partes.append((actual["pag"], actual["y"], FOOTER))
    return partes


def extraer(doc):
    marcas = marcadores(doc)
    claves = claves_oficiales(doc)
    items = []
    por_pagina = {}
    for m in marcas:
        por_pagina.setdefault(m["pag"], []).append(m["y"])

    for idx, m in enumerate(marcas):
        imgs = []
        ys_pag = por_pagina[m["pag"]]
        primero = min(ys_pag)
        es_primera = abs(m["y"] - primero) < 1
        if es_primera:
            stim = recorte(doc[m["pag"]], HEADER, m["y"] - 4)
            if stim is not None and stim.height > 40 * ZOOM:
                imgs.append(stim)
        prev_ys = por_pagina.get(m["pag"] - 1, [])
        if primero < 140 and m["pag"] > 0 and prev_ys and len(prev_ys) == 1 and min(prev_ys) < 420:
            extra = recorte(doc[m["pag"] - 1], 520, FOOTER)
            if extra is not None:
                imgs.insert(0, extra)
        for pag, y0, y1 in tramos_pregunta(marcas, idx):
            imgs.append(recorte(doc[pag], y0, y1))
        img = unir(imgs)
        if img is None:
            continue
        txt = ""
        for pag, y0, y1 in tramos_pregunta(marcas, idx):
            clip = pymupdf.Rect(LEFT, max(HEADER, y0), RIGHT, min(FOOTER, y1))
            txt += doc[pag].get_text(clip=clip)
        items.append(
            {
                "num": m["num"],
                "img": img,
                "texto": txt,
                "clave": claves.get(m["num"]),
            }
        )
    return items, len(marcas), len(claves)


def guardar(items):
    if PREGUNTAS.exists():
        for hijo in PREGUNTAS.iterdir():
            if hijo.is_dir():
                shutil.rmtree(hijo)
            elif hijo.name == "indice.json":
                hijo.unlink()

    cubetas = {k: [] for k in TEMAS_META}
    for item in items:
        cubetas[clasificar(item["texto"])].append(item)

    temas_indice = []
    con_clave = 0
    for i, (tid, meta) in enumerate(TEMAS_META.items(), start=1):
        cubetas[tid].sort(key=lambda x: x["num"])
        carpeta = PREGUNTAS / tid
        carpeta.mkdir(parents=True, exist_ok=True)
        respuestas = {}
        nombres = []
        for item in cubetas[tid]:
            nombre = f"p{item['num']:02d}.png"
            item["img"].save(carpeta / nombre, "PNG")
            nombres.append(nombre)
            if item["clave"]:
                respuestas[nombre] = item["clave"]
                con_clave += 1
        tema_json = {
            **meta,
            "icono": f"{i:02d}",
            "respuestas": respuestas,
            "explicaciones": {},
            "fuente": "Icfes, (2026). Prueba Matemáticas, Cuadernillo de preguntas. Saber 11. Uso académico.",
        }
        (carpeta / "tema.json").write_text(
            json.dumps(tema_json, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temas_indice.append(
            {
                "id": tid,
                **meta,
                "icono": f"{i:02d}",
                "carpeta": f"preguntas/{tid}",
                "preguntas": nombres,
                "respuestas": respuestas,
                "explicaciones": {},
            }
        )
        print(f"{tid}: {len(nombres)}")

    (PREGUNTAS / "indice.json").write_text(
        json.dumps({"temas": temas_indice}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return con_clave


def main():
    doc = pymupdf.open(PDF_2026)
    items, nmarcas, nclaves = extraer(doc)
    con_clave = guardar(items)
    print(f"preguntas={len(items)} marcas={nmarcas} claves={nclaves} con_clave={con_clave}")


if __name__ == "__main__":
    main()
