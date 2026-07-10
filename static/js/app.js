/* ==========================================================================
   NutriAI — Frontend Application Logic
   Handles: Tabs · Chat · Meal Analysis · Nutrition Plan · BMI · Family Plan
   ========================================================================== */

"use strict";

// ── State ──────────────────────────────────────────────────────────────────
const State = {
  currentTab: "chat",
  familyMembers: [],
  userProfile: null,
  mealPlanGenerated: false,
};

// ── DOM Helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);

// ── Format Markdown-ish text into HTML ─────────────────────────────────────
function formatResponse(text) {
  if (!text) return "";
  // Bold **text** → <strong>
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic *text* → <em>
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  // Headings ## or ###
  text = text.replace(/^###\s+(.+)$/gm, '<h4 class="mt-3 mb-1">$1</h4>');
  text = text.replace(/^##\s+(.+)$/gm,  '<h3 class="mt-3 mb-1">$1</h3>');
  // Bullet lists
  text = text.replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
  // Numbered lists
  text = text.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Line breaks
  text = text.replace(/\n{2,}/g, "</p><p>");
  text = text.replace(/\n/g, "<br/>");
  // Wrap orphan text in <p>
  if (!text.startsWith("<")) text = "<p>" + text + "</p>";
  return text;
}

// ── Toast Notification ──────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const el = $("toastEl");
  $("toastMsg").textContent = msg;
  el.className = `toast align-items-center border-0 toast-${type}`;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3000 }).show();
}

// ── Loading Overlay ─────────────────────────────────────────────────────────
function showLoader(text = "NutriAI is thinking…") {
  $("loaderText").textContent = text;
  $("loadingOverlay").classList.remove("d-none");
}
function hideLoader() {
  $("loadingOverlay").classList.add("d-none");
}

