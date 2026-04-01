import{a as e,n as t}from"./chunk-BneVvdWh.js";import{n,t as r}from"./iframe-DYlbbSxv.js";import{a as i,c as a,d as o,f as s,h as c,i as l,l as u,m as d,n as f,o as p,p as m,r as h,s as g,t as _,u as v}from"./sidebar-story-workspace-GKsVD5g7.js";function y(){return[...w]}function b(){w.length=0}function x({message:e}){let[t,n]=(0,S.useState)(()=>f(e)),r=(0,S.useRef)(t),a=(0,S.useRef)({postMessage(e){w.push(e);let t=l(r.current,e);t&&window.setTimeout(()=>{(0,S.startTransition)(()=>{n(t)})},0)}}).current;return(0,S.useEffect)(()=>{r.current=t},[t]),(0,S.useEffect)(()=>{(0,S.startTransition)(()=>{n(f(e))})},[e]),(0,S.useEffect)(()=>{let e=_(t),n=window.setTimeout(()=>{window.postMessage(e,`*`)},0);return()=>{window.clearTimeout(n)}},[t]),(0,C.jsx)(`div`,{style:{height:`100%`,width:`100%`},children:(0,C.jsx)(i,{vscode:a})})}var S,C,w,T=t((()=>{S=e(n()),p(),h(),C=r(),w=[],x.__docgenInfo={description:``,methods:[],displayName:`SidebarStoryHarness`,props:{message:{required:!0,tsType:{name:`signature`,type:`object`,raw:`{
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
| "light-orange"`,elements:[{name:`literal`,value:`"plain-dark"`},{name:`literal`,value:`"plain-light"`},{name:`literal`,value:`"dark-green"`},{name:`literal`,value:`"dark-blue"`},{name:`literal`,value:`"dark-red"`},{name:`literal`,value:`"dark-pink"`},{name:`literal`,value:`"dark-orange"`},{name:`literal`,value:`"light-blue"`},{name:`literal`,value:`"light-green"`},{name:`literal`,value:`"light-pink"`},{name:`literal`,value:`"light-orange"`}],required:!0}},{key:`highlightedVisibleCount`,value:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}],required:!0}},{key:`visibleCount`,value:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}],required:!0}},{key:`visibleSlotLabels`,value:{name:`Array`,elements:[{name:`string`}],raw:`string[]`,required:!0}},{key:`viewMode`,value:{name:`union`,raw:`"horizontal" | "vertical" | "grid"`,elements:[{name:`literal`,value:`"horizontal"`},{name:`literal`,value:`"vertical"`},{name:`literal`,value:`"grid"`}],required:!0}}]},required:!0}}]}},description:``}}}}));function E({activity:e=`idle`,activityLabel:t,alias:n,agentIcon:r,detail:i,isFocused:a=!1,isRunning:o=!0,isVisible:s=!1,primaryTitle:c,sessionId:l,shortcutLabel:u,terminalTitle:d}){return{activity:e,activityLabel:t,agentIcon:r,alias:n,column:0,detail:i,isFocused:a,isRunning:o,isVisible:s,primaryTitle:c,row:0,sessionId:l,shortcutLabel:u,terminalTitle:d}}function D(e){return e.map(e=>({...e,sessions:e.sessions.map(e=>({...e}))}))}function O(e){let t=e.flatMap(e=>e.sessions).find(e=>e.isFocused);return t?t.alias??t.terminalTitle??t.primaryTitle??t.detail:void 0}function k(e){return e.flatMap(e=>e.sessions).filter(e=>e.isVisible).map(e=>e.shortcutLabel)}var A=t((()=>{})),j,M,N,P,F,I,L=t((()=>{A(),j=[{groupId:`group-1`,isActive:!1,sessions:[E({alias:`show title in 2nd row`,agentIcon:`codex`,detail:`OpenAI Codex`,sessionId:`session-1`,shortcutLabel:`⌘⌥1`}),E({alias:`layout drift fix`,agentIcon:`codex`,detail:`OpenAI Codex`,sessionId:`session-2`,shortcutLabel:`⌘⌥2`}),E({alias:`Harbor Vale`,agentIcon:`codex`,detail:`OpenAI Codex`,sessionId:`session-3`,shortcutLabel:`⌘⌥3`})],title:`Main`},{groupId:`group-2`,isActive:!1,sessions:[E({activity:`attention`,alias:`tooltip & show an indicator on the active card`,detail:`OpenAI Codex`,sessionId:`session-4`,shortcutLabel:`⌘⌥4`}),E({alias:`Indigo Grove`,detail:`OpenAI Codex`,sessionId:`session-5`,shortcutLabel:`⌘⌥5`})],title:`Group 2`},{groupId:`group-4`,isActive:!0,sessions:[E({alias:`Amber Lattice`,detail:`OpenAI Codex`,isFocused:!0,isVisible:!0,sessionId:`session-6`,shortcutLabel:`⌘⌥6`})],title:`Group 4`}],M=[{groupId:`group-1`,isActive:!0,sessions:[E({activity:`working`,alias:`active refactor`,detail:`Claude Code`,isFocused:!0,isVisible:!0,sessionId:`session-1`,shortcutLabel:`⌘⌥1`}),E({alias:`ui hover audit`,detail:`OpenAI Codex`,isVisible:!0,sessionId:`session-2`,shortcutLabel:`⌘⌥2`}),E({activity:`attention`,alias:`terminal title indicator`,detail:`OpenAI Codex`,isVisible:!0,sessionId:`session-3`,shortcutLabel:`⌘⌥3`}),E({alias:`workspace sync`,detail:`OpenAI Codex`,isVisible:!0,sessionId:`session-4`,shortcutLabel:`⌘⌥4`})],title:`Main`},{groupId:`group-2`,isActive:!1,sessions:[E({alias:`fallback styling pass`,detail:`OpenAI Codex`,isRunning:!1,sessionId:`session-5`,shortcutLabel:`⌘⌥5`})],title:`Review`}],N=[{groupId:`group-1`,isActive:!0,sessions:[E({activity:`working`,alias:`extremely long alias for the primary debugging session that should truncate cleanly`,detail:`OpenAI Codex running a sidebar layout regression pass with long secondary text`,isFocused:!0,isVisible:!0,sessionId:`session-1`,shortcutLabel:`⌘⌥1`,terminalTitle:`OpenAI Codex / terminal / feature/sidebar-storybook / very-long-branch-name`}),E({activity:`attention`,alias:`hover tooltip verification for overflow and status chip alignment`,detail:`Claude Code with a surprisingly verbose secondary line to stress wrapping assumptions`,isVisible:!0,sessionId:`session-2`,shortcutLabel:`⌘⌥2`,terminalTitle:`Claude Code / visual diff / attention state`}),E({alias:`inactive session with close button`,detail:`Gemini CLI`,isRunning:!1,sessionId:`session-3`,shortcutLabel:`⌘⌥3`})],title:`Main workspace with a deliberately long group title`},{groupId:`group-2`,isActive:!1,sessions:[E({alias:`session card spacing audit across themes`,detail:`OpenAI Codex`,sessionId:`session-4`,shortcutLabel:`⌘⌥4`}),E({alias:`secondary label overflow with keyboard shortcut visible`,detail:`OpenAI Codex with another very long provider name for stress testing`,sessionId:`session-5`,shortcutLabel:`⌘⌥5`})],title:`Secondary investigations`},{groupId:`group-3`,isActive:!1,sessions:[E({alias:`one more card for density`,detail:`OpenAI Codex`,sessionId:`session-6`,shortcutLabel:`⌘⌥6`})],title:`QA`}],P=[{groupId:`group-1`,isActive:!0,sessions:[E({alias:`fresh workspace`,detail:`OpenAI Codex`,isFocused:!0,isVisible:!0,sessionId:`session-1`,shortcutLabel:`⌘⌥1`})],title:`Main`},{groupId:`group-2`,isActive:!1,sessions:[],title:`Design`},{groupId:`group-3`,isActive:!1,sessions:[],title:`Review`}],F=[{groupId:`group-1`,isActive:!0,sessions:[E({alias:`Atlas Forge`,detail:`OpenAI Codex`,isFocused:!0,isVisible:!0,sessionId:`session-1`,shortcutLabel:`⌘⌥1`}),E({alias:`Beryl Note`,detail:`OpenAI Codex`,isVisible:!0,sessionId:`session-2`,shortcutLabel:`⌘⌥2`})],title:`Main`},{groupId:`group-2`,isActive:!1,sessions:[E({alias:`Cinder Path`,detail:`OpenAI Codex`,sessionId:`session-3`,shortcutLabel:`⌘⌥3`}),E({alias:`Dune Echo`,detail:`OpenAI Codex`,sessionId:`session-4`,shortcutLabel:`⌘⌥4`})],title:`Group 2`},{groupId:`group-3`,isActive:!1,sessions:[E({alias:`Elm Signal`,detail:`OpenAI Codex`,sessionId:`session-5`,shortcutLabel:`⌘⌥5`}),E({alias:`Fjord Thread`,detail:`OpenAI Codex`,sessionId:`session-6`,shortcutLabel:`⌘⌥6`})],title:`Group 3`}],I={default:j,"empty-groups":P,"overflow-stress":N,"selector-states":M,"three-groups-stress":F}}));function R(e){let t=D(I[e.fixture]).map(t=>{let n=t.isActive?e.visibleCount:o(Math.max(1,t.sessions.length));return{...t,isFocusModeActive:t.isActive?e.isFocusModeActive:!1,layoutVisibleCount:t.isActive?e.highlightedVisibleCount:n,viewMode:t.isActive?e.viewMode:`grid`,visibleCount:n}});return{groups:t,hud:{agentManagerZoomPercent:100,agents:d(),commands:s(),completionBellEnabled:!1,completionSound:a,completionSoundLabel:u(a),debuggingMode:!1,focusedSessionTitle:O(t),highlightedVisibleCount:e.highlightedVisibleCount,isFocusModeActive:e.isFocusModeActive,showCloseButtonOnSessionCards:e.showCloseButtonOnSessionCards,showHotkeysOnSessionCards:e.showHotkeysOnSessionCards,theme:e.theme,viewMode:e.viewMode,visibleCount:e.visibleCount,visibleSlotLabels:k(t)},scratchPadContent:``,type:`hydrate`}}var z=t((()=>{v(),c(),m(),g(),L(),A()}));function B(e){return(0,V.jsx)(x,{message:R(e)})}var V,H,U,W,G=t((()=>{T(),z(),V=r(),H={fixture:`default`,highlightedVisibleCount:1,isFocusModeActive:!1,showCloseButtonOnSessionCards:!1,showHotkeysOnSessionCards:!1,theme:`dark-blue`,viewMode:`grid`,visibleCount:1},U={fixture:{control:`select`,options:[`default`,`selector-states`,`overflow-stress`,`empty-groups`,`three-groups-stress`]},highlightedVisibleCount:{control:`inline-radio`,options:[1,2,3,4,6,9]},isFocusModeActive:{control:`boolean`},showCloseButtonOnSessionCards:{control:`boolean`},showHotkeysOnSessionCards:{control:`boolean`},theme:{control:`select`,options:[`plain-dark`,`plain-light`,`dark-green`,`dark-blue`,`dark-red`,`dark-pink`,`dark-orange`,`light-blue`,`light-green`,`light-pink`,`light-orange`]},viewMode:{control:`inline-radio`,options:[`horizontal`,`vertical`,`grid`]},visibleCount:{control:`inline-radio`,options:[1,2,3,4,6,9]}},W=[e=>(0,V.jsx)(`div`,{style:{display:`grid`,justifyItems:`center`,minHeight:`100vh`,padding:`16px`},children:(0,V.jsx)(`div`,{style:{height:`950px`,overflow:`auto`,width:`300px`},children:(0,V.jsx)(e,{})})})],B.__docgenInfo={description:``,methods:[],displayName:`renderSidebarStory`,props:{fixture:{required:!0,tsType:{name:`union`,raw:`| "default"
| "selector-states"
| "overflow-stress"
| "empty-groups"
| "three-groups-stress"`,elements:[{name:`literal`,value:`"default"`},{name:`literal`,value:`"selector-states"`},{name:`literal`,value:`"overflow-stress"`},{name:`literal`,value:`"empty-groups"`},{name:`literal`,value:`"three-groups-stress"`}]},description:``},highlightedVisibleCount:{required:!0,tsType:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}]},description:``},isFocusModeActive:{required:!0,tsType:{name:`boolean`},description:``},showCloseButtonOnSessionCards:{required:!0,tsType:{name:`boolean`},description:``},showHotkeysOnSessionCards:{required:!0,tsType:{name:`boolean`},description:``},theme:{required:!0,tsType:{name:`union`,raw:`| "plain-dark"
| "plain-light"
| "dark-green"
| "dark-blue"
| "dark-red"
| "dark-pink"
| "dark-orange"
| "light-blue"
| "light-green"
| "light-pink"
| "light-orange"`,elements:[{name:`literal`,value:`"plain-dark"`},{name:`literal`,value:`"plain-light"`},{name:`literal`,value:`"dark-green"`},{name:`literal`,value:`"dark-blue"`},{name:`literal`,value:`"dark-red"`},{name:`literal`,value:`"dark-pink"`},{name:`literal`,value:`"dark-orange"`},{name:`literal`,value:`"light-blue"`},{name:`literal`,value:`"light-green"`},{name:`literal`,value:`"light-pink"`},{name:`literal`,value:`"light-orange"`}]},description:``},viewMode:{required:!0,tsType:{name:`union`,raw:`"horizontal" | "vertical" | "grid"`,elements:[{name:`literal`,value:`"horizontal"`},{name:`literal`,value:`"vertical"`},{name:`literal`,value:`"grid"`}]},description:``},visibleCount:{required:!0,tsType:{name:`union`,raw:`1 | 2 | 3 | 4 | 6 | 9`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`6`},{name:`literal`,value:`9`}]},description:``}}}}));export{B as a,y as c,G as i,T as l,U as n,R as o,W as r,z as s,H as t,b as u};