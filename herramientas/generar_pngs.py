import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from banco_preguntas import TEMAS, corregir_aritmetica

AZUL = (3, 92, 167)
VERDE = (154, 204, 100)
NEGRO = (17, 17, 17)
FONDO = (255, 255, 255)
ANCHO = 980
MARGEN = 48


def fuente(nombre, size):
    rutas = [
        Path(r"C:\Windows\Fonts") / nombre,
        Path("/usr/share/fonts/truetype/dejavu") / nombre,
    ]
    for r in rutas:
        if r.exists():
            return ImageFont.truetype(str(r), size)
    return ImageFont.load_default()


def wrap(draw, texto, font, max_w):
    palabras = texto.split()
    lineas, linea = [], ""
    for p in palabras:
        prueba = (linea + " " + p).strip()
        if draw.textlength(prueba, font=font) <= max_w:
            linea = prueba
        else:
            if linea:
                lineas.append(linea)
            linea = p
    if linea:
        lineas.append(linea)
    return lineas or [""]


def render_pregunta(pregunta, numero, titulo_tema):
    regular = fuente("segoeui.ttf", 28)
    negrita = fuente("segoeuib.ttf", 30)
    pequena = fuente("segoeui.ttf", 22)
    dummy = Image.new("RGB", (ANCHO, 200), FONDO)
    d0 = ImageDraw.Draw(dummy)
    max_w = ANCHO - 2 * MARGEN
    lineas_en = wrap(d0, pregunta["enunciado"], negrita, max_w)
    bloques_op = []
    for letra in ("A", "B", "C", "D"):
        bloques_op.append((letra, wrap(d0, pregunta["opciones"][letra], regular, max_w - 50)))

    alto = 70
    alto += 40 * len(lineas_en) + 30
    for _, ls in bloques_op:
        alto += 18 + 36 * len(ls)
    alto += 60

    img = Image.new("RGB", (ANCHO, alto), FONDO)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, ANCHO, 8], fill=AZUL)
    draw.text((MARGEN, 24), f"{titulo_tema}  ·  Pregunta {numero:02d}", font=pequena, fill=VERDE)
    y = 70
    for ln in lineas_en:
        draw.text((MARGEN, y), ln, font=negrita, fill=AZUL)
        y += 40
    y += 16
    for letra, ls in bloques_op:
        draw.text((MARGEN, y), f"{letra}.", font=negrita, fill=VERDE)
        x = MARGEN + 48
        for i, ln in enumerate(ls):
            draw.text((x, y + i * 36), ln, font=regular, fill=NEGRO)
        y += max(42, 36 * len(ls) + 10)
    return img


def main():
    corregir_aritmetica()
    base = ROOT / "preguntas"
    temas_indice = []
    for i, tema in enumerate(TEMAS, start=1):
        carpeta = base / tema["id"]
        carpeta.mkdir(parents=True, exist_ok=True)
        respuestas = {}
        explicaciones = {}
        nombres = []
        for n, preg in enumerate(tema["preguntas"], start=1):
            nombre = f"{n:02d}.png"
            img = render_pregunta(preg, n, tema["titulo"])
            img.save(carpeta / nombre, "PNG", optimize=True)
            nombres.append(nombre)
            respuestas[nombre] = preg["respuesta"]
            explicaciones[nombre] = preg["explicacion"]
        meta = {
            "titulo": tema["titulo"],
            "subtitulo": tema["subtitulo"],
            "descripcion": tema["descripcion"],
            "icono": f"{i:02d}",
            "respuestas": respuestas,
            "explicaciones": explicaciones,
        }
        (carpeta / "tema.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temas_indice.append(
            {
                "id": tema["id"],
                "titulo": tema["titulo"],
                "subtitulo": tema["subtitulo"],
                "descripcion": tema["descripcion"],
                "icono": f"{i:02d}",
                "carpeta": f"preguntas/{tema['id']}",
                "preguntas": nombres,
                "respuestas": respuestas,
                "explicaciones": explicaciones,
            }
        )
        print(f"{tema['id']}: {len(nombres)} png")
    (base / "indice.json").write_text(
        json.dumps({"temas": temas_indice}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("indice.json listo")


if __name__ == "__main__":
    main()
