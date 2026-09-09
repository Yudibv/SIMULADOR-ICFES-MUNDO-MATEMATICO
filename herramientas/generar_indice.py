"""Recorre preguntas/ y arma indice.json. Cada subcarpeta con PNG es una tarjeta."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "preguntas"


def titulo_desde_carpeta(nombre):
    return nombre.replace("_", " ")


def main():
    BASE.mkdir(exist_ok=True)
    temas = []
    for carpeta in (p for p in BASE.iterdir() if p.is_dir()):
        pngs = sorted(p.name for p in carpeta.glob("*.png"))
        if not pngs:
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
                or f"{len(pngs)} preguntas en esta carpeta.",
                "icono": meta.get("icono") or "99",
                "carpeta": f"preguntas/{carpeta.name}",
                "preguntas": pngs,
                "respuestas": meta.get("respuestas") or {},
                "explicaciones": meta.get("explicaciones") or {},
            }
        )
    # Orden por icono (01, 02…), no por nombre de carpeta ni por el SO.
    temas.sort(key=lambda t: (str(t.get("icono") or "99"), t.get("titulo") or t["id"]))
    for i, tema in enumerate(temas, start=1):
        if tema.get("icono") in (None, "", "99"):
            tema["icono"] = f"{i:02d}"
    (BASE / "indice.json").write_text(
        json.dumps({"temas": temas}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(temas)} temas en preguntas/indice.json")


if __name__ == "__main__":
    main()
