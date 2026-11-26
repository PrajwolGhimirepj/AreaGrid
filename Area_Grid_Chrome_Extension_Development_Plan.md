# Chrome Extension: Resizable Area Grid Overlay

## 1. Project goal

Build a Chrome Extension (Manifest V3) that lets the user draw a
rectangular region on the current website and display an evenly spaced
horizontal/vertical grid inside that region.

The grid is a visual overlay only. It must not modify the website's DOM
content, layout, or styling in a way that changes page behavior.

The extension popup provides controls to enable/disable the grid and
customize its appearance and spacing. Preferences are saved per website
origin.

## 2. Core user experience

1.  The user opens the extension popup on a website.
2.  The popup shows the current site's saved settings and whether the
    overlay is active.
3.  The user clicks **Draw area**.
4.  The popup closes (or the action otherwise returns focus to the
    page), and the extension enters area-selection mode.
5.  The user presses and drags on the page to draw a rectangle.
6.  On pointer release, the rectangle is stored for that site's grid
    configuration and the grid appears inside it.
7.  The user can reopen the popup to toggle the grid, adjust its
    appearance, change horizontal/vertical line counts, or redraw the
    area.
8.  Settings are saved automatically for that website.
9.  Switching to another tab must turn the visible grid off. The saved
    settings remain available when the user returns to that site, but
    the grid must not automatically reappear merely because the tab
    becomes active. The user explicitly enables it again.

## 3. Functional requirements

### 3.1 Rectangle selection

-   Provide a **Draw area** action in the popup.
-   On activation, inject or activate a full-viewport selection layer
    over the current page.
-   Show a clear crosshair cursor and a visible selection rectangle
    while dragging.
-   Support mouse and pen input through Pointer Events (`pointerdown`,
    `pointermove`, `pointerup`, `pointercancel`).
-   Normalize drag direction: dragging from bottom-right to top-left
    must work just like top-left to bottom-right.
-   Ignore accidental clicks or extremely small selections; show a brief
    instruction if needed.
-   On completion, remove the selection layer and show the grid in the
    selected bounds.
-   Provide a **Redraw area** action so the user can replace the saved
    rectangle.
-   Escape cancels selection without overwriting the previous saved
    rectangle.
-   The selection UI must be above page content and must not cause page
    reflow.

### 3.2 Grid rendering

-   Render evenly spaced horizontal and vertical lines only inside the
    selected rectangle.
-   Clip lines to the rectangle; no line should spill outside its
    bounds.
-   The rectangle should remain visible as the grid's boundary, with a
    separately configurable or sensible default boundary style.
-   Horizontal line amount and vertical line amount are independent
    settings.
-   Define each amount as the number of **internal lines**, excluding
    the rectangle's boundary. For example, 4 horizontal lines means 4
    internal horizontal lines, evenly spaced between the top and bottom
    edges.
-   A value of 0 means no internal lines in that direction.
-   Use CSS/SVG or another lightweight rendering approach. Prefer SVG
    for predictable line placement and clipping, or CSS if it remains
    equally accurate.
-   The overlay must not intercept normal page interaction when it is
    merely displaying the grid (`pointer-events: none`).
-   Selection mode may temporarily capture pointer input.

### 3.3 Appearance controls in the popup

Provide these controls:

-   Grid visibility toggle: On / Off.
-   Grid line opacity.
-   Grid line thickness.
-   Grid line colour (colour picker).
-   Horizontal internal-line count.
-   Vertical internal-line count.
-   Draw area / Redraw area action.
-   Optional: boundary visibility, boundary colour, and boundary
    thickness if they can be added without delaying the core
    implementation.

Recommended initial ranges (adjust if testing indicates better
usability):

  Setting            Suggested range/default
  ------------------ ---------------------------------
  Opacity            0--100%, default 60%
  Thickness          0.5--5 px, default 1 px
  Colour             White or a neutral grey default
  Horizontal lines   0--30, default 5
  Vertical lines     0--30, default 5

Display the current numeric value beside sliders or inputs. Changes
should update the overlay immediately, without requiring a page refresh.

### 3.4 Per-site preferences

-   Save preferences by website **origin**
    (`protocol + hostname + port`), not by full URL path.
-   Example: `https://example.com/page-a` and
    `https://example.com/page-b` share the same preferences.
-   Store at least:
    -   Selected rectangle geometry.
    -   Opacity.
    -   Thickness.
    -   Colour.
    -   Horizontal line count.
    -   Vertical line count.
-   Use `chrome.storage.local` for persistence.
-   Use a versioned storage shape so future settings migrations are
    possible.
-   If a site has no saved settings, load sensible defaults.
-   Do not overwrite a site's saved rectangle when the user cancels
    selection.

