/**
 * AWAKENED BY YAH MUSIC
 * ABY Music Administration Center
 *
 * Handles:
 * - Administrator authentication
 * - Review dashboard statistics
 * - Pending, approved, featured, and monthly reviews
 * - Approve and reject actions
 * - Verified-review status
 * - Featured-review status
 * - Review of the Month
 * - Artist responses
 * - Password reset
 * - Secure sign out
 */

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   CONFIGURATION
========================================================= */

const firebaseConfig =
  window.ABY_ADMIN_FIREBASE_CONFIG;

const adminSettings =
  window.ABY_ADMIN_SETTINGS || {};

const AUTHORIZED_ADMIN_EMAIL =
  String(
    adminSettings.administratorEmail ||
    "yahuahsremnant@gmail.com"
  )
    .trim()
    .toLowerCase();

const REVIEWS_COLLECTION = "reviews";


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

if (
  !firebaseConfig ||
  !firebaseConfig.apiKey ||
  !firebaseConfig.projectId
) {
  throw new Error(
    "The Firebase configuration is missing from admin/index.html."
  );
}

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


/* =========================================================
   PAGE STATE
========================================================= */

const state = {
  currentUser: null,
  reviews: [],
  activeView: "dashboard",
  loading: false,
  selectedReviewId: null
};

const elements = {};


/* =========================================================
   PAGE STARTUP
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeAdminCenter
);

function initializeAdminCenter() {
  cacheElements();
  connectLoginControls();
  connectDashboardControls();
  connectModalControls();
  initializePasswordVisibility();

  onAuthStateChanged(
    auth,
    handleAuthenticationChange
  );
}


/* =========================================================
   ELEMENT REFERENCES
========================================================= */

function cacheElements() {
  const elementIds = [
    "loginScreen",
    "dashboardScreen",

    "loginForm",
    "adminEmail",
    "adminPassword",
    "rememberMe",
    "togglePassword",
    "forgotPasswordButton",
    "signInButton",
    "loginMessage",

    "signOutButton",
    "refreshDashboardButton",
    "dashboardMessage",

    "pendingNavBadge",
    "pendingReviewCount",
    "approvedReviewCount",
    "featuredReviewCount",
    "averageReviewRating",

    "pendingReviewPreview",
    "pendingReviewsList",
    "approvedReviewsList",
    "featuredReviewsList",
    "reviewOfMonthList",
    "artistResponsesList",

    "reviewModal",
    "reviewModalContent"
  ];

  elementIds.forEach(id => {
    elements[id] =
      document.getElementById(id);
  });
}


/* =========================================================
   LOGIN CONTROLS
========================================================= */

function connectLoginControls() {
  elements.loginForm?.addEventListener(
    "submit",
    handleAdministratorSignIn
  );

  elements.forgotPasswordButton?.addEventListener(
    "click",
    handlePasswordReset
  );
}

function initializePasswordVisibility() {
  elements.togglePassword?.addEventListener(
    "click",
    () => {
      const passwordInput =
        elements.adminPassword;

      if (!passwordInput) {
        return;
      }

      const showingPassword =
        passwordInput.type === "text";

      passwordInput.type =
        showingPassword
          ? "password"
          : "text";

      elements.togglePassword.setAttribute(
        "aria-pressed",
        String(!showingPassword)
      );

      elements.togglePassword.setAttribute(
        "aria-label",
        showingPassword
          ? "Show password"
          : "Hide password"
      );

      const showIcon =
        elements.togglePassword.querySelector(
          ".eye-icon--show"
        );

      const hideIcon =
        elements.togglePassword.querySelector(
          ".eye-icon--hide"
        );

      if (showIcon) {
        showIcon.hidden = !showingPassword;
      }

      if (hideIcon) {
        hideIcon.hidden = showingPassword;
      }
    }
  );
}


/* =========================================================
   ADMINISTRATOR SIGN IN
========================================================= */

