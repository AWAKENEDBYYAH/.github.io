// ============================================================
// AWAKENED BY YAH MUSIC — LIVE ACTIVITY INTERFACE
// Reads active visitors from Cloud Firestore and updates
// the elegant live dashboard in real time.
// ============================================================

import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ------------------------------------------------------------
// FIREBASE CONFIGURATION
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
// CONNECT TO THE EXISTING FIREBASE APP
// ------------------------------------------------------------

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const database = getFirestore(firebaseApp);


// ------------------------------------------------------------
// REMOVE VISITOR RECORDS INACTIVE FOR MORE THAN 10 MINUTES
// ------------------------------------------------------------

async function cleanupStaleVisitors() {
  try {
    // Use 11 minutes to give the Firestore security rule a safe buffer.
    const cutoffTime = Timestamp.fromMillis(Date.now() - 11 * 60 * 1000);

    const staleVisitorsQuery = query(
      collection(database, "liveVisitors"),
      where("lastSeen", "<", cutoffTime)
    );

    const staleVisitorsSnapshot = await getDocs(staleVisitorsQuery);

    if (staleVisitorsSnapshot.empty) {
      return;
    }

    await Promise.all(
      staleVisitorsSnapshot.docs.map((visitorDocument) =>
        deleteDoc(visitorDocument.ref)
      )
    );

    console.log(
      `Removed ${staleVisitorsSnapshot.size} stale visitor record(s).`
    );
  } catch (error) {
    console.error("Unable to clean up stale visitor records:", error);
  }
}

// ------------------------------------------------------------
// SETTINGS
// A visitor is considered active when the heartbeat is no more
// than 90 seconds old.
// ------------------------------------------------------------

const ACTIVE_WINDOW_MS = 90 * 1000;
const REFRESH_INTERVAL_MS = 15 * 1000;

let latestVisitors = [];


// ------------------------------------------------------------
// FIND THE EXISTING LIVE TRACKER ELEMENTS
// ------------------------------------------------------------

const liveWrap = document.getElementById("liveWrap");
const liveBadge = document.getElementById("liveBadge");
const livePanel = document.getElementById("livePanel");

if (!liveWrap || !liveBadge || !livePanel) {
  console.warn(
    "AWAKENED BY YAH live interface could not find liveWrap, liveBadge, or livePanel."
  );
} else {
  initializeLiveInterface();
}


// ------------------------------------------------------------
// BUILD THE DASHBOARD
// ------------------------------------------------------------

function initializeLiveInterface() {
  liveBadge.setAttribute("role", "button");
  liveBadge.setAttribute("tabindex", "0");
  liveBadge.setAttribute("aria-expanded", "false");
  liveBadge.setAttribute("aria-controls", "livePanel");

  livePanel.setAttribute("aria-hidden", "true");

  livePanel.innerHTML = `
    <div class="aby-live-shell">

      <header class="aby-live-header">
        <div>
          <div class="aby-live-eyebrow">
            <span>Live Activity</span>
          </div>

          <h2 class="aby-live-title">
            The Nations Are Awakening
          </h2>

          <p class="aby-live-subtitle">
            Real-time activity across AWAKENED BY YAH MUSIC
          </p>
        </div>

        <button
          id="livePanelClose"
          type="button"
          aria-label="Close live activity panel"
        >
          ✕
        </button>
      </header>

      <section class="aby-live-metrics">

        <article class="aby-live-card">
          <div class="aby-live-card-label">
            Visitors Online
          </div>

          <div
            class="aby-live-number"
            id="abyLiveOnlineCount"
          >
            0
          </div>

          <div class="aby-live-card-note">
            Active across the site
          </div>
        </article>

        <article class="aby-live-card">
          <div class="aby-live-card-label">
            Digital Store
          </div>

          <div
            class="aby-live-number"
            id="abyLiveStoreCount"
          >
            0
          </div>

          <div class="aby-live-card-note">
            Browsing the store
          </div>
        </article>

      </section>

      <section class="aby-live-wide-card">
        <div class="aby-live-wide-label">
          Now Hearing
        </div>

        <div
          class="aby-live-track"
          id="abyNowListeningTrack"
        >
          Waiting for the next listener
        </div>

        <div
          class="aby-live-muted"
          id="abyNowListeningCount"
        >
          Song activity will appear here
        </div>
      </section>

      <section class="aby-live-wide-card">
        <div class="aby-live-wide-label">
          Active Across the Site
        </div>

        <div id="livePages">
          <div class="aby-live-page-row">
            <span class="aby-live-page-name">
              Waiting for live activity...
            </span>

            <span class="aby-live-page-count">
              0
            </span>
          </div>
        </div>
      </section>

      <footer class="aby-live-footer">
        Activity updates automatically in real time
      </footer>

    </div>
  `;

  bindInterfaceControls();
  beginFirestoreListener();

  window.setInterval(() => {
    renderVisitors(latestVisitors);
  }, REFRESH_INTERVAL_MS);
}


// ------------------------------------------------------------
// OPEN AND CLOSE CONTROLS
// ------------------------------------------------------------

function bindInterfaceControls() {
  const closeButton = document.getElementById("livePanelClose");

  function openPanel() {
    livePanel.classList.add("is-open");
    livePanel.setAttribute("aria-hidden", "false");
    liveBadge.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    livePanel.classList.remove("is-open");
    livePanel.setAttribute("aria-hidden", "true");
    liveBadge.setAttribute("aria-expanded", "false");
  }

  function togglePanel() {
    if (livePanel.classList.contains("is-open")) {
      closePanel();
    } else {
      openPanel();
    }
  }

  liveBadge.addEventListener("click", togglePanel);

  liveBadge.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePanel();
    }
  });

  closeButton?.addEventListener("click", event => {
    event.stopPropagation();
    closePanel();
  });

  document.addEventListener("click", event => {
    if (
      livePanel.classList.contains("is-open") &&
      !liveWrap.contains(event.target)
    ) {
      closePanel();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closePanel();
    }
  });
}