### 3.5 Active state and tab switching

Keep **saved configuration** separate from **currently visible/active
overlay state**.

-   Saved configuration persists per origin.
-   Active overlay state is temporary and belongs to the current
    tab/session.
-   When the user switches to another tab, hide/remove the overlay from
    the previous tab.
-   When the user returns to the original tab, do not automatically show
    the grid. The user must turn it on again.
-   Also turn the grid off when navigating to a different origin.
-   Handle same-origin page navigation deliberately: retain the saved
    site settings, but do not assume the old rectangle is still
    appropriate for a different page layout. At minimum, keep the grid
    off until explicitly enabled.
-   The popup toggle reflects the active state of the current tab, not
    merely whether that site has saved settings.

### 3.6 Responsive behavior

The selected rectangle must adapt when the browser viewport changes.

-   Store rectangle coordinates as normalized viewport fractions:
    -   `x = left / viewportWidth`
    -   `y = top / viewportHeight`
    -   `width = selectionWidth / viewportWidth`
    -   `height = selectionHeight / viewportHeight`
-   On viewport resize, calculate pixel coordinates from the normalized
    values and redraw the rectangle/grid.
-   Keep the grid anchored to the viewport, not to document scroll
    coordinates. This makes it useful as an on-screen drawing/reference
    guide.
-   The overlay should remain aligned during browser zoom and
    device-pixel-ratio changes.
-   Use `ResizeObserver` only if needed; the window `resize` event may
    be sufficient for a viewport-fixed overlay.
-   Test browser zoom levels and responsive page layouts.

## 4. Suggested architecture

Use Manifest V3 with a small, separated codebase.

``` text
area-grid-extension/
├── manifest.json
├── background/
│   └── service-worker.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   ├── content.js
│   ├── overlay.js
│   └── overlay.css
├── shared/
│   ├── defaults.js
│   ├── storage.js
│   └── messages.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

Responsibilities:

-   **Popup:** controls, current-site settings, draw-area command, and
    live setting updates.
-   **Content script:** creates/removes the overlay, handles rectangle
    selection, and renders the grid.
-   **Service worker:** coordinates tab activation/navigation events and
    ensures overlays are deactivated when required.
-   **Shared modules:** defaults, storage schema, validation, and
    message/action names.

Use message passing between popup, service worker, and content script.
Keep the content script idempotent: repeated commands must not create
duplicate overlays or duplicate event listeners.

## 5. Data model

Suggested versioned data model:

``` js
{
  version: 1,
  sites: {
    "https://example.com": {
      area: {
        x: 0.10,
        y: 0.12,
        width: 0.80,
        height: 0.70
      },
      appearance: {
        opacity: 0.60,
        thickness: 1,
        color: "#ffffff",
        horizontalLines: 5,
        verticalLines: 5
      }
    }
  }
}
```

Keep runtime activation state out of this persistent site-preferences
object. Runtime state can be tracked by the service worker and/or the
content script, keyed by tab ID.

Validate loaded values before using them. Clamp opacity, thickness, line
counts, and normalized rectangle values to supported ranges.

## 6. Message/action contract

Define a small, consistent message contract. Suggested actions:

-   `GET_SITE_SETTINGS` --- retrieve settings for the current origin.
-   `SAVE_SITE_SETTINGS` --- persist updated settings for the current
    origin.
-   `START_AREA_SELECTION` --- enter rectangle selection mode.
-   `CANCEL_AREA_SELECTION` --- cancel selection.
-   `SET_GRID_VISIBLE` --- show or hide the grid for the current tab.
-   `UPDATE_GRID_SETTINGS` --- update appearance or line counts and
    redraw immediately.
-   `SET_SELECTED_AREA` --- save the completed normalized rectangle.
-   `DEACTIVATE_TAB_OVERLAY` --- remove/hide the active overlay.

Every message should identify the intended tab/origin where appropriate.
Validate messages and settings rather than trusting arbitrary page data.

## 7. Development workflow

Build in the following stages. Do not attempt all features at once.

### Stage 1 --- Extension skeleton

-   Create the project structure.
-   Configure Manifest V3.
-   Create a minimal popup and content script.
-   Load the unpacked extension in `chrome://extensions`.
-   Verify that the popup can communicate with the active tab.

**Acceptance:** clicking a test popup action produces a visible,
temporary confirmation on the current page.

### Stage 2 --- Rectangle drawing

-   Implement selection mode using Pointer Events.
-   Draw a temporary selection rectangle while dragging.
-   Support all drag directions and Escape cancellation.
-   Return normalized coordinates to the extension.
-   Remove selection listeners and temporary DOM cleanly.

