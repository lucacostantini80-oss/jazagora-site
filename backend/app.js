import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  getAuth,
  getIdTokenResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  collection,
  collectionGroup,
  deleteDoc,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBp52sTbFZ9MghiEiWKZ2HDHZYCOVBcm9o",
  authDomain: "jazagora-8239d.firebaseapp.com",
  projectId: "jazagora-8239d",
  storageBucket: "jazagora-8239d.firebasestorage.app",
  messagingSenderId: "564898345036",
  appId: "1:564898345036:web:46875ec82eed92a1b784e9",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const authPersistence = setPersistence(auth, browserLocalPersistence).catch(
  (error) => {
    console.error("Unable to enable persistent admin session:", error);
  },
);

const elements = {
  loginView: document.querySelector("#loginView"),
  dashboardView: document.querySelector("#dashboardView"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  authMessage: document.querySelector("#authMessage"),
  connectionStatus: document.querySelector("#connectionStatus"),
  adminEmail: document.querySelector("#adminEmail"),
  activeConsentCount: document.querySelector("#activeConsentCount"),
  uniqueEmailCount: document.querySelector("#uniqueEmailCount"),
  lastSync: document.querySelector("#lastSync"),
  reviewCount: document.querySelector("#reviewCount"),
  reviewLastSync: document.querySelector("#reviewLastSync"),
  reviewConnectionStatus: document.querySelector("#reviewConnectionStatus"),
  reviewTableBody: document.querySelector("#reviewTableBody"),
  reviewEmptyState: document.querySelector("#reviewEmptyState"),
  reviewEmptyTitle: document.querySelector("#reviewEmptyTitle"),
  reviewEmptyDescription: document.querySelector("#reviewEmptyDescription"),
  reviewResultSummary: document.querySelector("#reviewResultSummary"),
  reviewSearchInput: document.querySelector("#reviewSearchInput"),
  reviewRatingFilter: document.querySelector("#reviewRatingFilter"),
  reviewClubFilter: document.querySelector("#reviewClubFilter"),
  resetReviewFilters: document.querySelector("#resetReviewFilters"),
  deleteReviewDialog: document.querySelector("#deleteReviewDialog"),
  deleteReviewSummary: document.querySelector("#deleteReviewSummary"),
  cancelDeleteReviewButton: document.querySelector("#cancelDeleteReviewButton"),
  confirmDeleteReviewButton: document.querySelector("#confirmDeleteReviewButton"),
  searchInput: document.querySelector("#searchInput"),
  copyEmailsButton: document.querySelector("#copyEmailsButton"),
  consentTableBody: document.querySelector("#consentTableBody"),
  consentTableViewport: document.querySelector("#consentTableViewport"),
  consentTableControls: document.querySelector("#consentTableControls"),
  toggleConsentTable: document.querySelector("#toggleConsentTable"),
  emptyState: document.querySelector("#emptyState"),
  resultSummary: document.querySelector("#resultSummary"),
  reviewTableViewport: document.querySelector("#reviewTableViewport"),
  reviewTableControls: document.querySelector("#reviewTableControls"),
  toggleReviewTable: document.querySelector("#toggleReviewTable"),
  toast: document.querySelector("#toast"),
};

let allConsentUsers = [];
let allReviews = [];
let userProfilesByUid = new Map();
let clubNamesById = new Map();
let unsubscribeUsers = null;
let unsubscribeUserProfiles = null;
let unsubscribeReviews = null;
let unsubscribeClubs = null;
let pendingReviewDelete = null;
let toastTimer = null;

function setAuthMessage(message = "") {
  elements.authMessage.textContent = message;
}

function setConnectionStatus(label, isError = false) {
  elements.connectionStatus.lastChild.textContent = label;
  elements.connectionStatus.classList.toggle("error", isError);
}

function setReviewConnectionStatus(label, isError = false) {
  elements.reviewConnectionStatus.lastChild.textContent = label;
  elements.reviewConnectionStatus.classList.toggle("error", isError);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 3200);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function dateFromFirestore(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = dateFromFirestore(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStoredDisplayName(data) {
  const composedName = [data.firstName, data.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  const candidates = [
    data.displayName,
    data.name,
    data.fullName,
    data.username,
    composedName,
  ];
  const name = candidates.find((value) => String(value || "").trim());
  return name ? String(name).trim() : "";
}

function isGenericUserName(value) {
  const normalized = normalizeSearchText(value);
  return (
    !normalized ||
    normalized === "utente jazagora" ||
    normalized === "nome non salvato" ||
    normalized === "nome non disponibile"
  );
}

function getReviewAuthorName(uid) {
  const review = allReviews.find(
    (item) => item.userId === uid && !isGenericUserName(item.authorName),
  );
  return review?.authorName || "";
}

function getNameFromEmail(value) {
  const localPart = normalizeEmail(value)
    .split("@")[0]
    .split("+")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!localPart) return "";

  return localPart
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase("it") + part.slice(1))
    .join(" ");
}

function resolveConsentUserName(user) {
  if (user.storedName) {
    return { name: user.storedName, source: "Nome dal profilo Firestore" };
  }

  const reviewName = getReviewAuthorName(user.uid);
  if (reviewName) {
    return { name: reviewName, source: "Nome recuperato dalle recensioni" };
  }

  const emailName = getNameFromEmail(user.email || user.accountEmail);
  if (emailName) {
    return { name: emailName, source: "Nome ricavato dall’email" };
  }

  return { name: "Nome non disponibile", source: "Profilo senza nome" };
}

function normalizeUser(snapshot) {
  const data = snapshot.data();
  const email = normalizeEmail(data.marketingEmail || data.email);
  return {
    uid: snapshot.id,
    storedName: getStoredDisplayName(data),
    email,
    accountEmail: normalizeEmail(data.email),
    updatedAt: data.marketingConsentUpdatedAt || data.updatedAt || null,
    policyVersion: data.marketingConsentPolicyVersion || "—",
  };
}

function getReviewDisplayName(review) {
  const profileName = userProfilesByUid.get(review.userId)?.storedName;
  if (profileName) return profileName;
  if (!isGenericUserName(review.authorName)) return review.authorName;
  return "Utente Jazagora";
}

function getReviewNameSource(review) {
  if (userProfilesByUid.get(review.userId)?.storedName) return "Profilo Firestore";
  if (!isGenericUserName(review.authorName)) return "Nome salvato nella recensione";
  return "Nome non salvato";
}

function updateCompactTable(viewport, controls, button, resultCount, labels) {
  const hasOverflow = resultCount > 5;
  controls.hidden = !hasOverflow;
  if (!hasOverflow) {
    viewport.classList.remove("expanded");
    button.textContent = labels.expand;
  }
}

function toggleCompactTable(viewport, button, labels) {
  const expanded = viewport.classList.toggle("expanded");
  button.textContent = expanded ? labels.collapse : labels.expand;
  if (!expanded) viewport.scrollTo({ top: 0, behavior: "smooth" });
}

function getUniqueValidEmails(users = allConsentUsers) {
  return [...new Set(users.map((user) => user.email).filter(isValidEmail))];
}

function currentFilteredUsers() {
  const search = normalizeSearchText(elements.searchInput.value);
  if (!search) return allConsentUsers;
  return allConsentUsers.filter((user) =>
    normalizeSearchText(
      [
        resolveConsentUserName(user).name,
        user.storedName,
        user.email,
        user.accountEmail,
        user.uid,
      ].join(" "),
    ).includes(search),
  );
}

function createCell(label, value, className = "") {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  if (className) cell.className = className;
  cell.textContent = value;
  return cell;
}

function renderUsers() {
  const users = currentFilteredUsers();
  const fragment = document.createDocumentFragment();
  elements.consentTableBody.replaceChildren();

  users.forEach((user) => {
    const row = document.createElement("tr");
    const resolvedName = resolveConsentUserName(user);

    const userCell = document.createElement("td");
    const name = document.createElement("span");
    const accountEmail = document.createElement("span");
    name.className = "user-name";
    name.textContent = resolvedName.name;
    accountEmail.className = "user-secondary";

    const secondaryDetails = [resolvedName.source];
    if (user.accountEmail && user.accountEmail !== user.email) {
      secondaryDetails.push(`Account: ${user.accountEmail}`);
    }
    accountEmail.textContent = secondaryDetails.join(" · ");
    userCell.append(name, accountEmail);

    const emailCell = createCell(
      "Email comunicazioni",
      user.email || "Email non disponibile",
      "email-value",
    );
    const dateCell = createCell("Consenso aggiornato", formatDate(user.updatedAt));
    const policyCell = createCell("Informativa", user.policyVersion);
    const uidCell = createCell("ID utente", user.uid, "uid-value");
    uidCell.title = user.uid;

    row.append(userCell, emailCell, dateCell, policyCell, uidCell);
    fragment.append(row);
  });

  elements.consentTableBody.append(fragment);
  elements.consentTableViewport.scrollTop = 0;
  updateCompactTable(
    elements.consentTableViewport,
    elements.consentTableControls,
    elements.toggleConsentTable,
    users.length,
    { expand: "Mostra tutti", collapse: "Riduci elenco" },
  );
  elements.emptyState.hidden = users.length > 0;
  elements.resultSummary.textContent =
    users.length === allConsentUsers.length
      ? `${users.length} profili con consenso attivo.`
      : `${users.length} risultati su ${allConsentUsers.length} consensi attivi.`;

  const validEmails = getUniqueValidEmails(users);
  elements.copyEmailsButton.disabled = validEmails.length === 0;
  elements.copyEmailsButton.textContent =
    validEmails.length > 0
      ? `Copia ${validEmails.length} email per CCN`
      : "Copia email per CCN";
}

function updateStats() {
  elements.activeConsentCount.textContent = String(allConsentUsers.length);
  elements.uniqueEmailCount.textContent = String(
    getUniqueValidEmails(allConsentUsers).length,
  );
  elements.lastSync.textContent = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function normalizeReview(snapshot) {
  const data = snapshot.data();
  const pathParts = snapshot.ref.path.split("/");
  const nestedClubId =
    pathParts[0] === "clubs" && pathParts[2] === "reviews"
      ? pathParts[1]
      : "";
  const clubId = String(data.targetId || data.clubId || nestedClubId || "");
  const rawRating = Number(data.rating);
  const rating = Number.isFinite(rawRating)
    ? Math.min(5, Math.max(1, Math.round(rawRating)))
    : null;

  return {
    id: snapshot.id,
    ref: snapshot.ref,
    path: snapshot.ref.path,
    authorName: String(
      data.authorName ||
        data.displayName ||
        data.userName ||
        data.username ||
        "Utente Jazagora",
    ).trim(),
    userId: String(data.userId || snapshot.id),
    rating,
    comment: String(data.comment || "").trim(),
    clubId,
    embeddedClubName: String(
      data.clubName || data.venueName || data.targetName || "",
    ).trim(),
    createdAt: data.createdAt || data.updatedAt || null,
    status: String(data.status || "—"),
    sortDate: data.updatedAt || data.createdAt || null,
  };
}

function getReviewClubName(review) {
  return (
    clubNamesById.get(review.clubId) ||
    review.embeddedClubName ||
    review.clubId ||
    "Locale non disponibile"
  );
}

function createReviewUserCell(review) {
  const cell = document.createElement("td");
  cell.dataset.label = "Utente";

  const name = document.createElement("span");
  name.className = "user-name";
  name.textContent = getReviewDisplayName(review);

  const identifier = document.createElement("span");
  identifier.className = "user-secondary";
  identifier.textContent = `${getReviewNameSource(review)} · ID: ${review.userId}`;
  identifier.title = review.userId;

  cell.append(name, identifier);
  return cell;
}

function createRatingCell(rating) {
  const cell = document.createElement("td");
  cell.dataset.label = "Voto";
  cell.className = "review-rating";
  cell.setAttribute(
    "aria-label",
    rating ? `${rating} stelle su 5` : "Voto non disponibile",
  );

  if (!rating) {
    cell.textContent = "—";
    return cell;
  }

  const stars = document.createElement("span");
  stars.className = "review-stars";
  stars.setAttribute("aria-hidden", "true");
  stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);

  const numeric = document.createElement("span");
  numeric.className = "review-rating-number";
  numeric.textContent = `${rating}/5`;

  cell.append(stars, numeric);
  return cell;
}

function createReviewActionsCell(review) {
  const cell = document.createElement("td");
  cell.dataset.label = "Azioni";
  cell.className = "review-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "review-delete-button";
  button.textContent = "Elimina";
  button.setAttribute(
    "aria-label",
    `Elimina la recensione di ${getReviewDisplayName(review)}`,
  );
  button.addEventListener("click", () => openDeleteReviewDialog(review));

  cell.append(button);
  return cell;
}

function openDeleteReviewDialog(review) {
  pendingReviewDelete = review;
  const ratingLabel = review.rating ? `${review.rating}/5 stelle` : "senza voto";
  const commentPreview = review.comment
    ? review.comment.slice(0, 180) + (review.comment.length > 180 ? "…" : "")
    : "Commento non disponibile";

  elements.deleteReviewSummary.textContent = [
    getReviewDisplayName(review),
    ratingLabel,
    getReviewClubName(review),
    `“${commentPreview}”`,
  ].join("\n");
  elements.confirmDeleteReviewButton.disabled = false;
  elements.confirmDeleteReviewButton.textContent = "Elimina definitivamente";
  elements.deleteReviewDialog.showModal();
}

function closeDeleteReviewDialog() {
  if (elements.deleteReviewDialog.open) elements.deleteReviewDialog.close();
  pendingReviewDelete = null;
}

async function deleteSelectedReview() {
  if (!pendingReviewDelete?.ref) return;

  const review = pendingReviewDelete;
  elements.confirmDeleteReviewButton.disabled = true;
  elements.cancelDeleteReviewButton.disabled = true;
  elements.confirmDeleteReviewButton.textContent = "Eliminazione…";

  try {
    await deleteDoc(review.ref);
    closeDeleteReviewDialog();
    showToast("Recensione eliminata definitivamente.");
  } catch (error) {
    console.error("Review deletion failed:", error);
    elements.confirmDeleteReviewButton.disabled = false;
    elements.confirmDeleteReviewButton.textContent = "Elimina definitivamente";
    showToast("Eliminazione non riuscita. Verifica i permessi amministrativi.");
  } finally {
    elements.cancelDeleteReviewButton.disabled = false;
  }
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function getReviewClubFilterKey(review) {
  return review.clubId || `name:${normalizeSearchText(getReviewClubName(review))}`;
}

function updateReviewClubFilterOptions() {
  const selectedValue = elements.reviewClubFilter.value;
  const clubs = new Map();

  allReviews.forEach((review) => {
    clubs.set(getReviewClubFilterKey(review), getReviewClubName(review));
  });

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = "Tutti i locali";

  const options = [...clubs.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "it", { sensitivity: "base" }))
    .map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    });

  elements.reviewClubFilter.replaceChildren(firstOption, ...options);
  elements.reviewClubFilter.value = clubs.has(selectedValue) ? selectedValue : "";
}

