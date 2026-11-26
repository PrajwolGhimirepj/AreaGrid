(function () {
  "use strict";

  class AreaGridOverlay {
    constructor() {
      this.host = null;
      this.shadow = null;
      this.svg = null;
      this.selection = null;
      this.selectionKeyHandler = null;
      this.settings = AreaGridDefaults.cloneDefaults();
      this.selectionStart = null;
      this.selectionPointerId = null;
      this.selectionComplete = null;
    }

    ensureHost() {
      if (this.host && this.host.isConnected) return;
      this.host = document.createElement("div");
      this.host.id = "area-grid-overlay-host";
      this.host.style.cssText = "all:initial;position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;";
      this.shadow = this.host.attachShadow({ mode: "closed" });
      document.documentElement.appendChild(this.host);
    }

    removeHost() {
      if (this.host) this.host.remove();
      this.host = null;
      this.shadow = null;
      this.svg = null;
    }

    hide() {
      this.cancelSelection(false);
      this.removeHost();
    }

    show(settings) {
      if (!settings.area) {
        this.hide();
        return false;
      }
      this.settings = AreaGridDefaults.normalizeSettings(settings);
      this.ensureHost();
      this.renderGrid();
      return true;
    }

    update(settings) {
      this.settings = AreaGridDefaults.normalizeSettings(settings);
      if (this.settings.area) {
        this.ensureHost();
        this.renderGrid();
      }
    }

    renderGrid() {
      this.cancelSelection(false);
      this.ensureHost();
      this.shadow.replaceChildren();

      const area = this.settings.area;
      if (!area) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const left = area.x * width;
      const top = area.y * height;
      const boxWidth = area.width * width;
      const boxHeight = area.height * height;
      const appearance = this.settings.appearance;

      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial; }
        svg { position: fixed; inset: 0; width: 100vw; height: 100vh; overflow: hidden; pointer-events: none; }
      `;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));

      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.setAttribute("id", "area-grid-boundary-clip");
      const clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      clipRect.setAttribute("x", String(left));
      clipRect.setAttribute("y", String(top));
      clipRect.setAttribute("width", String(boxWidth));
      clipRect.setAttribute("height", String(boxHeight));
      clip.appendChild(clipRect);
      svg.appendChild(clip);

      const clipped = document.createElementNS("http://www.w3.org/2000/svg", "g");
      clipped.setAttribute("clip-path", "url(#area-grid-boundary-clip)");
      const gridOpacity = appearance.opacity / 100;
      const addLine = (x1, y1, x2, y2) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(x1)); line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2)); line.setAttribute("y2", String(y2));
        line.setAttribute("stroke", appearance.color);
        line.setAttribute("stroke-width", String(appearance.thickness));
        line.setAttribute("opacity", String(gridOpacity));
        line.setAttribute("vector-effect", "non-scaling-stroke");
        clipped.appendChild(line);
      };

      if (appearance.spacingMode === "gap") {
        for (let x = left + appearance.gap; x < left + boxWidth; x += appearance.gap) {
          addLine(x, top, x, top + boxHeight);
        }
        for (let y = top + appearance.gap; y < top + boxHeight; y += appearance.gap) {
          addLine(left, y, left + boxWidth, y);
        }
      } else {
        for (let i = 1; i <= appearance.verticalLines; i++) {
          const x = left + (boxWidth * i / (appearance.verticalLines + 1));
          addLine(x, top, x, top + boxHeight);
        }
        for (let i = 1; i <= appearance.horizontalLines; i++) {
          const y = top + (boxHeight * i / (appearance.horizontalLines + 1));
          addLine(left, y, left + boxWidth, y);
        }
      }
      svg.appendChild(clipped);

      if (appearance.boundaryVisible) {
        const boundary = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        boundary.setAttribute("x", String(left)); boundary.setAttribute("y", String(top));
        boundary.setAttribute("width", String(boxWidth)); boundary.setAttribute("height", String(boxHeight));
        boundary.setAttribute("fill", "none");
        boundary.setAttribute("stroke", appearance.boundaryColor);
        boundary.setAttribute("stroke-width", String(appearance.boundaryThickness));
        boundary.setAttribute("opacity", String(gridOpacity));
        boundary.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(boundary);
      }

      this.shadow.append(style, svg);
      this.svg = svg;
    }

    startSelection(onComplete) {
      this.cancelSelection(false);
      this.ensureHost();
      this.selectionComplete = onComplete;
      this.shadow.replaceChildren();

      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial; }
        .selection-layer { position: fixed; inset: 0; width: 100vw; height: 100vh; cursor: crosshair; pointer-events: auto; background: transparent; user-select: none; touch-action: none; }
        .selection-box { position: fixed; display: none; border: 2px solid #66a3ff; background: rgba(70, 140, 255, 0.12); box-shadow: 0 0 0 1px rgba(255,255,255,0.8) inset; }
        .instruction { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); color: white; background: rgba(20,20,20,.9); border-radius: 6px; padding: 8px 12px; font: 13px system-ui, sans-serif; pointer-events: none; }
      `;
      const layer = document.createElement("div");
      layer.className = "selection-layer";
      const box = document.createElement("div");
      box.className = "selection-box";
      const instruction = document.createElement("div");
      instruction.className = "instruction";
      instruction.textContent = "Drag to draw an area. Press Escape to cancel.";
      layer.append(box, instruction);
      this.shadow.append(style, layer);
      this.selection = { layer, box, instruction };

      this.selectionKeyHandler = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.cancelSelection(true);
        }
      };
      document.addEventListener("keydown", this.selectionKeyHandler, true);
      layer.addEventListener("pointerdown", this.onPointerDown.bind(this));
      layer.addEventListener("pointermove", this.onPointerMove.bind(this));
      layer.addEventListener("pointerup", this.onPointerUp.bind(this));
      layer.addEventListener("pointercancel", this.onPointerCancel.bind(this));
    }

    onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      this.selectionPointerId = event.pointerId;
      this.selectionStart = { x: event.clientX, y: event.clientY };
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      this.selection.box.style.display = "block";
      this.updateSelectionBox(event.clientX, event.clientY);
    }

    onPointerMove(event) {
      if (!this.selectionStart || event.pointerId !== this.selectionPointerId) return;
      this.updateSelectionBox(event.clientX, event.clientY);
    }

    onPointerUp(event) {
      if (!this.selectionStart || event.pointerId !== this.selectionPointerId) return;
      const left = Math.min(this.selectionStart.x, event.clientX);
      const top = Math.min(this.selectionStart.y, event.clientY);
      const width = Math.abs(event.clientX - this.selectionStart.x);
      const height = Math.abs(event.clientY - this.selectionStart.y);
      const complete = this.selectionComplete;
      this.cancelSelection(false);

      if (width < 12 || height < 12) {
        if (this.settings.area) this.renderGrid();
        return;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      complete({
        x: Math.min(1, Math.max(0, left / viewportWidth)),
        y: Math.min(1, Math.max(0, top / viewportHeight)),
        width: Math.min(1 - left / viewportWidth, width / viewportWidth),
        height: Math.min(1 - top / viewportHeight, height / viewportHeight)
      });
    }

    onPointerCancel() {
      this.cancelSelection(true);
    }

    updateSelectionBox(clientX, clientY) {
      const left = Math.min(this.selectionStart.x, clientX);
      const top = Math.min(this.selectionStart.y, clientY);
      const width = Math.abs(clientX - this.selectionStart.x);
      const height = Math.abs(clientY - this.selectionStart.y);
      this.selection.box.style.left = `${left}px`;
      this.selection.box.style.top = `${top}px`;
      this.selection.box.style.width = `${width}px`;
      this.selection.box.style.height = `${height}px`;
    }

    cancelSelection(notify) {
      if (this.selectionKeyHandler) {
        document.removeEventListener("keydown", this.selectionKeyHandler, true);
        this.selectionKeyHandler = null;
      }
      this.selectionStart = null;
      this.selectionPointerId = null;
      this.selection = null;
      this.selectionComplete = null;
      if (this.host) this.removeHost();
      if (notify && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: "CANCEL_AREA_SELECTION_FROM_PAGE"
        }).catch(() => {});
      }
    }

    bindResize() {
      window.addEventListener("resize", () => {
        if (this.settings.area && !this.selection) this.renderGrid();
      });
    }
  }

  globalThis.AreaGridOverlay = AreaGridOverlay;
})();
