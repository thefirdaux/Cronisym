// Shared menu drawer: injected into every page that has the header menu button.
document.body.insertAdjacentHTML(
  "beforeend",
  `
<div class="drawer-backdrop" id="menu-backdrop" hidden></div>
<aside class="drawer" id="menu-drawer" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <div class="drawer__head">
    <div class="drawer__brand">
      <p class="drawer__name">CRONYISM</p>
      <p class="drawer__tagline">SPORTS SYNDICATE</p>
    </div>
    <button class="icon-btn drawer__close" id="menu-close" type="button" aria-label="Close menu">
      <img src="assets/icons/close.svg" width="24" height="24" alt="" />
    </button>
  </div>

  <nav class="drawer__nav" aria-label="Main">
    <a class="drawer__link" href="#">Badminton Session</a>
    <a class="drawer__link" href="#">Netball Session</a>
    <a class="drawer__link" href="index.html#outstanding">Outstanding check</a>
    <a class="drawer__link" href="#">Join community</a>
    <a class="drawer__link" href="#">Be Cronies</a>
    <a class="drawer__link" href="#">Merchandise</a>
  </nav>

  <div class="drawer__social">
    <a class="drawer__link drawer__link--icon" href="https://www.tiktok.com/@cronyism.bs" target="_blank" rel="noopener">
      <img src="assets/icons/tiktok.svg" width="24" height="24" alt="" />
      <span><span class="visually-hidden">TikTok: </span>Cronyism.bs</span>
    </a>
    <a class="drawer__link drawer__link--icon drawer__link--last" href="https://www.threads.net/@cronyism.bs" target="_blank" rel="noopener">
      <img src="assets/icons/threads.svg" width="24" height="24" alt="" />
      <span><span class="visually-hidden">Threads: </span>Cronyism.bs</span>
    </a>
  </div>

  <a class="drawer__admin" href="admin-login.html">
    <img src="assets/icons/admin.svg" width="24" height="24" alt="" />
    Admin Log in
  </a>
</aside>
`
);

const drawer = document.getElementById("menu-drawer");
const backdrop = document.getElementById("menu-backdrop");
const openBtn = document.getElementById("menu-open");
const closeBtn = document.getElementById("menu-close");

// Move focus for screen readers and keyboard users, but skip the focus outline
// when the drawer was toggled by a tap/click (iOS Safari draws it anyway).
function moveFocus(el, byPointer) {
  el.classList.toggle("no-focus-ring", byPointer);
  el.addEventListener("blur", () => el.classList.remove("no-focus-ring"), { once: true });
  el.focus();
}

// Keyboard-activated clicks report detail 0; taps and mouse clicks report 1+.
const isPointer = (e) => e.detail > 0;

function setMenuOpen(open, byPointer = false) {
  openBtn.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("drawer-open", open);

  if (open) {
    drawer.hidden = backdrop.hidden = false;
    // Force a reflow so the slide-in transition runs after un-hiding.
    drawer.offsetWidth;
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    moveFocus(closeBtn, byPointer);
  } else {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    const hide = () => { if (!drawer.classList.contains("is-open")) drawer.hidden = backdrop.hidden = true; };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) hide();
    else drawer.addEventListener("transitionend", hide, { once: true });
    moveFocus(openBtn, byPointer);
  }
}

openBtn.addEventListener("click", (e) => setMenuOpen(true, isPointer(e)));
closeBtn.addEventListener("click", (e) => setMenuOpen(false, isPointer(e)));
backdrop.addEventListener("click", () => setMenuOpen(false, true));
// Only close for links that stay on this page. Closing (and moving focus) while
// a cross-page link is being followed cancels the navigation in iOS Safari.
const samePage = (path) => path.replace(/\/index\.html$/, "/") === location.pathname.replace(/\/index\.html$/, "/");

drawer.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link || link.target === "_blank" || !samePage(link.pathname)) return;
  if (link.hash && link.pathname !== location.pathname) {
    // e.g. "index.html#outstanding" while on "/": jump to the section without reloading.
    e.preventDefault();
    location.hash = link.hash;
  }
  setMenuOpen(false, isPointer(e));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !drawer.hidden) setMenuOpen(false);
});
