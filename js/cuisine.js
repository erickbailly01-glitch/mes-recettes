// Mode cuisine : plein écran par-dessus la page recette.
// Écran « Mise en place » (ingrédients), puis une étape par écran, minuteurs dans un bandeau en bas.
// S'appuie sur recette.js (nom, dureeEnSecondes, formaterDuree, libelleDuree, preparerSon, sonner,
// resumeQuantites) et commun.js (el, memoire).

const DUREE_MAX_MINUTEUR = 48 * 3600;            // au-delà : on affiche seulement la durée
const DUREE_REPRISE = 7 * 24 * 3600 * 1000;      // on propose de reprendre pendant 7 jours
const MISE_EN_PLACE = -1;

function initialiserCuisine(r, ingredients) {
  const cleProgression = "cuisine:" + nom;
  const cleMinuteurs = "minuteurs:" + nom;

  // Étapes à plat, numérotées en continu d'une phase à l'autre.
  const etapes = [];
  (r.phases || []).forEach(([phase, liste]) => liste.forEach(([titre, duree, texte, astuce]) => {
    const secondes = dureeEnSecondes(duree);
    etapes.push({
      numero: etapes.length + 1, phase, titre, duree, texte, astuce,
      minuteur: secondes && secondes <= DUREE_MAX_MINUTEUR ? secondes : null,
    });
  }));
  const total = etapes.length;
  if (!total) return;
  const FIN = total;   // position de l'écran « Terminé »

  let ouvert = false;
  let position = MISE_EN_PLACE;
  let ignorerRetour = false;
  const reglages = etapes.map((e) => e.minuteur);   // durée choisie avant de lancer (−1 / +1 min)

  // ---------- Construction de l'écran ----------
  const racine = document.getElementById("cuisine");
  const haut = el("header", "cuisine-haut");
  const reperes = el("div", "cuisine-reperes");
  const libellePhase = el("p", "cuisine-phase");
  const compteur = el("p", "cuisine-compteur");
  reperes.append(libellePhase, compteur);
  const quitter = el("button", "cuisine-quitter", "✕");
  quitter.type = "button";
  quitter.setAttribute("aria-label", "Quitter le mode cuisine");
  const piste = el("div", "cuisine-progression");
  const barre = el("div", "cuisine-barre");
  piste.append(barre);
  piste.setAttribute("role", "progressbar");
  piste.setAttribute("aria-valuemin", "0");
  piste.setAttribute("aria-valuemax", String(total));
  haut.append(reperes, quitter, piste);

  const contenu = el("main", "cuisine-contenu");
  contenu.setAttribute("aria-live", "polite");
  const bandeau = el("div", "cuisine-minuteurs");
  bandeau.setAttribute("aria-label", "Minuteurs en cours");
  const nav = el("footer", "cuisine-nav");
  const precedent = el("button", "bouton secondaire", "← Précédent");
  const suivant = el("button", "bouton", "Suivant →");
  precedent.type = suivant.type = "button";
  nav.append(precedent, suivant);
  racine.append(haut, contenu, bandeau, nav);

  // ---------- Progression mémorisée (pour reprendre plus tard) ----------
  function progressionSauvee() {
    const p = memoire.lire(cleProgression, null);
    if (!p || !(p.i >= 0 && p.i < total) || Date.now() - p.t > DUREE_REPRISE) return null;
    return p.i;
  }
  function oublierProgression() {
    memoire.ecrire(cleProgression, null);
    document.getElementById("reprise").classList.add("cache");
  }

  // ---------- Écrans ----------
  function ecranMiseEnPlace() {
    const blocs = [el("h2", "cuisine-titre", "Mise en place")];
    if (resumeQuantites) blocs.push(el("p", "cuisine-portions", resumeQuantites));
    const reprise = progressionSauvee();
    if (reprise !== null) {
      const b = el("button", "bouton cuisine-reprendre", `Reprendre à l'étape ${reprise + 1} / ${total}`);
      b.type = "button";
      b.addEventListener("click", () => aller(reprise));
      blocs.push(b);
    }
    let groupe = null;
    let liste = null;
    for (const ing of ingredients) {
      if (!liste || ing.groupe !== groupe) {
        groupe = ing.groupe;
        if (groupe) blocs.push(el("h3", "cuisine-groupe", groupe));
        liste = el("ul", "cuisine-ingredients");
        blocs.push(liste);
      }
      const li = el("li");
      const label = el("label");
      const c = el("input");
      c.type = "checkbox";
      c.checked = ing.caseACocher.checked;
      // Même case que sur la page recette : l'état est partagé et mémorisé.
      c.addEventListener("change", () => {
        ing.caseACocher.checked = c.checked;
        ing.caseACocher.dispatchEvent(new Event("change"));
      });
      const quantite = el("span", "cuisine-quantite");
      const texte = el("span", ing.q.classList.contains("modifiee") ? "modifiee" : null, ing.q.textContent);
      quantite.append(texte);
      label.append(c, quantite, el("span", null, ing.nom));
      li.append(label);
      liste.append(li);
    }
    return blocs;
  }

  function ecranEtape(i) {
    const e = etapes[i];
    const blocs = [];
    if (e.duree && e.duree !== "—") blocs.push(el("p", "cuisine-duree", "⏱ " + e.duree));
    blocs.push(el("h2", "cuisine-titre", e.titre), el("p", "cuisine-texte", e.texte));
    if (e.astuce) blocs.push(el("p", "cuisine-astuce", e.astuce));
    if (e.minuteur) blocs.push(zoneMinuteur(i));
    return blocs;
  }

  function ecranFin() {
    const b = el("button", "bouton", "Revenir à la recette");
    b.type = "button";
    b.addEventListener("click", () => demanderFermeture());
    return [el("p", "cuisine-fete", "🎉"), el("h2", "cuisine-titre", "Terminé !"),
      el("p", "cuisine-texte", "Bon appétit !"), b];
  }

  // Bloc « Lancer le minuteur » d'une étape (ou rappel du minuteur déjà lancé).
  function zoneMinuteur(i) {
    const zone = el("div", "cuisine-lancer");
    const enCours = minuteurs.find((m) => m.etape === i);
    if (enCours) {
      zone.append(el("p", "cuisine-en-cours", "Minuteur lancé : il continue dans le bandeau en bas, même si vous changez d'étape."));
      return zone;
    }
    const ligne = el("div", "cuisine-reglage-duree");
    const moins = el("button", "bouton secondaire", "−1 min");
    const valeur = el("output", "cuisine-valeur-duree", libelleDuree(reglages[i]));
    const plus = el("button", "bouton secondaire", "+1 min");
    const lancer = el("button", "bouton cuisine-bouton-minuteur", "⏱ Lancer le minuteur");
    moins.type = plus.type = lancer.type = "button";
    const maj = () => {
      valeur.textContent = libelleDuree(reglages[i]);
      moins.disabled = reglages[i] <= 60;
    };
    moins.addEventListener("click", () => { reglages[i] = Math.max(60, reglages[i] - 60); maj(); });
    plus.addEventListener("click", () => { reglages[i] += 60; maj(); });
    lancer.addEventListener("click", () => {
      preparerSon();
      ajouterMinuteur(i, Date.now() + reglages[i] * 1000);
      afficher();
    });
    maj();
    ligne.append(moins, valeur, plus);
    zone.append(lancer, ligne);
    return zone;
  }

  function afficher() {
    let blocs;
    if (position === MISE_EN_PLACE) {
      libellePhase.textContent = "Mise en place";
      compteur.textContent = `${total} étapes`;
      blocs = ecranMiseEnPlace();
    } else if (position === FIN) {
      libellePhase.textContent = "Terminé";
      compteur.textContent = `Étape ${total} / ${total}`;
      blocs = ecranFin();
    } else {
      libellePhase.textContent = etapes[position].phase;
      compteur.textContent = `Étape ${position + 1} / ${total}`;
      blocs = ecranEtape(position);
    }
    const fait = position === MISE_EN_PLACE ? 0 : Math.min(position + 1, total);
    barre.style.width = `${(fait / total) * 100}%`;
    piste.setAttribute("aria-valuenow", String(fait));
    contenu.replaceChildren(...blocs);
    contenu.scrollTop = 0;

    precedent.classList.toggle("invisible", position === MISE_EN_PLACE);
    suivant.classList.toggle("cache", position === FIN);
    suivant.textContent = position === MISE_EN_PLACE ? "C'est parti →"
      : position === total - 1 ? "Terminé 🎉" : "Suivant →";
  }

  function aller(p) {
    position = Math.max(MISE_EN_PLACE, Math.min(FIN, p));
    if (position >= 0 && position < total) memoire.ecrire(cleProgression, { i: position, t: Date.now() });
    if (position === FIN) oublierProgression();
    afficher();
  }

  precedent.addEventListener("click", () => aller(position - 1));
  suivant.addEventListener("click", () => aller(position + 1));

  // Glisser vers la gauche : étape suivante ; vers la droite : étape précédente.
  let depart = null;
  contenu.addEventListener("touchstart", (ev) => {
    const t = ev.changedTouches[0];
    depart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  contenu.addEventListener("touchend", (ev) => {
    if (!depart) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - depart.x;
    const dy = t.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    if (dx < 0 && position < FIN) aller(position + 1);
    if (dx > 0 && position > MISE_EN_PLACE) aller(position - 1);
  }, { passive: true });
  document.addEventListener("keydown", (ev) => {
    if (!ouvert) return;
    if (ev.key === "ArrowRight" && position < FIN) aller(position + 1);
    if (ev.key === "ArrowLeft" && position > MISE_EN_PLACE) aller(position - 1);
    if (ev.key === "Escape") demanderFermeture();
  });

  // ---------- Minuteurs (bandeau en bas, plusieurs à la fois) ----------
  let minuteurs = [];   // { etape, fin (ms), fini, ligne, temps }
  let horlogeCuisine = null;
  let sonnerieCuisine = null;

  function sauverMinuteurs() {
    memoire.ecrire(cleMinuteurs, minuteurs.map((m) => ({ etape: m.etape, fin: m.fin })));
  }

  function ajouterMinuteur(i, fin) {
    const m = { etape: i, fin, fini: false };
    const e = etapes[i];
    m.ligne = el("div", "cuisine-minuteur");
    m.ligne.setAttribute("role", "timer");
    const nomEtape = el("span", "cuisine-minuteur-nom", `${e.numero}. ${e.titre}`);
    m.temps = el("span", "cuisine-minuteur-temps");
    const moins = el("button", "cuisine-mini", "−1");
    const plus = el("button", "cuisine-mini", "+1");
    const arreter = el("button", "cuisine-mini arreter", "■");
    moins.type = plus.type = arreter.type = "button";
    moins.setAttribute("aria-label", "Retirer une minute");
    plus.setAttribute("aria-label", "Ajouter une minute");
    arreter.setAttribute("aria-label", "Arrêter le minuteur");
    moins.addEventListener("click", () => { m.fin = Math.max(Date.now(), m.fin - 60000); sauverMinuteurs(); tic(); });
    plus.addEventListener("click", () => {
      if (m.fini) { m.fini = false; m.fin = Date.now(); m.ligne.classList.remove("fini"); }
      m.fin += 60000; sauverMinuteurs(); tic();
    });
    arreter.addEventListener("click", () => retirerMinuteur(m));
    m.ligne.append(nomEtape, m.temps, moins, plus, arreter);
    m.boutons = [moins, plus];
    minuteurs.push(m);
    bandeau.append(m.ligne);
    sauverMinuteurs();
    tic();
    if (!horlogeCuisine) horlogeCuisine = setInterval(tic, 250);
  }

  function retirerMinuteur(m) {
    minuteurs = minuteurs.filter((x) => x !== m);
    m.ligne.remove();
    sauverMinuteurs();
    majSonnerie();
    if (!minuteurs.length) { clearInterval(horlogeCuisine); horlogeCuisine = null; }
    if (ouvert && position === m.etape) afficher();
  }

  function toutArreter() {
    for (const m of [...minuteurs]) retirerMinuteur(m);
  }

  function tic() {
    for (const m of minuteurs) {
      const s = (m.fin - Date.now()) / 1000;
      if (s <= 0 && !m.fini) {
        m.fini = true;
        m.ligne.classList.add("fini");
        majSonnerie();
      }
      m.temps.textContent = m.fini ? "Terminé !" : formaterDuree(s);
      m.boutons[0].disabled = m.fini;
    }
    bandeau.classList.toggle("cache", !minuteurs.length);
  }

  // Sonne et vibre toutes les 3 s tant qu'un minuteur terminé n'a pas été arrêté.
  function majSonnerie() {
    const sonne = minuteurs.some((m) => m.fini);
    if (sonne && !sonnerieCuisine) {
      sonner();
      sonnerieCuisine = setInterval(sonner, 3000);
    } else if (!sonne && sonnerieCuisine) {
      clearInterval(sonnerieCuisine);
      sonnerieCuisine = null;
      if (navigator.vibrate) navigator.vibrate(0);
    }
  }

  // Minuteurs restés en mémoire (téléphone mis en veille, appli fermée…).
  function restaurerMinuteurs() {
    if (minuteurs.length) return;
    for (const { etape, fin } of memoire.lire(cleMinuteurs, [])) {
      if (etape >= 0 && etape < total && etapes[etape].minuteur) ajouterMinuteur(etape, fin);
    }
  }

  // ---------- Écran allumé pendant tout le mode cuisine ----------
  let verrou = null;
  async function garderEcranAllume() {
    if (!("wakeLock" in navigator) || verrou) return;
    try {
      verrou = await navigator.wakeLock.request("screen");
      verrou.addEventListener("release", () => { verrou = null; });
    } catch { /* refusé (économie d'énergie…) : on continue sans */ }
  }
  document.addEventListener("visibilitychange", () => {
    if (ouvert && document.visibilityState === "visible") garderEcranAllume();
  });

  // ---------- Ouvrir / quitter ----------
  function ouvrir(p) {
    if (!ouvert) {
      ouvert = true;
      racine.classList.remove("cache");
      document.body.classList.add("cuisine-ouverte");
      history.pushState({ cuisine: true }, "");   // le bouton « retour » du téléphone quitte le mode cuisine
      garderEcranAllume();
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
    restaurerMinuteurs();
    position = p;
    afficher();
    suivant.focus();
  }

  function fermer(depuisHistorique) {
    if (!ouvert) return;
    ouvert = false;
    toutArreter();
    racine.classList.add("cache");
    document.body.classList.remove("cuisine-ouverte");
    if (verrou) verrou.release().catch(() => {});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (!depuisHistorique && history.state && history.state.cuisine) {
      ignorerRetour = true;
      history.back();
    }
    proposerReprise();
  }

  function confirmerSiMinuteur() {
    return !minuteurs.length
      || confirm("Un minuteur est en cours. Quitter le mode cuisine l'arrêtera. Quitter quand même ?");
  }

  function demanderFermeture() {
    if (confirmerSiMinuteur()) fermer(false);
  }
  quitter.addEventListener("click", demanderFermeture);

  window.addEventListener("popstate", () => {
    if (ignorerRetour) { ignorerRetour = false; return; }
    if (!ouvert) return;
    if (confirmerSiMinuteur()) fermer(true);
    else history.pushState({ cuisine: true }, "");
  });

  // ---------- Page recette : bouton d'accès et proposition de reprise ----------
  function proposerReprise() {
    const zone = document.getElementById("reprise");
    const i = progressionSauvee();
    zone.classList.toggle("cache", i === null);
    if (i === null) return;
    document.getElementById("reprise-texte").textContent =
      `Vous vous étiez arrêté à l'étape ${i + 1} / ${total} (« ${etapes[i].titre} »).`;
  }

  document.getElementById("mode-cuisine").addEventListener("click", () => ouvrir(MISE_EN_PLACE));
  document.getElementById("reprise-oui").addEventListener("click", () => {
    const i = progressionSauvee();
    ouvrir(i === null ? MISE_EN_PLACE : i);
  });
  document.getElementById("reprise-non").addEventListener("click", () => {
    oublierProgression();
    memoire.ecrire(cleMinuteurs, []);
  });

  proposerReprise();

  // Arrivée depuis le bouton « Mode cuisine » d'une carte de l'accueil.
  const adresse = new URL(location.href);
  if (adresse.searchParams.get("mode") === "cuisine") {
    adresse.searchParams.delete("mode");
    history.replaceState(null, "", adresse.pathname.split("/").pop() + adresse.search);
    ouvrir(MISE_EN_PLACE);
  }
}
