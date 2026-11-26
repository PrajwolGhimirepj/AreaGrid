(function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    version: 1,
    area: null,
    appearance: Object.freeze({
      opacity: 60,
      thickness: 1,
      color: "#ffffff",
      spacingMode: "count",
      gap: 50,
      horizontalLines: 5,
      verticalLines: 5,
      boundaryVisible: true,
      boundaryColor: "#ffffff",
      boundaryThickness: 1
    })
  });

  function cloneDefaults() {
    return {
      version: DEFAULTS.version,
      area: null,
      appearance: { ...DEFAULTS.appearance }
    };
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function normalizeSettings(settings) {
    const fallback = cloneDefaults();
    const source = settings && typeof settings === "object" ? settings : {};
    const appearance = source.appearance && typeof source.appearance === "object"
      ? source.appearance
      : {};

    let area = null;
    if (source.area && typeof source.area === "object") {
      const candidate = {
        x: clamp(source.area.x, 0, 1, 0),
        y: clamp(source.area.y, 0, 1, 0),
        width: clamp(source.area.width, 0, 1, 0),
        height: clamp(source.area.height, 0, 1, 0)
      };
      if (candidate.width > 0.01 && candidate.height > 0.01 &&
          candidate.x + candidate.width <= 1.01 &&
          candidate.y + candidate.height <= 1.01) {
        candidate.width = clamp(candidate.width, 0.01, 1 - candidate.x, candidate.width);
        candidate.height = clamp(candidate.height, 0.01, 1 - candidate.y, candidate.height);
        area = candidate;
      }
    }

    return {
      version: 1,
      area,
      appearance: {
        opacity: clamp(appearance.opacity, 0, 100, fallback.appearance.opacity),
        thickness: clamp(appearance.thickness, 0.5, 5, fallback.appearance.thickness),
        color: /^#[0-9a-f]{6}$/i.test(appearance.color) ? appearance.color : fallback.appearance.color,
        spacingMode: appearance.spacingMode === "gap" ? "gap" : "count",
        gap: clamp(appearance.gap, 10, 200, fallback.appearance.gap),
        horizontalLines: Math.round(clamp(appearance.horizontalLines, 0, 30, fallback.appearance.horizontalLines)),
        verticalLines: Math.round(clamp(appearance.verticalLines, 0, 30, fallback.appearance.verticalLines)),
        boundaryVisible: typeof appearance.boundaryVisible === "boolean"
          ? appearance.boundaryVisible
          : fallback.appearance.boundaryVisible,
        boundaryColor: /^#[0-9a-f]{6}$/i.test(appearance.boundaryColor)
          ? appearance.boundaryColor
          : fallback.appearance.boundaryColor,
        boundaryThickness: clamp(appearance.boundaryThickness, 0.5, 5, fallback.appearance.boundaryThickness)
      }
    };
  }

  globalThis.AreaGridDefaults = { DEFAULTS, cloneDefaults, clamp, normalizeSettings };
})();
