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
  searchInput: document.querySelector("#searchInput"),
  copyEmailsButton: document.querySelector("#copyEmailsButton"),
  consentTableBody: document.querySelector("#consentTableBody"),
  emptyState: document.querySelector("#emptyState"),
  resultSummary: document.querySelector("#resultSummary"),
  toast: document.querySelector("#toast"),
};

let allConsentUsers = [];
let unsubscribeUsers = null;
let toastTimer = null;

function setAuthMessage(message = "") {
  elements.authMessage.textContent = message;
}

function setConnectionStatus(label, isError = false) {
  elements.connectionStatus.lastChild.textContent = label;
  elements.connectionStatus.classList.toggle("error", isError);
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

function getDisplayName(data) {
  return (
    data.displayName ||
    data.name ||
    data.fullName ||
    data.username ||
    "Nome non salvato"
  );
}

function normalizeUser(snapshot) {
  const data = snapshot.data();
  const email = normalizeEmail(data.marketingEmail || data.email);
  return {
    uid: snapshot.id,
    name: getDisplayName(data),
    email,
    accountEmail: normalizeEmail(data.email),
    updatedAt: data.marketingConsentUpdatedAt || data.updatedAt || null,
    policyVersion: data.marketingConsentPolicyVersion || "—",
  };
}

function getUniqueValidEmails(users = allConsentUsers) {
  return [...new Set(users.map((user) => user.email).filter(isValidEmail))];
}

function currentFilteredUsers() {
  const search = elements.searchInput.value.trim().toLocaleLowerCase("it");
  if (!search) return allConsentUsers;
  return allConsentUsers.filter((user) =>
    [user.name, user.email, user.accountEmail, user.uid]
      .join(" ")
      .toLocaleLowerCase("it")
      .includes(search),
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

    const userCell = document.createElement("td");
    const name = document.createElement("span");
    const accountEmail = document.createElement("span");
    name.className = "user-name";
    name.textContent = user.name;
    accountEmail.className = "user-secondary";
    accountEmail.textContent =
      user.accountEmail && user.accountEmail !== user.email
        ? `Account: ${user.accountEmail}`
        : "Profilo Firebase";
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
  unsubscribeUsers?.();
  unsubscribeUsers = null;
}

function showDashboard(user) {
  elements.loginView.hidden = true;
  elements.dashboardView.hidden = false;
  elements.adminEmail.textContent = user.email || "Amministratore";
  subscribeToConsents();
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
