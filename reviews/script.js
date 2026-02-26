const API_URL = "https://script.google.com/macros/s/AKfycbz4i8uQxxHKfcv33EAwvr1YC9vJem4o4tEv5ePDFGxGY1PdZIwUzMMV_aQtBqxK3Pr0/exec";

document.addEventListener("DOMContentLoaded", () => {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      if (!data) return;

      Object.keys(data).forEach(trackKey => {
        const trackData = data[trackKey];

        const card = document.querySelector(
          `[data-track="${trackKey}"]`
        );

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
          reviewEl.textContent =
            `"${trackData.latestComment}" — ${trackData.latestName}`;
        }
      });
    })
    .catch(err => {
      console.error("Ratings API error:", err);
    });
});
