import type { ITerminalOptions } from "@xterm/xterm";
import type { WorkspacePanelTerminalAppearance } from "../shared/workspace-panel-contract";

export type TerminalAppearanceOptions = Pick<
  ITerminalOptions,
  "cursorBlink" | "cursorStyle" | "fontFamily" | "fontSize" | "letterSpacing" | "lineHeight"
>;

export function getTerminalAppearanceOptions(
  appearance: WorkspacePanelTerminalAppearance,
): TerminalAppearanceOptions {
  return {
    cursorBlink: appearance.cursorBlink,
    cursorStyle: appearance.cursorStyle,
    fontFamily: appearance.fontFamily,
    fontSize: appearance.fontSize,
    letterSpacing: appearance.letterSpacing,
    lineHeight: appearance.lineHeight,
  };
}
