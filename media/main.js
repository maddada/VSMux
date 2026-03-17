// @ts-check

/**
 * @typedef {{ count: number }} CatCodingState
 * @typedef {{ type: 'refactor' }} ExtensionToWebviewMessage
 * @typedef {{ type: 'alert', text: string }} WebviewToExtensionMessage
 */

(function () {
  const vscode = acquireVsCodeApi();
  const previousState = /** @type {CatCodingState | undefined} */ (vscode.getState());
  const counter = document.getElementById("lines-of-code-counter");
  const alertButton = document.getElementById("alert-button");

  if (!(counter instanceof HTMLElement) || !(alertButton instanceof HTMLButtonElement)) {
    return;
  }

  let currentCount = previousState?.count ?? 0;

  const renderCount = () => {
    counter.textContent = `${currentCount}`;
  };

  const persistState = () => {
    vscode.setState({ count: currentCount });
  };

  const postBugAlert = () => {
    const message = /** @type {WebviewToExtensionMessage} */ ({
      type: "alert",
      text: `Bug introduced on line ${currentCount}`,
    });

    vscode.postMessage(message);
  };

  renderCount();
  persistState();

  const intervalId = window.setInterval(() => {
    currentCount += 1;
    renderCount();
    persistState();

    if (Math.random() < Math.min(0.001 * currentCount, 0.05)) {
      postBugAlert();
    }
  }, 100);

  alertButton.addEventListener("click", () => {
    postBugAlert();
    alertButton.blur();
  });

  window.addEventListener("message", (event) => {
    const message = /** @type {ExtensionToWebviewMessage | undefined} */ (event.data);

    if (message?.type !== "refactor") {
      return;
    }

    currentCount = Math.max(0, Math.ceil(currentCount * 0.5));
    renderCount();
    persistState();
  });

  window.addEventListener("unload", () => {
    window.clearInterval(intervalId);
  });
})();
