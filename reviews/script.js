/**
 * AWAKENED BY YAH MUSIC
 * Firestore Ratings & Reviews System
 */

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   CONFIGURATION
========================================================= */

const SETTINGS = {
  reviewsCollection: "reviews",
  votesCollection: "reviewVotes",
  reviewsPerPage: 12,
  newReviewDays: 14,
  minimumReviewLength: 20,
  maximumReviewLength: 2000,
  maximumNameLength: 70,
  maximumTitleLength: 120,
  ambientStorageKey: "aby_reviews_ambient_enabled",
  visitorStorageKey: "aby_reviews_visitor_id"
};


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

const firebaseConfig = window.REVIEWS_FIREBASE_CONFIG;

if (
  !firebaseConfig ||
  !firebaseConfig.apiKey ||
  !firebaseConfig.projectId
) {
  console.error(
    "The Firebase configuration is missing from reviews/index.html."
  );

  document.addEventListener("DOMContentLoaded", () => {
    const loading = document.getElementById("reviewsLoading");
    const error = document.getElementById("reviewsError");

    if (loading) {
      loading.hidden = true;
    }

    if (error) {
      error.hidden = false;
      error.textContent =
        "The Reviews page could not connect because its Firebase configuration is missing.";
    }
  });

  throw new Error("Missing REVIEWS_FIREBASE_CONFIG");
}

const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const db = getFirestore(firebaseApp);


/* =========================================================
   PAGE STATE
========================================================= */

const state = {
  reviews: [],
  filteredReviews: [],
  visibleCount: SETTINGS.reviewsPerPage,
  searchText: "",
  ratingFilter: "all",
  releaseFilter: "all",
  sortFilter: "newest",
  loading: false
};

const elements = {};


/* =========================================================
   PAGE STARTUP
========================================================= */

document.addEventListener("DOMContentLoaded", initializeReviewsPage);

async function initializeReviewsPage() {
  cacheElements();
  connectPageControls();
  initializeCharacterCounter();
  initializeAmbientAudio();
  await loadApprovedReviews();
}


/* =========================================================
   ELEMENT REFERENCES
========================================================= */