function reviewFiltersAreActive() {
  return Boolean(
    elements.reviewSearchInput.value.trim() ||
      elements.reviewRatingFilter.value ||
      elements.reviewClubFilter.value,
  );
}

function currentFilteredReviews() {
  const search = normalizeSearchText(elements.reviewSearchInput.value);
  const rating = elements.reviewRatingFilter.value;
  const club = elements.reviewClubFilter.value;

  return allReviews.filter((review) => {
    if (rating && String(review.rating) !== rating) return false;
    if (club && getReviewClubFilterKey(review) !== club) return false;
    if (!search) return true;

    return normalizeSearchText(
      [
        getReviewDisplayName(review),
        review.authorName,
        review.userId,
        review.id,
        review.comment,
        getReviewClubName(review),
        formatDate(review.createdAt),
      ].join(" "),
    ).includes(search);
  });
}

function resetReviewFilters() {
  elements.reviewSearchInput.value = "";
  elements.reviewRatingFilter.value = "";
  elements.reviewClubFilter.value = "";
  renderReviews();
}

function renderReviews() {
  updateReviewClubFilterOptions();
  const reviews = currentFilteredReviews();
  const filtersActive = reviewFiltersAreActive();
  const fragment = document.createDocumentFragment();
  elements.reviewTableBody.replaceChildren();

  reviews.forEach((review) => {
    const row = document.createElement("tr");
    row.append(
      createReviewUserCell(review),
      createRatingCell(review.rating),
      createCell(
        "Commento",
        review.comment || "Commento non disponibile",
        "review-comment",
      ),
      createCell("Locale", getReviewClubName(review), "review-club"),
      createCell("Data", formatDate(review.createdAt), "review-date"),
      createReviewActionsCell(review),
    );
    row.title = `Recensione ${review.id} · ${review.status}`;
    fragment.append(row);
  });

  elements.reviewTableBody.append(fragment);
  elements.reviewTableViewport.scrollTop = 0;
  updateCompactTable(
    elements.reviewTableViewport,
    elements.reviewTableControls,
    elements.toggleReviewTable,
    reviews.length,
    { expand: "Mostra tutte", collapse: "Riduci elenco" },
  );
  elements.reviewEmptyState.hidden = reviews.length > 0;
  elements.reviewEmptyTitle.textContent =
    allReviews.length > 0 ? "Nessun risultato" : "Nessuna recensione";
  elements.reviewEmptyDescription.textContent =
    allReviews.length > 0
      ? "Modifica la ricerca o azzera i filtri applicati."
      : "Le nuove recensioni compariranno qui in tempo reale.";
  elements.reviewResultSummary.textContent = allReviews.length
    ? filtersActive
      ? `${reviews.length} risultati su ${allReviews.length} recensioni.`
      : `${allReviews.length} recensioni sincronizzate da Firestore.`
    : "Nessuna recensione presente.";
  elements.resetReviewFilters.disabled = !filtersActive;
  elements.reviewCount.textContent = String(allReviews.length);
  elements.reviewLastSync.textContent = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function subscribeToClubs() {
  unsubscribeClubs?.();

  const clubsQuery = query(
    collection(db, "clubs"),
    where("status", "==", "published"),
  );

  unsubscribeClubs = onSnapshot(
    clubsQuery,
    (snapshot) => {
      clubNamesById = new Map(
        snapshot.docs.map((club) => {
          const data = club.data();
          return [
            club.id,
            String(data.name || data.title || club.id).trim(),
          ];
        }),
      );
      renderReviews();
    },
    (error) => {
      console.error("Firestore club listener failed:", error);
      clubNamesById = new Map();
      renderReviews();
    },
  );
}

function subscribeToReviews() {
  unsubscribeReviews?.();
  setReviewConnectionStatus("Connessione…");

  unsubscribeReviews = onSnapshot(
    collectionGroup(db, "reviews"),
    (snapshot) => {
      allReviews = snapshot.docs.map(normalizeReview).sort((a, b) => {
        const aDate = dateFromFirestore(a.sortDate)?.getTime() || 0;
        const bDate = dateFromFirestore(b.sortDate)?.getTime() || 0;
        return bDate - aDate || a.path.localeCompare(b.path, "it");
      });
      setReviewConnectionStatus("Aggiornato in tempo reale");
      renderReviews();
      renderUsers();
    },
    (error) => {
      console.error("Firestore review listener failed:", error);
      setReviewConnectionStatus("Accesso ai dati negato", true);
      elements.reviewResultSummary.textContent =
        "Impossibile leggere le recensioni. Verifica il claim admin e le regole Firestore.";
      showToast("Lettura recensioni non autorizzata.");
    },
  );
}

function subscribeToUserProfiles() {
  unsubscribeUserProfiles?.();

  unsubscribeUserProfiles = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      userProfilesByUid = new Map(
        snapshot.docs.map((profile) => {
          const normalized = normalizeUser(profile);
          return [normalized.uid, normalized];
        }),
      );
      renderUsers();
      renderReviews();
    },
    (error) => {
      console.error("Firestore user profile listener failed:", error);
      userProfilesByUid = new Map();
      renderReviews();
    },
  );
}

