const categories = ["all", "food", "drinks", "outdoor", "culture", "event", "date", "trip"];
const categoryValues = ["food", "drinks", "outdoor", "culture", "event", "date", "trip", "other"];
const statusFilters = ["all", "saved", "planned", "done"];
const statusValues = ["saved", "planned", "done", "archived"];
const priceLevels = ["free", "low", "medium", "high", "unknown"];
const indoorOutdoorValues = ["indoor", "outdoor", "both", "unknown"];
const suitableForValues = ["solo", "date", "friends", "family", "group"];

let currentUser = null;
let activities = [];
let filteredActivities = [];
let activeCategory = "all";
let activeStatus = "all";
let searchTerm = "";
let editingActivityId = null;
let planningActivityId = null;

const $ = (selector) => document.querySelector(selector);

const elements = {
  authView: $("#authView"),
  dashboardView: $("#dashboardView"),
  authForm: $("#authForm"),
  authEmail: $("#authEmail"),
  authPassword: $("#authPassword"),
  authSubmit: $("#authSubmit"),
  authError: $("#authError"),
  loginTab: $("#loginTab"),
  signupTab: $("#signupTab"),
  userEmail: $("#userEmail"),
  logoutBtn: $("#logoutBtn"),
  newActivityBtn: $("#newActivityBtn"),
  searchInput: $("#searchInput"),
  categoryFilters: $("#categoryFilters"),
  statusFilters: $("#statusFilters"),
  activitiesGrid: $("#activitiesGrid"),
  emptyState: $("#emptyState"),
  loadingState: $("#loadingState"),
  resultCount: $("#resultCount"),
  activityModal: $("#activityModal"),
  activityForm: $("#activityForm"),
  activityModalTitle: $("#activityModalTitle"),
  activityError: $("#activityError"),
  saveActivityBtn: $("#saveActivityBtn"),
  planModal: $("#planModal"),
  planForm: $("#planForm"),
  planActivityTitle: $("#planActivityTitle"),
  planError: $("#planError"),
  savePlanBtn: $("#savePlanBtn"),
  shareLinkBox: $("#shareLinkBox"),
  shareLink: $("#shareLink"),
  copyShareBtn: $("#copyShareBtn"),
  toast: $("#toast"),
};

let authMode = "login";

function initApp() {
  if (!bucketClient) {
    showAuthError("Bitte trage zuerst Supabase URL und Anon Key in supabaseClient.js ein.");
    return;
  }

  buildStaticControls();
  bindEvents();
  checkSession();

  bucketClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    toggleViews(Boolean(currentUser));
    if (currentUser) loadActivities();
  });
}

async function checkSession() {
  setAuthLoading(true);
  const { data, error } = await bucketClient.auth.getSession();
  setAuthLoading(false);

  if (error) {
    showAuthError(error.message);
    return;
  }

  currentUser = data.session?.user ?? null;
  toggleViews(Boolean(currentUser));
  if (currentUser) await loadActivities();
}

async function signUp() {
  clearAuthError();
  setAuthLoading(true);
  const { data, error } = await bucketClient.auth.signUp({
    email: elements.authEmail.value.trim(),
    password: elements.authPassword.value,
  });
  setAuthLoading(false);

  if (error) return showAuthError(error.message);
  if (data.user) await ensureProfile(data.user);
  showToast("Registrierung erfolgreich. Prüfe ggf. deine E-Mails zur Bestätigung.");
}

async function signIn() {
  clearAuthError();
  setAuthLoading(true);
  const { error } = await bucketClient.auth.signInWithPassword({
    email: elements.authEmail.value.trim(),
    password: elements.authPassword.value,
  });
  setAuthLoading(false);

  if (error) return showAuthError(error.message);
  showToast("Willkommen zurück.");
}

async function signOut() {
  elements.logoutBtn.disabled = true;
  const { error } = await bucketClient.auth.signOut();
  elements.logoutBtn.disabled = false;

  if (error) return showToast(error.message);
  currentUser = null;
  activities = [];
  renderActivities();
  toggleViews(false);
}

