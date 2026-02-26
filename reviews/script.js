const API_URL = "https://script.google.com/macros/s/AKfycbz4i8uQxxHKfcv33EAwvr1YC9vJem4o4tEv5ePDFGxGY1PdZIwUzMMV_aQtBqxK3Pr0/exec";

const TRACKS = [
  "Hidden With You",
  "Think About Me",
  "Not My Will",
  "The Secret Place",
  "Ten Toes Down",
  "Sound The Shupar"
];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("tracksGrid");
  const status = document.getElementById("status");

  if (!grid) return;

  // Build track cards first
  TRACKS.forEach(track => {
    const key = normalizeKey(track);

    const card = document.createElement("div");
    card.className = "trackCard";
    card.setAttribute("data-track", key);

    card.innerHTML = `
      <div class="trackName">${track}</div>
      <div class="starsRow">
        <div class="stars">★★★★★</div>
        <div class="meta">
          <span class="rating-average">0.0 ★</span> • 
          <span class="rating-count">(0 RATINGS)</span>
        </div>
      </div>
      <div class="quote latest-review">
        No ratings yet — be the first to rate this track.
      </div>
    `;

    grid.appendChild(card);
  });

  // Now fetch ratings
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      if (!data) {
        status.textContent = "No ratings yet.";
        return;
      }

      Object.keys(data).forEach(trackKey => {
        const trackData = data[trackKey];
        const card = document.querySelector(`[data-track="${trackKey}"]`);
        if (!card) return;

        const avgEl = card.querySelector(".rating-average");
        const countEl = card.querySelector(".rating-count");
        const reviewEl = card.querySelector(".latest-review");

        if (avgEl)
          avgEl.textContent = `${trackData.average.toFixed(1)} ★`;

        if (countEl)
          countEl.textContent =
            `(${trackData.count} RATING${trackData.count > 1 ? "S" : ""})`;

        if (reviewEl && trackData.latestComment) {
          reviewEl.innerHTML = `
            "${trackData.latestComment}"
            <small>${trackData.latestName}</small>
          `;
        }
      });

      status.textContent = "";
    })
    .catch(() => {
      status.textContent = "Unable to load ratings.";
    });
});
