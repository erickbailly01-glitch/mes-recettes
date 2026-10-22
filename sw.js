// Service worker : rend le site consultable hors connexion.
//
// - Le « squelette » du site (pages, styles, scripts, icônes) est mis en cache à
//   l'installation. ⚠ Augmenter VERSION à chaque modification de ces fichiers :
//   l'ancien cache est alors supprimé et les téléphones reçoivent la mise à jour.
// - Les recettes (recettes/*.json, dont index.json), types.json et les fiches PDF passent par
//   « réseau d'abord, cache en secours » : une nouvelle recette apparaît dès qu'on
//   est connecté, et ce qui a déjà été consulté reste lisible hors connexion.

const VERSION = "v7";
const CACHE_SITE = `mes-recettes-site-${VERSION}`;
// Non versionné : les recettes déjà consultées restent disponibles hors connexion
// après une mise à jour du site (elles sont de toute façon redemandées au réseau d'abord).
const CACHE_DONNEES = "mes-recettes-donnees";

const SQUELETTE = [
  "./",
  "index.html",
  "recette.html",
  "css/style.css",
  "js/commun.js",
  "js/accueil.js",
  "js/recette.js",
  "js/cuisine.js",
  "manifest.webmanifest",
  "icones/logo.png",
  "icones/favicon.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-masquable-512.png",
  "icones/apple-touch-icon.png",
  "recettes/index.json",
  "types.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const site = await caches.open(CACHE_SITE);
    // cache: "reload" pour ignorer le cache HTTP du navigateur et prendre les fichiers à jour.
    const DONNEES = ["recettes/index.json", "types.json"];
    await site.addAll(SQUELETTE.filter((f) => !DONNEES.includes(f))
      .map((f) => new Request(f, { cache: "reload" })));
    const donnees = await caches.open(CACHE_DONNEES);
    await donnees.addAll(DONNEES.map((f) => new Request(f, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const garder = [CACHE_SITE, CACHE_DONNEES];
    const noms = await caches.keys();
    await Promise.all(noms
      .filter((n) => n.startsWith("mes-recettes-") && !garder.includes(n))
      .map((n) => caches.delete(n)));
    // Fiches PDF gardées sans empreinte (?v=…) : ce sont d'anciennes versions, on les oublie.
    const donnees = await caches.open(CACHE_DONNEES);
    for (const requete of await donnees.keys()) {
      const url = new URL(requete.url);
      if (url.pathname.endsWith(".pdf") && !url.searchParams.has("v")) await donnees.delete(requete);
    }
    await self.clients.claim();
  })());
});

// Chemin relatif au dossier du site (« /mes-recettes/recettes/x.json » → « recettes/x.json »).
function cheminRelatif(url) {
  const base = new URL(self.registration.scope).pathname;
  return url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
}

async function reseauDAbord(requete) {
  const cache = await caches.open(CACHE_DONNEES);
  try {
    // no-store : on redemande toujours le fichier complet au serveur, sans passer par le cache HTTP.
    const reponse = await fetch(requete.url, { cache: "no-store" });
    if (reponse.ok) {
      // Une seule version de chaque fiche PDF en mémoire : on retire celles d'une autre empreinte.
      const url = new URL(requete.url);
      if (url.pathname.endsWith(".pdf")) {
        for (const ancienne of await cache.keys(requete.url, { ignoreSearch: true })) {
          if (ancienne.url !== requete.url) await cache.delete(ancienne);
        }
      }
      await cache.put(requete.url, reponse.clone());
    }
    return reponse;
  } catch (erreur) {
    // Hors connexion : la version demandée, sinon (fiche PDF) la dernière version gardée.
    const enCache = await cache.match(requete.url) || await cache.match(requete.url, { ignoreSearch: true });
    if (enCache) return enCache;
    throw erreur;
  }
}

async function cacheDAbord(requete) {
  // ignoreSearch : « recette.html?r=flan » utilise la page recette.html mise en cache.
  const enCache = await caches.match(requete, { cacheName: CACHE_SITE, ignoreSearch: true });
  if (enCache) return enCache;
  try {
    return await fetch(requete);
  } catch (erreur) {
    if (requete.mode === "navigate") {
      const accueil = await caches.match("index.html", { cacheName: CACHE_SITE });
      if (accueil) return accueil;
    }
    throw erreur;
  }
}

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  const chemin = cheminRelatif(url);
  if (chemin === null) return;

  if (/^recettes\/.+\.json$/.test(chemin) || chemin === "types.json" || /^pdf\/.+\.pdf$/.test(chemin)) {
    event.respondWith(reseauDAbord(requete));
  } else {
    event.respondWith(cacheDAbord(requete));
  }
});
