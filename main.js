// `slots` are spots already booked outside the website (e.g. over WhatsApp) / total spots.
// People who join through the website are added on top, live, from Firebase (realtime.js).
const sessions = [
  {
    id: "2026-09-30-cbs-badminton",
    sport: "Badminton",
    title: "CBS Social Session",
    start: "2026-09-30T20:00:00+08:00",
    end: "2026-09-30T22:00:00+08:00",
    venue: "DS PA Desa Rejang",
    waze: "https://waze.com/ul/hw2864uw4w",
    price: "RM15/Player",
    slots: { male: "2/16", female: "0/8" },
  },
  {
    id: "2026-10-02-netball-social",
    sport: "Netball",
    title: "Social Session",
    start: "2026-10-02T21:00:00+08:00",
    end: "2026-10-02T23:00:00+08:00",
    venue: "HKL Netball Court",
    waze: "https://waze.com/ul/hw286436mw",
    price: "RM10/Player",
    slots: { female: "28/28" },
  },
  {
    id: "2026-10-03-cbs-badminton",
    sport: "Badminton",
    title: "CBS Social Session",
    start: "2026-10-03T20:00:00+08:00",
    end: "2026-10-03T22:00:00+08:00",
    venue: "DS PA Desa Rejang",
    waze: "https://waze.com/ul/hw2864uw4w",
    price: "RM15/Player",
    slots: { male: "3/16", female: "0/8" },
  },
];

// A session disappears from the homepage this long after it starts.
const HIDE_AFTER_START_MS = 15 * 60 * 1000;

// Sessions are in Malaysia time (UTC+8, no daylight saving), so dates and times
// are shown in that zone whatever time zone the viewer's phone is set to.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

const toMyt = (iso) => new Date(new Date(iso).getTime() + MYT_OFFSET_MS);