function subscribeToConsents() {
  unsubscribeUsers?.();
  setConnectionStatus("Connessione…");

  const consentQuery = query(
    collection(db, "users"),
    where("marketingConsent", "==", true),
  );

  unsubscribeUsers = onSnapshot(
    consentQuery,
    (snapshot) => {
      allConsentUsers = snapshot.docs
        .map(normalizeUser)
        .sort((a, b) => {
          const aDate = dateFromFirestore(a.updatedAt)?.getTime() || 0;
          const bDate = dateFromFirestore(b.updatedAt)?.getTime() || 0;
          return bDate - aDate || a.email.localeCompare(b.email, "it");
        });
      setConnectionStatus("Aggiornato in tempo reale");
      updateStats();
      renderUsers();
    },
    (error) => {
      console.error("Firestore consent listener failed:", error);
      setConnectionStatus("Accesso ai dati negato", true);
      elements.resultSummary.textContent =
        "Impossibile leggere i profili. Verifica il claim admin e le regole Firestore.";
      showToast("Lettura Firestore non autorizzata.");
    },
  );
}

async function copyEmails() {
  const emails = getUniqueValidEmails(currentFilteredUsers());
  if (!emails.length) return;
  const text = emails.join(", ");

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }

  showToast(`${emails.length} email copiate. Incollale nel campo CCN/BCC.`);
}

