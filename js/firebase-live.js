// ============================================================
// AWAKENED BY YAH MUSIC — FIREBASE LIVE TRACKER
// Version 4: Presence, countries, and live song activity
// ============================================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ------------------------------------------------------------
// FIREBASE PROJECT CONFIGURATION
// ------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyC4i9NobSeKErPgoB0LkaRq82nT0c62YOw",
  authDomain: "awakened-by-yah-live-tracker.firebaseapp.com",
  projectId: "awakened-by-yah-live-tracker",
  storageBucket: "awakened-by-yah-live-tracker.firebasestorage.app",
  messagingSenderId: "28174425646",
  appId: "1:28174425646:web:984c07adf4f38a542d09bf"
};


// ------------------------------------------------------------
// INITIALIZE FIREBASE
// ------------------------------------------------------------

const firebaseApp = initializeApp(firebaseConfig);
const database = getFirestore(firebaseApp);


// ------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------

const HEARTBEAT_INTERVAL = 30000;

const VISITOR_STORAGE_KEY = "aby_live_visitor_id";
const LOCATION_STORAGE_KEY = "aby_live_location";


// ------------------------------------------------------------
// CURRENT LISTENING STATE
// ------------------------------------------------------------

let listeningState = {
  isListening: false,
  trackTitle: ""
};


// ------------------------------------------------------------
// CREATE OR RETRIEVE A PRIVATE RANDOM VISITOR ID
// ------------------------------------------------------------

function getVisitorId() {
  let visitorId = sessionStorage.getItem(VISITOR_STORAGE_KEY);

  if (!visitorId) {
    visitorId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 12)}`;

    sessionStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  }

  return visitorId;
}


// ------------------------------------------------------------
// DETERMINE THE CURRENT PAGE
// ------------------------------------------------------------

function getPageInformation() {
  const pathname = window.location.pathname;

  let pageName = document.title || "AWAKENED BY YAH MUSIC";

  if (pathname === "/" || pathname.endsWith("/index.html")) {
    pageName = "Homepage";
  } else if (pathname.includes("/store")) {
    pageName = "Digital Store";
  } else if (pathname.includes("/music")) {
    pageName = "Music";
  } else if (pathname.includes("/albums")) {
    pageName = "Albums";
  } else if (pathname.includes("/videos")) {
    pageName = "Videos";
  } else if (pathname.includes("/press")) {
    pageName = "Press";
  } else if (pathname.includes("/downloads")) {
    pageName = "Downloads";
  }

  return {
    pageName,
    pagePath: pathname,
    pageTitle: document.title || "",
    pageUrl: window.location.href
  };
}


// ------------------------------------------------------------
// DEFAULT LOCATION
// Used if the country service is unavailable.
// ------------------------------------------------------------

function getUnknownLocation() {
  return {
    country: "Unknown",
    countryCode: "",
    region: "",
    city: "",
    continent: ""
  };
}


// ------------------------------------------------------------
// READ CACHED LOCATION
// The country lookup is performed only once per browser session.
// ------------------------------------------------------------

function getCachedLocation() {
  try {
    const storedLocation =
      sessionStorage.getItem(LOCATION_STORAGE_KEY);

    if (!storedLocation) {
      return null;
    }

    const parsedLocation = JSON.parse(storedLocation);

    if (
      typeof parsedLocation.country !== "string" ||
      typeof parsedLocation.countryCode !== "string" ||
      typeof parsedLocation.region !== "string" ||
      typeof parsedLocation.city !== "string" ||
      typeof parsedLocation.continent !== "string"
    ) {
      return null;
    }

    return parsedLocation;
  } catch (error) {
    return null;
  }
}


// ------------------------------------------------------------
// LOOK UP THE VISITOR'S GENERAL LOCATION
// No IP address is stored in Firestore.
// ------------------------------------------------------------

async function getLocationInformation() {
  const cachedLocation = getCachedLocation();

  if (cachedLocation) {
    return cachedLocation;
  }

  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, 6000);

  try {
    const response = await fetch("https://ipwho.is/", {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Location request failed with status ${response.status}`
      );
    }

    const locationData = await response.json();

    if (locationData.success === false) {
      throw new Error(
        locationData.message || "Location lookup was unsuccessful."
      );
    }

    const location = {
      country:
        typeof locationData.country === "string"
          ? locationData.country
          : "Unknown",

      countryCode:
        typeof locationData.country_code === "string"
          ? locationData.country_code
          : "",

      region:
        typeof locationData.region === "string"
          ? locationData.region
          : "",

      city:
        typeof locationData.city === "string"
          ? locationData.city
          : "",

      continent:
        typeof locationData.continent === "string"
          ? locationData.continent
          : ""
    };

    sessionStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify(location)
    );

    return location;
  } catch (error) {
    console.warn(
      "Country lookup unavailable. Using Unknown location:",
      error
    );

    const unknownLocation = getUnknownLocation();

    sessionStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify(unknownLocation)
    );

    return unknownLocation;
  } finally {
    window.clearTimeout(timeoutId);
  }
}