function cacheElements() {
  const elementIds = [
    "reviewsGrid",
    "reviewsLoading",
    "reviewsEmpty",
    "reviewsError",
    "loadMoreReviews",

    "reviewSearch",
    "ratingFilter",
    "releaseFilter",
    "sortFilter",

    "reviewForm",
    "reviewerName",
    "reviewerEmail",
    "reviewRelease",
    "reviewReleaseType",
    "reviewRating",
    "reviewTitle",
    "reviewText",
    "reviewConsent",
    "reviewSubmit",
    "reviewFormMessage",
    "reviewCharacterCount",

    "statFiveStarReviews",
    "statHelpfulVotes",

    "featuredReviews",
    "reviewOfMonth",

    "ambientToggle",
    "ambientAudio"
  ];

  elementIds.forEach(id => {
    elements[id] = document.getElementById(id);
  });
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function connectPageControls() {
  elements.reviewSearch?.addEventListener(
    "input",
    debounce(event => {
      state.searchText = event.target.value
        .trim()
        .toLowerCase();

      resetFiltersAndRender();
    }, 180)
  );

  elements.ratingFilter?.addEventListener("change", event => {
    state.ratingFilter = event.target.value;
    resetFiltersAndRender();
  });

  elements.releaseFilter?.addEventListener("change", event => {
    state.releaseFilter = event.target.value;
    resetFiltersAndRender();
  });

  elements.sortFilter?.addEventListener("change", event => {
    state.sortFilter = event.target.value;
    resetFiltersAndRender();
  });

  elements.loadMoreReviews?.addEventListener("click", () => {
    state.visibleCount += SETTINGS.reviewsPerPage;
    renderAllReviews();
  });

  elements.reviewForm?.addEventListener(
    "submit",
    submitReview
  );

  elements.reviewText?.addEventListener(
    "input",
    updateCharacterCounter
  );

  elements.ambientToggle?.addEventListener(
    "click",
    toggleAmbientAudio
  );

  elements.ambientAudio?.addEventListener("error", () => {
    console.error(
      "Ambient audio could not load:",
      elements.ambientAudio.currentSrc
    );

    updateAmbientButton(false);

    if (elements.ambientToggle) {
      elements.ambientToggle.title =
        "The ambient audio file could not be loaded.";
    }
  });

  elements.ambientAudio?.addEventListener("ended", () => {
    updateAmbientButton(false);
  });
}


/* =========================================================
   LOAD APPROVED REVIEWS
========================================================= */

async function loadApprovedReviews() {
  setLoadingState(true);
  showReviewError("");

  try {
    const reviewsReference = collection(
      db,
      SETTINGS.reviewsCollection
    );

    let snapshot;

    try {
      const orderedReviewsQuery = query(
        reviewsReference,
        where("status", "==", "approved"),
        orderBy("approvedAt", "desc")
      );

      snapshot = await getDocs(orderedReviewsQuery);
    } catch (indexError) {
      console.warn(
        "The approvedAt index is unavailable. Loading approved reviews without server-side ordering.",
        indexError
      );

      const fallbackQuery = query(
        reviewsReference,
        where("status", "==", "approved")
      );

      snapshot = await getDocs(fallbackQuery);
    }

    state.reviews = snapshot.docs
      .map(snapshotDocument => {
        return normalizeReview(
          snapshotDocument.id,
          snapshotDocument.data()
        );
      })
      .sort((reviewA, reviewB) => {
        return reviewB.sortDate - reviewA.sortDate;
      });

    populateReleaseFilter();
    renderStatistics();
    renderFeaturedReviews();
    renderReviewOfMonth();
    applyReviewFilters();
  } catch (error) {
    console.error("Unable to load approved reviews:", error);

    state.reviews = [];
    state.filteredReviews = [];

    renderStatistics();
    renderAllReviews();

    showReviewError(
      "Reviews could not be loaded. Please refresh the page and try again."
    );
  } finally {
    setLoadingState(false);
  }
}


/* =========================================================
   NORMALIZE REVIEW DATA
========================================================= */

function normalizeReview(reviewId, reviewData) {
  const createdDate = timestampToDate(
    reviewData.createdAt
  );

  const approvedDate = timestampToDate(
    reviewData.approvedAt
  );

  const sortDate =
    approvedDate ||
    createdDate ||
    new Date(0);

  return {
    id: reviewId,

    reviewerName:
      cleanText(reviewData.reviewerName) ||
      "AWAKENED BY YAH listener",

    releaseTitle:
      cleanText(reviewData.releaseTitle) ||
      "AWAKENED BY YAH MUSIC",

    releaseType:
      cleanText(reviewData.releaseType),

    rating:
      clampNumber(reviewData.rating, 1, 5, 5),

    reviewTitle:
      cleanText(reviewData.reviewTitle),

    reviewText:
      cleanText(reviewData.reviewText),

    verified:
      Boolean(reviewData.verified),

    featured:
      Boolean(reviewData.featured),

    reviewOfMonth:
      Boolean(reviewData.reviewOfMonth),

    artistResponse:
      cleanText(reviewData.artistResponse),

    artistRespondedAt:
      timestampToDate(
        reviewData.artistRespondedAt ||
        reviewData.artistResponseUpdatedAt
      ),

    helpfulCount:
      Math.max(
        0,
        Number(reviewData.helpfulCount) || 0
      ),

    createdDate,
    approvedDate,
    sortDate,

    isNew:
      isDateRecent(
        sortDate,
        SETTINGS.newReviewDays
      )
  };
}


/* =========================================================
   SEARCH, FILTERS, AND SORTING
========================================================= */

function applyReviewFilters() {
  const searchTerms = state.searchText
    .split(/\s+/)
    .filter(Boolean);

  state.filteredReviews = state.reviews.filter(review => {
    const searchableText = [
      review.reviewerName,
      review.releaseTitle,
      review.releaseType,
      review.reviewTitle,
      review.reviewText,
      review.artistResponse
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      searchTerms.length === 0 ||
      searchTerms.every(term => {
        return searchableText.includes(term);
      });

    const matchesRating =
      state.ratingFilter === "all" ||
      review.rating === Number(state.ratingFilter);

    const matchesRelease =
      state.releaseFilter === "all" ||
      review.releaseTitle === state.releaseFilter;

    return (
      matchesSearch &&
      matchesRating &&
      matchesRelease
    );
  });

  state.filteredReviews.sort(
    getReviewSortFunction(state.sortFilter)
  );

  renderAllReviews();
}

function getReviewSortFunction(sortOption) {
  switch (sortOption) {
    case "oldest":
      return (reviewA, reviewB) => {
        return reviewA.sortDate - reviewB.sortDate;
      };

    case "highest":
      return (reviewA, reviewB) => {
        return (
          reviewB.rating - reviewA.rating ||
          reviewB.helpfulCount - reviewA.helpfulCount ||
          reviewB.sortDate - reviewA.sortDate
        );
      };

    case "helpful":
      return (reviewA, reviewB) => {
        return (
          reviewB.helpfulCount - reviewA.helpfulCount ||
          reviewB.rating - reviewA.rating ||
          reviewB.sortDate - reviewA.sortDate
        );
      };

    case "newest":
    default:
      return (reviewA, reviewB) => {
        return reviewB.sortDate - reviewA.sortDate;
      };
  }
}

function resetFiltersAndRender() {
  state.visibleCount = SETTINGS.reviewsPerPage;
  applyReviewFilters();
}


/* =========================================================
   RENDER ALL REVIEWS
========================================================= */

function renderAllReviews() {
  if (!elements.reviewsGrid) {
    return;
  }

  const visibleReviews =
    state.filteredReviews.slice(
      0,
      state.visibleCount
    );

  elements.reviewsGrid.innerHTML = "";

  visibleReviews.forEach(review => {
    elements.reviewsGrid.appendChild(
      createReviewCard(review)
    );
  });

  const noReviewsFound =
    state.filteredReviews.length === 0;

  if (elements.reviewsEmpty) {
    elements.reviewsEmpty.hidden =
      !noReviewsFound;
  }

  if (elements.loadMoreReviews) {
    const moreReviewsAvailable =
      state.visibleCount <
      state.filteredReviews.length;

    elements.loadMoreReviews.hidden =
      !moreReviewsAvailable;

    elements.loadMoreReviews.disabled =
      !moreReviewsAvailable;
  }
}


/* =========================================================
   CREATE REVIEW CARD
========================================================= */

function createReviewCard(review, options = {}) {
  const card = document.createElement("article");

  card.className = [
    "review-card",
    review.featured
      ? "is-featured"
      : "",
    review.reviewOfMonth
      ? "is-review-of-month"
      : "",
    options.compact
      ? "review-card--compact"
      : ""
  ]
    .filter(Boolean)
    .join(" ");

  card.dataset.reviewId = review.id;

  const badges = [];

  if (review.verified) {
    badges.push(
      `<span class="review-badge review-badge--verified">Verified Listener</span>`
    );
  }

  if (review.featured) {
    badges.push(
      `<span class="review-badge review-badge--featured">Featured</span>`
    );
  }

  if (review.isNew) {
    badges.push(
      `<span class="review-badge review-badge--new">New</span>`
    );
  }

  const artistResponseMarkup =
    review.artistResponse
      ? `
        <section
          class="artist-response"
          aria-label="Official response from AWAKENED BY YAH MUSIC GROUP"
        >
          <div class="artist-response__official">
            Official Response
          </div>

          <div class="artist-response__company">
            AWAKENED BY YAH MUSIC GROUP
          </div>

          <div
            class="artist-response__divider"
            aria-hidden="true"
          ></div>

          <p class="artist-response__text">
            ${escapeHtml(review.artistResponse)}
          </p>

          ${
            review.artistRespondedAt
              ? `
                <div class="artist-response__date">
                  Responded:
                  ${formatDate(review.artistRespondedAt)}
                </div>
              `
              : ""
          }
        </section>
      `
      : "";

  card.innerHTML = `
    <header class="review-card__header">
      <div>
        <div
          class="review-stars"
          aria-label="${review.rating} out of 5 stars"
        >
          ${renderStars(review.rating)}
        </div>

        <h3 class="review-card__title">
          ${escapeHtml(
            review.reviewTitle ||
            review.releaseTitle
          )}
        </h3>
      </div>

      <div class="review-card__badges">
        ${badges.join("")}
      </div>
    </header>

    <p class="review-card__text">
      ${formatReviewText(review.reviewText)}
    </p>

    <div class="review-card__release">
      Reviewed release:
      <strong>
        ${escapeHtml(review.releaseTitle)}
      </strong>

      ${
        review.releaseType
          ? `<span> · ${escapeHtml(review.releaseType)}</span>`
          : ""
      }
    </div>

    ${artistResponseMarkup}

    <footer class="review-card__footer">
      <div class="review-card__author">
        <strong>
          ${escapeHtml(review.reviewerName)}
        </strong>

        <span>
          ${formatDate(review.sortDate)}
        </span>
      </div>

      <button
        class="helpful-button"
        type="button"
        data-helpful-review="${escapeAttribute(review.id)}"
        aria-label="Mark this review as helpful"
      >
        Helpful
        <span data-helpful-count>
          ${review.helpfulCount}
        </span>
      </button>
    </footer>
  `;

  const helpfulButton =
    card.querySelector(
      "[data-helpful-review]"
    );

  if (helpfulButton) {
    const alreadyVoted =
      hasLocalHelpfulVote(review.id);

    helpfulButton.disabled = alreadyVoted;

    helpfulButton.classList.toggle(
      "is-voted",
      alreadyVoted
    );

    if (alreadyVoted) {
      setHelpfulButtonText(
        helpfulButton,
        review.helpfulCount,
        true
      );
    }

    helpfulButton.addEventListener(
      "click",
      () => {
        submitHelpfulVote(
          review,
          helpfulButton
        );
      }
    );
  }

  return card;
}


/* =========================================================
   HELPFUL VOTES
========================================================= */

async function submitHelpfulVote(review, button) {
  if (button.disabled) {
    return;
  }

  const visitorId = getVisitorId();

  const voteDocumentId =
    `${review.id}_${visitorId}`;

  const reviewReference = doc(
    db,
    SETTINGS.reviewsCollection,
    review.id
  );

  const voteReference = doc(
    db,
    SETTINGS.votesCollection,
    voteDocumentId
  );

  button.disabled = true;
  button.classList.add("is-saving");

  try {
    await runTransaction(
      db,
      async transaction => {
        const existingVote =
          await transaction.get(voteReference);

        if (existingVote.exists()) {
          throw new Error("ALREADY_VOTED");
        }

        transaction.set(
          voteReference,
          {
            reviewId: review.id,
            visitorId,
            createdAt: serverTimestamp()
          }
        );

        transaction.update(
          reviewReference,
          {
            helpfulCount: increment(1)
          }
        );
      }
    );

    review.helpfulCount += 1;

    rememberLocalHelpfulVote(review.id);

    button.classList.remove("is-saving");
    button.classList.add("is-voted");

    setHelpfulButtonText(
      button,
      review.helpfulCount,
      true
    );

    renderStatistics();
  } catch (error) {
    console.error(
      "Helpful vote could not be saved:",
      error
    );

    button.classList.remove("is-saving");

    if (error.message === "ALREADY_VOTED") {
      rememberLocalHelpfulVote(review.id);

      button.classList.add("is-voted");

      setHelpfulButtonText(
        button,
        review.helpfulCount,
        true
      );

      return;
    }

    button.disabled = false;

    showFormMessage(
      "The helpful vote could not be saved. Please try again.",
      "error"
    );
  }
}

function setHelpfulButtonText(
  button,
  count,
  voted
) {
  button.innerHTML = `
    ${voted ? "Helpful ✓" : "Helpful"}
    <span data-helpful-count>
      ${count}
    </span>
  `;
}


/* =========================================================
   REVIEW SUBMISSION
========================================================= */

async function submitReview(event) {
  event.preventDefault();

  if (!elements.reviewForm) {
    return;
  }

  const formData =
    new FormData(elements.reviewForm);

  const reviewSubmission = {
    reviewerName:
      readFormValue(
        formData,
        "reviewerName",
        elements.reviewerName
      ),

    reviewerEmail:
      readFormValue(
        formData,
        "reviewerEmail",
        elements.reviewerEmail
      ),

    releaseTitle:
      readFormValue(
        formData,
        "releaseTitle",
        elements.reviewRelease
      ),

    releaseType:
      readFormValue(
        formData,
        "releaseType",
        elements.reviewReleaseType
      ),

    rating:
      Number(
        readFormValue(
          formData,
          "rating",
          elements.reviewRating
        )
      ),

    reviewTitle:
      readFormValue(
        formData,
        "reviewTitle",
        elements.reviewTitle
      ),

    reviewText:
      readFormValue(
        formData,
        "reviewText",
        elements.reviewText
      ),

    consent:
      Boolean(
        formData.get("reviewConsent") ||
        formData.get("consent") ||
        elements.reviewConsent?.checked
      )
  };

  const validationMessage =
    validateReviewSubmission(
      reviewSubmission
    );

  if (validationMessage) {
    showFormMessage(
      validationMessage,
      "error"
    );

    return;
  }

  setSubmitButtonState(true);
  showFormMessage("", "");

  try {
    await addDoc(
      collection(
        db,
        SETTINGS.reviewsCollection
      ),
      {
        reviewerName:
          reviewSubmission.reviewerName,

        reviewerEmail:
          reviewSubmission.reviewerEmail,

        releaseTitle:
          reviewSubmission.releaseTitle,

        releaseType:
          reviewSubmission.releaseType,

        rating:
          reviewSubmission.rating,

        reviewTitle:
          reviewSubmission.reviewTitle,

        reviewText:
          reviewSubmission.reviewText,

        consent: true,

        status: "pending",

        verified: false,
        featured: false,
        reviewOfMonth: false,

        artistResponse: "",

        helpfulCount: 0,

        createdAt: serverTimestamp(),
        approvedAt: null,

        source: "website"
      }
    );

    elements.reviewForm.reset();

    updateCharacterCounter();

    showFormMessage(
      "Tudah! Your review was submitted successfully and is now awaiting approval.",
      "success"
    );
  } catch (error) {
    console.error(
      "Review submission failed:",
      error
    );

    showFormMessage(
      "Your review could not be submitted. Please check your connection and try again.",
      "error"
    );
  } finally {
    setSubmitButtonState(false);
  }
}


/* =========================================================
   FORM VALIDATION
========================================================= */

function validateReviewSubmission(review) {
  if (!review.reviewerName) {
    return "Please enter your name.";
  }

  if (
    review.reviewerName.length >
    SETTINGS.maximumNameLength
  ) {
    return `Your name must be ${SETTINGS.maximumNameLength} characters or fewer.`;
  }

  if (!review.releaseTitle) {
    return "Please choose the release you are reviewing.";
  }

  if (
    !Number.isInteger(review.rating) ||
    review.rating < 1 ||
    review.rating > 5
  ) {
    return "Please choose a rating from 1 to 5 stars.";
  }

  if (
    review.reviewTitle.length >
    SETTINGS.maximumTitleLength
  ) {
    return `The review title must be ${SETTINGS.maximumTitleLength} characters or fewer.`;
  }

  if (
    review.reviewText.length <
    SETTINGS.minimumReviewLength
  ) {
    return `Please write at least ${SETTINGS.minimumReviewLength} characters about your experience.`;
  }

  if (
    review.reviewText.length >
    SETTINGS.maximumReviewLength
  ) {
    return `Your review must be ${SETTINGS.maximumReviewLength} characters or fewer.`;
  }

  if (
    review.reviewerEmail &&
    !isValidEmail(review.reviewerEmail)
  ) {
    return "Please enter a valid email address or leave the email field blank.";
  }

  if (!review.consent) {
    return "Please confirm that your review may be published on the website.";
  }

  return "";
}


/* =========================================================
   STATISTICS
========================================================= */

function renderStatistics() {
  const totalReviews =
    state.reviews.length;

  const averageRating =
    totalReviews > 0
      ? state.reviews.reduce(
          (total, review) => {
            return total + review.rating;
          },
          0
        ) / totalReviews
      : 0;

  const fiveStarReviews =
    state.reviews.filter(review => {
      return review.rating === 5;
    }).length;

  const helpfulVotes =
    state.reviews.reduce(
      (total, review) => {
        return total + review.helpfulCount;
      },
      0
    );

  document
    .querySelectorAll(
      "[data-stat-total-reviews]"
    )
    .forEach(element => {
      element.textContent =
        totalReviews.toLocaleString();
    });

  document
    .querySelectorAll(
      "[data-stat-average-rating]"
    )
    .forEach(element => {
      element.textContent =
        totalReviews > 0
          ? averageRating.toFixed(1)
          : "0.0";
    });

  if (elements.statFiveStarReviews) {
    elements.statFiveStarReviews.textContent =
      fiveStarReviews.toLocaleString();
  }

  if (elements.statHelpfulVotes) {
    elements.statHelpfulVotes.textContent =
      helpfulVotes.toLocaleString();
  }
}


/* =========================================================
   FEATURED REVIEWS
========================================================= */

function renderFeaturedReviews() {
  if (!elements.featuredReviews) {
    return;
  }

  const featuredReviews =
    state.reviews
      .filter(review => review.featured)
      .sort((reviewA, reviewB) => {
        return reviewB.sortDate - reviewA.sortDate;
      })
      .slice(0, 3);

  elements.featuredReviews.innerHTML = "";

  featuredReviews.forEach(review => {
    elements.featuredReviews.appendChild(
      createReviewCard(
        review,
        { compact: true }
      )
    );
  });

  const featuredSection =
    elements.featuredReviews.closest("section");

  if (featuredSection) {
    featuredSection.hidden =
      featuredReviews.length === 0;
  }
}


/* =========================================================
   REVIEW OF THE MONTH
========================================================= */

function renderReviewOfMonth() {
  if (!elements.reviewOfMonth) {
    return;
  }

  const reviewOfMonth =
    state.reviews
      .filter(review => {
        return review.reviewOfMonth;
      })
      .sort((reviewA, reviewB) => {
        return reviewB.sortDate - reviewA.sortDate;
      })[0];

  elements.reviewOfMonth.innerHTML = "";

  if (reviewOfMonth) {
    elements.reviewOfMonth.appendChild(
      createReviewCard(reviewOfMonth)
    );
  }

  const reviewOfMonthSection =
    elements.reviewOfMonth.closest("section");

  if (reviewOfMonthSection) {
    reviewOfMonthSection.hidden =
      !reviewOfMonth;
  }
}


/* =========================================================
   RELEASE FILTER
========================================================= */

function populateReleaseFilter() {
  if (!elements.releaseFilter) {
    return;
  }

  const selectedRelease =
    elements.releaseFilter.value || "all";

  const releases = [
    ...new Set(
      state.reviews
        .map(review => review.releaseTitle)
        .filter(Boolean)
    )
  ].sort((releaseA, releaseB) => {
    return releaseA.localeCompare(releaseB);
  });

  elements.releaseFilter.innerHTML =
    `<option value="all">All releases</option>`;

  releases.forEach(release => {
    const option =
      document.createElement("option");

    option.value = release;
    option.textContent = release;

    elements.releaseFilter.appendChild(option);
  });

  elements.releaseFilter.value =
    releases.includes(selectedRelease)
      ? selectedRelease
      : "all";
}


/* =========================================================
   AMBIENT AUDIO
========================================================= */

function initializeAmbientAudio() {
  if (
    !elements.ambientAudio ||
    !elements.ambientToggle
  ) {
    return;
  }

  elements.ambientAudio.volume = 0.18;
  elements.ambientAudio.loop = true;

  updateAmbientButton(false);

  const audioWasEnabled =
    localStorage.getItem(
      SETTINGS.ambientStorageKey
    ) === "true";

  if (!audioWasEnabled) {
    return;
  }

  const resumeAudioAfterInteraction =
    async () => {
      try {
        await elements.ambientAudio.play();

        updateAmbientButton(true);
      } catch (error) {
        console.info(
          "The browser requires a direct click before audio can play.",
          error
        );
      }
    };

  document.addEventListener(
    "pointerdown",
    resumeAudioAfterInteraction,
    { once: true }
  );

  document.addEventListener(
    "keydown",
    resumeAudioAfterInteraction,
    { once: true }
  );
}

async function toggleAmbientAudio() {
  if (!elements.ambientAudio) {
    return;
  }

  try {
    if (elements.ambientAudio.paused) {
      await elements.ambientAudio.play();

      localStorage.setItem(
        SETTINGS.ambientStorageKey,
        "true"
      );

      updateAmbientButton(true);
    } else {
      elements.ambientAudio.pause();

      localStorage.setItem(
        SETTINGS.ambientStorageKey,
        "false"
      );

      updateAmbientButton(false);
    }
  } catch (error) {
    console.error(
      "Ambient audio failed:",
      error
    );

    updateAmbientButton(false);

    if (elements.ambientToggle) {
      elements.ambientToggle.title =
        "The audio file could not be played. Check the audio path in index.html.";
    }
  }
}

function updateAmbientButton(isPlaying) {
  if (!elements.ambientToggle) {
    return;
  }

  elements.ambientToggle.setAttribute(
    "aria-pressed",
    String(isPlaying)
  );

  elements.ambientToggle.classList.toggle(
    "is-playing",
    isPlaying
  );

  const buttonLabel =
    elements.ambientToggle.querySelector(
      "[data-ambient-label]"
    );

  if (buttonLabel) {
    buttonLabel.textContent =
      isPlaying
        ? "Ambient sound on"
        : "Ambient sound off";
  }
}


/* =========================================================
   CHARACTER COUNTER
========================================================= */

function initializeCharacterCounter() {
  updateCharacterCounter();
}

function updateCharacterCounter() {
  if (
    !elements.reviewText ||
    !elements.reviewCharacterCount
  ) {
    return;
  }

  const characterCount =
    elements.reviewText.value.length;

  elements.reviewCharacterCount.textContent =
    `${characterCount.toLocaleString()} / ${SETTINGS.maximumReviewLength.toLocaleString()}`;

  elements.reviewCharacterCount.classList.toggle(
    "is-over-limit",
    characterCount >
      SETTINGS.maximumReviewLength
  );
}


/* =========================================================
   LOADING AND ERROR STATES
========================================================= */

function setLoadingState(isLoading) {
  state.loading = isLoading;

  if (elements.reviewsLoading) {
    elements.reviewsLoading.hidden =
      !isLoading;
  }

  if (elements.reviewsGrid) {
    elements.reviewsGrid.setAttribute(
      "aria-busy",
      String(isLoading)
    );
  }
}

function showReviewError(message) {
  if (!elements.reviewsError) {
    return;
  }

  elements.reviewsError.textContent =
    message;

  elements.reviewsError.hidden =
    !message;
}


/* =========================================================
   SUBMIT BUTTON AND FORM MESSAGE
========================================================= */

function setSubmitButtonState(isSubmitting) {
  if (!elements.reviewSubmit) {
    return;
  }

  if (
    !elements.reviewSubmit.dataset.defaultText
  ) {
    elements.reviewSubmit.dataset.defaultText =
      elements.reviewSubmit.textContent.trim();
  }

  elements.reviewSubmit.disabled =
    isSubmitting;

  elements.reviewSubmit.textContent =
    isSubmitting
      ? "Submitting Review…"
      : elements.reviewSubmit.dataset.defaultText;
}

function showFormMessage(message, messageType) {
  if (!elements.reviewFormMessage) {
    return;
  }

  elements.reviewFormMessage.textContent =
    message;

  elements.reviewFormMessage.hidden =
    !message;

  elements.reviewFormMessage.classList.remove(
    "is-success",
    "is-error"
  );

  if (messageType === "success") {
    elements.reviewFormMessage.classList.add(
      "is-success"
    );
  }

  if (messageType === "error") {
    elements.reviewFormMessage.classList.add(
      "is-error"
    );
  }
}


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function renderStars(rating) {
  return Array.from(
    { length: 5 },
    (_, index) => {
      const isFilled =
        index < rating;

      return `
        <span
          aria-hidden="true"
          class="${isFilled ? "is-filled" : ""}"
        >
          ★
        </span>
      `;
    }
  ).join("");
}

function formatReviewText(reviewText) {
  return escapeHtml(reviewText)
    .replace(/\n/g, "<br>");
}

function formatDate(date) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  ).format(date);
}

