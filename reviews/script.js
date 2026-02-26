const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxeIYnJg8AJ9u1pgyCMoZ9z38xVemW_h03X_bQsiHvN754xhdgyJIJfIACH1aPPa8R/exec";

// Track list (key = what the API stores/returns, name = what you display)
const TRACKS = [
  { key: "HIDDEN_WITH_YOU", name: "Hidden With You" },
  { key: "THINK_ABOUT_ME", name: "Think About Me" },
  { key: "NOT_MY_WILL", name: "Not My Will" },
  { key: "THE_SECRET_PLACE", name: "The Secret Place" },
  { key: "TEN_TOES_DOWN", name: "Ten Toes Down" },
  { key: "SOUND_THE_SHUPAR", name: "Sound The Shupar" },
  { key: "SHOW_ME_YOUR_HEART", name: "Show Me Your Heart" },
  { key: "WE_RISE", name: "We Rise" },
  { key: "UNBROKEN_FREQUENCY_REMIX", name: "Unbroken Frequency Remix" },
  { key: "THE_LOVE_I_HAVE_IN_YAHUAH", name: "The Love I Have In YAHUAH" }
];

const $ = (id) => document.getElementById(id);

function starString(avg) {
  const filled = Math.round(avg);
  return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(0, 5 - filled);
}

// Build the 10 cards so the page is never blank
function buildEmptyCards() {
  const grid = $("tracksGrid");
  if (!grid) return;

  grid.innerHTML = "";

  TRACKS.forEach(t => {
    grid.insertAdjacentHTML("beforeend", `
      <div class="trackCard" data-track="${t.key}">
        <div class="trackName">${t.name}</div>

        <div class="starsRow">
          <div class="stars" id="stars-${t.key}">☆☆☆☆☆</div>
          <div class="meta" id="count-${t.key}">0.0 ★ (0 ratings)</div>
        </div>

        <div class="quote" id="quote-${t.key}">No ratings yet — be the first to rate this track.</div>
      </div>
    `);
  });
}

async function loadRatings() {
  const statusEl = $("status");

  try {
    if (statusEl) statusEl.textContent = "Loading ratings…";

    const res = await fetch(SCRIPT_URL, { cache: "no-store" });
    const data = await res.json(); // expected: { KEY: {average, count}, ... }

    let totalRatings = 0;

    TRACKS.forEach(t => {
      const entry = data[t.key] || { average: 0, count: 0 };
      const avg = Number(entry.average || 0);
      const count = Number(entry.count || 0);

      totalRatings += count;

      const starsEl = $(`stars-${t.key}`);
      const countEl = $(`count-${t.key}`);

      if (starsEl) starsEl.textContent = starString(avg);
      if (countEl) countEl.textContent = `${avg.toFixed(1)} ★ (${count} ratings)`;
    });

    if (statusEl) {
      statusEl.textContent = totalRatings > 0
        ? `Loaded ${totalRatings} ratings.`
        : "Ready — no ratings yet.";
    }

  } catch (err) {
    console.error("Ratings load error:", err);
    if (statusEl) statusEl.textContent = "Could not load ratings.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Build cards first
  buildEmptyCards();
  // Then load ratings
  loadRatings();
});
