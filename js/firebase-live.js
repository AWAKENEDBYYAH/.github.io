// ============================================================
// AWAKENED BY YAH MUSIC — FIREBASE LIVE TRACKER
// Version 2: Visitor presence, heartbeat, and offline tracking
// ============================================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  doc,
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
// VISITOR DOCUMENT
// ------------------------------------------------------------

const visitorId = getVisitorId();
const visitorReference = doc(database, "liveVisitors", visitorId);


// ------------------------------------------------------------
// REGISTER THE VISITOR
// ------------------------------------------------------------

async function registerVisitor() {
  const page = getPageInformation();

  try {
    await setDoc(
      visitorReference,
      {
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
        screenWidth: window.screen?.width || null,
        screenHeight: window.screen?.height || null
      },
      { merge: true }
    );

    console.log(
      "%cAWAKENED BY YAH LIVE TRACKER CONNECTED",
      "color:#fbbf24;font-weight:bold;"
    );
  } catch (error) {
    console.error("Live tracker registration failed:", error);
  }
}


// ------------------------------------------------------------
// HEARTBEAT
// Keeps the visitor marked active while the page remains open.
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
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    // Recreate the document if it no longer exists.
    await registerVisitor();
  }
}


// ------------------------------------------------------------
// MARK VISITOR OFFLINE
// Browser exit events are not guaranteed, so stale visitor
// documents are also removed later by the dashboard cleanup.
// ------------------------------------------------------------

async function markVisitorOffline() {
  try {
    await updateDoc(visitorReference, {
      online: false,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.warn("Could not mark visitor offline:", error);
  }
}


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
  stopHeartbeat() {
    window.clearInterval(heartbeatTimer);
  }
};