// ------------------------------------------------------------
// LISTEN TO FIRESTORE IN REAL TIME
// ------------------------------------------------------------

function beginFirestoreListener() {
  const visitorsCollection = collection(database, "liveVisitors");

  onSnapshot(
    visitorsCollection,
    snapshot => {
      latestVisitors = snapshot.docs.map(visitorDocument => ({
        id: visitorDocument.id,
        ...visitorDocument.data()
      }));

      renderVisitors(latestVisitors);
    },
    error => {
      console.error("Live interface Firestore error:", error);

      updateBadge(0);

      const livePages = document.getElementById("livePages");

      if (livePages) {
        livePages.innerHTML = `
          <div class="aby-live-page-row">
            <span class="aby-live-page-name">
              Live activity temporarily unavailable
            </span>

            <span class="aby-live-page-count">
              —
            </span>
          </div>
        `;
      }
    }
  );
}


// ------------------------------------------------------------
// DETERMINE WHETHER A VISITOR IS STILL ACTIVE
// ------------------------------------------------------------

function isVisitorActive(visitor) {
  if (visitor.online !== true || !visitor.lastSeen) {
    return false;
  }

  const lastSeenDate =
    typeof visitor.lastSeen.toDate === "function"
      ? visitor.lastSeen.toDate()
      : new Date(visitor.lastSeen);

  if (Number.isNaN(lastSeenDate.getTime())) {
    return false;
  }

  return Date.now() - lastSeenDate.getTime() <= ACTIVE_WINDOW_MS;
}


// ------------------------------------------------------------
// RENDER ALL CURRENT ACTIVITY
// ------------------------------------------------------------

function renderVisitors(visitors) {
  const activeVisitors = visitors.filter(isVisitorActive);

  const onlineCount = activeVisitors.length;

  const storeCount = activeVisitors.filter(visitor => {
    const pageName = String(visitor.pageName || "").toLowerCase();
    const pagePath = String(visitor.pagePath || "").toLowerCase();

    return (
      pageName.includes("store") ||
      pagePath.includes("/store") ||
      pagePath.includes("payhip")
    );
  }).length;

  const pageCounts = countActivePages(activeVisitors);

  animateNumber("abyLiveOnlineCount", onlineCount);
  animateNumber("abyLiveStoreCount", storeCount);

  updateBadge(onlineCount);
  renderPageRows(pageCounts);
}


// ------------------------------------------------------------
// COUNT ACTIVE VISITORS BY PAGE
// ------------------------------------------------------------

function countActivePages(activeVisitors) {
  const pageMap = new Map();

  activeVisitors.forEach(visitor => {
    const pageName =
      String(visitor.pageName || "").trim() || "Unknown Page";

    pageMap.set(pageName, (pageMap.get(pageName) || 0) + 1);
  });

  return [...pageMap.entries()]
    .map(([pageName, count]) => ({
      pageName,
      count
    }))
    .sort((first, second) => {
      if (second.count !== first.count) {
        return second.count - first.count;
      }

      return first.pageName.localeCompare(second.pageName);
    });
}


// ------------------------------------------------------------
// UPDATE THE LIVE BADGE
// ------------------------------------------------------------

function updateBadge(onlineCount) {
  const visitorWord = onlineCount === 1 ? "Visitor" : "Visitors";

  liveBadge.textContent =
    `Live Activity · ${onlineCount} ${visitorWord} Online`;
}


// ------------------------------------------------------------
// RENDER ACTIVE PAGE ROWS
// ------------------------------------------------------------

function renderPageRows(pageCounts) {
  const livePages = document.getElementById("livePages");

  if (!livePages) {
    return;
  }

  if (pageCounts.length === 0) {
    livePages.innerHTML = `
      <div class="aby-live-page-row">
        <span class="aby-live-page-name">
          No active pages right now
        </span>

        <span class="aby-live-page-count">
          0
        </span>
      </div>
    `;

    return;
  }

  livePages.innerHTML = pageCounts
    .slice(0, 6)
    .map(page => `
      <div class="aby-live-page-row">
        <span class="aby-live-page-name">
          ${escapeHtml(page.pageName)}
        </span>

        <span class="aby-live-page-count">
          ${page.count}
        </span>
      </div>
    `)
    .join("");
}


// ------------------------------------------------------------
// SMOOTH NUMBER ANIMATION
// ------------------------------------------------------------

function animateNumber(elementId, newValue) {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  const currentValue =
    Number.parseInt(element.textContent, 10) || 0;

  if (currentValue === newValue) {
    return;
  }

  const difference = newValue - currentValue;
  const duration = 350;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easedProgress =
      1 - Math.pow(1 - progress, 3);

    const displayedValue = Math.round(
      currentValue + difference * easedProgress
    );

    element.textContent = String(displayedValue);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}


// ------------------------------------------------------------
// PROTECT INTERFACE OUTPUT
// ------------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Run stale-visitor cleanup when the dashboard loads.
cleanupStaleVisitors();

// Run cleanup again every 5 minutes while the dashboard remains open.
setInterval(cleanupStaleVisitors, 5 * 60 * 1000);
