const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxeIYnJg8AJ9u1pgyCMoZ9z38xVemW_h03X_bQsiHvN754xhdgyJIJfIACH1aPPa8R/exec";

/* LOAD RATINGS */
async function loadRatings() {
  try {
    const response = await fetch(SCRIPT_URL);
    const data = await response.json();

    Object.keys(data).forEach(track => {
      const avg = Number(data[track].average || 0);
      const count = Number(data[track].count || 0);

      renderStars(track, avg);

      const countEl = document.getElementById(`count-${track}`);
      if (countEl) {
        countEl.textContent = `${avg.toFixed(1)} ★ (${count} ratings)`;
      }
    });

  } catch (error) {
    console.error("Ratings load error:", error);
  }
}

/* DISPLAY STARS */
function renderStars(track, rating) {
  const container = document.getElementById(`stars-${track}`);
  if (!container) return;

  container.innerHTML = "";

  const rounded = Math.round(rating);

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.textContent = i <= rounded ? "★" : "☆";
    star.style.fontSize = "22px";
    star.style.color = "#FFD700";
    star.style.marginRight = "3px";
    container.appendChild(star);
  }
}

/* SUBMIT RATING */
async function rateTrack(track, rating) {
  try {
    await fetch(`${SCRIPT_URL}?track=${encodeURIComponent(track)}&rating=${rating}`);
    await loadRatings();
  } catch (error) {
    console.error("Rating submit error:", error);
  }
}

/* AUTO LOAD */
window.addEventListener("DOMContentLoaded", loadRatings);
