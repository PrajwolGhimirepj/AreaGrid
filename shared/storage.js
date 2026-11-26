(function () {
  "use strict";

  const STORAGE_KEY = "areaGridPreferences";

  function originFromUrl(url) {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) return null;
      return parsed.origin;
    } catch {
      return null;
    }
  }

  async function readStore() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const store = result[STORAGE_KEY];
    if (!store || store.version !== 1 || typeof store.sites !== "object") {
      return { version: 1, sites: {} };
    }
    return store;
  }

  async function getSiteSettings(origin) {
    const store = await readStore();
    const saved = store.sites[origin];
    return AreaGridDefaults.normalizeSettings(saved);
  }

  async function saveSiteSettings(origin, settings) {
    if (!origin) throw new Error("A valid HTTP origin is required");
    const store = await readStore();
    store.sites[origin] = AreaGridDefaults.normalizeSettings(settings);
    await chrome.storage.local.set({ [STORAGE_KEY]: store });
  }

  globalThis.AreaGridStorage = {
    STORAGE_KEY,
    originFromUrl,
    readStore,
    getSiteSettings,
    saveSiteSettings
  };
})();
