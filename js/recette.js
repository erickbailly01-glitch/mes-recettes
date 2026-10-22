// Page recette : affiche recettes/<nom>.json (nom passé dans l'adresse : recette.html?r=<nom>).

const nom = new URLSearchParams(location.search).get("r") || "";

// ---------- Durées des étapes ----------

// « 10 min » → 600 ; « 1 à 2 h » → 3600 (on prend la durée la plus courte) ;
// « 1 h 30 » → 5400 ; « 12 h minimum » → 43200 ; texte sans durée → null.
function dureeEnSecondes(texte) {
  const t = (texte || "").toLowerCase();
  const debut = t.split(/\s+à\s+|\s*[–—-]\s*/)[0];
  const heures = debut.match(/(\d+(?:[.,]\d+)?)\s*h(?:\s*(\d+))?/);
  if (heures) return Math.round(parseFloat(heures[1].replace(",", ".")) * 3600 + (parseInt(heures[2] || "0", 10) * 60));
  const minutes = debut.match(/(\d+(?:[.,]\d+)?)\s*min/);
  if (minutes) return Math.round(parseFloat(minutes[1].replace(",", ".")) * 60);
  // « 5 à 8 min » : le premier nombre n'a pas d'unité, on prend celle de la fin.
  const nombre = debut.match(/^\D*(\d+(?:[.,]\d+)?)\s*$/);
  if (nombre) {
    const valeur = parseFloat(nombre[1].replace(",", "."));
    if (/\d\s*h\b/.test(t)) return Math.round(valeur * 3600);
    if (/\d\s*min/.test(t)) return Math.round(valeur * 60);
  }
  return null;
}

