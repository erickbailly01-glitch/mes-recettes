# Mes recettes — instructions du projet

Application de recettes personnelle d'Erick, utilisable sur téléphone et partagée avec des proches par un simple lien.
Tout le contenu, l'interface et les messages de commit sont **en français**.

## Architecture (à respecter)

- **Site statique** (HTML / CSS / JavaScript, sans serveur ni base de données), hébergé gratuitement sur **GitHub Pages**.
- **PWA** : installable sur l'écran d'accueil du téléphone (manifest + service worker), consultable hors connexion une fois chargée.
- **Les recettes sont des fichiers JSON** dans `recettes/`, un fichier par recette, nommé en kebab-case (`flan-patissier-cafe-rhum.json`).
  Le format de référence est `recettes/flan-patissier-cafe-rhum.json` ; la docstring de `fiche_recette.py` le décrit.
- `recettes/index.json` liste toutes les recettes (fichier, titre, catégorie, sous-titre, temps de préparation). Il est **régénéré automatiquement** par `scripts/build_index.py` : ne jamais l'éditer à la main.
- **Hors connexion** : `sw.js` met le site en cache. Après toute modification d'un fichier du site (HTML, CSS, JS, icônes, manifest), augmenter `VERSION` dans `sw.js`. Inutile pour une simple recette : `recettes/*.json` et `pdf/*.pdf` sont chargés « réseau d'abord ».
- **Chemins relatifs uniquement** (le site est servi depuis `/mes-recettes/`).
- **Fiches PDF** : `fiche_recette.py` génère la fiche A4 de chaque recette dans `pdf/<même-nom>.pdf`. Le site propose un bouton « Fiche PDF » qui ouvre ce fichier. **Ne pas modifier le rendu de `fiche_recette.py`** sans demande explicite.

## Interface

- Pensée d'abord pour le **téléphone** (mode portrait, gros boutons, lisible en cuisine).
- Accueil : liste des recettes en cartes, recherche par mot-clé, filtre par catégorie.
- Page recette : en-tête, bandeau d'infos, ingrédients (cases à cocher), étapes numérotées en continu avec astuces, minuteur sur les étapes qui ont une durée, option « garder l'écran allumé ».
- Charte reprise de la fiche PDF : espresso `#3B2418`, café `#8A5A3B`, crème `#F6EEE3`, latte `#E7D3BC`, encre `#2A211C` ; titres en serif, texte en sans-serif.

## Ajouter une recette (tâche la plus fréquente)

Quand Erick demande « ajoute la recette … » (texte, lien, photo ou simple idée) :
1. Rédiger le JSON au format de référence dans `recettes/`, en français, quantités en unités métriques.
2. Lancer `python fiche_recette.py recettes/<nom>.json pdf/<nom>.pdf`. En cas de « DÉBORDEMENT », raccourcir les textes et relancer jusqu'à « OK ».
3. Lancer `python scripts/build_index.py`.
4. Vérifier que la page de la recette s'affiche correctement.
5. Commit (« Ajout recette : <titre> ») puis push sur `main` : GitHub Pages met le site à jour tout seul.

Ne jamais supprimer ou réécrire une recette existante sans demande explicite.

## Méthode de travail

- Avancer par petites étapes, proposer un plan avant tout gros changement.
- Expliquer simplement : Erick n'est pas développeur.
- Pas de dépendance lourde côté site (pas de framework nécessitant une compilation).
