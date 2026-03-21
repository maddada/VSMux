import claudeLogo from "../src/assets/claude.svg";
import codexLogo from "../src/assets/codex.svg";
import geminiLogo from "../src/assets/gemini.svg";
import opencodeLogo from "../src/assets/opencode.svg";
import type { SidebarAgentIcon } from "../shared/sidebar-agents";

export const AGENT_LOGOS: Record<SidebarAgentIcon, string> = {
  claude: claudeLogo,
  codex: codexLogo,
  gemini: geminiLogo,
  opencode: opencodeLogo,
};
