"""Régénère recettes/index.json à partir des fichiers de recettes.

Usage : python scripts/build_index.py

Chaque recette de recettes/*.json (sauf index.json) donne une entrée :
fichier, titre, catégorie, type, sous-titre, temps de préparation,
et l'empreinte de la fiche PDF (pdf/<nom>.pdf) : elle change dès que le PDF change,
ce qui oblige les téléphones à télécharger la nouvelle fiche au lieu d'une ancienne copie.
À lancer après chaque génération de fiche PDF.
Le champ « type » est obligatoire et doit figurer dans types.json.
Vérifie aussi les liens étapes ↔ ingrédients : chaque ingrédient a un identifiant
([quantité, ingrédient, identifiant]) et chaque étape la liste des ingrédients qu'elle
utilise en 5e élément (voir la docstring de fiche_recette.py).
Ne jamais éditer recettes/index.json à la main : relancer ce script.
"""
import hashlib
import json
import re
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


def verifier_liens(r):
    """Liens étapes ↔ ingrédients : renvoie (erreurs, ingrédients cités dans aucune étape)."""
    erreurs = []
    ids = []
    for _, lignes in r.get("ingredients", []):
        for ligne in lignes:
            if len(ligne) < 3 or not isinstance(ligne[2], str) or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", ligne[2]):
                erreurs.append(f"ingrédient « {ligne[1]} » sans identifiant valide (3e élément, ex. \"sucre-glace\")")
            elif ligne[2] in ids:
                erreurs.append(f"identifiant « {ligne[2]} » en double")
            else:
                ids.append(ligne[2])
    utilises = set()
    for _, etapes in r.get("phases", []):
        for etape in etapes:
            if len(etape) < 5 or not isinstance(etape[4], list):
                erreurs.append(f"étape « {etape[0]} » sans liste d'ingrédients (5e élément, [] si aucun)")
                continue
            for lien in etape[4]:
                ident = lien if isinstance(lien, str) else (lien[0] if isinstance(lien, list) and len(lien) == 2 else None)
                if ident is None or (not isinstance(lien, str) and not str(lien[1]).strip()):
                    erreurs.append(f"étape « {etape[0]} » : lien mal écrit {json.dumps(lien, ensure_ascii=False)}")
                elif ident not in ids:
                    erreurs.append(f"étape « {etape[0]} » : ingrédient « {ident} » inconnu")
                else:
                    utilises.add(ident)
    return erreurs, [i for i in ids if i not in utilises]


def main():
    with open(TYPES, encoding="utf-8") as fh:
        types = [t["nom"] for t in json.load(fh)["types"]]
    entrees = []
    erreurs = []
    non_utilises = []
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
            problemes, inutilises = verifier_liens(r)
            if problemes:
                raise ValueError("\n    " + "\n    ".join(problemes))
            if inutilises:
                non_utilises.append(f"{chemin.stem} : {', '.join(inutilises)}")
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
    if non_utilises:
        print("Info — ingrédients cités dans aucune étape (variantes, options…) :\n  " + "\n  ".join(non_utilises))


if __name__ == "__main__":
    main()