function timestampToDate(timestampValue) {
  if (!timestampValue) {
    return null;
  }

  if (
    typeof timestampValue.toDate ===
    "function"
  ) {
    return timestampValue.toDate();
  }

  if (timestampValue instanceof Date) {
    return timestampValue;
  }

  const parsedDate =
    new Date(timestampValue);

  return Number.isNaN(
    parsedDate.getTime()
  )
    ? null
    : parsedDate;
}

function isDateRecent(date, numberOfDays) {
  if (!(date instanceof Date)) {
    return false;
  }

  const age =
    Date.now() - date.getTime();

  const maximumAge =
    numberOfDays *
    24 *
    60 *
    60 *
    1000;

  return age >= 0 && age <= maximumAge;
}

function clampNumber(
  value,
  minimum,
  maximum,
  fallback
) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.round(numberValue)
    )
  );
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function readFormValue(
  formData,
  fieldName,
  fallbackElement
) {
  const formValue =
    formData.get(fieldName);

  if (formValue !== null) {
    return cleanText(formValue);
  }

  return cleanText(
    fallbackElement?.value
  );
}

function isValidEmail(emailAddress) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    emailAddress
  );
}

function getVisitorId() {
  let visitorId =
    localStorage.getItem(
      SETTINGS.visitorStorageKey
    );

  if (!visitorId) {
    visitorId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`;

    localStorage.setItem(
      SETTINGS.visitorStorageKey,
      visitorId
    );
  }

  return visitorId.replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );
}

function getHelpfulVoteStorageKey(
  reviewId
) {
  return `aby_review_vote_${reviewId}`;
}

function hasLocalHelpfulVote(reviewId) {
  return (
    localStorage.getItem(
      getHelpfulVoteStorageKey(reviewId)
    ) === "true"
  );
}

function rememberLocalHelpfulVote(
  reviewId
) {
  localStorage.setItem(
    getHelpfulVoteStorageKey(reviewId),
    "true"
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/`/g, "&#096;");
}

function debounce(callback, delay) {
  let timer;

  return (...argumentsList) => {
    clearTimeout(timer);

    timer = setTimeout(
      () => {
        callback(...argumentsList);
      },
      delay
    );
  };
}