async function handleAdministratorSignIn(event) {
  event.preventDefault();

  const email =
    String(
      elements.adminEmail?.value || ""
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      elements.adminPassword?.value || ""
    );

  if (!email) {
    showLoginMessage(
      "Enter the administrator email address.",
      "error"
    );

    return;
  }

  if (!password) {
    showLoginMessage(
      "Enter the administrator password.",
      "error"
    );

    return;
  }

  if (email !== AUTHORIZED_ADMIN_EMAIL) {
    showLoginMessage(
      "This email address is not authorized to access the Administration Center.",
      "error"
    );

    return;
  }

  setLoginLoading(true);
  showLoginMessage("", "");

  try {
    const persistence =
      elements.rememberMe?.checked
        ? browserLocalPersistence
        : browserSessionPersistence;

    await setPersistence(
      auth,
      persistence
    );

    const credential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    const signedInEmail =
      String(
        credential.user.email || ""
      )
        .trim()
        .toLowerCase();

    if (
      signedInEmail !==
      AUTHORIZED_ADMIN_EMAIL
    ) {
      await signOut(auth);

      throw new Error(
        "UNAUTHORIZED_ADMIN"
      );
    }

    showLoginMessage(
      "Administrator verified. Opening the Administration Center…",
      "success"
    );
  } catch (error) {
    console.error(
      "Administrator sign-in failed:",
      error
    );

    showLoginMessage(
      getAuthenticationErrorMessage(error),
      "error"
    );
  } finally {
    setLoginLoading(false);
  }
}


/* =========================================================
   AUTHENTICATION STATE
========================================================= */

async function handleAuthenticationChange(user) {
  if (!user) {
    state.currentUser = null;

    showLoginScreen();

    return;
  }

  const signedInEmail =
    String(user.email || "")
      .trim()
      .toLowerCase();

  if (
    signedInEmail !==
    AUTHORIZED_ADMIN_EMAIL
  ) {
    await signOut(auth);

    showLoginMessage(
      "This Google or Firebase account is not authorized.",
      "error"
    );

    return;
  }

  state.currentUser = user;

  showDashboardScreen();

  await loadReviewDashboard();
}


/* =========================================================
   SCREEN VISIBILITY
========================================================= */

function showLoginScreen() {
  if (elements.loginScreen) {
    elements.loginScreen.hidden = false;
  }

  if (elements.dashboardScreen) {
    elements.dashboardScreen.hidden = true;
  }
}

function showDashboardScreen() {
  if (elements.loginScreen) {
    elements.loginScreen.hidden = true;
  }

  if (elements.dashboardScreen) {
    elements.dashboardScreen.hidden = false;
  }
}


/* =========================================================
   PASSWORD RESET
========================================================= */

async function handlePasswordReset() {
  const enteredEmail =
    String(
      elements.adminEmail?.value || ""
    )
      .trim()
      .toLowerCase();

  const resetEmail =
    enteredEmail ||
    AUTHORIZED_ADMIN_EMAIL;

  if (
    resetEmail !==
    AUTHORIZED_ADMIN_EMAIL
  ) {
    showLoginMessage(
      "Password resets are available only for the authorized administrator email.",
      "error"
    );

    return;
  }

  try {
    await sendPasswordResetEmail(
      auth,
      resetEmail
    );

    showLoginMessage(
      `A password-reset message was sent to ${resetEmail}.`,
      "success"
    );
  } catch (error) {
    console.error(
      "Password reset failed:",
      error
    );

    showLoginMessage(
      getAuthenticationErrorMessage(error),
      "error"
    );
  }
}


/* =========================================================
   SIGN OUT
========================================================= */

function connectDashboardControls() {
  elements.signOutButton?.addEventListener(
    "click",
    async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error(
          "Sign out failed:",
          error
        );

        showDashboardMessage(
          "The sign-out request could not be completed.",
          "error"
        );
      }
    }
  );

  elements.refreshDashboardButton?.addEventListener(
    "click",
    loadReviewDashboard
  );

  document
    .querySelectorAll(
      "[data-admin-view]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const viewName =
            button.dataset.adminView;

          openAdminView(viewName);
        }
      );
    });
}


/* =========================================================
   LOAD ALL REVIEWS
========================================================= */

