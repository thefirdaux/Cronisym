const sessions = [
  {
    sport: "Badminton",
    title: "CBS Social Session",
    start: "2026-09-30T20:00:00+08:00",
    end: "2026-09-30T22:00:00+08:00",
    venue: "DS PA Desa Rejang",
    waze: "https://waze.com/ul/hw2864uw4w",
    price: "RM15/Player",
    slots: { male: "2/16", female: "0/8" },
    full: false,
  },
  {
    sport: "Netball",
    title: "Social Session",
    start: "2026-10-02T21:00:00+08:00",
    end: "2026-10-02T23:00:00+08:00",
    venue: "HKL Netball Court",
    waze: "https://waze.com/ul/hw286436mw",
    price: "RM10/Player",
    slots: { female: "28/28" },
    full: true,
  },
  {
    sport: "Badminton",
    title: "CBS Social Session",
    start: "2026-10-03T20:00:00+08:00",
    end: "2026-10-03T22:00:00+08:00",
    venue: "DS PA Desa Rejang",
    waze: "https://waze.com/ul/hw2864uw4w",
    price: "RM15/Player",
    slots: { male: "3/16", female: "0/8" },
    full: false,
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
  const key = upcoming.map(sessionKey).join("|") + JSON.stringify(loadBookings());
  if (key === shownKey) return;
  shownKey = key;

  sessionsCount.textContent = `(${upcoming.length})`;
  sessionsList.innerHTML = upcoming.length
    ? upcoming.map((s) => renderCard(withBooking(s), sessions.indexOf(s))).join("")
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

// ---- Joining with the saved setup profile ----
// Bookings are kept on this device only until a booking backend exists,
// so other visitors don't see them yet.
const BOOKINGS_KEY = "cronyism.bookings";
const sessionKey = (s) => `${s.start}|${s.title}`;

function loadBookings() {
  try {
    return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBookings(bookings) {
  try {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  } catch {
    // Storage blocked (e.g. private browsing): the join lasts until the page reloads.
  }
}

// The visitor's saved setup (name, phone, gender), from onboarding.js.
const myProfile = () => (typeof loadProfile === "function" ? loadProfile() : null);

// The session as this visitor sees it, with their own join / waitlist added in.
function withBooking(s) {
  const status = loadBookings()[sessionKey(s)] || null;
  const me = myProfile();
  if (!status || !me) return { ...s, status: null };
  if (status === "waitlist") return { ...s, status, waitlist: (s.waitlist || 0) + 1 };
  if (!s.slots[me.gender]) return { ...s, status: null };
  const [joined, capacity] = parseSlots(s.slots[me.gender]);
  const others = s.players?.[me.gender] || Array(joined).fill("Name");
  return {
    ...s,
    status,
    slots: { ...s.slots, [me.gender]: `${joined + 1}/${capacity}` },
    // Cut names saved before the 8-character limit existed.
    players: { ...s.players, [me.gender]: [...others, me.name.slice(0, NAME_MAX_LENGTH)] },
    me: { gender: me.gender, index: joined },
  };
}

const isFullFor = (s, gender) => {
  const [joined, capacity] = parseSlots(s.slots[gender]);
  return joined >= capacity;
};

// Sheet button: [label, action]. Actions: "joined", "waitlist", "leave", "none".
function ctaState(s) {
  const me = myProfile();
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
// TODO: replace the placeholder names with real player names once bookings come from a backend
// (e.g. `players: { male: ["Aiman", ...] }` on a session).
function playerRow(s, gender) {
  const [joined, capacity] = parseSlots(s.slots[gender]);
  const names = s.players?.[gender] || [];
  const circles = Array.from({ length: capacity }, (_, i) => {
    const taken = i < joined;
    // Open spots have no name; the empty label keeps the rows lined up.
    const name = taken ? names[i] || "Name" : "";
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
  const s = withBooking(session);
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
document.getElementById("sheet-cta").addEventListener("click", (e) => {
  const action = e.currentTarget.dataset.action;
  if (action === "none") return;
  // Not set up yet: ask for name / number / gender first.
  if (!myProfile()) {
    closeSheet(true);
    openOnboarding();
    return;
  }
  const bookings = loadBookings();
  const key = sessionKey(sheetSession);
  if (action === "leave") delete bookings[key];
  else bookings[key] = action;
  saveBookings(bookings);
  // TODO: send the join / waitlist / leave request once the booking backend exists.
  fillSheet(sheetSession);
  renderSessions();
});

document.getElementById("outstanding-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const phone = e.target.phone.value.trim();
  // TODO: hook up to the outstanding-balance lookup once the backend exists.
  console.log("Check outstanding for", phone);
});

renderSessions();

// Keep the list current while the page stays open, and when returning to the tab.
setInterval(renderSessions, 30 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderSessions();
});