function showLogin() {
  elements.loginView.hidden = false;
  elements.dashboardView.hidden = true;
  elements.adminEmail.textContent = "";
  allConsentUsers = [];
  allReviews = [];
  userProfilesByUid = new Map();
  clubNamesById = new Map();
  elements.reviewSearchInput.value = "";
  elements.reviewRatingFilter.value = "";
  elements.reviewClubFilter.value = "";
  closeDeleteReviewDialog();
  unsubscribeUsers?.();
  unsubscribeUsers = null;
  unsubscribeUserProfiles?.();
  unsubscribeUserProfiles = null;
  unsubscribeReviews?.();
  unsubscribeReviews = null;
  unsubscribeClubs?.();
  unsubscribeClubs = null;
}

function showDashboard(user) {
  elements.loginView.hidden = true;
  elements.dashboardView.hidden = false;
  elements.adminEmail.textContent = user.email || "Amministratore";
  subscribeToUserProfiles();
  subscribeToConsents();
  subscribeToClubs();
  subscribeToReviews();
}

elements.loginButton.addEventListener("click", async () => {
  elements.loginButton.disabled = true;
  setAuthMessage("Apertura accesso Google…");
  try {
    await authPersistence;
    const result = await signInWithPopup(auth, googleProvider);
    await result.user.getIdToken(true);
  } catch (error) {
    console.error("Google admin sign-in failed:", error);
    const messages = {
      "auth/popup-closed-by-user": "Accesso annullato.",
      "auth/cancelled-popup-request":
        "È già aperta una richiesta di accesso Google.",
      "auth/popup-blocked":
        "Il browser ha bloccato la finestra Google. Consenti i popup e riprova.",
      "auth/unauthorized-domain":
        "Questo dominio non è autorizzato in Firebase Authentication.",
    };
    const message =
      messages[error?.code] ||
      `Accesso non riuscito${error?.code ? ` (${error.code})` : ""}.`;
    setAuthMessage(message);
  } finally {
    elements.loginButton.disabled = false;
  }
});

