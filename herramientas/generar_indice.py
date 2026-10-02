"""Recorre preguntas/ y arma indice.json. Cada subcarpeta con imágenes es una tarjeta."""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "preguntas"
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def titulo_desde_carpeta(nombre):
    return nombre.replace("_", " ")


def es_carpeta_de_tema(nombre):
    base = unicodedata.normalize("NFD", nombre)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn")
    return not base.casefold().startswith("sondeo")


def clave_archivo(nombre):
    partes = re.split(r"(\d+)", nombre.casefold())
    return [int(p) if p.isdigit() else p for p in partes]


def main():
    BASE.mkdir(exist_ok=True)
    temas = []
    for carpeta in (p for p in BASE.iterdir() if p.is_dir() and es_carpeta_de_tema(p.name)):
        imagenes = sorted(
            (p.name for p in carpeta.iterdir() if p.is_file() and p.suffix.lower() in EXTS),
            key=clave_archivo,
        )
        if not imagenes:
            continue
        meta = {}
        tema_json = carpeta / "tema.json"
        if tema_json.exists():
            meta = json.loads(tema_json.read_text(encoding="utf-8"))
        temas.append(
            {
                "id": carpeta.name,
                "titulo": meta.get("titulo") or titulo_desde_carpeta(carpeta.name),
                "subtitulo": meta.get("subtitulo") or "Matemáticas Saber 11",
                "descripcion": meta.get("descripcion")
                or f"{len(imagenes)} preguntas en esta carpeta.",
                "icono": meta.get("icono") or "99",
                "carpeta": f"preguntas/{carpeta.name}",
                "preguntas": imagenes,
                "respuestas": meta.get("respuestas") or {},
                "explicaciones": meta.get("explicaciones") or {},
            }
        )
    temas.sort(key=lambda t: (str(t.get("icono") or "99"), t.get("titulo") or t["id"]))
    for i, tema in enumerate(temas, start=1):
        if tema.get("icono") in (None, "", "99"):
            tema["icono"] = f"{i:02d}"
    (BASE / "indice.json").write_text(
        json.dumps({"temas": temas}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(temas)} temas en preguntas/indice.json")
    for tema in temas:
        print(f"  {tema['icono']} {tema['titulo']}: {len(tema['preguntas'])} preguntas")


if __name__ == "__main__":
    main()