async function loadReviewDashboard() {
  if (!state.currentUser) {
    return;
  }

  state.loading = true;

  setRefreshButtonState(true);

  showDashboardMessage("", "");

  try {
    const reviewsReference =
      collection(
        db,
        REVIEWS_COLLECTION
      );

    let snapshot;

    try {
      snapshot = await getDocs(
        query(
          reviewsReference,
          orderBy(
            "createdAt",
            "desc"
          )
        )
      );
    } catch (orderError) {
      console.warn(
        "Ordered review query failed. Loading without server ordering.",
        orderError
      );

      snapshot =
        await getDocs(
          reviewsReference
        );
    }

    state.reviews =
      snapshot.docs
        .map(snapshotDocument => {
          return normalizeReview(
            snapshotDocument.id,
            snapshotDocument.data()
          );
        })
        .sort((reviewA, reviewB) => {
          return (
            reviewB.createdDate -
            reviewA.createdDate
          );
        });

    renderDashboardStatistics();
    renderPendingReviewPreview();
    renderAllAdministrationViews();
  } catch (error) {
    console.error(
      "Unable to load admin reviews:",
      error
    );

    showDashboardMessage(
      "The reviews could not be loaded. The Firestore administrator rules may still need to be updated.",
      "error"
    );
  } finally {
    state.loading = false;

    setRefreshButtonState(false);
  }
}


/* =========================================================
   NORMALIZE REVIEW DATA
========================================================= */

function normalizeReview(reviewId, data) {
  const createdDate =
    timestampToDate(
      data.createdAt
    ) || new Date(0);

  const approvedDate =
    timestampToDate(
      data.approvedAt
    );

  return {
    id: reviewId,

    reviewerName:
      cleanText(
        data.reviewerName
      ) || "Anonymous Listener",

    reviewerEmail:
      cleanText(
        data.reviewerEmail
      ),

    releaseTitle:
      cleanText(
        data.releaseTitle
      ) || "AWAKENED BY YAH MUSIC",

    releaseType:
      cleanText(
        data.releaseType
      ),

    rating:
      clampNumber(
        data.rating,
        1,
        5,
        5
      ),

    reviewTitle:
      cleanText(
        data.reviewTitle
      ),

    reviewText:
      cleanText(
        data.reviewText
      ),

    status:
      cleanText(
        data.status
      ) || "pending",

    verified:
      Boolean(
        data.verified
      ),

    featured:
      Boolean(
        data.featured
      ),

    reviewOfMonth:
      Boolean(
        data.reviewOfMonth
      ),

    artistResponse:
      cleanText(
        data.artistResponse
      ),

    helpfulCount:
      Math.max(
        0,
        Number(
          data.helpfulCount
        ) || 0
      ),

    createdDate,
    approvedDate
  };
}


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function renderDashboardStatistics() {
  const pendingReviews =
    state.reviews.filter(review => {
      return review.status === "pending";
    });

  const approvedReviews =
    state.reviews.filter(review => {
      return review.status === "approved";
    });

  const featuredReviews =
    approvedReviews.filter(review => {
      return review.featured;
    });

  const averageRating =
    approvedReviews.length > 0
      ? approvedReviews.reduce(
          (total, review) => {
            return (
              total +
              review.rating
            );
          },
          0
        ) /
        approvedReviews.length
      : 0;

  setText(
    elements.pendingNavBadge,
    pendingReviews.length
  );

  setText(
    elements.pendingReviewCount,
    pendingReviews.length
  );

  setText(
    elements.approvedReviewCount,
    approvedReviews.length
  );

  setText(
    elements.featuredReviewCount,
    featuredReviews.length
  );

  setText(
    elements.averageReviewRating,
    averageRating.toFixed(1)
  );
}


/* =========================================================
   DASHBOARD PREVIEW
========================================================= */

function renderPendingReviewPreview() {
  if (!elements.pendingReviewPreview) {
    return;
  }

  const pendingReviews =
    state.reviews
      .filter(review => {
        return review.status === "pending";
      })
      .slice(0, 3);

  elements.pendingReviewPreview.innerHTML = "";

  if (pendingReviews.length === 0) {
    elements.pendingReviewPreview.innerHTML = `
      <div class="dashboard-empty-state">
        <span aria-hidden="true">✓</span>

        <h4>
          No reviews awaiting approval
        </h4>

        <p>
          New listener submissions will appear here.
        </p>
      </div>
    `;

    return;
  }

  pendingReviews.forEach(review => {
    elements.pendingReviewPreview.appendChild(
      createAdminReviewCard(review)
    );
  });
}


