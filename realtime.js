// Shared, real-time session rosters using Firebase (Firestore + anonymous sign-in).
// Every open phone watches the same documents, so joins and leaves appear everywhere
// within about a second. Access is limited by firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  doc,
  initializeFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// Web app config from the Firebase console. These values identify the project and are
// meant to be public; what visitors can read or write is decided by firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyDiTgZCGkxpoyiKLjxJD7bDqItQwpwZc7A",
  authDomain: "cronyism-bs.firebaseapp.com",
  projectId: "cronyism-bs",
  storageBucket: "cronyism-bs.firebasestorage.app",
  messagingSenderId: "509213488590",
  appId: "1:509213488590:web:76597beaffd45f9af9679f",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Long polling instead of a streaming connection: iPhone Safari's streaming kept failing,
// and Firebase only fell back to long polling after a 15-20 second timeout.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

// Each browser gets its own anonymous ID (no password), kept across visits.
const uidReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve(user.uid);
      window.dispatchEvent(new Event("cronyism:signed-in"));
    } else {
      signInAnonymously(auth).catch((err) => {
        console.error("Anonymous sign-in failed", err);
        window.dispatchEvent(new CustomEvent("cronyism:db-error", { detail: err }));
      });
    }
  });
});

// A session document: { limits: {male, female}, male: [entry], female: [entry], waitlist: [entry] }
// where entry = { uid, name, at } (waitlist entries also carry `gender`).
const emptyRoster = () => ({ male: [], female: [], waitlist: [] });
const sessionRef = (id) => doc(db, "sessions", id);
const withDefaults = (data) => ({ ...emptyRoster(), ...data });

function statusOf(roster, uid) {
  if ([...roster.male, ...roster.female].some((p) => p.uid === uid)) return "joined";
  if (roster.waitlist.some((p) => p.uid === uid)) return "waitlist";
  return null;
}

// Calls onChange(roster) straight away and again whenever anyone changes this session.
function watchSession(id, onChange) {
  return onSnapshot(
    sessionRef(id),
    (snap) => onChange(snap.exists() ? withDefaults(snap.data()) : emptyRoster()),
    (err) => console.error(`Watching session ${id} failed`, err)
  );
}

// Takes a spot if one is free for that gender, otherwise joins the waiting list.
// Runs as a transaction, so two people can't both take the last spot. Returns the updated roster.
async function joinSession(id, { gender, name, limits }) {
  const uid = await uidReady;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef(id));
    const roster = snap.exists() ? withDefaults(snap.data()) : { ...emptyRoster(), limits };
    if (statusOf(roster, uid)) return roster;

    const entry = { uid, name, at: Date.now() };
    const hasRoom = roster[gender].length < (roster.limits[gender] || 0);
    const change = hasRoom ? { [gender]: [...roster[gender], entry] } : { waitlist: [...roster.waitlist, { ...entry, gender }] };

    if (snap.exists()) tx.update(sessionRef(id), change);
    else tx.set(sessionRef(id), { ...roster, ...change });
    return { ...roster, ...change };
  });
}

// Removes the visitor from the session and its waiting list. Returns the updated roster.
async function leaveSession(id) {
  const uid = await uidReady;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef(id));
    if (!snap.exists()) return emptyRoster();
    const roster = withDefaults(snap.data());
    const change = {};
    for (const key of ["male", "female", "waitlist"]) {
      const kept = roster[key].filter((p) => p.uid !== uid);
      if (kept.length !== roster[key].length) change[key] = kept;
    }
    if (Object.keys(change).length) tx.update(sessionRef(id), change);
    return { ...roster, ...change };
  });
}

// Moves the visitor from the waiting list into the session when a spot has opened up
// and they're next in line for their gender. The page calls this when it sees a free spot.
async function claimFreedSpot(id) {
  const uid = await uidReady;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef(id));
    if (!snap.exists()) return false;
    const roster = withDefaults(snap.data());
    const mine = roster.waitlist.find((p) => p.uid === uid);
    if (!mine) return false;
    const nextInLine = roster.waitlist.find((p) => p.gender === mine.gender);
    const hasRoom = roster[mine.gender].length < (roster.limits[mine.gender] || 0);
    if (nextInLine.uid !== uid || !hasRoom) return false;
    tx.update(sessionRef(id), {
      waitlist: roster.waitlist.filter((p) => p.uid !== uid),
      [mine.gender]: [...roster[mine.gender], { uid, name: mine.name, at: Date.now() }],
    });
    return true;
  });
}

// Keeps the visitor's setup details (including WhatsApp number) in a private document
// only they can read. The organiser can see these in the Firebase console.
async function saveProfile(profile) {
  const uid = await uidReady;
  const { name, phone, gender, badmintonLevel = null, netballLevel = null } = profile;
  return setDoc(doc(db, "profiles", uid), {
    name: name.slice(0, 8),
    phone,
    gender,
    badmintonLevel,
    netballLevel,
    updatedAt: serverTimestamp(),
  });
}

window.CronyismDB = {
  uid: () => auth.currentUser?.uid ?? null,
  statusOf,
  watchSession,
  joinSession,
  leaveSession,
  claimFreedSpot,
  saveProfile,
};
window.dispatchEvent(new Event("cronyism:db-ready"));
