// renderer.js

let currentConfig = null;

const appTitleEl = document.getElementById("appTitle");
const toggleConfigBtn = document.getElementById("toggleConfigBtn");
const configPanel = document.getElementById("configPanel");
const inputAppTitle = document.getElementById("inputAppTitle");
const sourcesConfigContainer = document.getElementById("sourcesConfig");
const displayArea = document.getElementById("displayArea");
const sourceCountSelect = document.getElementById("sourceCountSelect");
const gridColumnsSelect = document.getElementById("gridColumnsSelect");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

let slotRefs = [];
let lastGridColumns = null;
let presetsCache = [];

function normalizeStreamUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    // youtube watch -> embed
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      let videoId = null;
      if (host === "youtu.be") {
        videoId = u.pathname.slice(1);
      } else if (u.searchParams.get("v")) {
        videoId = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/").pop();
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
      }
    }
    // wrap HLS into local player
    if (/\.m3u8(\?|$)/i.test(u.pathname + u.search)) {
      const encoded = encodeURIComponent(url);
      return `player.html?src=${encoded}`;
    }
    return url;
  } catch (err) {
    return url;
  }
}

async function loadPresetsFallback() {
  try {
    const res = await fetch("stream-presets.json");
    if (!res.ok) throw new Error("failed");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

function renderDisplayArea() {
  if (!currentConfig) return;
  const sources = (currentConfig.sources || []).slice(0, 10);
  const cols = Math.min(Math.max(Number(currentConfig.gridColumns) || 3, 1), 5);
  slotRefs = [];
  displayArea.innerHTML = "";
  lastGridColumns = cols;

  const addRow = (rowSources, startIndex, singleRow) => {
    if (!rowSources.length) return;
    const row = document.createElement("div");
    row.className = "display-row" + (singleRow ? " single-row" : "");

    rowSources.forEach((source, i) => {
      const idx = startIndex + i;
      const slot = document.createElement("div");
      slot.className = "display-slot";

      const header = document.createElement("div");
      header.className = "slot-header frame";
      
      // Add decorations helper
      const addDecorations = (el) => {
        const corners = ["inner-top-left", "inner-top-right", "inner-bottom-left", "inner-bottom-right"];
        corners.forEach(c => {
          const div = document.createElement("div");
          div.className = `inner-corner ${c}`;
          el.appendChild(div);
        });
        const lines = ["inner-line-top", "inner-line-right", "inner-line-bottom", "inner-line-left"];
        lines.forEach(l => {
          const div = document.createElement("div");
          div.className = `connecting-line ${l}`;
          el.appendChild(div);
        });
      };

      addDecorations(header);

      const nameSpan = document.createElement("span");
      nameSpan.className = "slot-name";
      nameSpan.id = `slot-name-${idx}`;
      // Ensure content is above decorations if needed, or just append
      header.appendChild(nameSpan);

      // Create wrapper for iframe to hold frame decorations
      const iframeWrapper = document.createElement("div");
      iframeWrapper.className = "iframe-wrapper frame";
      addDecorations(iframeWrapper);

      const iframe = document.createElement("iframe");
      iframe.id = `iframe-${idx}`;
      iframe.dataset.currentUrl = "";
      iframe.allow =
        "autoplay; encrypted-media; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      
      iframeWrapper.appendChild(iframe);

      slot.appendChild(header);
      slot.appendChild(iframeWrapper);
      row.appendChild(slot);

      slotRefs[idx] = { slot, name: nameSpan, iframe };
    });

    displayArea.appendChild(row);
  };

  const total = sources.length;
  const rows = Math.ceil(total / cols) || 1;
  for (let r = 0; r < rows; r += 1) {
    const start = r * cols;
    const rowSlice = sources.slice(start, start + cols);
    addRow(rowSlice, start, rows === 1);
  }
}

function applyLayout(forceReload = false) {
  if (!currentConfig) return;
  const { appTitle, sources = [] } = currentConfig;

  const cols = Math.min(Math.max(Number(currentConfig.gridColumns) || 3, 1), 5);
  if (
    !slotRefs.length ||
    slotRefs.length !== sources.length ||
    lastGridColumns !== cols
  ) {
    renderDisplayArea();
  }

  appTitleEl.textContent = appTitle || "Display Manager";

  sources.forEach((source, idx) => {
    const ref = slotRefs[idx];
    if (!ref) return;

    const weight = Number(source.weight) || 1;
    // Use flex-grow directly for smoother proportional resizing
    ref.slot.style.flex = `${weight} 1 0`;
    ref.name.textContent = source.name || `PC ${idx + 1}`;
    const targetUrl = source.url || "about:blank";
    const currentUrl = ref.iframe.dataset.currentUrl;
    if (forceReload || currentUrl !== targetUrl) {
      ref.iframe.dataset.currentUrl = targetUrl;
      ref.iframe.src = targetUrl;
    }
  });
}

function renderConfigPanel() {
  if (!currentConfig) return;
  const { appTitle, sources = [] } = currentConfig;

  inputAppTitle.value = appTitle || "";
  sourceCountSelect.value = String(sources.length || 1);
  gridColumnsSelect.value = String(
    Math.min(Math.max(Number(currentConfig.gridColumns) || 3, 1), 5)
  );
  presetsCache = currentConfig.streamPresets || [];
  if (!presetsCache.length) {
    loadPresetsFallback().then((data) => {
      if (data.length) {
        currentConfig.streamPresets = data;
        presetsCache = data;
        renderConfigPanel();
      }
    });
  }

  sourcesConfigContainer.innerHTML = "";

  sources.forEach((source, idx) => {
    const row = document.createElement("div");
    row.className = "config-row";

    // Add corner and line decorations
    const corners = [
      "inner-top-left",
      "inner-top-right",
      "inner-bottom-left",
      "inner-bottom-right"
    ];
    corners.forEach(cornerClass => {
      const corner = document.createElement("div");
      corner.className = `inner-corner ${cornerClass}`;
      row.appendChild(corner);
    });

    const lines = [
      "inner-line-top",
      "inner-line-right",
      "inner-line-bottom",
      "inner-line-left"
    ];
    lines.forEach(lineClass => {
      const line = document.createElement("div");
      line.className = `connecting-line ${lineClass}`;
      row.appendChild(line);
    });

    const rowHeader = document.createElement("div");
    rowHeader.className = "config-row-header";

    const badge = document.createElement("div");
    badge.className = "grid-badge";
    badge.textContent = `Source #${idx + 1}`;
    rowHeader.appendChild(badge);

    // Create frame wrapper for remove button
    const removeBtnFrame = document.createElement("div");
    removeBtnFrame.className = "frame remove-btn-frame";
    
    // Add corner decorations
    const btnCorners = ["inner-top-left", "inner-top-right", "inner-bottom-left", "inner-bottom-right"];
    btnCorners.forEach(cornerClass => {
      const corner = document.createElement("div");
      corner.className = `inner-corner ${cornerClass}`;
      removeBtnFrame.appendChild(corner);
    });
    
    // Add line decorations
    const btnLines = ["inner-line-top", "inner-line-right", "inner-line-bottom", "inner-line-left"];
    btnLines.forEach(lineClass => {
      const line = document.createElement("div");
      line.className = `connecting-line ${lineClass}`;
      removeBtnFrame.appendChild(line);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.className = "remove-source";
    removeBtn.dataset.index = idx;
    
    removeBtnFrame.appendChild(removeBtn);
    rowHeader.appendChild(removeBtnFrame);

    row.appendChild(rowHeader);

    // Preset select
    const groupPreset = document.createElement("div");
    groupPreset.className = "config-group";
    const labelPreset = document.createElement("label");
    labelPreset.textContent = "Select Preset";
    const presetSelect = document.createElement("select");
    presetSelect.className = "preset-select";
    presetSelect.dataset.index = idx;
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "- Select preset -";
    presetSelect.appendChild(emptyOpt);
    presetsCache.forEach((preset, pIdx) => {
      const opt = document.createElement("option");
      opt.value = String(pIdx);
      opt.textContent = preset.label;
      presetSelect.appendChild(opt);
    });
    groupPreset.appendChild(labelPreset);
    groupPreset.appendChild(presetSelect);
    row.appendChild(groupPreset);

    // Name
    const groupName = document.createElement("div");
    groupName.className = "config-group";
    const labelName = document.createElement("label");
    labelName.textContent = "Display Name";
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.value = source.name || "";
    inputName.dataset.index = idx;
    inputName.dataset.field = "name";
    groupName.appendChild(labelName);
    groupName.appendChild(inputName);

    // URL
    const groupUrl = document.createElement("div");
    groupUrl.className = "config-group";
    const labelUrl = document.createElement("label");
    labelUrl.textContent = "URL (stream / dashboard / remote viewer)";
    const inputUrl = document.createElement("input");
    inputUrl.type = "text";
    inputUrl.value = source.url || "";
    inputUrl.dataset.index = idx;
    inputUrl.dataset.field = "url";
    groupUrl.appendChild(labelUrl);
    groupUrl.appendChild(inputUrl);

    // Weight
    const groupWeight = document.createElement("div");
    groupWeight.className = "config-group";
    const labelWeight = document.createElement("label");
    labelWeight.textContent = "Width Proportion (1–5)";
    const inputWeight = document.createElement("input");
    inputWeight.type = "range";
    inputWeight.min = "1";
    inputWeight.max = "5";
    inputWeight.step = "0.1";
    inputWeight.value = source.weight || 1;
    inputWeight.dataset.index = idx;
    inputWeight.dataset.field = "weight";
    const weightValue = document.createElement("div");
    weightValue.className = "weight-value";
    weightValue.textContent = (source.weight || 1).toFixed(1);
    weightValue.dataset.index = idx;
    groupWeight.appendChild(labelWeight);
    groupWeight.appendChild(inputWeight);
    groupWeight.appendChild(weightValue);

    row.appendChild(groupName);
    row.appendChild(groupUrl);
    row.appendChild(groupWeight);

    sourcesConfigContainer.appendChild(row);
  });
}

toggleConfigBtn.addEventListener("click", () => {
  configPanel.classList.toggle("hidden");
});

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

sourceCountSelect.addEventListener("change", () => {
  if (!currentConfig) return;
  const desired = Math.min(Math.max(Number(sourceCountSelect.value) || 1, 1), 10);
  const current = currentConfig.sources.length;
  if (desired > current) {
    const toAdd = desired - current;
    for (let i = 0; i < toAdd; i += 1) {
      currentConfig.sources.push({
        name: `PC ${currentConfig.sources.length + 1}`,
        url: "",
        weight: 1,
      });
    }
  } else if (desired < current) {
    currentConfig.sources = currentConfig.sources.slice(0, desired);
  }
  renderConfigPanel();
  renderDisplayArea();
  applyLayout();
});

gridColumnsSelect.addEventListener("change", () => {
  if (!currentConfig) return;
  currentConfig.gridColumns = Math.min(
    Math.max(Number(gridColumnsSelect.value) || 3, 1),
    5
  );
  renderDisplayArea();
  applyLayout();
});

sourcesConfigContainer.addEventListener("click", (event) => {
  if (
    event.target instanceof HTMLElement &&
    event.target.classList.contains("remove-source")
  ) {
    if (!currentConfig) return;
    const idx = Number(event.target.dataset.index);
    if (!Number.isInteger(idx)) return;
    currentConfig.sources.splice(idx, 1);
    const desired = Math.min(
      Math.max(Number(sourceCountSelect.value) || currentConfig.sources.length, 1),
      10
    );
    currentConfig.sources = currentConfig.sources.slice(0, desired);
    renderConfigPanel();
    renderDisplayArea();
    applyLayout();
  }
});

sourcesConfigContainer.addEventListener("input", (event) => {
  if (!currentConfig) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const idx = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!Number.isInteger(idx) || field !== "weight") return;

  const newWeight = Number(target.value || 1);
  currentConfig.sources[idx].weight = newWeight;

  // Update displayed value
  const valueDisplay = sourcesConfigContainer.querySelector(
    `.weight-value[data-index="${idx}"]`
  );
  if (valueDisplay) valueDisplay.textContent = newWeight.toFixed(1);

  applyLayout();
});

sourcesConfigContainer.addEventListener("change", (event) => {
  if (!currentConfig) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const idx = Number(target.dataset.index);
  if (!Number.isInteger(idx)) return;

  const presets = currentConfig.streamPresets || [];

  if (target.classList.contains("preset-select")) {
    const presetIdx = Number(target.value);
    const preset = presets[presetIdx];
    if (preset) {
      currentConfig.sources[idx].url = normalizeStreamUrl(preset.url || "");
      currentConfig.sources[idx].name = preset.label || currentConfig.sources[idx].name;
      const nameInput = sourcesConfigContainer.querySelector(
        `input[data-field="name"][data-index="${idx}"]`
      );
      const urlInput = sourcesConfigContainer.querySelector(
        `input[data-field="url"][data-index="${idx}"]`
      );
      if (nameInput) nameInput.value = currentConfig.sources[idx].name || "";
      if (urlInput) urlInput.value = currentConfig.sources[idx].url || "";
      applyLayout();
    }
  }
});

saveConfigBtn.addEventListener("click", async () => {
  if (!currentConfig) return;

  const newConfig = { ...currentConfig };
  newConfig.appTitle = inputAppTitle.value || "Display Manager";

  const inputs = sourcesConfigContainer.querySelectorAll("input");
  inputs.forEach((input) => {
    const idx = Number(input.dataset.index);
    const field = input.dataset.field;
    if (Number.isInteger(idx) && field) {
      if (field === "weight") {
        newConfig.sources[idx][field] = Number(input.value || 1);
      } else if (field === "url") {
        newConfig.sources[idx][field] = normalizeStreamUrl(input.value || "");
      } else {
        newConfig.sources[idx][field] = input.value;
      }
    }
  });

  newConfig.sources = (newConfig.sources || []).slice(0, 10);
  newConfig.gridColumns = Math.min(
    Math.max(Number(gridColumnsSelect.value) || 3, 1),
    5
  );

  currentConfig = await window.electronAPI.setConfig(newConfig);
  renderDisplayArea();
  applyLayout(true); // force iframe reload after saving
  configPanel.classList.add("hidden");
});

// INIT
(async () => {
  currentConfig = await window.electronAPI.getConfig();
  if (currentConfig?.sources?.length > 10) {
    currentConfig.sources = currentConfig.sources.slice(0, 10);
  }
  if (!currentConfig.gridColumns) currentConfig.gridColumns = 3;
  if (!currentConfig.streamPresets || currentConfig.streamPresets.length === 0) {
    currentConfig.streamPresets = await loadPresetsFallback();
  }
  renderDisplayArea();
  applyLayout();
  renderConfigPanel();
})();