/* =========================================================
   ADMINISTRATION VIEWS
========================================================= */

function renderAllAdministrationViews() {
  renderReviewList(
    elements.pendingReviewsList,
    state.reviews.filter(review => {
      return review.status === "pending";
    }),
    "No pending reviews."
  );

  renderReviewList(
    elements.approvedReviewsList,
    state.reviews.filter(review => {
      return review.status === "approved";
    }),
    "No approved reviews."
  );

  renderReviewList(
    elements.featuredReviewsList,
    state.reviews.filter(review => {
      return (
        review.status === "approved" &&
        review.featured
      );
    }),
    "No featured reviews."
  );

  renderReviewList(
    elements.reviewOfMonthList,
    state.reviews.filter(review => {
      return (
        review.status === "approved" &&
        review.reviewOfMonth
      );
    }),
    "No Review of the Month is currently selected."
  );

  renderReviewList(
    elements.artistResponsesList,
    state.reviews.filter(review => {
      return Boolean(
        review.artistResponse
      );
    }),
    "No artist responses have been added."
  );
}

function renderReviewList(
  container,
  reviews,
  emptyMessage
) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="dashboard-empty-state">
        <span aria-hidden="true">—</span>

        <h4>
          ${escapeHtml(emptyMessage)}
        </h4>
      </div>
    `;

    return;
  }

  reviews.forEach(review => {
    container.appendChild(
      createAdminReviewCard(review)
    );
  });
}


/* =========================================================
   CREATE ADMIN REVIEW CARD
========================================================= */

function createAdminReviewCard(review) {
  const article =
    document.createElement(
      "article"
    );

  article.className =
    "admin-review-card";

  const statusLabel =
    review.status === "approved"
      ? "Approved"
      : review.status === "rejected"
      ? "Rejected"
      : "Pending";

  article.innerHTML = `
    <div class="admin-review-card__top">
      <div>
        <div class="admin-review-card__stars">
          ${renderStars(review.rating)}
        </div>

        <h4 class="admin-review-card__title">
          ${escapeHtml(
            review.reviewTitle ||
            review.releaseTitle
          )}
        </h4>
      </div>

      <span class="review-status review-status--${escapeAttribute(
        review.status
      )}">
        ${escapeHtml(statusLabel)}
      </span>
    </div>

    <p class="admin-review-card__meta">
      ${escapeHtml(review.reviewerName)}
      ·
      ${escapeHtml(review.releaseTitle)}
      ${
        review.releaseType
          ? ` · ${escapeHtml(review.releaseType)}`
          : ""
      }
      ·
      ${formatDate(review.createdDate)}
    </p>

    <p class="admin-review-card__text">
      ${formatReviewText(review.reviewText)}
    </p>

    <div class="admin-review-card__actions">

      ${
        review.status === "pending"
          ? `
            <button
              class="admin-action-button admin-action-button--approve"
              type="button"
              data-review-action="approve"
              data-review-id="${escapeAttribute(review.id)}"
            >
              Approve
            </button>

            <button
              class="admin-action-button admin-action-button--reject"
              type="button"
              data-review-action="reject"
              data-review-id="${escapeAttribute(review.id)}"
            >
              Reject
            </button>
          `
          : ""
      }

      ${
        review.status === "approved"
          ? `
            <button
              class="admin-action-button"
              type="button"
              data-review-action="toggleVerified"
              data-review-id="${escapeAttribute(review.id)}"
            >
              ${
                review.verified
                  ? "Remove Verified"
                  : "Mark Verified"
              }
            </button>

            <button
              class="admin-action-button"
              type="button"
              data-review-action="toggleFeatured"
              data-review-id="${escapeAttribute(review.id)}"
            >
              ${
                review.featured
                  ? "Remove Featured"
                  : "Feature Review"
              }
            </button>

            <button
              class="admin-action-button"
              type="button"
              data-review-action="toggleMonth"
              data-review-id="${escapeAttribute(review.id)}"
            >
              ${
                review.reviewOfMonth
                  ? "Remove Monthly Spotlight"
                  : "Review of the Month"
              }
            </button>

            <button
              class="admin-action-button"
              type="button"
              data-review-action="response"
              data-review-id="${escapeAttribute(review.id)}"
            >
              ${
                review.artistResponse
                  ? "Edit Artist Response"
                  : "Add Artist Response"
              }
            </button>
          `
          : ""
      }

      <button
        class="admin-action-button"
        type="button"
        data-review-action="open"
        data-review-id="${escapeAttribute(review.id)}"
      >
        View Full Review
      </button>

      <button
        class="admin-action-button admin-action-button--reject"
        type="button"
        data-review-action="delete"
        data-review-id="${escapeAttribute(review.id)}"
      >
        Delete
      </button>

    </div>
  `;

  article
    .querySelectorAll(
      "[data-review-action]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          handleReviewAction(
            button.dataset.reviewAction,
            button.dataset.reviewId
          );
        }
      );
    });

  return article;
}


/* =========================================================
   REVIEW ACTION ROUTER
========================================================= */

async function handleReviewAction(
  action,
  reviewId
) {
  const review =
    state.reviews.find(item => {
      return item.id === reviewId;
    });

  if (!review) {
    return;
  }

  switch (action) {
    case "approve":
      await approveReview(review);
      break;

    case "reject":
      await rejectReview(review);
      break;

    case "toggleVerified":
      await toggleVerifiedReview(review);
      break;

    case "toggleFeatured":
      await toggleFeaturedReview(review);
      break;

    case "toggleMonth":
      await toggleReviewOfMonth(review);
      break;

    case "response":
      openArtistResponsePrompt(review);
      break;

    case "open":
      openReviewModal(review);
      break;

    case "delete":
      await deleteReview(review);
      break;

    default:
      break;
  }
}


/* =========================================================
   APPROVE REVIEW
========================================================= */

async function approveReview(review) {
  const confirmed =
    window.confirm(
      `Approve the review from ${review.reviewerName}?`
    );

  if (!confirmed) {
    return;
  }

  try {
    await updateDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      ),
      {
        status: "approved",
        approvedAt: serverTimestamp()
      }
    );

    showDashboardMessage(
      "The review was approved and is now visible on the public Reviews page.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "The review could not be approved.",
      error
    );
  }
}


/* =========================================================
   REJECT REVIEW
========================================================= */

async function rejectReview(review) {
  const confirmed =
    window.confirm(
      `Reject the review from ${review.reviewerName}?`
    );

  if (!confirmed) {
    return;
  }

  try {
    await updateDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      ),
      {
        status: "rejected",
        approvedAt: null,
        featured: false,
        reviewOfMonth: false
      }
    );

    showDashboardMessage(
      "The review was rejected and will not appear publicly.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "The review could not be rejected.",
      error
    );
  }
}


/* =========================================================
   VERIFIED REVIEW
========================================================= */

async function toggleVerifiedReview(review) {
  try {
    await updateDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      ),
      {
        verified: !review.verified
      }
    );

    showDashboardMessage(
      review.verified
        ? "Verified status was removed."
        : "The review is now marked as verified.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "Verified status could not be updated.",
      error
    );
  }
}


/* =========================================================
   FEATURED REVIEW
========================================================= */

async function toggleFeaturedReview(review) {
  try {
    await updateDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      ),
      {
        featured: !review.featured
      }
    );

    showDashboardMessage(
      review.featured
        ? "The review was removed from Featured Reviews."
        : "The review was added to Featured Reviews.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "Featured status could not be updated.",
      error
    );
  }
}


/* =========================================================
   REVIEW OF THE MONTH
========================================================= */

async function toggleReviewOfMonth(review) {
  try {
    if (!review.reviewOfMonth) {
      const currentMonthlyReviews =
        state.reviews.filter(item => {
          return (
            item.reviewOfMonth &&
            item.id !== review.id
          );
        });

      for (
        const currentReview
        of currentMonthlyReviews
      ) {
        await updateDoc(
          doc(
            db,
            REVIEWS_COLLECTION,
            currentReview.id
          ),
          {
            reviewOfMonth: false
          }
        );
      }
    }

    await updateDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      ),
      {
        reviewOfMonth:
          !review.reviewOfMonth
      }
    );

    showDashboardMessage(
      review.reviewOfMonth
        ? "The monthly spotlight was removed."
        : "The review is now the Review of the Month.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "Review of the Month status could not be updated.",
      error
    );
  }
}


/* =========================================================
   ARTIST RESPONSE
========================================================= */

async function openArtistResponsePrompt(review) {
  const response =
    window.prompt(
      "Enter the official AWAKENED BY YAH MUSIC response:",
      review.artistResponse
    );

  if (response === null) {
    return;
  }

  const cleanedResponse =
    response.trim();

  if (
    cleanedResponse.length > 1000
  ) {
    showDashboardMessage(
      "Artist responses must be 1,000 characters or fewer.",
      "error"
    );

    return;
  }

  try {
    await updateDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      ),
      {
        artistResponse:
          cleanedResponse
      }
    );

    showDashboardMessage(
      cleanedResponse
        ? "The artist response was saved."
        : "The artist response was removed.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "The artist response could not be saved.",
      error
    );
  }
}


/* =========================================================
   DELETE REVIEW
========================================================= */

async function deleteReview(review) {
  const confirmed =
    window.confirm(
      `Permanently delete the review from ${review.reviewerName}? This cannot be undone.`
    );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDoc(
      doc(
        db,
        REVIEWS_COLLECTION,
        review.id
      )
    );

    showDashboardMessage(
      "The review was permanently deleted.",
      "success"
    );

    await loadReviewDashboard();
  } catch (error) {
    handleAdminWriteError(
      "The review could not be deleted.",
      error
    );
  }
}


/* =========================================================
   REVIEW MODAL
========================================================= */

function connectModalControls() {
  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(element => {
      element.addEventListener(
        "click",
        closeReviewModal
      );
    });

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape" &&
        elements.reviewModal &&
        !elements.reviewModal.hidden
      ) {
        closeReviewModal();
      }
    }
  );
}

function openReviewModal(review) {
  if (
    !elements.reviewModal ||
    !elements.reviewModalContent
  ) {
    return;
  }

  state.selectedReviewId =
    review.id;

  elements.reviewModalContent.innerHTML = `
    <p class="panel-eyebrow">
      FULL REVIEW
    </p>

    <h2 id="reviewModalTitle">
      ${escapeHtml(
        review.reviewTitle ||
        review.releaseTitle
      )}
    </h2>

    <p class="admin-review-card__stars">
      ${renderStars(review.rating)}
    </p>

    <p>
      <strong>Reviewer:</strong>
      ${escapeHtml(review.reviewerName)}
    </p>

    <p>
      <strong>Email:</strong>
      ${escapeHtml(
        review.reviewerEmail ||
        "Not provided"
      )}
    </p>

    <p>
      <strong>Release:</strong>
      ${escapeHtml(review.releaseTitle)}
      ${
        review.releaseType
          ? ` · ${escapeHtml(review.releaseType)}`
          : ""
      }
    </p>

    <p>
      <strong>Status:</strong>
      ${escapeHtml(review.status)}
    </p>

    <p>
      <strong>Submitted:</strong>
      ${formatDate(review.createdDate)}
    </p>

    <div class="admin-review-card__text">
      ${formatReviewText(review.reviewText)}
    </div>

    ${
      review.artistResponse
        ? `
          <div class="admin-review-card__text">
            <strong>
              AWAKENED BY YAH MUSIC Response
            </strong>

            <br><br>

            ${formatReviewText(
              review.artistResponse
            )}
          </div>
        `
        : ""
    }
  `;

  elements.reviewModal.hidden = false;

  document.body.style.overflow =
    "hidden";
}

function closeReviewModal() {
  if (elements.reviewModal) {
    elements.reviewModal.hidden = true;
  }

  document.body.style.overflow = "";

  state.selectedReviewId = null;
}


/* =========================================================
   ADMIN VIEW NAVIGATION
========================================================= */

function openAdminView(viewName) {
  if (!viewName) {
    return;
  }

  state.activeView =
    viewName;

  document
    .querySelectorAll(
      "[data-view-panel]"
    )
    .forEach(panel => {
      panel.hidden =
        panel.dataset.viewPanel !==
        viewName;
    });

  document
    .querySelectorAll(
      ".admin-nav-item"
    )
    .forEach(button => {
      button.classList.toggle(
        "is-active",
        button.dataset.adminView ===
          viewName
      );
    });
}


/* =========================================================
   BUTTON STATES AND MESSAGES
========================================================= */

function setLoginLoading(isLoading) {
  if (!elements.signInButton) {
    return;
  }

  elements.signInButton.disabled =
    isLoading;

  const buttonText =
    elements.signInButton.querySelector(
      ".sign-in-button__text"
    );

  const buttonArrow =
    elements.signInButton.querySelector(
      ".sign-in-button__arrow"
    );

  const buttonLoader =
    elements.signInButton.querySelector(
      ".button-loader"
    );

  if (buttonText) {
    buttonText.textContent =
      isLoading
        ? "Signing In"
        : "Sign In";
  }

  if (buttonArrow) {
    buttonArrow.hidden =
      isLoading;
  }

  if (buttonLoader) {
    buttonLoader.hidden =
      !isLoading;
  }
}

function setRefreshButtonState(isLoading) {
  if (!elements.refreshDashboardButton) {
    return;
  }

  elements.refreshDashboardButton.disabled =
    isLoading;

  elements.refreshDashboardButton.textContent =
    isLoading
      ? "Refreshing…"
      : "Refresh";
}

function showLoginMessage(
  message,
  type
) {
  showMessage(
    elements.loginMessage,
    message,
    type
  );
}

function showDashboardMessage(
  message,
  type
) {
  showMessage(
    elements.dashboardMessage,
    message,
    type
  );

  if (
    message &&
    elements.dashboardMessage
  ) {
    window.setTimeout(
      () => {
        if (
          elements.dashboardMessage.textContent ===
          message
        ) {
          showMessage(
            elements.dashboardMessage,
            "",
            ""
          );
        }
      },
      5000
    );
  }
}

function showMessage(
  element,
  message,
  type
) {
  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.hidden =
    !message;

  element.classList.remove(
    "is-error",
    "is-success"
  );

  if (type === "error") {
    element.classList.add(
      "is-error"
    );
  }

  if (type === "success") {
    element.classList.add(
      "is-success"
    );
  }
}


/* =========================================================
   ADMIN WRITE ERROR
========================================================= */

function handleAdminWriteError(
  message,
  error
) {
  console.error(
    message,
    error
  );

  const permissionDenied =
    error?.code ===
      "permission-denied" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("permission");

  showDashboardMessage(
    permissionDenied
      ? `${message} The Firestore administrator security rules must be updated next.`
      : message,
    "error"
  );
}


/* =========================================================
   AUTHENTICATION ERROR MESSAGES
========================================================= */

function getAuthenticationErrorMessage(error) {
  const code =
    String(error?.code || "");

  switch (code) {
    case "auth/invalid-email":
      return "The administrator email address is invalid.";

    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email address or password is incorrect.";

    case "auth/too-many-requests":
      return "Too many sign-in attempts were made. Wait a moment and try again.";

    case "auth/network-request-failed":
      return "The sign-in request could not reach Firebase. Check your internet connection.";

    case "auth/user-disabled":
      return "This administrator account has been disabled.";

    default:
      if (
        error?.message ===
        "UNAUTHORIZED_ADMIN"
      ) {
        return "This account is not authorized to access the Administration Center.";
      }

      return "The administrator sign-in could not be completed.";
  }
}


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function renderStars(rating) {
  return Array.from(
    { length: 5 },
    (_, index) => {
      return index < rating
        ? "★"
        : "☆";
    }
  ).join("");
}

function timestampToDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsedDate =
    new Date(value);

  return Number.isNaN(
    parsedDate.getTime()
  )
    ? null
    : parsedDate;
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
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  ).format(date);
}

function formatReviewText(text) {
  return escapeHtml(text)
    .replace(/\n/g, "<br>");
}

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function clampNumber(
  value,
  minimum,
  maximum,
  fallback
) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue)
  ) {
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

function setText(
  element,
  value
) {
  if (element) {
    element.textContent =
      String(value);
  }
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
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