**Acceptance:** the user can draw, cancel, and redraw a rectangle
without affecting page layout or leaving duplicate overlays.

### Stage 3 --- Grid rendering

-   Render horizontal and vertical lines within the rectangle.
-   Add clipping/boundary behavior.
-   Ensure the display overlay has `pointer-events: none`.
-   Verify 0 lines, 1 line, and higher line counts.

**Acceptance:** lines are evenly spaced, clipped to the selected region,
and do not block clicks, scrolling, or text selection on the website.

### Stage 4 --- Popup controls and live updates

-   Add the visibility toggle.
-   Add opacity, thickness, and colour controls.
-   Add horizontal and vertical line-count controls.
-   Send updates to the content script and redraw immediately.

**Acceptance:** every control updates the visible grid without
refreshing the page.

### Stage 5 --- Per-origin persistence

-   Implement versioned `chrome.storage.local` storage.
-   Load defaults for new origins.
-   Save the area and settings automatically.
-   Verify that different origins have independent preferences and paths
    on the same origin share preferences.

**Acceptance:** closing/reopening the popup or browser does not lose
saved site preferences.

### Stage 6 --- Tab and navigation lifecycle

-   Track tab activation and navigation.
-   Deactivate the visible grid when switching tabs.
-   Keep saved preferences intact.
-   Require explicit reactivation when returning to a tab.
-   Handle restricted pages where content scripts cannot run (for
    example, Chrome internal pages and the Chrome Web Store) with a
    clear popup message.

**Acceptance:** switching tabs always hides the previous grid; returning
does not automatically reactivate it.

### Stage 7 --- Responsive behavior and polish

-   Recalculate overlay geometry on viewport resize.
-   Test browser zoom, page resizing, and different viewport dimensions.
-   Add clean empty/error states in the popup.
-   Ensure keyboard cancellation and pointer cleanup work.
-   Check performance on long or complex pages.

**Acceptance:** the grid stays aligned with the selected proportional
region as the viewport changes and remains lightweight.

### Stage 8 --- Final QA and packaging

Test at minimum:

-   Chrome desktop, normal and maximized windows.
-   Small and large viewport sizes.
-   Browser zoom at 80%, 100%, 125%, and 150%.
-   Mouse and drawing-tablet pen input.
-   Dragging in all four directions.
-   Escape cancellation.
-   0, 1, and maximum line counts.
-   Transparent, dark, and bright grid colours.
-   Tab switching and returning.
-   Same-origin and cross-origin navigation.
-   Reloading a page and reopening the browser.
-   Restricted browser pages.
-   No duplicate overlays or event listeners after repeated use.

Document how to load the unpacked extension and how to build/package it.

## 8. Technical and implementation constraints

-   Use Manifest V3.
-   Use the least permissions possible. Likely permissions include
    `storage` and `activeTab`; add `scripting` and tab lifecycle access
    only where the chosen implementation requires them.
-   Do not request broad host permissions unless there is a clear
    technical reason.
-   Do not use a remote server or send browsing data anywhere.
-   Keep the overlay isolated from page styles. Use a Shadow DOM host or
    carefully namespaced styles to avoid CSS collisions.
-   Use a very high overlay stacking order, but test pages with unusual
    stacking contexts and fullscreen elements.
-   Avoid modifying the page's layout or adding scrollbars.
-   Clean up event listeners and DOM nodes when deactivating.
-   Do not rely on popup state remaining alive; popups are closed
    frequently. Persist settings and coordinate state through
    storage/messages.
-   Handle missing content scripts gracefully, including after page
    reloads.

## 9. Important product decisions

Use these decisions unless implementation testing reveals a strong
reason to change them:

1.  The selected area is viewport-relative, not document-relative.
2.  The grid is an overlay and never changes the website's layout.
3.  Horizontal/vertical amounts mean internal lines, excluding the
    rectangle border.
4.  Site preferences are keyed by origin.
5.  Switching tabs hides the grid; returning to a tab does not
    reactivate it automatically.
6.  Drawing a new rectangle replaces the previous rectangle for that
    origin.
7.  Displaying the grid must not block interaction with the website.

## 10. Definition of done

The first complete version is done when a user can:

-   Open the extension on a normal website.
-   Draw a rectangular area with a mouse or pen.
-   See an evenly spaced horizontal/vertical grid constrained to that
    rectangle.
-   Toggle the grid on and off from the popup.
-   Change opacity, thickness, colour, horizontal line count, and
    vertical line count.
-   See changes immediately.
-   Have those settings and the rectangle saved per website origin.
-   Resize the viewport and retain correct proportional alignment.
-   Switch tabs and have the grid turn off, while keeping saved
    preferences.
-   Return to a site and manually turn its grid back on.