async function loadActivities() {
  elements.loadingState.classList.remove("hidden");
  elements.activitiesGrid.classList.add("hidden");
  elements.emptyState.classList.add("hidden");

  const { data, error } = await bucketClient
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false });

  elements.loadingState.classList.add("hidden");
  elements.activitiesGrid.classList.remove("hidden");

  if (error) {
    showToast(error.message);
    return;
  }

  activities = data ?? [];
  applyFilters();
}

function renderActivities(list = filteredActivities) {
  elements.activitiesGrid.innerHTML = "";
  elements.resultCount.textContent = `${list.length} von ${activities.length} Aktivitäten`;
  elements.emptyState.classList.toggle("hidden", activities.length !== 0 || list.length !== 0);

  if (activities.length > 0 && list.length === 0) {
    elements.activitiesGrid.innerHTML = `<div class="state-card card">Keine Aktivität passt zu deinen Filtern.</div>`;
    return;
  }

  list.forEach((activity) => {
    const card = document.createElement("article");
    card.className = "activity-card card";
    card.innerHTML = `
      ${activity.image_url ? `<img class="activity-image" src="${escapeAttribute(activity.image_url)}" alt="${escapeAttribute(activity.title)}" loading="lazy">` : ""}
      <div class="activity-body">
        <div class="activity-top">
          <div>
            <span class="badge badge-accent">${escapeHtml(activity.category)}</span>
            <h3 class="activity-title">${escapeHtml(activity.title)}</h3>
          </div>
          <span class="badge">${escapeHtml(activity.status)}</span>
        </div>
        ${activity.description ? `<p class="muted">${escapeHtml(activity.description)}</p>` : ""}
        <div class="meta-grid">
          <span>📍 ${escapeHtml(activity.location_name || activity.address || "Kein Ort")}</span>
          <span>💸 ${escapeHtml(activity.price_level)}</span>
          <span>🌗 ${escapeHtml(activity.indoor_outdoor)}</span>
          <span>⏱ ${escapeHtml(activity.duration || "Offen")}</span>
        </div>
        ${renderTags(activity.tags)}
        ${activity.source_url ? `<a class="source-link" href="${escapeAttribute(activity.source_url)}" target="_blank" rel="noreferrer">Quelle öffnen ↗</a>` : ""}
        <div class="card-actions">
          <button class="btn btn-secondary" type="button" data-action="plan" data-id="${activity.id}">Planen</button>
          <button class="btn btn-secondary" type="button" data-action="done" data-id="${activity.id}">Gemacht</button>
          <button class="btn btn-ghost" type="button" data-action="edit" data-id="${activity.id}">Bearbeiten</button>
          <button class="btn btn-danger" type="button" data-action="delete" data-id="${activity.id}">Löschen</button>
        </div>
      </div>
    `;
    elements.activitiesGrid.appendChild(card);
  });
}

async function createActivity(payload) {
  const { error } = await bucketClient.from("activities").insert({ ...payload, user_id: currentUser.id });
  if (error) throw error;
  showToast("Aktivität gespeichert.");
  await loadActivities();
}

async function updateActivity(id, payload) {
  const { error } = await bucketClient.from("activities").update(payload).eq("id", id);
  if (error) throw error;
  showToast("Aktivität aktualisiert.");
  await loadActivities();
}

async function deleteActivity(id) {
  const activity = activities.find((item) => item.id === id);
  if (!confirm(`„${activity?.title ?? "Diese Aktivität"}“ wirklich löschen?`)) return;

  const { error } = await bucketClient.from("activities").delete().eq("id", id);
  if (error) return showToast(error.message);
  showToast("Aktivität gelöscht.");
  await loadActivities();
}

async function updateActivityStatus(id, status) {
  const { error } = await bucketClient.from("activities").update({ status }).eq("id", id);
  if (error) return showToast(error.message);
  showToast(status === "done" ? "Als gemacht markiert." : "Status aktualisiert.");
  await loadActivities();
}