// ------------------------------------------------------------
// VISITOR DOCUMENT
// ------------------------------------------------------------

const visitorId = getVisitorId();

const visitorReference = doc(
  database,
  "liveVisitors",
  visitorId
);


// ------------------------------------------------------------
// REGISTER OR RESTORE THE VISITOR
// ------------------------------------------------------------

async function registerVisitor() {
  const page = getPageInformation();
  const location = await getLocationInformation();

  try {
    const existingVisitor = await getDoc(visitorReference);

    if (existingVisitor.exists()) {
      await updateDoc(visitorReference, {
        online: true,
        pageName: page.pageName,
        pagePath: page.pagePath,
        pageTitle: page.pageTitle,
        pageUrl: page.pageUrl,
        lastSeen: serverTimestamp(),
        country: location.country,
        countryCode: location.countryCode,
        region: location.region,
        city: location.city,
        continent: location.continent,
        isListening: listeningState.isListening,
        trackTitle: listeningState.trackTitle
      });
    } else {
      await setDoc(visitorReference, {
        visitorId,
        online: true,
        pageName: page.pageName,
        pagePath: page.pagePath,
        pageTitle: page.pageTitle,
        pageUrl: page.pageUrl,
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
        userAgent: navigator.userAgent,
        language: navigator.language || "Unknown",
        screenWidth: Number.isInteger(window.screen?.width)
          ? window.screen.width
          : 0,
        screenHeight: Number.isInteger(window.screen?.height)
          ? window.screen.height
          : 0,
        country: location.country,
        countryCode: location.countryCode,
        region: location.region,
        city: location.city,
        continent: location.continent,
        isListening: listeningState.isListening,
        trackTitle: listeningState.trackTitle
      });
    }

    console.log(
      `%cAWAKENED BY YAH LIVE TRACKER CONNECTED — ${location.country}`,
      "color:#fbbf24;font-weight:bold;"
    );
  } catch (error) {
    console.error("Live tracker registration failed:", error);
  }
}


// ------------------------------------------------------------
// HEARTBEAT
// Keeps the visitor active while the page remains open.
// ------------------------------------------------------------

async function sendHeartbeat() {
  const page = getPageInformation();

  try {
    await updateDoc(visitorReference, {
      online: true,
      pageName: page.pageName,
      pagePath: page.pagePath,
      pageTitle: page.pageTitle,
      pageUrl: page.pageUrl,
      lastSeen: serverTimestamp(),
      isListening: listeningState.isListening,
      trackTitle: listeningState.trackTitle
    });
  } catch (error) {
    await registerVisitor();
  }
}


// ------------------------------------------------------------
// MARK VISITOR OFFLINE
// ------------------------------------------------------------

