// Accueil : liste des recettes, recherche par mot-clé et filtre par type.

const TOUS = "Toutes";
let recettes = [];
let couleurs = new Map();   // nom du type → couleur
let typeChoisi = TOUS;

const champRecherche = document.getElementById("recherche");
const zoneFiltres = document.getElementById("filtres");
const listeCartes = document.getElementById("cartes");
const compteur = document.getElementById("compteur");

function carte(r) {
  const li = el("li");
  const lien = el("a", "carte");
  lien.href = "recette.html?r=" + encodeURIComponent(r.fichier.replace(/\.json$/, ""));
  appliquerCouleur(lien, couleurs.get(r.type));
  if (r.type) lien.append(el("span", "pastille-type", r.type));
  lien.append(el("h2", null, r.titre));
  if (r.sous_titre) lien.append(el("p", "sous-titre", r.sous_titre));
  if (r.preparation) lien.append(el("span", "temps", "Préparation " + r.preparation));
  li.append(lien);
  return li;
}

function afficherFiltres() {
  // Ordre de types.json ; seuls les types qui ont au moins une recette.
  const presents = new Set(recettes.map((r) => r.type));
  const types = [...couleurs.keys()].filter((t) => presents.has(t));
  for (const t of presents) if (t && !types.includes(t)) types.push(t);

  zoneFiltres.replaceChildren(...[TOUS, ...types].map((nom) => {
    const bouton = el("button", nom === TOUS ? "filtre tous" : "filtre", nom);
    bouton.type = "button";
    if (nom !== TOUS) appliquerCouleur(bouton, couleurs.get(nom));
    bouton.setAttribute("aria-pressed", String(nom === typeChoisi));
    bouton.addEventListener("click", () => {
      typeChoisi = nom;
      afficherFiltres();
      afficherCartes();
    });
    return bouton;
  }));
  // Pas de filtre utile s'il n'y a qu'un seul type.
  zoneFiltres.classList.toggle("cache", types.length <= 1);
}

function afficherCartes() {
  const mots = normaliser(champRecherche.value).split(/\s+/).filter(Boolean);
  const visibles = recettes.filter((r) => {
    if (typeChoisi !== TOUS && r.type !== typeChoisi) return false;
    const texte = normaliser([r.titre, r.sous_titre, r.type, r.categorie].join(" "));
    return mots.every((mot) => texte.includes(mot));
  });
  listeCartes.replaceChildren(...visibles.map(carte));
  const n = visibles.length;
  compteur.textContent = n === 0 ? "Aucune recette ne correspond à cette recherche."
    : n === 1 ? "1 recette" : `${n} recettes`;
}

champRecherche.addEventListener("input", afficherCartes);

Promise.all([chargerJSON("recettes/index.json"), chargerTypes()])
  .then(([index, types]) => {
    couleurs = new Map(types.map((t) => [t.nom, t.couleur]));
    recettes = index.recettes || [];
    afficherFiltres();
    afficherCartes();
  })
  .catch(() => afficherMessage(
    "Impossible de charger la liste des recettes. Vérifiez la connexion internet puis rechargez la page."));
