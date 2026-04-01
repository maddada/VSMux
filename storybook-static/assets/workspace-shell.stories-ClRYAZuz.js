import{a as e,n as t}from"./chunk-BneVvdWh.js";import{n,t as r}from"./iframe-DYlbbSxv.js";import{a as i,i as a,n as o,o as s,r as c,t as l}from"./sidebar-story-workspace-GKsVD5g7.js";import{i as u,n as d,o as f,s as p,t as m}from"./sidebar-story-meta-DpCxcLJt.js";import{n as h,t as g}from"./workspace-app-DOQD4-qO.js";function _({debuggingMode:e=!1,message:t}){let[n,r]=(0,w.useState)(()=>o(t)),s=(0,w.useRef)(n),c=(0,w.useRef)(new EventTarget).current,u=(0,w.useRef)(new EventTarget).current,d=e=>{let t=a(s.current,e);t&&(0,w.startTransition)(()=>{r(t)})},f=(0,w.useMemo)(()=>({postMessage(e){d(e)}}),[]),p=(0,w.useMemo)(()=>({postMessage(e){e.type!==`focusSession`||typeof e.sessionId!=`string`||d({sessionId:e.sessionId,type:`focusSession`})}}),[]);return(0,w.useEffect)(()=>{s.current=n},[n]),(0,w.useEffect)(()=>{(0,w.startTransition)(()=>{r(o(t))})},[t]),(0,w.useEffect)(()=>{let t=l(n),r=v(n,e),i=window.setTimeout(()=>{C(c,t),C(u,r)},0);return()=>{window.clearTimeout(i)}},[e,c,n,u]),(0,T.jsxs)(`div`,{style:{boxSizing:`border-box`,display:`grid`,gap:`16px`,gridTemplateColumns:`300px minmax(0, 1fr)`,height:`100vh`,padding:`16px`},children:[(0,T.jsx)(`div`,{style:{minHeight:0,overflow:`auto`},children:(0,T.jsx)(i,{messageSource:c,vscode:f})}),(0,T.jsx)(`div`,{style:{minHeight:0,overflow:`hidden`},children:(0,T.jsx)(g,{messageSource:u,vscode:p})})]})}function v(e,t){let n=l(e),r=n.groups.find(e=>e.isActive)??n.groups[0],i=r?.sessions.find(e=>e.isFocused)?.sessionId,a=(r?.sessions??[]).filter(e=>e.isVisible).map(e=>({kind:`terminal`,sessionId:e.sessionId,sessionRecord:{alias:e.alias,column:e.column,createdAt:new Date(0).toISOString(),displayId:x(e.shortcutLabel),kind:`terminal`,row:e.row,sessionId:e.sessionId,slotIndex:S(e.shortcutLabel),title:e.primaryTitle??e.terminalTitle??e.alias},snapshot:y(e.sessionId)}));return{activeGroupId:e.snapshot.activeGroupId,connection:E,debuggingMode:t,focusedSessionId:i,panes:a,terminalAppearance:{cursorBlink:!0,cursorStyle:`bar`,fontFamily:`MesloLGL Nerd Font Mono`,fontSize:14,letterSpacing:0,lineHeight:1.1},type:`hydrate`,viewMode:r?.viewMode??`grid`,visibleCount:r?.visibleCount??1,workspaceSnapshot:e.snapshot}}function y(e){return{agentName:`OpenAI Codex`,agentStatus:`idle`,cols:120,cwd:`/Users/madda/dev/_active/agent-tiler`,history:b(e),restoreState:`live`,rows:34,sessionId:e,shell:`/bin/zsh`,startedAt:new Date(0).toISOString(),status:`running`,workspaceId:`storybook-workspace`}}function b(e){return[`\x1B[38;2;145;203;255mdev/_active/agent-tiler\x1B[0m `,`\u001b[38;2;255;216;115m${e}\u001b[0m`,`\r
`,`$ pnpm exec tsc -p tsconfig.extension.json --noEmit\r
`,`No type errors found.\r
`,`$ pnpm exec vp build --config vite.workspace.config.ts\r
`,`vite v8.0.0 building client environment for production...\r
`,`transforming... ✓ 26 modules transformed.\r
`,`rendering chunks...\r
`,`computing gzip size...\r
`,`$ echo "focus / resize / fit debugging"\r
`,`focus / resize / fit debugging\r
`,`$ `].join(``)}function x(e){let t=e.match(/(\d+)$/)?.[1];return t?t.padStart(2,`0`):`00`}function S(e){let t=e.match(/(\d+)$/)?.[1],n=t?Number.parseInt(t,10):NaN;return Number.isFinite(n)&&n>0?n:1}function C(e,t){e.dispatchEvent(new MessageEvent(`message`,{data:t}))}var w,T,E,D=t((()=>{w=e(n()),s(),c(),h(),T=r(),E={baseUrl:`ws://127.0.0.1:0`,mock:!0,token:`storybook`},_.__docgenInfo={description:``,methods:[],displayName:`WorkspaceStoryHarness`,props:{debuggingMode:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}},message:{required:!0,tsType:{name:`signature`,type:`object`,raw:`{
  groups: SidebarSessionGroup[];
  previousSessions: SidebarPreviousSessionItem[];
  scratchPadContent: string;
  type: "hydrate";
  hud: SidebarHudState;
}`,signature:{properties:[{key:`groups`,value:{name:`Array`,elements:[{name:`signature`,type:`object`,raw:`{
  kind?: "browser" | "workspace";
  groupId: string;
  isActive: boolean;
  isFocusModeActive: boolean;
  layoutVisibleCount: VisibleSessionCount;
  sessions: SidebarSessionItem[];
  title: string;
  viewMode: TerminalViewMode;
  visibleCount: VisibleSessionCount;
}`,signature:{properties:[{key:`kind`,value:{name:`union`,raw:`"browser" | "workspace"`,elements:[{name:`literal`,value:`"browser"`},{name:`literal`,value:`"workspace"`}],required:!1}},{key:`groupId`,value:{name:`string`,required:!0}},{key:`isActive`,value:{name:`boolean`,required:!0}},{key:`isFocusModeActive`,value:{name:`boolean`,required:!0}},{key:`layoutVisibleCount`,value:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}],required:!0}},{key:`sessions`,value:{name:`Array`,elements:[{name:`signature`,type:`object`,raw:`{
  kind?: "browser" | "workspace";
  activity: "idle" | "working" | "attention";
  activityLabel?: string;
  agentIcon?: SidebarAgentIcon;
  sessionId: string;
  sessionNumber?: string;
  primaryTitle?: string;
  terminalTitle?: string;
  alias: string;
  shortcutLabel: string;
  row: number;
  column: number;
  isFocused: boolean;
  isVisible: boolean;
  isRunning: boolean;
  detail?: string;
}`,signature:{properties:[{key:`kind`,value:{name:`union`,raw:`"browser" | "workspace"`,elements:[{name:`literal`,value:`"browser"`},{name:`literal`,value:`"workspace"`}],required:!1}},{key:`activity`,value:{name:`union`,raw:`"idle" | "working" | "attention"`,elements:[{name:`literal`,value:`"idle"`},{name:`literal`,value:`"working"`},{name:`literal`,value:`"attention"`}],required:!0}},{key:`activityLabel`,value:{name:`string`,required:!1}},{key:`agentIcon`,value:{name:`union`,raw:`"browser" | DefaultSidebarAgent["icon"]`,elements:[{name:`literal`,value:`"browser"`},{name:`unknown[number]["icon"]`,raw:`DefaultSidebarAgent["icon"]`}],required:!1}},{key:`sessionId`,value:{name:`string`,required:!0}},{key:`sessionNumber`,value:{name:`string`,required:!1}},{key:`primaryTitle`,value:{name:`string`,required:!1}},{key:`terminalTitle`,value:{name:`string`,required:!1}},{key:`alias`,value:{name:`string`,required:!0}},{key:`shortcutLabel`,value:{name:`string`,required:!0}},{key:`row`,value:{name:`number`,required:!0}},{key:`column`,value:{name:`number`,required:!0}},{key:`isFocused`,value:{name:`boolean`,required:!0}},{key:`isVisible`,value:{name:`boolean`,required:!0}},{key:`isRunning`,value:{name:`boolean`,required:!0}},{key:`detail`,value:{name:`string`,required:!1}}]}}],raw:`SidebarSessionItem[]`,required:!0}},{key:`title`,value:{name:`string`,required:!0}},{key:`viewMode`,value:{name:`union`,raw:`"horizontal" | "vertical" | "grid"`,elements:[{name:`literal`,value:`"horizontal"`},{name:`literal`,value:`"vertical"`},{name:`literal`,value:`"grid"`}],required:!0}},{key:`visibleCount`,value:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}],required:!0}}]}}],raw:`SidebarSessionGroup[]`,required:!0}},{key:`previousSessions`,value:{name:`Array`,elements:[{name:`intersection`,raw:`SidebarSessionItem & {
  closedAt: string;
  historyId: string;
  isGeneratedName: boolean;
  isRestorable: boolean;
}`,elements:[{name:`signature`,type:`object`,raw:`{
  kind?: "browser" | "workspace";
  activity: "idle" | "working" | "attention";
  activityLabel?: string;
  agentIcon?: SidebarAgentIcon;
  sessionId: string;
  sessionNumber?: string;
  primaryTitle?: string;
  terminalTitle?: string;
  alias: string;
  shortcutLabel: string;
  row: number;
  column: number;
  isFocused: boolean;
  isVisible: boolean;
  isRunning: boolean;
  detail?: string;
}`,signature:{properties:[{key:`kind`,value:{name:`union`,raw:`"browser" | "workspace"`,elements:[{name:`literal`,value:`"browser"`},{name:`literal`,value:`"workspace"`}],required:!1}},{key:`activity`,value:{name:`union`,raw:`"idle" | "working" | "attention"`,elements:[{name:`literal`,value:`"idle"`},{name:`literal`,value:`"working"`},{name:`literal`,value:`"attention"`}],required:!0}},{key:`activityLabel`,value:{name:`string`,required:!1}},{key:`agentIcon`,value:{name:`union`,raw:`"browser" | DefaultSidebarAgent["icon"]`,elements:[{name:`literal`,value:`"browser"`},{name:`unknown[number]["icon"]`,raw:`DefaultSidebarAgent["icon"]`}],required:!1}},{key:`sessionId`,value:{name:`string`,required:!0}},{key:`sessionNumber`,value:{name:`string`,required:!1}},{key:`primaryTitle`,value:{name:`string`,required:!1}},{key:`terminalTitle`,value:{name:`string`,required:!1}},{key:`alias`,value:{name:`string`,required:!0}},{key:`shortcutLabel`,value:{name:`string`,required:!0}},{key:`row`,value:{name:`number`,required:!0}},{key:`column`,value:{name:`number`,required:!0}},{key:`isFocused`,value:{name:`boolean`,required:!0}},{key:`isVisible`,value:{name:`boolean`,required:!0}},{key:`isRunning`,value:{name:`boolean`,required:!0}},{key:`detail`,value:{name:`string`,required:!1}}]}},{name:`signature`,type:`object`,raw:`{
  closedAt: string;
  historyId: string;
  isGeneratedName: boolean;
  isRestorable: boolean;
}`,signature:{properties:[{key:`closedAt`,value:{name:`string`,required:!0}},{key:`historyId`,value:{name:`string`,required:!0}},{key:`isGeneratedName`,value:{name:`boolean`,required:!0}},{key:`isRestorable`,value:{name:`boolean`,required:!0}}]}}]}],raw:`SidebarPreviousSessionItem[]`,required:!0}},{key:`scratchPadContent`,value:{name:`string`,required:!0}},{key:`type`,value:{name:`literal`,value:`"hydrate"`,required:!0}},{key:`hud`,value:{name:`signature`,type:`object`,raw:`{
  agentManagerZoomPercent: number;
  agents: SidebarAgentButton[];
  commands: SidebarCommandButton[];
  completionBellEnabled: boolean;
  completionSound: CompletionSoundSetting;
  completionSoundLabel: string;
  debuggingMode: boolean;
  focusedSessionTitle?: string;
  isFocusModeActive: boolean;
  showCloseButtonOnSessionCards: boolean;
  showHotkeysOnSessionCards: boolean;
  theme:
    | "plain-dark"
    | "plain-light"
    | "dark-green"
    | "dark-blue"
    | "dark-red"
    | "dark-pink"
    | "dark-orange"
    | "light-blue"
    | "light-green"
    | "light-pink"
    | "light-orange";
  highlightedVisibleCount: VisibleSessionCount;
  visibleCount: VisibleSessionCount;
  visibleSlotLabels: string[];
  viewMode: TerminalViewMode;
}`,signature:{properties:[{key:`agentManagerZoomPercent`,value:{name:`number`,required:!0}},{key:`agents`,value:{name:`Array`,elements:[{name:`signature`,type:`object`,raw:`{
  agentId: string;
  command?: string;
  icon?: SidebarAgentIcon;
  isDefault: boolean;
  name: string;
}`,signature:{properties:[{key:`agentId`,value:{name:`string`,required:!0}},{key:`command`,value:{name:`string`,required:!1}},{key:`icon`,value:{name:`union`,raw:`"browser" | DefaultSidebarAgent["icon"]`,elements:[{name:`literal`,value:`"browser"`},{name:`unknown[number]["icon"]`,raw:`DefaultSidebarAgent["icon"]`}],required:!1}},{key:`isDefault`,value:{name:`boolean`,required:!0}},{key:`name`,value:{name:`string`,required:!0}}]}}],raw:`SidebarAgentButton[]`,required:!0}},{key:`commands`,value:{name:`Array`,elements:[{name:`signature`,type:`object`,raw:`{
  actionType: SidebarActionType;
  closeTerminalOnExit: boolean;
  command?: string;
  commandId: string;
  isDefault: boolean;
  name: string;
  url?: string;
}`,signature:{properties:[{key:`actionType`,value:{name:`union`,raw:`"browser" | "terminal"`,elements:[{name:`literal`,value:`"browser"`},{name:`literal`,value:`"terminal"`}],required:!0}},{key:`closeTerminalOnExit`,value:{name:`boolean`,required:!0}},{key:`command`,value:{name:`string`,required:!1}},{key:`commandId`,value:{name:`string`,required:!0}},{key:`isDefault`,value:{name:`boolean`,required:!0}},{key:`name`,value:{name:`string`,required:!0}},{key:`url`,value:{name:`string`,required:!1}}]}}],raw:`SidebarCommandButton[]`,required:!0}},{key:`completionBellEnabled`,value:{name:`boolean`,required:!0}},{key:`completionSound`,value:{name:`unknown[number]["value"]`,raw:`(typeof COMPLETION_SOUND_OPTIONS)[number]["value"]`,required:!0}},{key:`completionSoundLabel`,value:{name:`string`,required:!0}},{key:`debuggingMode`,value:{name:`boolean`,required:!0}},{key:`focusedSessionTitle`,value:{name:`string`,required:!1}},{key:`isFocusModeActive`,value:{name:`boolean`,required:!0}},{key:`showCloseButtonOnSessionCards`,value:{name:`boolean`,required:!0}},{key:`showHotkeysOnSessionCards`,value:{name:`boolean`,required:!0}},{key:`theme`,value:{name:`union`,raw:`| "plain-dark"
| "plain-light"
| "dark-green"
| "dark-blue"
| "dark-red"
| "dark-pink"
| "dark-orange"
| "light-blue"
| "light-green"
| "light-pink"
| "light-orange"`,elements:[{name:`literal`,value:`"plain-dark"`},{name:`literal`,value:`"plain-light"`},{name:`literal`,value:`"dark-green"`},{name:`literal`,value:`"dark-blue"`},{name:`literal`,value:`"dark-red"`},{name:`literal`,value:`"dark-pink"`},{name:`literal`,value:`"dark-orange"`},{name:`literal`,value:`"light-blue"`},{name:`literal`,value:`"light-green"`},{name:`literal`,value:`"light-pink"`},{name:`literal`,value:`"light-orange"`}],required:!0}},{key:`highlightedVisibleCount`,value:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}],required:!0}},{key:`visibleCount`,value:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}],required:!0}},{key:`visibleSlotLabels`,value:{name:`Array`,elements:[{name:`string`}],raw:`string[]`,required:!0}},{key:`viewMode`,value:{name:`union`,raw:`"horizontal" | "vertical" | "grid"`,elements:[{name:`literal`,value:`"horizontal"`},{name:`literal`,value:`"vertical"`},{name:`literal`,value:`"grid"`}],required:!0}}]},required:!0}}]}},description:``}}}})),O,k,A,j,M;t((()=>{p(),u(),D(),O=r(),k={title:`Workspace/Debug Shell`,args:{...m,debuggingMode:!0},argTypes:{...d,debuggingMode:{control:`boolean`}},render:e=>(0,O.jsx)(_,{debuggingMode:e.debuggingMode,message:f(e)})},A={},j={args:{debuggingMode:!0,fixture:`selector-states`,highlightedVisibleCount:2,isFocusModeActive:!1,theme:`dark-blue`,viewMode:`vertical`,visibleCount:2}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    debuggingMode: true,
    fixture: "selector-states",
    highlightedVisibleCount: 2,
    isFocusModeActive: false,
    theme: "dark-blue",
    viewMode: "vertical",
    visibleCount: 2
  }
}`,...j.parameters?.docs?.source}}},M=[`Default`,`SplitFocusDebug`]}))();export{A as Default,j as SplitFocusDebug,M as __namedExportsOrder,k as default};