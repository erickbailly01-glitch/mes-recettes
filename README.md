# Mes recettes

Les recettes d'Erick : un petit site à ouvrir sur le téléphone, à installer sur l'écran d'accueil, et à partager par un simple lien.

## Mettre le site en ligne (une seule fois)

1. Sur GitHub, ouvrir le dépôt → **Settings** → **Pages**.
2. Dans « Build and deployment », choisir **Source : Deploy from a branch**, puis **Branch : main** et le dossier **/ (root)**, et cliquer sur **Save**.
3. Après une ou deux minutes, le site est disponible à l'adresse
   `https://erickbailly01-glitch.github.io/mes-recettes/` : c'est le lien à partager.

Ensuite, chaque modification poussée sur `main` met le site à jour automatiquement.

## Installer l'application sur le téléphone

- **Android (Chrome)** : ouvrir le lien, menu ⋮ → « Ajouter à l'écran d'accueil » (ou « Installer l'application »).
- **iPhone (Safari)** : ouvrir le lien, bouton Partager → « Sur l'écran d'accueil ».

Une fois ouvertes une première fois, les recettes restent consultables sans connexion.
Les nouvelles recettes apparaissent toutes seules dès que le téléphone est connecté : pas besoin de réinstaller.

## Organisation des fichiers

| Fichier / dossier | Rôle |
| --- | --- |
| `recettes/*.json` | une recette par fichier (format de référence : `flan-patissier-cafe-rhum.json`) |
| `recettes/index.json` | liste des recettes, **générée** par `python scripts/build_index.py` |
| `types.json` | types de recette et leurs couleurs (chaque recette a un champ `"type"`) |
| `pdf/*.pdf` | fiches A4, générées par `python fiche_recette.py recettes/<nom>.json pdf/<nom>.pdf` |
| `index.html`, `js/accueil.js` | page d'accueil (liste, recherche, filtres) |
| `recette.html`, `js/recette.js` | page d'une recette (`recette.html?r=<nom>`) |
| `css/style.css` | apparence (charte de la fiche PDF) |
| `manifest.webmanifest`, `icones/` | installation sur le téléphone ; logo du site (`icones/logo.png`) |
| `sw.js` | fonctionnement hors connexion |

**Après toute modification du site** (HTML, CSS, JavaScript, icônes) : augmenter `VERSION` dans `sw.js`
(`"v1"` → `"v2"`…), sinon les téléphones garderont l'ancienne version. Ce n'est pas nécessaire pour ajouter une recette.

La génération des PDF nécessite Python, ReportLab et les polices DejaVu (paquets `fonts-dejavu-core` et `fonts-dejavu-extra` sous Linux).