elements.logoutButton.addEventListener("click", () => signOut(auth));
elements.searchInput.addEventListener("input", renderUsers);
elements.copyEmailsButton.addEventListener("click", copyEmails);
elements.toggleConsentTable.addEventListener("click", () =>
  toggleCompactTable(
    elements.consentTableViewport,
    elements.toggleConsentTable,
    { expand: "Mostra tutti", collapse: "Riduci elenco" },
  ),
);
elements.toggleReviewTable.addEventListener("click", () =>
  toggleCompactTable(
    elements.reviewTableViewport,
    elements.toggleReviewTable,
    { expand: "Mostra tutte", collapse: "Riduci elenco" },
  ),
);
elements.reviewSearchInput.addEventListener("input", renderReviews);
elements.reviewRatingFilter.addEventListener("change", renderReviews);
elements.reviewClubFilter.addEventListener("change", renderReviews);
elements.resetReviewFilters.addEventListener("click", resetReviewFilters);
elements.cancelDeleteReviewButton.addEventListener(
  "click",
  closeDeleteReviewDialog,
);
elements.confirmDeleteReviewButton.addEventListener(
  "click",
  deleteSelectedReview,
);
elements.deleteReviewDialog.addEventListener("close", () => {
  pendingReviewDelete = null;
});
elements.deleteReviewDialog.addEventListener("cancel", () => {
  pendingReviewDelete = null;
});
elements.deleteReviewDialog.addEventListener("click", (event) => {
  if (event.target === elements.deleteReviewDialog) closeDeleteReviewDialog();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setAuthMessage("");
    showLogin();
    return;
  }

  try {
    const token = await getIdTokenResult(user, true);
    if (token.claims.admin !== true) {
      setAuthMessage(
        `L’account ${user.email || ""} non è autorizzato come amministratore.`,
      );
      await signOut(auth);
      return;
    }
    setAuthMessage("");
    showDashboard(user);
  } catch (error) {
    console.error("Admin claim verification failed:", error);
    setAuthMessage("Impossibile verificare i permessi amministrativi.");
    await signOut(auth);
  }
});