// "Wed, 30 Sept 2026"
function formatDate(iso) {
  const d = toMyt(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "8pm", "8:30pm", "12am"
function formatTime(iso) {
  const d = toMyt(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

const isUpcoming = (s, now = Date.now()) => now < new Date(s.start).getTime() + HIDE_AFTER_START_MS;

const icon = (name) => `<img src="assets/icons/${name}.svg" width="16" height="16" alt="" />`;
const meta = (name, text) => `<li class="meta">${icon(name)}<span>${text}</span></li>`;

// Card button colour: Joined (lime), On Waitlist (grey), Join Waitlist (amber), Join (yellow).
function cardButtonClass(s) {
  if (s.status === "joined") return " card__btn--joined";
  if (s.status === "waitlist") return " card__btn--on-waitlist";
  return s.full ? " card__btn--waitlist" : "";
}

function renderCard(s, index) {
  const slots = ["male", "female"]
    .filter((g) => s.slots[g])
    .map((g) => `<span class="meta" aria-label="${g} slots">${icon(g)}<span>${s.slots[g]}</span></span>`)
    .join("");

  return `
    <article class="card" data-index="${index}">
      <span class="card__tag">${s.sport}</span>
      <div class="card__body">
        <h3 class="card__title">${s.title}</h3>
        <ul class="card__meta">
          ${meta("calendar", formatDate(s.start))}
          ${meta("clock", `${formatTime(s.start)} - ${formatTime(s.end)}`)}
          ${meta("location", s.venue)}
          ${meta("price", s.price)}
        </ul>
        <div class="card__slots">${slots}</div>
      </div>
      <button class="card__btn${cardButtonClass(s)}" type="button">
        ${s.status === "joined" ? "Joined" : s.status === "waitlist" ? "On Waitlist" : s.full ? "Join Waitlist" : "Join"}
      </button>
    </article>`;
}

const sessionsList = document.getElementById("sessions-list");
const sessionsCount = document.getElementById("sessions-count");
const indicator = document.getElementById("sessions-indicator");
const thumb = indicator.firstElementChild;
let shownKey = null;

function renderSessions() {
  const upcoming = sessions.filter((s) => isUpcoming(s));
  // Skip re-rendering (and resetting the scroll position) when nothing changed.
  const key = JSON.stringify(upcoming.map((s) => [s.id, rosters[s.id]])) + myUid();
  if (key === shownKey) return;
  shownKey = key;

  sessionsCount.textContent = `(${upcoming.length})`;
  sessionsList.innerHTML = upcoming.length
    ? upcoming.map((s) => renderCard(withRoster(s), sessions.indexOf(s))).join("")
    : `<p class="sessions__empty">No upcoming sessions. Check back soon!</p>`;
  updateIndicator();
}

// Move the indicator thumb along its track in step with the session list's scroll.

function updateIndicator() {
  const maxScroll = sessionsList.scrollWidth - sessionsList.clientWidth;
  indicator.hidden = maxScroll <= 0;
  if (indicator.hidden) return;
  // Thumb width shows how much of the list is on screen; never smaller than a 12px circle.
  const trackWidth = indicator.clientWidth;
  const thumbWidth = Math.max(12, Math.round(trackWidth * (sessionsList.clientWidth / sessionsList.scrollWidth)));
  thumb.style.width = `${thumbWidth}px`;
  const travel = trackWidth - thumbWidth;
  const progress = Math.min(Math.max(sessionsList.scrollLeft / maxScroll, 0), 1);
  thumb.style.transform = `translateX(${progress * travel}px)`;
}

sessionsList.addEventListener("scroll", updateIndicator, { passive: true });
window.addEventListener("resize", updateIndicator);

// ---- Live rosters (shared across phones via realtime.js / Firebase) ----
const rosters = {}; // session id -> { limits, male: [entry], female: [entry], waitlist: [entry] }
const db = () => window.CronyismDB;
const myUid = () => db()?.uid() ?? null;

// The visitor's saved setup (name, phone, gender), from onboarding.js.
const myProfile = () => (typeof loadProfile === "function" ? loadProfile() : null);

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Spots the website may fill for each gender: total minus those booked outside the website.
function onlineLimits(s) {
  const limits = { male: 0, female: 0 };
  for (const g of slotKinds(s)) {
    const [booked, capacity] = parseSlots(s.slots[g]);
    limits[g] = Math.max(0, capacity - booked);
  }
  return limits;
}

// The session as this visitor sees it: outside bookings plus everyone who joined online.
function withRoster(s) {
  const roster = rosters[s.id] || { male: [], female: [], waitlist: [] };
  const uid = myUid();
  const view = { ...s, slots: {}, players: {}, me: null };
  for (const g of slotKinds(s)) {
    const [booked, capacity] = parseSlots(s.slots[g]);
    const online = roster[g] || [];
    view.slots[g] = `${booked + online.length}/${capacity}`;
    view.players[g] = [...Array(booked).fill("Name"), ...online.map((p) => p.name)];
    const mine = online.findIndex((p) => p.uid === uid);
    if (mine >= 0) view.me = { gender: g, index: booked + mine };
  }
  view.waitlist = (s.waitlist || 0) + roster.waitlist.length;
  view.status = uid ? db().statusOf(roster, uid) : null;
  view.full = slotKinds(s).every((g) => isFullFor(view, g));
  return view;
}

// Start listening to each upcoming session once Firebase is ready.
const watched = new Set();
function watchRosters() {
  if (!db()) return;
  for (const s of sessions.filter((x) => isUpcoming(x))) {
    if (watched.has(s.id)) continue;
    watched.add(s.id);
    db().watchSession(s.id, (roster) => {
      rosters[s.id] = roster;
      claimSpotIfNext(s.id, roster);
      renderSessions();
      if (!sheet.hidden && sheetSession?.id === s.id) fillSheet(sheetSession);
    });
  }
}

// "If someone who is already in leaves, the next person in the waitlist joins automatically":
// when this visitor is next in line and a spot is free, move them in.
const claiming = new Set();
function claimSpotIfNext(id, roster) {
  const uid = myUid();
  const mine = uid && roster.waitlist.find((p) => p.uid === uid);
  if (!mine || claiming.has(id)) return;
  const next = roster.waitlist.find((p) => p.gender === mine.gender);
  if (next.uid !== uid || (roster[mine.gender] || []).length >= (roster.limits?.[mine.gender] || 0)) return;
  claiming.add(id);
  db().claimFreedSpot(id).catch((err) => console.error(err)).finally(() => claiming.delete(id));
}

window.addEventListener("cronyism:db-ready", watchRosters);

// Firebase is loaded from here (not a <script> tag in index.html) so a phone holding an
// older cached index.html still connects. Bump ASSET_VERSION with the ?v= in the HTML files.
const ASSET_VERSION = "3";
let dbError = null;
import(`./realtime.js?v=${ASSET_VERSION}`).catch((err) => {
  console.error("Loading Firebase failed", err);
  window.dispatchEvent(new CustomEvent("cronyism:db-error", { detail: err }));
});
window.addEventListener("cronyism:db-error", (e) => {
  dbError = e.detail || true;
  if (!sheet.hidden) fillSheet(sheetSession);
});
window.addEventListener("cronyism:signed-in", () => {
  shownKey = null;
  renderSessions();
  if (!sheet.hidden) fillSheet(sheetSession);
});

const isFullFor = (s, gender) => {
  const [joined, capacity] = parseSlots(s.slots[gender]);
  return joined >= capacity;
};

// Sheet button: [label, action]. Actions: "joined", "waitlist", "leave", "none".
function ctaState(s) {
  const me = myProfile();
  if (dbError) return ["Couldn't connect. Tap to retry", "retry"];
  if (!db() || !myUid()) return ["Connecting…", "none"];
  if (s.status === "joined") return ["Leave Session", "leave"];
  if (s.status === "waitlist") return ["Leave Waitlist", "leave"];
  if (me && !s.slots[me.gender]) return [`${GENDERS[slotKinds(s)[0]].tag} Only session`, "none"];
  const full = me ? isFullFor(s, me.gender) : s.full;
  return full ? ["Join Waitlist", "waitlist"] : ["Join", "joined"];
}

// Directions button: the session's own Waze link, or a Waze search for the venue.
const wazeLink = (s) => s.waze || `https://waze.com/ul?q=${encodeURIComponent(s.venue)}&navigate=yes`;

// ---- Session details bottom sheet ----
const sheet = document.getElementById("session-sheet");
const sheetBackdrop = document.getElementById("sheet-backdrop");
let sheetSession = null;
let sheetReturnFocus = null;

// "28/28" -> [28, 28]
const parseSlots = (text) => text.split("/").map(Number);

const GENDERS = {
  male: { tag: "Mens", group: "Men Joined" },
  female: { tag: "Womens", group: "Women Joined" },
};

// Slot types this session offers, in a fixed order: men first, then women.
const slotKinds = (s) => ["male", "female"].filter((g) => s.slots[g]);

// Tags after the sport: "Womens Only" / "Mens Only" for single-gender sessions,
// otherwise one tag per gender ("Mens", "Womens").
function genderTags(s) {
  const kinds = slotKinds(s);
  if (kinds.length === 1) return [[kinds[0], `${GENDERS[kinds[0]].tag} Only`]];
  return kinds.map((g) => [g, GENDERS[g].tag]);
}

// A row of player circles: filled for joined players, dashed for open spots.
// Spots booked outside the website show as "Name"; online joiners show their own name.
function playerRow(s, gender) {
  const [joined, capacity] = parseSlots(s.slots[gender]);
  const names = s.players?.[gender] || [];
  const circles = Array.from({ length: capacity }, (_, i) => {
    const taken = i < joined;
    // Open spots have no name; the empty label keeps the rows lined up.
    const name = taken ? escapeHtml(names[i] || "Name") : "";
    const isMe = s.me?.gender === gender && s.me.index === i;
    return `<li class="player${isMe ? " player--me" : ""}"><span class="player__avatar player__avatar--${gender}${taken ? "" : " player__avatar--open"}"></span><span class="player__name">${name}</span></li>`;
  });
  return `<ul class="sheet__players">${circles.join("")}</ul>`;
}

// Single-gender sessions show one "Joined" row; mixed sessions get a row per gender.
function renderRoster(s) {
  const kinds = slotKinds(s);
  if (kinds.length === 1) {
    return `<p class="sheet__joined"><strong>Joined</strong> ( ${s.slots[kinds[0]]})</p>${playerRow(s, kinds[0])}`;
  }
  return kinds
    .map((g) => `<div class="roster-group"><p class="roster-group__title">${GENDERS[g].group} ( ${s.slots[g]})</p>${playerRow(s, g)}</div>`)
    .join("");
}

const detail = (name, text) =>
  `<li class="sheet__detail"><img src="assets/icons/${name}.svg" width="24" height="24" alt="" /><span>${text}</span></li>`;

function fillSheet(session) {
  const s = withRoster(session);
  document.getElementById("sheet-tags").innerHTML =
    `<span class="card__tag">${s.sport}</span>` +
    genderTags(s).map(([g, label]) => `<span class="card__tag sheet__tag--${g}">${label}</span>`).join("");
  document.getElementById("sheet-title").textContent = s.title;
  document.getElementById("sheet-details").innerHTML = [
    detail("calendar", formatDate(s.start)),
    detail("clock", `${formatTime(s.start)} - ${formatTime(s.end)}`),
    detail("location", s.venue),
    detail("price", s.price),
  ].join("");

  sheet.classList.toggle("sheet--mixed", slotKinds(s).length > 1);
  document.getElementById("sheet-roster").innerHTML = renderRoster(s);

  document.getElementById("sheet-waitlist-count").textContent = `Waiting List (${s.waitlist || 0})`;
  const cta = document.getElementById("sheet-cta");
  const [label, action] = ctaState(s);
  cta.textContent = label;
  cta.dataset.action = action;
  cta.disabled = action === "none";
  cta.classList.toggle("sheet__cta--leave", action === "leave");
  document.getElementById("sheet-directions").href = wazeLink(s);
  cta.classList.toggle("sheet__cta--waitlist", action === "waitlist");
}

function openSheet(s, returnFocus, byPointer) {
  sheetSession = s;
  sheetReturnFocus = returnFocus;
  fillSheet(s);
  document.body.classList.add("sheet-open");
  sheet.hidden = sheetBackdrop.hidden = false;
  sheet.scrollTop = 0;
  // Force a reflow so the slide-up transition runs after un-hiding.
  sheet.offsetWidth;
  sheet.classList.add("is-open");
  sheetBackdrop.classList.add("is-open");
  moveFocus(sheet, byPointer);
}

function closeSheet(byPointer = false) {
  if (sheet.hidden) return;
  document.body.classList.remove("sheet-open");
  sheet.style.transform = "";
  sheet.classList.remove("is-open", "is-dragging");
  sheetBackdrop.classList.remove("is-open");
  const hide = () => { if (!sheet.classList.contains("is-open")) sheet.hidden = sheetBackdrop.hidden = true; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) hide();
  else sheet.addEventListener("transitionend", hide, { once: true });
  if (sheetReturnFocus && document.contains(sheetReturnFocus)) moveFocus(sheetReturnFocus, byPointer);
}

// Tapping anywhere on a card (including its Join / Join Waitlist button) opens its details.
sessionsList.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  openSheet(sessions[card.dataset.index], card.querySelector(".card__btn"), isPointer(e));
});

sheetBackdrop.addEventListener("click", () => closeSheet(true));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});

