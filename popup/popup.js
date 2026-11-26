(function () {
  "use strict";

  const ids = [
    "gridVisible", "siteName", "status", "controls", "opacity", "opacityValue",
    "thickness", "thicknessValue", "gridColor", "countMode", "gapMode",
    "horizontalLines", "horizontalValue", "verticalLines", "verticalValue",
    "gap", "gapValue",
    "boundaryVisible", "boundaryColor", "boundaryThickness",
    "boundaryThicknessValue", "drawArea", "drawAreaLabel", "drawAreaHint"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

  let tabId = null;
  let origin = null;
  let settings = AreaGridDefaults.cloneDefaults();
  let activeVisible = false;
  let saveTimer = null;

  function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle("is-error", isError);
  }

  async function sendTabMessage(message) {
    if (tabId === null) throw new Error("No active tab");
    return chrome.tabs.sendMessage(tabId, message);
  }

  function populateControls() {
    const appearance = settings.appearance;
    elements.horizontalLines.value = appearance.horizontalLines;
    elements.horizontalValue.value = String(appearance.horizontalLines);
    elements.verticalLines.value = appearance.verticalLines;
    elements.verticalValue.value = String(appearance.verticalLines);
    elements.opacity.value = appearance.opacity;
    elements.opacityValue.value = `${appearance.opacity}%`;
    elements.thickness.value = appearance.thickness;
    elements.thicknessValue.value = `${appearance.thickness} px`;
    elements.gridColor.value = appearance.color;
    elements.gap.value = appearance.gap;
    elements.gapValue.value = `${appearance.gap} px`;
    elements.boundaryVisible.checked = appearance.boundaryVisible;
    elements.boundaryColor.value = appearance.boundaryColor;
    elements.boundaryThickness.value = appearance.boundaryThickness;
    elements.boundaryThicknessValue.value = `${appearance.boundaryThickness} px`;
    elements.gridVisible.checked = activeVisible;
    setSpacingMode(appearance.spacingMode);
    elements.drawAreaLabel.textContent = settings.area ? "Redraw area" : "Draw area";
    elements.drawAreaHint.textContent = settings.area
      ? "Click and drag to replace the current area"
      : "Click and drag on the page";
  }

  function readControls() {
    settings.appearance.horizontalLines = Number(elements.horizontalLines.value);
    settings.appearance.verticalLines = Number(elements.verticalLines.value);
    settings.appearance.opacity = Number(elements.opacity.value);
    settings.appearance.thickness = Number(elements.thickness.value);
    settings.appearance.color = elements.gridColor.value;
    settings.appearance.gap = Number(elements.gap.value);
    settings.appearance.spacingMode = elements.gapMode.getAttribute("aria-pressed") === "true"
      ? "gap"
      : "count";
    settings.appearance.boundaryVisible = elements.boundaryVisible.checked;
    settings.appearance.boundaryColor = elements.boundaryColor.value;
    settings.appearance.boundaryThickness = Number(elements.boundaryThickness.value);
  }

  function setSpacingMode(mode) {
    const useGap = mode === "gap";
    elements.countMode.setAttribute("aria-pressed", String(!useGap));
    elements.gapMode.setAttribute("aria-pressed", String(useGap));
    elements.horizontalLines.disabled = useGap;
    elements.verticalLines.disabled = useGap;
    elements.gap.disabled = !useGap;
  }

  async function persistAndUpdate() {
    readControls();
    settings = AreaGridDefaults.normalizeSettings(settings);
    if (origin) await AreaGridStorage.saveSiteSettings(origin, settings);
    if (activeVisible) {
      await sendTabMessage({
        action: AreaGridMessages.ACTIONS.UPDATE_GRID_SETTINGS,
        settings
      });
    }
  }

  function queuePersistAndUpdate() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistAndUpdate().catch((error) => setStatus(error.message, true));
    }, 80);
  }

  async function initialize() {
    elements.controls.hidden = true;
    const response = await chrome.runtime.sendMessage({ action: "GET_ACTIVE_TAB_INFO" });
    tabId = response.tabId;
    origin = response.origin;

    if (!origin) {
      elements.siteName.textContent = "Unsupported page";
      setStatus("This page cannot use the grid.", true);
      elements.gridVisible.disabled = true;
      elements.drawArea.disabled = true;
      elements.controls.hidden = false;
      return;
    }

    elements.siteName.textContent = new URL(origin).hostname;
    settings = await AreaGridStorage.getSiteSettings(origin);
    try {
      const state = await sendTabMessage({
        action: AreaGridMessages.ACTIONS.GET_OVERLAY_STATE
      });
      activeVisible = Boolean(state.visible);
    } catch {
      setStatus("Reload this page to activate the extension.", true);
      populateControls();
      elements.gridVisible.disabled = true;
      elements.drawArea.disabled = true;
      elements.controls.hidden = false;
      return;
    }

    elements.controls.hidden = false;
    setStatus(activeVisible ? "Grid is active." : "");
    populateControls();
  }

  elements.gridVisible.addEventListener("change", async () => {
    if (elements.gridVisible.checked && !settings.area) {
      elements.gridVisible.checked = false;
      setStatus("Draw an area before turning the grid on.");
      return;
    }
    activeVisible = elements.gridVisible.checked;
    try {
      const response = await sendTabMessage({
        action: AreaGridMessages.ACTIONS.SET_GRID_VISIBLE,
        visible: activeVisible,
        settings
      });
      activeVisible = Boolean(response.visible);
      elements.gridVisible.checked = activeVisible;
      setStatus(activeVisible ? "Grid is active." : "");
    } catch (error) {
      activeVisible = false;
      elements.gridVisible.checked = false;
      setStatus(error.message, true);
    }
  });

  [
    ["horizontalLines", "horizontalValue", ""],
    ["verticalLines", "verticalValue", ""],
    ["opacity", "opacityValue", "%"],
    ["thickness", "thicknessValue", " px"],
    ["gap", "gapValue", " px"],
    ["boundaryThickness", "boundaryThicknessValue", " px"]
  ].forEach(([inputId, outputId, suffix]) => {
    elements[inputId].addEventListener("input", () => {
      elements[outputId].value = `${elements[inputId].value}${suffix}`;
      queuePersistAndUpdate();
    });

    elements.countMode.addEventListener("click", () => {
      setSpacingMode("count");
      queuePersistAndUpdate();
    });
    elements.gapMode.addEventListener("click", () => {
      setSpacingMode("gap");
      queuePersistAndUpdate();
    });
  });

  [elements.gridColor, elements.boundaryVisible, elements.boundaryColor].forEach((control) => {
    control.addEventListener("change", queuePersistAndUpdate);
  });

  elements.drawArea.addEventListener("click", async () => {
    try {
      await persistAndUpdate();
      await sendTabMessage({
        action: AreaGridMessages.ACTIONS.START_AREA_SELECTION,
        settings
      });
      window.close();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  initialize().catch((error) => setStatus(error.message, true));
})();
