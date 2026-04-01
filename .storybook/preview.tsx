import type { CSSProperties } from "react";
import type { Preview } from "@storybook/react-vite";
import "../sidebar/styles.css";
import "../workspace/styles.css";

const vscodePreviewVariables: CSSProperties = {
  "--vscode-font-family": '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", sans-serif',
  "--vscode-font-size": "13px",
  "--vscode-font-weight": "400",
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={vscodePreviewVariables}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: {
      expanded: true,
    },
    layout: "fullscreen",
  },
};

export default preview;