async function createPlan() {
  clearPlanError();
  setPlanLoading(true);
  const plannedForValue = $("#planned_for").value;
  const payload = {
    activity_id: planningActivityId,
    creator_id: currentUser.id,
    planned_for: plannedForValue ? new Date(plannedForValue).toISOString() : null,
    note: $("#plan_note").value.trim() || null,
  };

  const { data, error } = await bucketClient.from("plans").insert(payload).select("share_token").single();

  if (error) {
    setPlanLoading(false);
    return showPlanError(error.message);
  }

  await updateActivityStatus(planningActivityId, "planned");
  const shareUrl = `${window.location.origin}${window.location.pathname.replace("index.html", "").replace(/\/$/, "")}/share.html?token=${data.share_token}`;
  elements.shareLink.value = shareUrl;
  elements.shareLinkBox.classList.remove("hidden");
  setPlanLoading(false);
  showToast("Plan erstellt. Share-Link ist bereit.");
}

async function copyShareLink() {
  if (!elements.shareLink.value) return;
  await navigator.clipboard.writeText(elements.shareLink.value);
  showToast("Share-Link kopiert.");
}

function openActivityModal(id = null) {
  editingActivityId = id;
  clearActivityError();
  elements.activityForm.reset();
  elements.activityModalTitle.textContent = id ? "Aktivität bearbeiten" : "Neue Aktivität";

  const activity = activities.find((item) => item.id === id);
  if (activity) fillActivityForm(activity);
  else $("#status").value = "saved";

  elements.activityModal.showModal();
}

function closeActivityModal() {
  editingActivityId = null;
  elements.activityModal.close();
}

function openPlanModal(id) {
  planningActivityId = id;
  const activity = activities.find((item) => item.id === id);
  elements.planActivityTitle.textContent = activity ? `„${activity.title}“ planen` : "Plan erstellen";
  elements.planForm.reset();
  clearPlanError();
  elements.shareLinkBox.classList.add("hidden");
  elements.shareLink.value = "";
  elements.planModal.showModal();
}

function closePlanModal() {
  planningActivityId = null;
  elements.planModal.close();
}

function applyFilters() {
  searchTerm = elements.searchInput.value.trim().toLowerCase();
  filteredActivities = activities.filter((activity) => {
    const categoryMatch = activeCategory === "all" || activity.category === activeCategory;
    const statusMatch = activeStatus === "all" || activity.status === activeStatus;
    const haystack = [
      activity.title,
      activity.description,
      activity.location_name,
      activity.address,
      ...(activity.tags ?? []),
      ...(activity.suitable_for ?? []),
    ].join(" ").toLowerCase();
    return categoryMatch && statusMatch && haystack.includes(searchTerm);
  });
  renderActivities(filteredActivities);
}

function buildStaticControls() {
  elements.categoryFilters.innerHTML = categories.map((category) => `<button class="chip ${category === "all" ? "active" : ""}" type="button" data-category="${category}">${label(category)}</button>`).join("");
  elements.statusFilters.innerHTML = statusFilters.map((status) => `<button class="chip ${status === "all" ? "active" : ""}" type="button" data-status="${status}">${label(status)}</button>`).join("");
  fillSelect("#category", categoryValues);
  fillSelect("#price_level", priceLevels);
  fillSelect("#indoor_outdoor", indoorOutdoorValues);
  fillSelect("#status", statusValues);
  fillSelect("#suitable_for", suitableForValues);
}

function bindEvents() {
  elements.loginTab.addEventListener("click", () => setAuthMode("login"));
  elements.signupTab.addEventListener("click", () => setAuthMode("signup"));
  elements.authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    authMode === "login" ? signIn() : signUp();
  });
  elements.logoutBtn.addEventListener("click", signOut);
  elements.newActivityBtn.addEventListener("click", () => openActivityModal());
  document.querySelectorAll("[data-open-activity]").forEach((button) => button.addEventListener("click", () => openActivityModal()));
  document.querySelectorAll("[data-close-activity]").forEach((button) => button.addEventListener("click", closeActivityModal));
  document.querySelectorAll("[data-close-plan]").forEach((button) => button.addEventListener("click", closePlanModal));
  elements.searchInput.addEventListener("input", applyFilters);
  elements.categoryFilters.addEventListener("click", (event) => setChipFilter(event, "category"));
  elements.statusFilters.addEventListener("click", (event) => setChipFilter(event, "status"));
  elements.copyShareBtn.addEventListener("click", copyShareLink);

  elements.activitiesGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "plan") openPlanModal(id);
    if (action === "done") updateActivityStatus(id, "done");
    if (action === "edit") openActivityModal(id);
    if (action === "delete") deleteActivity(id);
  });

  elements.activityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearActivityError();
    setActivityLoading(true);
    try {
      const payload = getActivityPayload();
      if (editingActivityId) await updateActivity(editingActivityId, payload);
      else await createActivity(payload);
      closeActivityModal();
    } catch (error) {
      showActivityError(error.message);
    } finally {
      setActivityLoading(false);
    }
  });

  elements.planForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createPlan();
  });
}

