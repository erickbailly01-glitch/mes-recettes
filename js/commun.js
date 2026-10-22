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
