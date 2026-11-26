(function () {
  "use strict";

  if (globalThis.__areaGridContentLoaded) return;
  globalThis.__areaGridContentLoaded = true;

  const overlay = new AreaGridOverlay();
  overlay.bindResize();
  let runtimeSettings = AreaGridDefaults.cloneDefaults();
  let visible = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.action !== "string") return false;
    const action = message.action;

    if (action === "CANCEL_AREA_SELECTION_FROM_PAGE") {
      overlay.cancelSelection(false);
      if (runtimeSettings.area) overlay.show(runtimeSettings);
      else overlay.hide();
      sendResponse({ ok: true });
      return true;
    }

    if (action === AreaGridMessages.ACTIONS.GET_OVERLAY_STATE) {
      sendResponse({ visible, activeSelection: Boolean(overlay.selection) });
      return true;
    }

    if (action === AreaGridMessages.ACTIONS.DEACTIVATE_TAB_OVERLAY) {
      visible = false;
      overlay.hide();
      sendResponse({ ok: true });
      return true;
    }

    if (action === AreaGridMessages.ACTIONS.SET_GRID_VISIBLE) {
      if (message.settings) {
        runtimeSettings = AreaGridDefaults.normalizeSettings(message.settings);
      }
      visible = Boolean(message.visible);
      if (visible) {
        visible = overlay.show(runtimeSettings);
      } else {
        overlay.hide();
      }
      sendResponse({ ok: true, visible });
      return true;
    }

    if (action === AreaGridMessages.ACTIONS.UPDATE_GRID_SETTINGS) {
      runtimeSettings = AreaGridDefaults.normalizeSettings(message.settings);
      overlay.update(runtimeSettings);
      sendResponse({ ok: true });
      return true;
    }

    if (action === AreaGridMessages.ACTIONS.START_AREA_SELECTION) {
      runtimeSettings = AreaGridDefaults.normalizeSettings(message.settings);
      overlay.startSelection(async (area) => {
        runtimeSettings.area = area;
        try {
          await AreaGridStorage.saveSiteSettings(location.origin, runtimeSettings);
          visible = true;
          overlay.show(runtimeSettings);
        } catch (error) {
          console.error("Could not save the selected grid area.", error);
          visible = true;
          overlay.show(runtimeSettings);
        }
      });
      sendResponse({ ok: true });
      return true;
    }

    if (action === AreaGridMessages.ACTIONS.CANCEL_AREA_SELECTION) {
      overlay.cancelSelection(true);
      if (runtimeSettings.area) overlay.show(runtimeSettings);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
})();
