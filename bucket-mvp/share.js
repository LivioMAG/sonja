let sharedPlan = null;
let selectedResponse = "yes";

const shareElements = {
  loading: document.querySelector("#shareLoading"),
  error: document.querySelector("#shareError"),
  content: document.querySelector("#shareContent"),
  toast: document.querySelector("#toast"),
};

async function loadSharedPlan() {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token || !bucketClient) {
    renderShareError();
    return;
  }

  const { data, error } = await bucketClient.rpc("get_shared_plan", { token });
  shareElements.loading.classList.add("hidden");

  if (error || !data || data.length === 0) {
    renderShareError();
    return;
  }

  sharedPlan = Array.isArray(data) ? data[0] : data;
  renderSharedPlan(sharedPlan);
}

function renderSharedPlan(plan) {
  shareElements.content.classList.remove("hidden");
  shareElements.content.innerHTML = `
    <p class="eyebrow">Du bist eingeladen</p>
    <h1 class="share-title">${escapeHtml(plan.activity_title)}</h1>
    ${plan.activity_description ? `<p class="muted">${escapeHtml(plan.activity_description)}</p>` : ""}
    <div class="meta-grid">
      <span>📍 ${escapeHtml(plan.location_name || plan.address || "Ort offen")}</span>
      <span>🗓 ${formatDate(plan.planned_for)}</span>
      <span>🏷 ${escapeHtml(plan.category || "other")}</span>
      <span>💸 ${escapeHtml(plan.price_level || "unknown")}</span>
    </div>
    ${plan.note ? `<div class="share-box"><strong>Notiz</strong><p>${escapeHtml(plan.note)}</p></div>` : ""}
    <form id="rsvpForm" class="form stack">
      <div>
        <label for="guestName">Dein Name</label>
        <input id="guestName" name="guestName" required maxlength="80" placeholder="z. B. Alex" />
      </div>
      <div>
        <label>RSVP</label>
        <div class="rsvp-options" role="group" aria-label="RSVP Antwort">
          <button class="btn rsvp-option active" type="button" data-response="yes">Bin dabei</button>
          <button class="btn rsvp-option" type="button" data-response="maybe">Vielleicht</button>
          <button class="btn rsvp-option" type="button" data-response="no">Keine Zeit</button>
        </div>
      </div>
      <button id="submitRsvpBtn" class="btn btn-primary btn-full" type="submit">RSVP speichern</button>
    </form>
  `;

  document.querySelector("#rsvpForm").addEventListener("submit", (event) => {
    event.preventDefault();
    submitRsvp();
  });
  shareElements.content.querySelector(".rsvp-options").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-response]");
    if (!button) return;
    selectedResponse = button.dataset.response;
    shareElements.content.querySelectorAll(".rsvp-option").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
}

async function submitRsvp() {
  const token = new URLSearchParams(window.location.search).get("token");
  const guestName = document.querySelector("#guestName").value.trim();
  const submitButton = document.querySelector("#submitRsvpBtn");

  if (!guestName) {
    showShareToast("Bitte gib deinen Namen ein.");
    return;
  }

  submitButton.disabled = true;
  const { error } = await bucketClient.rpc("create_rsvp", {
    token,
    guest_name: guestName,
    response: selectedResponse,
  });
  submitButton.disabled = false;

  if (error) {
    showShareToast(error.message);
    return;
  }

  document.querySelector("#rsvpForm").reset();
  selectedResponse = "yes";
  showShareToast("Danke! Deine Antwort wurde gespeichert.");
}

function renderShareError() {
  shareElements.loading.classList.add("hidden");
  shareElements.error.classList.remove("hidden");
}

function formatDate(value) {
  if (!value) return "Datum offen";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function showShareToast(message) {
  shareElements.toast.textContent = message;
  shareElements.toast.classList.add("show");
  window.setTimeout(() => shareElements.toast.classList.remove("show"), 3200);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

document.addEventListener("DOMContentLoaded", loadSharedPlan);