// ── API Request Helper ──────────────────────────────────────────────────────
async function apiPost(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiGet(endpoint) {
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
function switchTab(tabName) {
  State.currentTab = tabName;

  // Update nav pills
  document.querySelectorAll(".nav-pill").forEach((a) => {
    const isActive = a.dataset.tab === tabName;
    a.classList.toggle("active", isActive);
  });

  // Show/hide tab panes
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    const isTarget = pane.id === `tab-${tabName}`;
    pane.classList.toggle("d-none", !isTarget);
    if (isTarget) pane.classList.add("fade-in");
  });

  // Hide hero on non-chat tabs
  const hero = $("heroStrip");
  if (hero) hero.classList.toggle("d-none", tabName !== "chat");

  // Close mobile navbar
  const nav = document.querySelector(".navbar-collapse");
  if (nav && nav.classList.contains("show")) {
    bootstrap.Collapse.getInstance(nav)?.hide();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  DARK MODE TOGGLE
// ══════════════════════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem("nutriai-theme") || "light";
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("nutriai-theme", theme);

  const isDark = theme === "dark";
  const iconClass = isDark ? "bi-sun-fill" : "bi-moon-fill";
  const label = isDark ? "Light" : "Dark";

  [$("mobileThemeToggle"), $("desktopThemeToggle")].forEach((btn) => {
    if (!btn) return;
    const icon = btn.querySelector("i");
    const lbl  = btn.querySelector(".theme-label");
    if (icon) icon.className = `bi ${iconClass}`;
    if (lbl)  lbl.textContent = label;
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════════════════════
function scrollChatToBottom() {
  const el = $("chatMessages");
  el.scrollTop = el.scrollHeight;
}

function appendMessage(role, content, time) {
  const wrap = document.createElement("div");
  wrap.className = `chat-bubble-wrap ${role === "user" ? "user-wrap" : ""}`;

  const initial = role === "user" ? "You" : "AI";
  const avatarClass = role === "user" ? "avatar-user" : "avatar-ai";
  const bubbleClass = role === "user" ? "user-bubble" : "ai-bubble";
  const bubbleContent = role === "user"
    ? content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : formatResponse(content);

  wrap.innerHTML = `
    <div class="chat-avatar ${avatarClass}">${role === "user" ? "U" : "🌿"}</div>
    <div>
      <div class="chat-bubble ${bubbleClass}">${bubbleContent}</div>
      <div class="msg-time">${time || ""}</div>
    </div>
  `;
  $("chatMessages").appendChild(wrap);
  scrollChatToBottom();
}

function showTypingIndicator() {
  const wrap = document.createElement("div");
  wrap.className = "chat-bubble-wrap";
  wrap.id = "typingIndicator";
  wrap.innerHTML = `
    <div class="chat-avatar avatar-ai">🌿</div>
    <div>
      <div class="chat-bubble ai-bubble">
        <div class="typing-dots d-flex gap-1 align-items-center">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  $("chatMessages").appendChild(wrap);
  scrollChatToBottom();
}

function removeTypingIndicator() {
  const el = $("typingIndicator");
  if (el) el.remove();
}

function addWelcomeMessage() {
  const welcome = `**👋 Namaste! I'm NutriAI**, your personal AI nutrition expert powered by IBM Watsonx.ai (Granite).

I can help you with:
- **Personalized meal plans** tailored to your goals
- **Calorie & nutrition analysis** for any meal
- **BMI & TDEE calculations** with health insights
- **Indian diet expertise** — from dal-roti to dosas
- **Family nutrition planning** for all age groups

*Try one of the quick prompts below, or just ask me anything!*`;
  appendMessage("assistant", welcome, formatTime(new Date()));
}

function formatTime(d) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

async function sendChatMessage() {
  const input = $("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  input.style.height = "auto";
  updateCharCount();

  const btn = $("sendBtn");
  btn.disabled = true;

  appendMessage("user", msg, formatTime(new Date()));
  showTypingIndicator();

  // Hide quick prompts after first message
  const qp = $("quickPrompts");
  if (qp) qp.style.display = "none";

  try {
    const data = await apiPost("/api/chat", { message: msg });
    removeTypingIndicator();
    appendMessage("assistant", data.reply, data.timestamp);
  } catch (err) {
    removeTypingIndicator();
    appendMessage("assistant", `⚠️ Error: ${err.message}`, formatTime(new Date()));
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

function updateCharCount() {
  const input = $("chatInput");
  const cc = $("charCount");
  const len = input.value.length;
  cc.textContent = `${len} / 1000`;
  cc.classList.toggle("char-warn", len > 900);
}

// Auto-resize textarea
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

// ══════════════════════════════════════════════════════════════════════════════
//  MEAL ANALYSER
// ══════════════════════════════════════════════════════════════════════════════
async function analyseMeal() {
  const meal = $("mealInput").value.trim();
  if (!meal) { showToast("Please enter a meal description.", "error"); return; }

  showLoader("Analysing your meal…");
  try {
    const data = await apiPost("/api/meal-analysis", {
      meal,
      portion: $("portionInput").value.trim() || "standard serving",
    });
    const box = $("mealAnalysisResult");
    box.innerHTML = formatResponse(data.analysis);
    box.classList.remove("d-none");
  } catch (err) {
    showToast(`Analysis failed: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  QUICK TIPS
// ══════════════════════════════════════════════════════════════════════════════
async function getQuickTips() {
  const topic = $("tipsTopicInput").value.trim() || "general nutrition";
  showLoader("Fetching tips…");
  try {
    const data = await apiGet(`/api/quick-tips?topic=${encodeURIComponent(topic)}`);
    const box = $("quickTipsResult");
    box.innerHTML = formatResponse(data.tips);
    box.classList.remove("d-none");
  } catch (err) {
    showToast(`Tips fetch failed: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  NUTRITION PLAN (Dashboard)
// ══════════════════════════════════════════════════════════════════════════════
function saveProfile() {
  State.userProfile = {
    name:      $("profileName").value.trim()  || "User",
    age:       $("profileAge").value.trim(),
    gender:    $("profileGender").value,
    weight:    $("profileWeight").value.trim(),
    height:    $("profileHeight").value.trim(),
    goal:      $("profileGoal").value,
    activity_level: $("profileActivity").value,
    diet_type: $("profileDiet").value,
    medical_conditions: $("profileConditions").value.trim() || "none",
    allergies: $("profileAllergies").value.trim() || "none",
  };

  // Update stat cards
  if (State.userProfile.weight && State.userProfile.height) {
    const h = parseFloat(State.userProfile.height) / 100;
    const bmi = (parseFloat(State.userProfile.weight) / (h * h)).toFixed(1);
    $("statBMI").textContent = bmi;
    // Protein estimate: 0.8–1.2 g/kg
    const pMin = Math.round(parseFloat(State.userProfile.weight) * 0.8);
    const pMax = Math.round(parseFloat(State.userProfile.weight) * 1.2);
    $("statProtein").textContent = `${pMin}–${pMax}g`;
  }

  showToast("Profile saved! Click 'Generate' to build your plan.", "success");
}

async function generateNutritionPlan() {
  const profile = {
    name:      $("profileName").value.trim()  || "User",
    age:       $("profileAge").value.trim(),
    gender:    $("profileGender").value,
    weight:    $("profileWeight").value.trim(),
    height:    $("profileHeight").value.trim(),
    goal:      $("profileGoal").value,
    activity_level: $("profileActivity").value,
    diet_type: $("profileDiet").value,
    medical_conditions: $("profileConditions").value.trim(),
    allergies: $("profileAllergies").value.trim(),
    cuisine:   "Indian",
  };

  if (!profile.age || !profile.weight || !profile.height) {
    showToast("Please fill in age, weight, and height.", "error");
    return;
  }

  showLoader("Generating your personalised nutrition plan…");
  try {
    const data = await apiPost("/api/nutrition-plan", profile);

    // Update stat cards
    $("statCalories").textContent = `${data.tdee?.tdee ?? "—"} kcal`;
    $("statBMI").textContent = data.bmi?.bmi ?? "—";

    const result = $("dashboardResult");
    result.innerHTML = formatResponse(data.plan);
    result.classList.remove("d-none");
    showToast("Nutrition plan generated!", "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MEAL PLANNER
// ══════════════════════════════════════════════════════════════════════════════
async function generateMealPlan() {
  const payload = {
    name:      $("mpName").value.trim()  || "User",
    age:       $("mpAge").value.trim(),
    gender:    $("mpGender").value,
    weight:    $("mpWeight").value.trim(),
    height:    $("mpHeight").value.trim(),
    goal:      $("mpGoal").value,
    activity_level: $("mpActivity").value,
    diet_type: $("mpDiet").value,
    cuisine:   $("mpCuisine").value,
    medical_conditions: $("mpConditions").value.trim() || "none",
    allergies: $("mpAllergies").value.trim() || "none",
  };

  if (!payload.age || !payload.weight || !payload.height) {
    showToast("Please fill in age, weight, and height.", "error");
    return;
  }

  showLoader("Crafting your 7-day meal plan…");
  try {
    const data = await apiPost("/api/nutrition-plan", payload);
    const result = $("mealPlanResult");
    result.innerHTML = formatResponse(data.plan);

    const copyBtn = $("copyMealPlanBtn");
    if (copyBtn) copyBtn.style.display = "";

    State.mealPlanGenerated = true;
    showToast("7-day meal plan ready!", "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  BMI CALCULATOR
// ══════════════════════════════════════════════════════════════════════════════
async function calculateBMI() {
  const weight = parseFloat($("bmiWeight").value);
  const height = parseFloat($("bmiHeight").value);
  if (!weight || !height || weight < 1 || height < 1) {
    showToast("Please enter valid weight and height.", "error");
    return;
  }

  showLoader("Calculating BMI & calorie targets…");
  try {
    const data = await apiPost("/api/bmi", {
      weight, height,
      age:      parseInt($("bmiAge").value) || 30,
      gender:   $("bmiGender").value,
      activity: $("bmiActivity").value,
    });

    renderBMIResult(data);
    $("bmiEmptyState").classList.add("d-none");
    $("bmiResultPanel").classList.remove("d-none");
    showToast("BMI calculated!", "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

function renderBMIResult({ bmi, tdee, insight }) {
  const panel = $("bmiResultPanel");

  // Compute needle position (BMI 10–45 range)
  const pct = Math.min(100, Math.max(0, ((bmi.bmi - 10) / 35) * 100));

  panel.innerHTML = `
    <div class="row g-3">
      <div class="col-12">
        <div class="bmi-gauge-wrap">
          <div class="bmi-score" style="color:${bmi.colour}">${bmi.bmi}</div>
          <div class="bmi-category" style="color:${bmi.colour}">${bmi.category}</div>
          <div class="bmi-scale mt-3">
            <div style="background:#f59e0b" title="Underweight (<18.5)"></div>
            <div style="background:#22c55e" title="Normal (18.5–24.9)"></div>
            <div style="background:#f97316" title="Overweight (25–29.9)"></div>
            <div style="background:#ef4444" title="Obese (≥30)"></div>
          </div>
          <div class="bmi-pointer">
            <div class="bmi-pointer-arrow" style="left:${pct}%"></div>
          </div>
          <small class="text-muted d-block mt-1" style="font-size:0.72rem">
            ← Underweight | Normal | Overweight | Obese →
          </small>
        </div>
      </div>

      <div class="col-12">
        <div class="calorie-cards">
          <div class="calorie-card">
            <div class="cc-val">${tdee.bmr}</div>
            <div class="cc-label">BMR (kcal/day)</div>
          </div>
          <div class="calorie-card">
            <div class="cc-val">${tdee.tdee}</div>
            <div class="cc-label">Maintenance (TDEE)</div>
          </div>
          <div class="calorie-card">
            <div class="cc-val" style="color:var(--green)">${tdee.weight_loss}</div>
            <div class="cc-label">Weight Loss Goal</div>
          </div>
          <div class="calorie-card">
            <div class="cc-val" style="color:var(--orange)">${tdee.weight_gain}</div>
            <div class="cc-label">Weight Gain Goal</div>
          </div>
        </div>
      </div>

      ${insight ? `
      <div class="col-12">
        <div class="ai-insight-box">
          <div class="ai-insight-label">🌿 AI Insight (NutriAI)</div>
          ${formatResponse(insight)}
        </div>
      </div>` : ""}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
//  FAMILY PLAN
// ══════════════════════════════════════════════════════════════════════════════
function addFamilyMember() {
  const name = $("famName").value.trim();
  const age  = $("famAge").value.trim();
  if (!name || !age) { showToast("Name and age are required.", "error"); return; }

  const member = {
    name,
    age,
    gender:     $("famGender").value,
    goal:       $("famGoal").value,
    conditions: $("famConditions").value.trim() || "none",
    id: Date.now(),
  };

  State.familyMembers.push(member);
  renderFamilyMemberList();
  updateMemberCount();

  // Clear inputs
  $("famName").value = "";
  $("famAge").value  = "";
  $("famConditions").value = "";
  showToast(`${name} added!`, "success");
}

function removeFamilyMember(id) {
  State.familyMembers = State.familyMembers.filter((m) => m.id !== id);
  renderFamilyMemberList();
  updateMemberCount();
}

function renderFamilyMemberList() {
  const list = $("familyMemberList");
  if (State.familyMembers.length === 0) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = State.familyMembers.map((m) => `
    <div class="member-card">
      <div class="member-info">
        <div class="member-avatar">${m.name[0].toUpperCase()}</div>
        <div>
          <div class="member-name">${m.name}</div>
          <div class="member-meta">${m.age} yrs · ${m.gender} · ${m.goal}</div>
        </div>
      </div>
      <button class="btn-remove-member" onclick="removeFamilyMember(${m.id})" title="Remove">
        <i class="bi bi-x-circle-fill"></i>
      </button>
    </div>
  `).join("");
}

function updateMemberCount() {
  const n = State.familyMembers.length;
  $("memberCount").textContent = `${n} member${n !== 1 ? "s" : ""}`;
}

async function generateFamilyPlan() {
  if (State.familyMembers.length === 0) {
    showToast("Please add at least one family member.", "error");
    return;
  }
  showLoader("Creating family nutrition plan…");
  try {
    const data = await apiPost("/api/family-plan", {
      members: State.familyMembers,
      cuisine: $("famCuisine").value,
      budget:  $("famBudget").value,
    });
    $("familyPlanResult").innerHTML = formatResponse(data.plan);
    showToast("Family plan ready!", "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CLIPBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function copyMealPlan() {
  const content = $("mealPlanResult").innerText;
  try {
    await navigator.clipboard.writeText(content);
    showToast("Meal plan copied to clipboard!", "success");
  } catch {
    showToast("Copy not supported in this browser.", "error");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CLEAR CHAT
// ══════════════════════════════════════════════════════════════════════════════
async function clearChat() {
  try {
    await apiPost("/api/clear-chat", {});
  } catch { /* ignore */ }
  $("chatMessages").innerHTML = "";
  addWelcomeMessage();
  $("quickPrompts").style.display = "";
  showToast("Chat cleared.", "success");
}

// ══════════════════════════════════════════════════════════════════════════════
//  EVENT LISTENERS — wired once DOM is ready
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // ── Theme ──────────────────────────────────────────────────────────────────
  initTheme();
  $("mobileThemeToggle")?.addEventListener("click",  toggleTheme);
  $("desktopThemeToggle")?.addEventListener("click", toggleTheme);

  // ── Tab Navigation ─────────────────────────────────────────────────────────
  document.querySelectorAll("[data-tab]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  // ── Chat ───────────────────────────────────────────────────────────────────
  addWelcomeMessage();

  $("sendBtn").addEventListener("click", sendChatMessage);

  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  $("chatInput").addEventListener("input", () => {
    autoResize($("chatInput"));
    updateCharCount();
  });

  // Quick prompt buttons
  document.querySelectorAll(".qp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("chatInput").value = btn.dataset.prompt;
      autoResize($("chatInput"));
      updateCharCount();
      sendChatMessage();
    });
  });

  $("clearChatBtn").addEventListener("click", clearChat);

  // ── Meal Analyser ──────────────────────────────────────────────────────────
  $("analyseMealBtn").addEventListener("click", analyseMeal);

  // ── Quick Tips ─────────────────────────────────────────────────────────────
  $("getTipsBtn").addEventListener("click", getQuickTips);
  $("tipsTopicInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") getQuickTips();
  });

  // ── Dashboard / Nutrition Plan ─────────────────────────────────────────────
  $("saveProfileBtn").addEventListener("click", saveProfile);
  $("genNutritionPlanBtn").addEventListener("click", generateNutritionPlan);

  // ── Meal Planner ───────────────────────────────────────────────────────────
  $("genMealPlanBtn").addEventListener("click", generateMealPlan);
  $("copyMealPlanBtn")?.addEventListener("click", copyMealPlan);

  // ── BMI ────────────────────────────────────────────────────────────────────
  $("calcBmiBtn").addEventListener("click", calculateBMI);

  // Enter key for BMI fields
  [$("bmiWeight"), $("bmiHeight"), $("bmiAge")].forEach((el) => {
    el?.addEventListener("keydown", (e) => { if (e.key === "Enter") calculateBMI(); });
  });

  // ── Family Plan ────────────────────────────────────────────────────────────
  $("addMemberBtn").addEventListener("click", addFamilyMember);
  $("genFamilyPlanBtn").addEventListener("click", generateFamilyPlan);

  // Enter key for family member add
  [$("famName"), $("famAge")].forEach((el) => {
    el?.addEventListener("keydown", (e) => { if (e.key === "Enter") addFamilyMember(); });
  });

  console.log("🥗 NutriAI ready — powered by IBM Watsonx.ai Granite");
});

// Expose switchTab globally (used by hero button onclick)
window.switchTab = switchTab;
window.removeFamilyMember = removeFamilyMember;
