import { createRoot } from "react-dom/client";
import { WorkspaceApp } from "./workspace-app";
import "./styles.css";

declare global {
  function acquireVsCodeApi(): {
    postMessage: (message: unknown) => void;
  };
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Workspace root element was not found.");
}

const root = createRoot(rootElement);
root.render(<WorkspaceApp vscode={acquireVsCodeApi()} />);