async function ensureProfile(user) {
  await bucketClient.from("profiles").upsert({ id: user.id, email: user.email }, { onConflict: "id" });
}

function setAuthMode(mode) {
  authMode = mode;
  elements.loginTab.classList.toggle("active", mode === "login");
  elements.signupTab.classList.toggle("active", mode === "signup");
  elements.authSubmit.textContent = mode === "login" ? "Einloggen" : "Account erstellen";
  clearAuthError();
}

function toggleViews(isAuthed) {
  elements.authView.classList.toggle("hidden", isAuthed);
  elements.dashboardView.classList.toggle("hidden", !isAuthed);
  elements.userEmail.textContent = currentUser?.email ? `Eingeloggt als ${currentUser.email}` : "";
}

function getActivityPayload() {
  return {
    title: $("#title").value.trim(),
    description: $("#description").value.trim() || null,
    source_url: $("#source_url").value.trim() || null,
    image_url: $("#image_url").value.trim() || null,
    location_name: $("#location_name").value.trim() || null,
    address: $("#address").value.trim() || null,
    category: $("#category").value,
    price_level: $("#price_level").value,
    estimated_price: $("#estimated_price").value ? Number($("#estimated_price").value) : null,
    duration: $("#duration").value.trim() || null,
    indoor_outdoor: $("#indoor_outdoor").value,
    suitable_for: Array.from($("#suitable_for").selectedOptions).map((option) => option.value),
    tags: parseCommaList($("#tags").value),
    status: $("#status").value,
  };
}

function fillActivityForm(activity) {
  Object.entries(activity).forEach(([key, value]) => {
    const field = document.getElementById(key);
    if (!field || Array.isArray(value)) return;
    field.value = value ?? "";
  });
  $("#tags").value = (activity.tags ?? []).join(", ");
  Array.from($("#suitable_for").options).forEach((option) => {
    option.selected = (activity.suitable_for ?? []).includes(option.value);
  });
}

function setChipFilter(event, type) {
  const button = event.target.closest("button");
  if (!button) return;
  if (type === "category") activeCategory = button.dataset.category;
  if (type === "status") activeStatus = button.dataset.status;
  button.parentElement.querySelectorAll(".chip").forEach((chip) => chip.classList.remove("active"));
  button.classList.add("active");
  applyFilters();
}

function fillSelect(selector, values) {
  const select = $(selector);
  select.innerHTML = values.map((value) => `<option value="${value}">${label(value)}</option>`).join("");
}

function parseCommaList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function renderTags(tags = []) {
  if (!tags.length) return "";
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function label(value) {
  return value === "all" ? "Alle" : value.charAt(0).toUpperCase() + value.slice(1).replace("_", " ");
}

function setAuthLoading(isLoading) { elements.authSubmit.disabled = isLoading; }
function setActivityLoading(isLoading) { elements.saveActivityBtn.disabled = isLoading; }
function setPlanLoading(isLoading) { elements.savePlanBtn.disabled = isLoading; }
function showAuthError(message) { elements.authError.textContent = message; elements.authError.hidden = false; }
function clearAuthError() { elements.authError.hidden = true; elements.authError.textContent = ""; }
function showActivityError(message) { elements.activityError.textContent = message; elements.activityError.hidden = false; }
function clearActivityError() { elements.activityError.hidden = true; elements.activityError.textContent = ""; }
function showPlanError(message) { elements.planError.textContent = message; elements.planError.hidden = false; }
function clearPlanError() { elements.planError.hidden = true; elements.planError.textContent = ""; }

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

document.addEventListener("DOMContentLoaded", initApp);