async function markVisitorOffline() {
  try {
    listeningState = {
      isListening: false,
      trackTitle: ""
    };

    await updateDoc(visitorReference, {
      online: false,
      lastSeen: serverTimestamp(),
      isListening: false,
      trackTitle: ""
    });
  } catch (error) {
    console.warn("Could not mark visitor offline:", error);
  }
}


// ------------------------------------------------------------
// LIVE SONG ACTIVITY
// Tracks every HTML audio player on the page.
// ------------------------------------------------------------

function getAudioTrackTitle(audioElement) {
  const directTitle = String(
    audioElement.dataset.trackTitle ||
    audioElement.getAttribute("data-title") ||
    ""
  ).trim();

  if (directTitle) {
    return directTitle;
  }

  if (audioElement.id === "audio-player") {
    const nowPlayingTitle =
      document.getElementById("now-playing-title");

    const playlistTitle =
      String(nowPlayingTitle?.textContent || "").trim();

    if (playlistTitle) {
      return playlistTitle;
    }
  }

  const nearbyTitle = audioElement
    .closest("section, article, div")
    ?.querySelector(
      "[data-track-title], .track-title, .release-title, .featured-release h2, h1, h2, h3"
    );

  const nearbyText = String(
    nearbyTitle?.dataset?.trackTitle ||
    nearbyTitle?.textContent ||
    ""
  ).trim();

  return nearbyText || "Unknown Track";
}

async function updateListeningActivity(
  isListening,
  trackTitle = ""
) {
  listeningState = {
    isListening: Boolean(isListening),
    trackTitle: isListening
      ? String(trackTitle || "Unknown Track").trim()
      : ""
  };

  try {
    await updateDoc(visitorReference, {
      online: true,
      lastSeen: serverTimestamp(),
      isListening: listeningState.isListening,
      trackTitle: listeningState.trackTitle
    });
  } catch (error) {
    await registerVisitor();
  }
}

function bindAudioPlayer(audioElement) {
  if (!(audioElement instanceof HTMLAudioElement)) {
    return;
  }

  if (audioElement.dataset.abyListeningBound === "true") {
    return;
  }

  audioElement.dataset.abyListeningBound = "true";

  audioElement.addEventListener("play", () => {
    const trackTitle = getAudioTrackTitle(audioElement);

    updateListeningActivity(true, trackTitle);
  });

  audioElement.addEventListener("pause", () => {
    if (!audioElement.ended) {
      updateListeningActivity(false);
    }
  });

  audioElement.addEventListener("ended", () => {
    updateListeningActivity(false);
  });

  audioElement.addEventListener("emptied", () => {
    updateListeningActivity(false);
  });
}

function bindAllAudioPlayers() {
  document
    .querySelectorAll("audio")
    .forEach(bindAudioPlayer);
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    bindAllAudioPlayers
  );
} else {
  bindAllAudioPlayers();
}

const audioObserver = new MutationObserver(() => {
  bindAllAudioPlayers();
});

audioObserver.observe(document.documentElement, {
  childList: true,
  subtree: true
});


// ------------------------------------------------------------
// PAGE VISIBILITY
// ------------------------------------------------------------

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    sendHeartbeat();
  } else {
    markVisitorOffline();
  }
});


// ------------------------------------------------------------
// PAGE EXIT
// ------------------------------------------------------------

window.addEventListener("pagehide", () => {
  markVisitorOffline();
});


// ------------------------------------------------------------
// START TRACKING
// ------------------------------------------------------------

registerVisitor();

const heartbeatTimer = window.setInterval(
  sendHeartbeat,
  HEARTBEAT_INTERVAL
);


// ------------------------------------------------------------
// EXPOSE LIMITED TESTING CONTROLS
// ------------------------------------------------------------

window.ABYLiveTracker = {
  visitorId,
  sendHeartbeat,
  markVisitorOffline,
  updateListeningActivity,

  refreshLocation() {
    sessionStorage.removeItem(LOCATION_STORAGE_KEY);
    return registerVisitor();
  },

  stopHeartbeat() {
    window.clearInterval(heartbeatTimer);
  }
};
