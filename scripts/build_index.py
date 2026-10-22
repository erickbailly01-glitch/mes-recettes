"""Régénère recettes/index.json à partir des fichiers de recettes.

Usage : python scripts/build_index.py

Chaque recette de recettes/*.json (sauf index.json) donne une entrée :
fichier, titre, catégorie, type, sous-titre, temps de préparation,
et l'empreinte de la fiche PDF (pdf/<nom>.pdf) : elle change dès que le PDF change,
ce qui oblige les téléphones à télécharger la nouvelle fiche au lieu d'une ancienne copie.
À lancer après chaque génération de fiche PDF.
Le champ « type » est obligatoire et doit figurer dans types.json.
Ne jamais éditer recettes/index.json à la main : relancer ce script.
"""
import hashlib
import json
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "recettes"
INDEX = DOSSIER / "index.json"
TYPES = RACINE / "types.json"
PDF = RACINE / "pdf"


def cle_tri(texte):
    """Tri alphabétique sans tenir compte des accents ni des majuscules."""
    sans_accents = unicodedata.normalize("NFD", texte)
    return "".join(c for c in sans_accents if unicodedata.category(c) != "Mn").casefold()


def categorie(recette):
    """« PÂTISSERIE  ·  RECETTE MAISON » → « Pâtisserie »."""
    brute = recette.get("categorie", "").split("·")[0].strip()
    return brute.capitalize() if brute else "Autre"


def preparation(recette):
    for cle, valeur in recette.get("infos", []):
        if cle.strip().upper().startswith("PRÉPARATION"):
            return valeur
    return None


def empreinte_pdf(chemin_json):
    """8 premiers caractères de l'empreinte SHA-256 de la fiche PDF, ou None si elle n'existe pas."""
    pdf = PDF / (chemin_json.stem + ".pdf")
    return hashlib.sha256(pdf.read_bytes()).hexdigest()[:8] if pdf.exists() else None


def main():
    with open(TYPES, encoding="utf-8") as fh:
        types = [t["nom"] for t in json.load(fh)["types"]]
    entrees = []
    erreurs = []
    for chemin in sorted(DOSSIER.glob("*.json")):
        if chemin.name == INDEX.name:
            continue
        try:
            with open(chemin, encoding="utf-8") as fh:
                r = json.load(fh)
            if "type" not in r:
                raise ValueError("champ « type » manquant")
            if r["type"] not in types:
                raise ValueError(f"type « {r['type']} » inconnu")
            entrees.append({
                "fichier": chemin.name,
                "titre": r["titre"],
                "categorie": categorie(r),
                "type": r["type"],
                "sous_titre": r.get("sous_titre", ""),
                "preparation": preparation(r),
                "pdf": empreinte_pdf(chemin),
            })
        except (json.JSONDecodeError, KeyError, ValueError) as err:
            erreurs.append(f"{chemin.name} : {err}")

    if erreurs:
        sys.exit("ERREUR — recette(s) à corriger :\n  " + "\n  ".join(erreurs)
                 + "\nTypes possibles (types.json) : " + ", ".join(types))

    entrees.sort(key=lambda e: cle_tri(e["titre"]))
    with open(INDEX, "w", encoding="utf-8") as fh:
        json.dump({"recettes": entrees}, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    sans_pdf = [e["fichier"] for e in entrees if not e["pdf"]]
    print(f"OK — {len(entrees)} recette(s) dans {INDEX.relative_to(RACINE)}")
    if sans_pdf:
        print("ATTENTION — fiche PDF manquante pour : " + ", ".join(sans_pdf))


if __name__ == "__main__":
    main()
