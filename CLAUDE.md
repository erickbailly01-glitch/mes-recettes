# Mes recettes — instructions du projet

Application de recettes personnelle d'Erick, utilisable sur téléphone et partagée avec des proches par un simple lien.
Tout le contenu, l'interface et les messages de commit sont **en français**.

## Architecture (à respecter)

- **Site statique** (HTML / CSS / JavaScript, sans serveur ni base de données), hébergé gratuitement sur **GitHub Pages**.
- **PWA** : installable sur l'écran d'accueil du téléphone (manifest + service worker), consultable hors connexion une fois chargée.
- **Les recettes sont des fichiers JSON** dans `recettes/`, un fichier par recette, nommé en kebab-case (`flan-patissier-cafe-rhum.json`).
  Le format de référence est `recettes/flan-patissier-cafe-rhum.json` ; la docstring de `fiche_recette.py` le décrit.
- **Champ `"type"` obligatoire** dans chaque recette (juste après `"categorie"`), avec l'un des types de `types.json`. `scripts/build_index.py` et `fiche_recette.py` refusent une recette sans type ou avec un type inconnu.
- **Champ `"portions"`** au format `{"n": 4, "u": "pers."}` (juste après `"type"`), à renseigner pour toute nouvelle recette **quand ça a un sens** (personnes, parts, pièces, litres…) ; l'omettre sinon (liqueurs, pains, glaces au bac…). Il sert au réglage des quantités du site ; la fiche PDF reste à la quantité d'origine.
- **`types.json`** (racine) est la seule source des types et de leurs couleurs : le site, l'index et les fiches PDF le lisent. Pour ajouter ou recolorer un type, modifier uniquement ce fichier.
- `recettes/index.json` liste toutes les recettes (fichier, titre, catégorie, type, sous-titre, temps de préparation, empreinte de la fiche PDF). Il est **régénéré automatiquement** par `scripts/build_index.py` : ne jamais l'éditer à la main. **Le relancer après chaque génération de fiche PDF** : l'empreinte (`pdf/<nom>.pdf?v=…` sur le site) oblige les téléphones à prendre la nouvelle fiche au lieu d'une ancienne copie.
- **Hors connexion** : `sw.js` met le site en cache. Après toute modification d'un fichier du site (HTML, CSS, JS, icônes, manifest), augmenter `VERSION` dans `sw.js`. Inutile pour une simple recette : `recettes/*.json`, `types.json` et `pdf/*.pdf` sont chargés « réseau d'abord ».
- **Chemins relatifs uniquement** (le site est servi depuis `/mes-recettes/`).
- **Fiches PDF** : `fiche_recette.py` génère la fiche A4 de chaque recette dans `pdf/<même-nom>.pdf`. Le site propose un bouton « Fiche PDF » qui ouvre ce fichier. La fiche suit la même charte que le site (vert + couleur du type, brin de feuillage dans l'en-tête). **Ne pas modifier le rendu de `fiche_recette.py`** sans demande explicite.

## Interface

- Pensée d'abord pour le **téléphone** (mode portrait, gros boutons, lisible en cuisine).
- Accueil : liste des recettes en cartes (liseré et pastille de la couleur du type, petit bouton « Cuisiner » qui ouvre directement le mode cuisine), recherche par mot-clé, filtre par type.
- Page recette : en-tête, bandeau d'infos (couleur du type), réglage des quantités (− / + sur les portions, sinon ×½ à ×3, choix mémorisé sur le téléphone ; quantités recalculées et arrondies à l'affichage, jamais dans les fichiers), ingrédients (cases à cocher), étapes numérotées en continu avec astuces (pastilles de la couleur du type), minuteur sur les étapes qui ont une durée, option « garder l'écran allumé ».
- **Mode cuisine** (`js/cuisine.js`, bouton « Mode cuisine » en haut de la page recette) : plein écran ; écran « Mise en place » (ingrédients à cocher, quantités ajustées), puis une étape par écran (phase, « Étape n / total », barre de progression couleur du type, texte en gros caractères), « Précédent » / « Suivant » et glissement gauche/droite, écran final « Terminé ! ».
  Minuteurs : bouton « Lancer le minuteur » réglable à la minute, partant de la durée la plus courte ; plusieurs minuteurs à la fois dans un bandeau en bas, sonnerie + vibration + clignotement à la fin ; pas de minuteur au-delà de 48 h (durée seulement affichée). Écran gardé allumé pendant tout le mode. Étape et minuteurs mémorisés sur le téléphone : la page recette propose de reprendre. Quitter (✕ ou retour du téléphone) demande confirmation s'il reste un minuteur.
- Charte (site et fiches PDF) : vert sapin `#1F4D3A` (en-tête, titres), sauge clair `#E3EDE4` (encadrés), fond `#F6F9F4`, texte `#1E2A23` ; titres en serif, texte en sans-serif.
  Sur une couleur de type, le texte est blanc ou foncé selon ce qui se lit le mieux (calcul automatique).
- Logo : chat cuisinier crème sur vert sapin (`icones/logo.png`, fond transparent), dans l'en-tête du site et sur les icônes de l'application.
- Types et couleurs (`types.json`) :

  | Type | Couleur |
  | --- | --- |
  | Entrée & soupe | `#E07A2E` |
  | Plat | `#C8472F` |
  | Accompagnement | `#7F9130` |
  | Gâteau | `#C2386B` |
  | Dessert | `#7B4A9E` |
  | Petit-déjeuner | `#D9A021` |
  | Boulangerie | `#A8693B` |
  | Liqueurs & bocaux | `#2F5E8C` |

## Ajouter une recette (tâche la plus fréquente)

Quand Erick demande « ajoute la recette … » (texte, lien, photo ou simple idée) :
1. Rédiger le JSON au format de référence dans `recettes/`, en français, quantités en unités métriques, **avec son champ `"type"`** (demander à Erick en cas de doute sur le type) et son champ `"portions"` quand ça a un sens. Écrire chaque quantité en commençant par le nombre (« 150 g », « 2 c. à s. », « 0,5 ») pour qu'elle puisse être recalculée.
2. Lancer `python fiche_recette.py recettes/<nom>.json pdf/<nom>.pdf`. En cas de « DÉBORDEMENT », raccourcir les textes et relancer jusqu'à « OK ».
3. Lancer `python scripts/build_index.py`.
4. Vérifier que la page de la recette s'affiche correctement.
5. Commit (« Ajout recette : <titre> ») puis push sur `main` : GitHub Pages met le site à jour tout seul.

Ne jamais supprimer ou réécrire une recette existante sans demande explicite.

## Méthode de travail

- Avancer par petites étapes, proposer un plan avant tout gros changement.
- Expliquer simplement : Erick n'est pas développeur.
- Pas de dépendance lourde côté site (pas de framework nécessitant une compilation).
