// First-visit setup card: details -> badminton level -> netball level.
// Answers are kept on this device so the card only shows once.
// TODO: send the profile to the booking backend once it exists.
const PROFILE_KEY = "cronyism.profile";
const LEVELS = ["Beginner", "Social Player", "Intermediate", "Advanced"];
// Names are shown under a 48px player circle, which fits about 8 characters.
const NAME_MAX_LENGTH = 8;

const onboard = document.getElementById("onboard");
const onboardBackdrop = document.getElementById("onboard-backdrop");
const detailsForm = document.getElementById("onboard-step-1");
const nameInput = document.getElementById("onboard-name");
const phoneInput = document.getElementById("onboard-phone");
const steps = [...onboard.querySelectorAll(".onboard__step")];
const profile = {};

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY));
  } catch {
    return null;
  }
}

function saveProfile(data) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  } catch {
    // Private browsing or storage blocked: the card will simply show again next visit.
  }
}

// Put the saved WhatsApp number into the "Check your outstanding" box,
// unless the visitor has already typed something there.
function prefillOutstanding(phone) {
  const input = document.getElementById("phone");
  if (input && phone && !input.value) input.value = phone;
}

// Level buttons for each sport, plus the "not playing" choice.
for (const step of steps.slice(1)) {
  const sport = step.dataset.sport;
  step.querySelector(".onboard__options").innerHTML = [...LEVELS, `Im not playing ${sport}`]
    .map((label, i) => `<button class="onboard__option" type="button" data-level="${i < LEVELS.length ? label : "none"}">${label}</button>`)
    .join("");
}

function showStep(index) {
  steps.forEach((step, i) => (step.hidden = i !== index));
  onboard.setAttribute("aria-labelledby", steps[index].querySelector(".onboard__title").id);
  onboard.scrollTop = 0;
}

function openOnboarding() {
  showStep(0);
  document.body.classList.add("onboard-open");
  onboard.hidden = onboardBackdrop.hidden = false;
  // Force a reflow so the fade-in transition runs after un-hiding.
  onboard.offsetWidth;
  onboard.classList.add("is-open");
  onboardBackdrop.classList.add("is-open");
}

function closeOnboarding() {
  document.body.classList.remove("onboard-open");
  onboard.classList.remove("is-open");
  onboardBackdrop.classList.remove("is-open");
  const hide = () => { if (!onboard.classList.contains("is-open")) onboard.hidden = onboardBackdrop.hidden = true; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) hide();
  else onboard.addEventListener("transitionend", hide, { once: true });
}

// Highlight the tapped option briefly, then move on.
function choose(button, next) {
  button.parentElement.querySelectorAll(".onboard__option").forEach((b) => {
    b.classList.toggle("is-selected", b === button);
    b.setAttribute("aria-pressed", String(b === button));
  });
  setTimeout(next, 200);
}

// A WhatsApp number: 9-13 digits, optionally with spaces, dashes or a leading +.
function checkPhone() {
  const value = phoneInput.value.trim();
  const digits = value.replace(/\D/g, "").length;
  const ok = !value || (/^\+?[\d\s-]+$/.test(value) && digits >= 9 && digits <= 13);
  phoneInput.setCustomValidity(ok ? "" : "Enter a valid WhatsApp number, e.g. 0123456789");
}

// Step 1: name + WhatsApp number, then tapping Men / Women continues.
function detailsValid() {
  checkPhone();
  let firstInvalid = null;
  for (const input of detailsForm.querySelectorAll("input")) {
    input.value = input.value.trim();
    const ok = input.checkValidity();
    input.classList.toggle("is-invalid", !ok);
    if (!ok && !firstInvalid) firstInvalid = input;
  }
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.reportValidity();
  }
  return !firstInvalid;
}

detailsForm.addEventListener("input", (e) => {
  if (e.target === phoneInput) checkPhone();
  if (e.target.checkValidity()) e.target.classList.remove("is-invalid");
});

// Pressing Go / Enter on the keyboard moves between the two fields.
detailsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (document.activeElement === nameInput) phoneInput.focus();
  else document.activeElement.blur();
});

detailsForm.querySelectorAll("[data-gender]").forEach((button) =>
  button.addEventListener("click", () => {
    if (!detailsValid()) return;
    profile.name = nameInput.value.slice(0, NAME_MAX_LENGTH);
    profile.phone = phoneInput.value;
    profile.gender = button.dataset.gender;
    choose(button, () => showStep(1));
  })
);

// Steps 2 and 3: pick a level for each sport.
steps.slice(1).forEach((step, i) =>
  step.addEventListener("click", (e) => {
    const button = e.target.closest("[data-level]");
    if (!button) return;
    profile[`${step.dataset.sport}Level`] = button.dataset.level;
    choose(button, () => {
      if (i + 2 < steps.length) return showStep(i + 2);
      saveProfile({ ...profile, savedAt: new Date().toISOString() });
      prefillOutstanding(profile.phone);
      closeOnboarding();
    });
  })
);

const savedProfile = loadProfile();
if (savedProfile) prefillOutstanding(savedProfile.phone);
else openOnboarding();