// Swipe the sheet down to dismiss it (only when it's scrolled to the top).
let dragStartY = null;
sheet.addEventListener("touchstart", (e) => {
  dragStartY = sheet.scrollTop <= 0 ? e.touches[0].clientY : null;
}, { passive: true });
sheet.addEventListener("touchmove", (e) => {
  if (dragStartY === null) return;
  const dy = e.touches[0].clientY - dragStartY;
  if (dy <= 0) return;
  sheet.classList.add("is-dragging");
  sheet.style.transform = `translateY(${dy}px)`;
}, { passive: true });
sheet.addEventListener("touchend", (e) => {
  if (dragStartY === null) return;
  const dy = e.changedTouches[0].clientY - dragStartY;
  dragStartY = null;
  sheet.classList.remove("is-dragging");
  if (dy > 100) closeSheet(true);
  else sheet.style.transform = "";
});

function shareSession(text) {
  const s = sheetSession;
  const data = { title: s.title, text, url: location.origin + location.pathname };
  if (navigator.share) navigator.share(data).catch(() => {});
  else navigator.clipboard?.writeText(`${text} ${data.url}`);
}

const sessionSummary = (s) => `${s.sport} ${s.title}, ${formatDate(s.start)} ${formatTime(s.start)} at ${s.venue}`;

