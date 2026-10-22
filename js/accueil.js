// Accueil : liste des recettes, recherche par mot-clé et filtre par catégorie.

const TOUTES = "Toutes";
let recettes = [];
let categorieChoisie = TOUTES;

const champRecherche = document.getElementById("recherche");
const zoneFiltres = document.getElementById("filtres");
const listeCartes = document.getElementById("cartes");
const compteur = document.getElementById("compteur");

function carte(r) {
  const li = el("li");
  const lien = el("a", "carte");
  lien.href = "recette.html?r=" + encodeURIComponent(r.fichier.replace(/\.json$/, ""));
  lien.append(el("p", "categorie", r.categorie), el("h2", null, r.titre));
  if (r.sous_titre) lien.append(el("p", "sous-titre", r.sous_titre));
  if (r.preparation) lien.append(el("span", "temps", "Préparation " + r.preparation));
  li.append(lien);
  return li;
}

function afficherFiltres() {
  const categories = [TOUTES, ...new Set(recettes.map((r) => r.categorie))];
  zoneFiltres.replaceChildren(...categories.map((nom) => {
    const bouton = el("button", "filtre", nom);
    bouton.type = "button";
    bouton.setAttribute("aria-pressed", String(nom === categorieChoisie));
    bouton.addEventListener("click", () => {
      categorieChoisie = nom;
      afficherFiltres();
      afficherCartes();
    });
    return bouton;
  }));
  // Pas de filtre utile s'il n'y a qu'une seule catégorie.
  zoneFiltres.classList.toggle("cache", categories.length <= 2);
}

function afficherCartes() {
  const mots = normaliser(champRecherche.value).split(/\s+/).filter(Boolean);
  const visibles = recettes.filter((r) => {
    if (categorieChoisie !== TOUTES && r.categorie !== categorieChoisie) return false;
    const texte = normaliser([r.titre, r.sous_titre, r.categorie].join(" "));
    return mots.every((mot) => texte.includes(mot));
  });
  listeCartes.replaceChildren(...visibles.map(carte));
  const n = visibles.length;
  compteur.textContent = n === 0 ? "Aucune recette ne correspond à cette recherche."
    : n === 1 ? "1 recette" : `${n} recettes`;
}

champRecherche.addEventListener("input", afficherCartes);

chargerJSON("recettes/index.json")
  .then((index) => {
    recettes = index.recettes || [];
    afficherFiltres();
    afficherCartes();
  })
  .catch(() => afficherMessage(
    "Impossible de charger la liste des recettes. Vérifiez la connexion internet puis rechargez la page."));
