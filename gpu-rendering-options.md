# GPU Rendering Options For Agent Canvas X

This note captures the current options for reducing GPU usage in the webview terminal grid without repeating the "sleeping tiles" approach.

## Current Diagnosis

The likely problem is not the outer workspace layout by itself.

The larger cost is the terminal renderer:

- `ghostty-web` is canvas-based
- its README describes it as using canvas rendering at `60 FPS`
- that makes it a poor fit for many simultaneously visible terminal surfaces in a pan/zoom canvas UI

Because of that, changing React drag-and-drop libraries or replacing the outer layout shell will probably not materially improve GPU usage on its own.

## Option 1: Patch Or Fork `ghostty-web` To Stop Rendering Continuously

This is the best option if the goal is to keep Ghostty fidelity and keep many terminals visible.

Instead of a permanent render loop, the terminal should render only when something actually changes:

- new output arrives
- input changes the buffer
- resize happens
- selection changes
- scroll position changes
- cursor blink toggles

Recommended direction:

- keep cursor blink on a low-frequency timer
- render on dirty events
- avoid a permanent `requestAnimationFrame` loop unless something is actively animating

Why this is the strongest option:

- preserves the current terminal engine
- preserves current fidelity and behavior
- directly targets the most likely source of GPU usage

## Option 2: Keep Live Terminals, But Stop Zooming/Scaling The Terminal Surfaces

The current product idea is an "infinite canvas", but live terminal canvases are a bad match for arbitrary transforms.

A better model would be:

- keep terminal surfaces at 1:1 pixels
- pan with a normal scroll container instead of transforming a world surface
- use a minimap or overview navigator instead of true zoom
- zoom only surrounding UI chrome, not the terminal framebuffer itself

Why this helps:

- avoids constantly transformed terminal canvases
- reduces compositing pressure
- keeps all terminals live without needing a sleeping/offscreen state model

Tradeoff:

- you lose the pure infinite-canvas illusion
- the interaction model becomes more like a very large scrollable workspace

## Option 3: Switch To `xterm.js`, But Only With A Deliberate Renderer Choice

Do not switch to `xterm.js` blindly.

The meaningful renderer choices are:

- `xterm` with DOM renderer
- `xterm` with canvas or WebGL renderer

Practical expectation:

- `xterm` + DOM renderer: likely lower GPU usage, but often higher CPU and weaker performance under heavy output or dense grids
- `xterm` + canvas/WebGL: probably not enough of a gain to justify the renderer swap by itself

If the primary objective is specifically lower GPU usage, the only `xterm` path worth testing first is:

- `xterm.js` with DOM renderer

Recommended spike:

1. build a small renderer abstraction
2. swap one tile implementation to `xterm.js`
3. force DOM renderer
4. compare 4, 9, and 16 visible terminals

## Option 4: Use Native VS Code Terminals Instead Of Rendering Them In A Webview

If the freeform canvas requirement can be relaxed, this is the most pragmatic option.

VS Code already supports:

- native terminal editors
- terminal placement in the editor area
- extension APIs for creating/managing terminals

Direction:

- let VS Code own the terminal rendering
- let the extension own orchestration, grouping, navigation, naming, and layout logic around those terminals

Benefits:

- avoids custom webview terminal rendering cost
- avoids renderer maintenance
- uses the platform’s terminal implementation directly

Tradeoff:

- you lose arbitrary draggable freeform terminal geometry inside one custom webview

## Option 5: Keep `ghostty-web`, But Remove Performance-Heavy Features First

This is smaller than the options above, but worth trying if the renderer remains the same.

Recommended changes:

- disable transparency on terminal surfaces
- disable cursor blink
- disable smooth scroll
- reduce or remove blur-heavy tile chrome
- avoid scaling the terminal surface itself

Why:

- transparency and blur increase compositing cost
- cursor blinking guarantees ongoing visual updates
- smooth scrolling adds animation work

This will not solve the architectural problem if `ghostty-web` is still rendering continuously, but it can reduce some pressure.

## What Is Unlikely To Help Much

These are not strong bets for the main problem:

- replacing the outer layout with `react-dnd`
- changing drag libraries
- reshuffling React state structure alone
- using `OffscreenCanvas` as the primary fix

Why:

- drag-and-drop libraries do not address terminal renderer cost
- `OffscreenCanvas` may help main-thread responsiveness, but it does not automatically reduce GPU usage

## Recommended Order

If preserving the current UX matters most:

1. patch/fork `ghostty-web` to render on dirty events instead of continuously
2. stop scaling live terminal surfaces
3. remove transparency/blur from the terminal path

If lowering GPU is more important than preserving Ghostty fidelity:

1. build an `xterm.js` spike
2. force DOM renderer
3. measure side-by-side with the current implementation

If product robustness matters more than the freeform grid:

1. move toward native VS Code terminal editors
2. build the management/orchestration UI around them

## Sources

- `ghostty-web` README: <https://github.com/coder/ghostty-web>
- VS Code terminal appearance and renderer tradeoffs: <https://code.visualstudio.com/docs/terminal/appearance>
- VS Code terminal basics / editor area: <https://code.visualstudio.com/docs/terminal/getting-started>
- VS Code custom layout: <https://code.visualstudio.com/docs/configure/custom-layout>
- VS Code API: <https://code.visualstudio.com/api/references/vscode-api>
- `xterm.js` terminal API: <https://xtermjs.org/docs/api/terminal/classes/terminal/>
- `xterm.js` terminal options: <https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/>
- DomTerm features: <https://domterm.org/Features.html>
- xterm canvas movement issue: <https://github.com/xtermjs/xterm.js/issues/4922>
