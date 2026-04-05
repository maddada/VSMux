// Paste this file's contents into DevTools for the VSmux workarea webview.
// It will try to find the real inner frame that owns the terminal renderer,
// sample it for 5 seconds, and download a timestamped JSON result.
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const round = (n) => Math.round(n * 100) / 100;
  const formatTimestamp = (date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      "T",
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0"),
    ].join("");

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const getAccessibleFrames = () => {
    const frames = [];
    const visit = (win, path) => {
      let doc;
      try {
        doc = win.document;
      } catch {
        return;
      }
      frames.push({ win, doc, path });
      for (let i = 0; i < win.frames.length; i += 1) {
        try {
          visit(win.frames[i], `${path}.${i}`);
        } catch {
          // Ignore cross-origin or inaccessible frames.
        }
      }
    };
    visit(window, "top");
    return frames;
  };

  const scoreFrame = ({ win, doc }) => {
    const href = (() => {
      try {
        return win.location.href;
      } catch {
        return "";
      }
    })();
    const title = doc.title || "";
    const html = doc.documentElement?.outerHTML?.slice(0, 5000) || "";
    const bodyText = doc.body?.innerText?.slice(0, 5000) || "";
    const canvasCount = doc.querySelectorAll("canvas").length;
    const resttyCount = doc.querySelectorAll(
      ".restty-native-scroll-root, .restty-native-scroll-host, .restty-native-scroll-canvas",
    ).length;
    const terminalCount = doc.querySelectorAll(
      ".terminal-pane-root, .pane-canvas, .xterm, .xterm-screen",
    ).length;

    let score = 0;
    if (href.includes("extensionId=maddada.VSmux")) score += 10;
    if (href.includes("purpose=webview")) score += 4;
    if (title.toLowerCase().includes("vsmux")) score += 2;
    score += resttyCount * 20;
    score += terminalCount * 8;
    score += Math.min(canvasCount, 20) * 2;
    if (html.includes("restty")) score += 25;
    if (html.includes("terminal-pane")) score += 10;
    if (bodyText.includes("Session")) score += 2;

    return {
      href,
      title,
      score,
      canvasCount,
      resttyCount,
      terminalCount,
    };
  };

  const frames = getAccessibleFrames().map((frame) => ({
    ...frame,
    summary: scoreFrame(frame),
  }));

  const selected = [...frames].sort((a, b) => b.summary.score - a.summary.score)[0] || null;

  if (!selected) {
    throw new Error("No accessible frame was found.");
  }

  const targetWindow = selected.win;
  const targetDocument = selected.doc;
  const targetLocation = selected.summary.href;

  const isLikelyWorkbench =
    targetLocation.includes("/vs/code/electron-browser/workbench/workbench.html") ||
    targetLocation.startsWith("vscode-file://");
  const isLikelyVSmux =
    targetLocation.includes("extensionId=maddada.VSmux") ||
    selected.summary.resttyCount > 0 ||
    selected.summary.terminalCount > 0;

  if (isLikelyWorkbench && !isLikelyVSmux) {
    const message =
      "This script is still pointing at the main VS Code workbench, not the VSmux terminal document.";
    console.error(message, { selectedFrame: selected.path, href: targetLocation });
    throw new Error(message);
  }

  if (selected.summary.resttyCount <= 0 || selected.summary.canvasCount <= 0) {
    const message =
      "The script did not find the inner VSmux terminal frame. Open DevTools on the VSmux workarea itself and rerun.";
    console.error(message, {
      selectedFrame: selected.path,
      href: targetLocation,
      summary: selected.summary,
    });
    throw new Error(message);
  }

  const perfMemory = targetWindow.performance?.memory
    ? {
        usedJSHeapSizeMiB: round(targetWindow.performance.memory.usedJSHeapSize / 1024 / 1024),
        totalJSHeapSizeMiB: round(targetWindow.performance.memory.totalJSHeapSize / 1024 / 1024),
        jsHeapSizeLimitMiB: round(targetWindow.performance.memory.jsHeapSizeLimit / 1024 / 1024),
      }
    : null;

  const canvases = [...targetDocument.querySelectorAll("canvas")].map((el, i) => {
    const rect = el.getBoundingClientRect();
    const cs = targetWindow.getComputedStyle(el);
    return {
      i,
      className: el.className,
      connected: el.isConnected,
      width: el.width,
      height: el.height,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      rect: {
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
      },
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
    };
  });

  const originalRAF = targetWindow.requestAnimationFrame.bind(targetWindow);
  const rafSites = new Map();
  const callbackTimes = [];
  const longGaps = [];
  const visibilityEvents = [];
  const focusEvents = [];
  const intervalLag = [];

  let lastCallbackAt = targetWindow.performance.now();
  let expectedIntervalAt = targetWindow.performance.now() + 50;

  const normalizeStack = (stack) =>
    String(stack || "")
      .split("\n")
      .slice(1, 6)
      .map((line) => line.trim())
      .join(" | ");

  const onVisibilityChange = () => {
    visibilityEvents.push({
      t: round(targetWindow.performance.now()),
      visibilityState: targetDocument.visibilityState,
      hidden: targetDocument.hidden,
      hasFocus: targetDocument.hasFocus(),
    });
  };

  const onFocusBlur = (event) => {
    focusEvents.push({
      t: round(targetWindow.performance.now()),
      type: event.type,
      hasFocus: targetDocument.hasFocus(),
      visibilityState: targetDocument.visibilityState,
    });
  };

  targetDocument.addEventListener("visibilitychange", onVisibilityChange);
  targetWindow.addEventListener("focus", onFocusBlur, true);
  targetWindow.addEventListener("blur", onFocusBlur, true);

  targetWindow.requestAnimationFrame = function patchedRequestAnimationFrame(cb) {
    const scheduledAt = targetWindow.performance.now();
    const stack = normalizeStack(new targetWindow.Error().stack);
    let site = rafSites.get(stack);

    if (!site) {
      site = {
        scheduled: 0,
        invoked: 0,
        maxScheduleToInvokeDelayMs: 0,
        sampleCallbackNames: new Set(),
      };
      rafSites.set(stack, site);
    }

    site.scheduled += 1;

    return originalRAF((ts) => {
      const now = targetWindow.performance.now();
      const scheduleDelay = now - scheduledAt;
      site.invoked += 1;
      site.maxScheduleToInvokeDelayMs = Math.max(site.maxScheduleToInvokeDelayMs, scheduleDelay);

      if (cb && cb.name) {
        site.sampleCallbackNames.add(cb.name);
      }

      const gap = now - lastCallbackAt;
      if (gap > 20) {
        longGaps.push({
          t: round(now),
          gapMs: round(gap),
        });
      }

      lastCallbackAt = now;
      callbackTimes.push(now);

      return cb(ts);
    });
  };

  const intervalId = targetWindow.setInterval(() => {
    const now = targetWindow.performance.now();
    intervalLag.push(now - expectedIntervalAt);
    expectedIntervalAt += 50;
  }, 50);

  await wait(5000);

  targetWindow.clearInterval(intervalId);
  targetWindow.requestAnimationFrame = originalRAF;
  targetDocument.removeEventListener("visibilitychange", onVisibilityChange);
  targetWindow.removeEventListener("focus", onFocusBlur, true);
  targetWindow.removeEventListener("blur", onFocusBlur, true);

  const rafGaps = callbackTimes.slice(1).map((t, i) => t - callbackTimes[i]);
  const avg = (arr) =>
    arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : null;

  const result = {
    selectedFrame: {
      path: selected.path,
      href: targetLocation,
      title: selected.summary.title,
      score: selected.summary.score,
      canvasCount: selected.summary.canvasCount,
      resttyCount: selected.summary.resttyCount,
      terminalCount: selected.summary.terminalCount,
    },
    inspectedFrames: frames.map((frame) => ({
      path: frame.path,
      href: frame.summary.href,
      title: frame.summary.title,
      score: frame.summary.score,
      canvasCount: frame.summary.canvasCount,
      resttyCount: frame.summary.resttyCount,
      terminalCount: frame.summary.terminalCount,
    })),
    url: targetLocation,
    visibilityState: targetDocument.visibilityState,
    hidden: targetDocument.hidden,
    hasFocus: targetDocument.hasFocus(),
    perfMemory,
    canvases,
    rafSummary: {
      totalCallbacks: callbackTimes.length,
      callbacksPerSec: round(callbackTimes.length / 5),
      avgGapMs: avg(rafGaps) == null ? null : round(avg(rafGaps)),
      maxGapMs: rafGaps.length ? round(Math.max(...rafGaps)) : null,
      longGapsOver20ms: longGaps.slice(0, 50),
    },
    eventLoopLag50ms: {
      avgOvershootMs: avg(intervalLag) == null ? null : round(avg(intervalLag)),
      maxOvershootMs: intervalLag.length ? round(Math.max(...intervalLag)) : null,
    },
    rafSites: [...rafSites.entries()]
      .map(([stack, site]) => ({
        scheduled: site.scheduled,
        invoked: site.invoked,
        callbacksPerSec: round(site.invoked / 5),
        maxScheduleToInvokeDelayMs: round(site.maxScheduleToInvokeDelayMs),
        sampleCallbackNames: [...site.sampleCallbackNames].slice(0, 5),
        stack,
      }))
      .sort((a, b) => b.invoked - a.invoked)
      .slice(0, 10),
    visibilityEvents,
    focusEvents,
  };

  const filename = `vsmux-live-dump-${formatTimestamp(new Date())}.json`;
  const json = JSON.stringify(result, null, 2);

  targetWindow.__VSMUX_LIVE_DUMP__ = result;
  targetWindow.__VSMUX_LIVE_DUMP_FILE__ = filename;
  console.log("VSMUX_LIVE_DUMP", result);

  try {
    downloadText(filename, json);
    console.log(`Downloaded ${filename}`);
  } catch (error) {
    console.log("Automatic download failed", error);
  }

  try {
    copy(json);
    console.log("Copied JSON to clipboard");
  } catch {
    console.log("copy() was unavailable; use __VSMUX_LIVE_DUMP__");
  }

  return result;
})();
