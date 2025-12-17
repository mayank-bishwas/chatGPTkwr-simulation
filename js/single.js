// js/single.js
document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     ELEMENTS
  ========================= */
  const queryInput = document.getElementById("queryInput");
  const actionBtn = document.getElementById("actionBtnTop");
  const inputError = document.getElementById("inputError");

  const resultsSection = document.getElementById("singleResultsSection");
  const resultsWrapper = document.getElementById("resultsContainer");

  const resetBtn = document.getElementById("resetBtn");
  const screenshotBtn = document.getElementById("screenshotBtn");

  const ccpPercentEl = document.getElementById("ccpPercent");
  const ccpQueryTextEl = document.getElementById("ccpQueryText");

  const fanoutList = document.getElementById("fanoutList");
  const snippetsList = document.getElementById("snippetsList");
  const urlsList = document.getElementById("urlsList");

  const copyButtons = document.querySelectorAll(".copy-btn");

  let isResultShown = false;

  /* =========================
     HELPERS
  ========================= */
  function showError(msg) {
    inputError.textContent = msg;
  }

  function clearError() {
    inputError.textContent = "";
  }

  function clearList(el) {
    el.innerHTML = "";
  }

  function renderList(el, items) {
    clearList(el);
    items.forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      el.appendChild(li);
    });
  }

  function setLoading(isLoading) {
    actionBtn.disabled = isLoading;
    // MODIFIED: Only set the text to "Analyze Query" if we are NOT in the result state
    if (isLoading || !isResultShown) {
        actionBtn.textContent = isLoading ? "Analyzing…" : "Analyze Query";
    }
  }

  function showResults() {
    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }

  function hideResults() {
    resultsSection.style.display = "none";
  }

  function switchToResetMode() {
    isResultShown = true;
    queryInput.disabled = true;
    actionBtn.textContent = "Reset";
    actionBtn.disabled = false;
    resetBtn.style.display = "flex";
  }

  function resetUI() {
    queryInput.value = "";
    queryInput.disabled = false;
    queryInput.focus();

    clearError();
    hideResults();

    ccpPercentEl.textContent = "--%";
    ccpQueryTextEl.textContent = "“your query will appear here”";

    clearList(fanoutList);
    clearList(snippetsList);
    clearList(urlsList);
    
    actionBtn.disabled = false;
    
    // <<< ADDED: Ensures the top button text is reset when ANY reset trigger calls resetUI() >>>
    actionBtn.textContent = "Analyze Query"; 

    resetBtn.style.display = "none";
    isResultShown = false;
  }

  /* =========================
     MAIN ACTION
  ========================= */
  async function analyzeQuery() {
    const query = queryInput.value.trim();

    if (!query) {
      showError("Type something, please. Curious cats ask questions 🐱");
      return;
    }

    if (query.length < 4 || query.length > 100) {
      showError("Query must be between 4–100 characters.");
      return;
    }

    clearError();
    setLoading(true);

    try {
      const res = await fetch("/api/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      ccpQueryTextEl.textContent = `“${data.query}”`;

      // ===== NO WEB SEARCH =====
      if (!data.needs_search) {
        const msg = "None. Because web search was NOT triggered to answer this query.";

        ccpPercentEl.textContent = "0%";
        renderList(fanoutList, [msg]);
        renderList(snippetsList, [msg]);
        renderList(urlsList, [msg]);

        showResults();
        switchToResetMode();
        return;
      }

      // ===== NORMAL SEARCH =====
      ccpPercentEl.textContent = `${data.ccp}%`;

      renderList(fanoutList, data.fanout_queries || []);
      renderList(snippetsList, data.snippets || []);
      renderList(urlsList, data.urls || []);

      showResults();
      switchToResetMode();

    } catch {
      showError("Cat lost its way. Refresh and retry 🐈");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     SCREENSHOT
  ========================= */
  screenshotBtn.addEventListener("click", async () => {
    resultsSection.classList.add("screenshot-mode");

    await html2canvas(resultsSection, {
      backgroundColor: "#121212",
      scale: 2
    }).then(canvas => {
      const link = document.createElement("a");
      link.download = "chatGPTkwr_single-query.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });

    resultsSection.classList.remove("screenshot-mode");
    showToast("Screenshot saved 📸");
  });

  function showToast(text) {
    const toast = document.createElement("div");
    toast.textContent = text;
    toast.style.cssText = `
      position: fixed;
      bottom: 64px;
      left: 50%;
      transform: translateX(-50%);
      background: #121212;
      color: #fefefe;
      padding: 10px 24px;
      border-radius: 12px;
      font-size: 20px;
      box-shadow: 0 4px 14px rgba(104, 127, 60, 0.15);
      z-index: 9999;

      opacity: "0",
      transition: "opacity 0.50s ease"
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /* =========================
     EVENTS
  ========================= */
  actionBtn.addEventListener("click", () => {
    isResultShown ? resetUI() : analyzeQuery();
});

  queryInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !isResultShown) {
      analyzeQuery();
    }
  });

  resetBtn.addEventListener("click", resetUI);

  copyButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;

      const text = [...target.querySelectorAll("li")]
        .map(li => li.textContent)
        .join("\n");

      await navigator.clipboard.writeText(text);
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 400);
    });
  });
});