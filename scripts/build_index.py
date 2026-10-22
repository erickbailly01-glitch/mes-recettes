"""Régénère recettes/index.json à partir des fichiers de recettes.

Usage : python scripts/build_index.py

Chaque recette de recettes/*.json (sauf index.json) donne une entrée :
fichier, titre, catégorie, sous-titre, temps de préparation.
Ne jamais éditer recettes/index.json à la main : relancer ce script.
"""
import json
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "recettes"
INDEX = DOSSIER / "index.json"


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


def main():
    entrees = []
    erreurs = []
    for chemin in sorted(DOSSIER.glob("*.json")):
        if chemin.name == INDEX.name:
            continue
        try:
            with open(chemin, encoding="utf-8") as fh:
                r = json.load(fh)
            entrees.append({
                "fichier": chemin.name,
                "titre": r["titre"],
                "categorie": categorie(r),
                "sous_titre": r.get("sous_titre", ""),
                "preparation": preparation(r),
            })
        except (json.JSONDecodeError, KeyError) as err:
            erreurs.append(f"{chemin.name} : {err}")

    if erreurs:
        sys.exit("ERREUR — recette(s) illisible(s) :\n  " + "\n  ".join(erreurs))

    entrees.sort(key=lambda e: cle_tri(e["titre"]))
    with open(INDEX, "w", encoding="utf-8") as fh:
        json.dump({"recettes": entrees}, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"OK — {len(entrees)} recette(s) dans {INDEX.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