function formaterDuree(secondes) {
  const s = Math.max(0, Math.ceil(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${deuxChiffres(m)}:${deuxChiffres(s % 60)}` : `${deuxChiffres(m)}:${deuxChiffres(s % 60)}`;
}

function libelleDuree(secondes) {
  const h = Math.floor(secondes / 3600);
  const m = Math.round((secondes % 3600) / 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

// ---------- Sonnerie ----------

let audio = null;

// Le son doit être « débloqué » par un appui de l'utilisateur (règle des navigateurs).
function preparerSon() {
  const Contexte = window.AudioContext || window.webkitAudioContext;
  if (!Contexte) return;
  if (!audio) audio = new Contexte();
  if (audio.state === "suspended") audio.resume();
}

function sonner() {
  if (audio) {
    [0, 0.35, 0.7].forEach((decalage) => {
      const osc = audio.createOscillator();
      const volume = audio.createGain();
      const debut = audio.currentTime + decalage;
      osc.frequency.value = 880;
      volume.gain.setValueAtTime(0.0001, debut);
      volume.gain.exponentialRampToValueAtTime(0.5, debut + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, debut + 0.25);
      osc.connect(volume).connect(audio.destination);
      osc.start(debut);
      osc.stop(debut + 0.3);
    });
  }
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
}

// ---------- Minuteurs ----------

const minuteursActifs = new Set();
let horloge = null;

function tic() {
  for (const m of minuteursActifs) m.actualiser();
  if (!minuteursActifs.size) { clearInterval(horloge); horloge = null; }
}

function demarrerHorloge() {
  if (!horloge) horloge = setInterval(tic, 250);
}

// Un minuteur par étape. On mémorise l'heure de fin : le décompte reste juste
// même si le téléphone met la page en pause.
function creerMinuteur(dureeInitiale, titreEtape) {
  const zone = el("div", "minuteur");
  let fin = 0;           // heure de fin (ms) quand il tourne
  let restant = 0;       // secondes restantes quand il est en pause
  let enPause = false;
  let sonnerie = null;

  const lancer = el("button", "bouton secondaire", `⏱ Minuteur ${libelleDuree(dureeInitiale)}`);
  lancer.type = "button";

  const cadran = el("div", "cadran");
  cadran.setAttribute("role", "timer");
  cadran.setAttribute("aria-label", `Minuteur : ${titreEtape}`);
  const affichage = el("div", "temps-restant");
  const moins = el("button", "bouton secondaire", "−1 min");
  const pause = el("button", "bouton secondaire", "Pause");
  const plus = el("button", "bouton secondaire", "+1 min");
  const arreter = el("button", "bouton", "Arrêter");
  [moins, pause, plus, arreter].forEach((b) => { b.type = "button"; });
  cadran.append(affichage, moins, pause, plus, arreter);

  const secondesRestantes = () => (enPause ? restant : (fin - Date.now()) / 1000);

  const minuteur = {
    actualiser() {
      const s = secondesRestantes();
      affichage.textContent = formaterDuree(s);
      if (s <= 0 && !enPause) terminer();
    },
  };

  function afficherCadran(visible) {
    lancer.classList.toggle("cache", visible);
    cadran.classList.toggle("cache", !visible);
  }

  function terminer() {
    minuteursActifs.delete(minuteur);
    cadran.classList.add("fini");
    affichage.textContent = "Terminé !";
    [moins, pause, plus].forEach((b) => b.classList.add("cache"));
    sonner();
    sonnerie = setInterval(sonner, 3000);
  }

  function remettreAZero() {
    minuteursActifs.delete(minuteur);
    clearInterval(sonnerie);
    sonnerie = null;
    if (navigator.vibrate) navigator.vibrate(0);
    cadran.classList.remove("fini");
    [moins, pause, plus].forEach((b) => b.classList.remove("cache"));
    afficherCadran(false);
  }

  function ajuster(delta) {
    if (enPause) restant = Math.max(0, restant + delta);
    else fin = Math.max(Date.now(), fin + delta * 1000);
    minuteur.actualiser();
  }

  lancer.addEventListener("click", () => {
    preparerSon();
    enPause = false;
    pause.textContent = "Pause";
    fin = Date.now() + dureeInitiale * 1000;
    afficherCadran(true);
    minuteursActifs.add(minuteur);
    minuteur.actualiser();
    demarrerHorloge();
  });
  moins.addEventListener("click", () => ajuster(-60));
  plus.addEventListener("click", () => ajuster(60));
  pause.addEventListener("click", () => {
    if (enPause) {
      fin = Date.now() + restant * 1000;
      enPause = false;
      pause.textContent = "Pause";
      demarrerHorloge();
    } else {
      restant = secondesRestantes();
      enPause = true;
      pause.textContent = "Reprendre";
    }
    minuteur.actualiser();
  });
  arreter.addEventListener("click", remettreAZero);

  afficherCadran(false);
  zone.append(lancer, cadran);
  return zone;
}

// ---------- Garder l'écran allumé ----------

function initialiserEcran() {
  const bouton = document.getElementById("ecran");
  const remarque = document.getElementById("ecran-remarque");
  if (!("wakeLock" in navigator)) {
    bouton.disabled = true;
    remarque.textContent = "« Garder l'écran allumé » n'est pas disponible sur ce navigateur.";
    remarque.classList.remove("cache");
    return;
  }
  let verrou = null;
  let souhaite = false;

  async function verrouiller() {
    try {
      verrou = await navigator.wakeLock.request("screen");
      verrou.addEventListener("release", () => { verrou = null; });
    } catch {
      souhaite = false;
      maj();
      remarque.textContent = "Le téléphone a refusé de garder l'écran allumé (mode économie d'énergie ?).";
      remarque.classList.remove("cache");
    }
  }
  function maj() {
    bouton.setAttribute("aria-pressed", String(souhaite));
    bouton.textContent = souhaite ? "Écran allumé ✓" : "Garder l'écran allumé";
  }
  bouton.addEventListener("click", async () => {
    souhaite = !souhaite;
    maj();
    if (souhaite) await verrouiller();
    else if (verrou) await verrou.release();
  });
  // Le téléphone relâche le verrou quand on quitte l'appli : on le reprend au retour.
  document.addEventListener("visibilitychange", () => {
    if (souhaite && !verrou && document.visibilityState === "visible") verrouiller();
  });
}

// ---------- Affichage de la recette ----------

function afficherIngredients(groupes) {
  const cle = "coches:" + nom;
  const coches = new Set(memoire.lire(cle, []));
  const zone = document.getElementById("ingredients");
  const cases = [];

  groupes.forEach(([groupe, lignes], g) => {
    if (groupe) zone.append(el("h3", null, groupe));
    const liste = el("ul", "ingredients");
    lignes.forEach(([quantite, ingredient], i) => {
      const id = `${g}-${i}`;
      const li = el("li");
      const label = el("label", "ingredient");
      const caseACocher = el("input");
      caseACocher.type = "checkbox";
      caseACocher.checked = coches.has(id);
      caseACocher.addEventListener("change", () => {
        if (caseACocher.checked) coches.add(id); else coches.delete(id);
        memoire.ecrire(cle, [...coches]);
      });
      cases.push(caseACocher);
      label.append(caseACocher, el("span", "quantite", quantite), el("span", null, ingredient));
      li.append(label);
      liste.append(li);
    });
    zone.append(liste);
  });

  document.getElementById("decocher").addEventListener("click", () => {
    cases.forEach((c) => { c.checked = false; });
    coches.clear();
    memoire.ecrire(cle, []);
  });
}

function afficherEtapes(phases) {
  const zone = document.getElementById("phases");
  let numero = 0; // numérotation continue d'une phase à l'autre
  phases.forEach(([libelle, etapes]) => {
    zone.append(el("h2", "phase", libelle));
    const liste = el("ol", "etapes");
    etapes.forEach(([titre, duree, texte, astuce]) => {
      numero += 1;
      const li = el("li", "etape");
      const corps = el("div", "corps");
      const h3 = el("h3", null, titre);
      if (duree) h3.append(el("span", "duree", duree));
      corps.append(h3, el("p", null, texte));
      if (astuce) corps.append(el("p", "astuce", astuce));
      const secondes = dureeEnSecondes(duree);
      if (secondes) corps.append(creerMinuteur(secondes, titre));
      li.append(el("span", "numero", String(numero)), corps);
      liste.append(li);
    });
    zone.append(liste);
  });
}

function afficherRecette(r) {
  document.title = `${r.titre} — Mes recettes`;
  document.getElementById("categorie").textContent = r.categorie || "";
  document.getElementById("titre").textContent = r.titre;
  document.getElementById("sous-titre").textContent = r.sous_titre || "";

  document.getElementById("infos").replaceChildren(...(r.infos || []).map(([cle, valeur]) => {
    const info = el("div", "info");
    info.append(el("span", "cle", cle), el("span", "valeur", valeur));
    return info;
  }));

  document.getElementById("pdf").href = `pdf/${nom}.pdf`;

  afficherIngredients(r.ingredients || []);

  if (r.materiel) {
    document.getElementById("materiel").textContent = r.materiel;
    document.getElementById("bloc-materiel").classList.remove("cache");
  }
  if (r.planning && r.planning.length) {
    document.getElementById("planning").replaceChildren(...r.planning.map(([jour, texte]) => {
      const li = el("li");
      li.append(el("span", "jour", jour), el("span", null, texte));
      return li;
    }));
    document.getElementById("bloc-planning").classList.remove("cache");
  }
  if (r.note) {
    const note = document.getElementById("note");
    note.textContent = r.note;
    note.classList.remove("cache");
  }

  afficherEtapes(r.phases || []);
  initialiserEcran();
  document.getElementById("recette").classList.remove("cache");
}

function recetteIntrouvable(texte) {
  document.getElementById("titre").textContent = "Recette introuvable";
  afficherMessage(texte);
}

if (!/^[a-z0-9-]+$/.test(nom)) {
  recetteIntrouvable("Cette adresse ne correspond à aucune recette. Revenez à la liste des recettes.");
} else {
  chargerJSON(`recettes/${nom}.json`)
    .then(afficherRecette)
    // TypeError = le réseau ne répond pas ; sinon le serveur a répondu « introuvable ».
    .catch((erreur) => recetteIntrouvable(erreur instanceof TypeError
      ? "Pas de connexion internet, et cette recette n'a pas encore été ouverte sur ce téléphone."
      : "Cette recette n'existe pas (ou plus). Revenez à la liste des recettes."));
}
