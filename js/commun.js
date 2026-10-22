// Outils partagés par l'accueil et la page recette.

// Crée un élément HTML ; le texte est inséré tel quel (jamais interprété comme du HTML).
function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte != null) noeud.textContent = texte;
  return noeud;
}

// « Pâtisserie » → « patisserie » : pour chercher sans tenir compte des accents ni des majuscules.
function normaliser(texte) {
  return (texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

async function chargerJSON(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`${chemin} : erreur ${reponse.status}`);
  return reponse.json();
}

// ---------- Types de recette et leurs couleurs (types.json) ----------

function luminance(hexa) {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hexa.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

// Blanc ou texte foncé : celui qui se lit le mieux sur la couleur donnée (même règle que la fiche PDF).
function texteSur(hexa) {
  const fond = luminance(hexa);
  const contrasteBlanc = 1.05 / (fond + 0.05);
  const contrasteFonce = (fond + 0.05) / (luminance("#1E2A23") + 0.05);
  return contrasteBlanc >= contrasteFonce ? "#FFFFFF" : "#1E2A23";
}

// Liste ordonnée des types : [{ nom, couleur }, …]. Liste vide si le fichier est inaccessible.
async function chargerTypes() {
  try {
    return (await chargerJSON("types.json")).types || [];
  } catch {
    return [];
  }
}

// Donne à un élément (et à ce qu'il contient) la couleur d'un type.
function appliquerCouleur(element, couleur) {
  if (!couleur) return;
  element.style.setProperty("--type", couleur);
  element.style.setProperty("--type-texte", texteSur(couleur));
}

function afficherMessage(texte) {
  const message = document.getElementById("message");
  message.textContent = texte;
  message.classList.remove("cache");
}

// Mémoire locale du téléphone (cases cochées…) ; ignorée si le navigateur la refuse.
const memoire = {
  lire(cle, defaut) {
    try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch { /* mémoire indisponible */ }
  },
};

// Service worker : application installable et consultable hors connexion.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  });
}