document.getElementById("sheet-invite").addEventListener("click", () =>
  shareSession(`Join me at ${sessionSummary(sheetSession)}!`)
);
document.getElementById("sheet-cta").addEventListener("click", async (e) => {
  const cta = e.currentTarget;
  const action = cta.dataset.action;
  if (action === "none") return;
  if (action === "retry") {
    location.reload();
    return;
  }
  // Not set up yet: ask for name / number / gender first.
  const me = myProfile();
  if (!me) {
    closeSheet(true);
    openOnboarding();
    return;
  }

  const session = sheetSession;
  cta.disabled = true;
  cta.textContent = action === "leave" ? "Leaving…" : "Joining…";
  try {
    if (action === "leave") {
      await db().leaveSession(session.id);
    } else {
      // Names saved before the 8-character limit existed are cut to fit.
      await db().joinSession(session.id, { gender: me.gender, name: me.name.slice(0, NAME_MAX_LENGTH), limits: onlineLimits(session) });
      db().saveProfile(me).catch((err) => console.error("Saving profile failed", err));
    }
  } catch (err) {
    console.error(err);
    alert("Couldn't update your spot. Please check your internet connection and try again.");
  }
  // The live roster update re-renders the sheet; this covers the no-change case.
  if (sheetSession === session) fillSheet(session);
});

document.getElementById("outstanding-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const phone = e.target.phone.value.trim();
  // TODO: hook up to the outstanding-balance lookup once the backend exists.
  console.log("Check outstanding for", phone);
});

// Joins used to be saved only on this phone; they now live in Firebase.
try {
  localStorage.removeItem("cronyism.bookings");
} catch {}

renderSessions();
watchRosters();

// Keep the list current while the page stays open, and when returning to the tab.
setInterval(() => {
  renderSessions();
  watchRosters();
}, 30 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderSessions();
});
