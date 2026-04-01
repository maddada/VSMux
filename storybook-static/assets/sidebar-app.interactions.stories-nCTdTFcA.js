import{n as e}from"./chunk-BneVvdWh.js";import{a as t,c as n,i as r,l as i,n as a,r as o,t as s,u as c}from"./sidebar-story-meta-DpCxcLJt.js";async function l(){await w(()=>S(n().some(e=>e.type===`ready`)).toBe(!0))}async function u(e){await w(()=>S(n().some(t=>x(t,e))).toBe(!0))}async function d(e,t){await p(t,await f(e,t))}async function f(e,t){let n=v(e),r=v(t),i={button:0,buttons:1,isPrimary:!0,pointerId:1,pointerType:`mouse`};return await C.pointerDown(e,{...i,bubbles:!0,clientX:n.x,clientY:n.y}),await y(250),await C.pointerMove(e.ownerDocument,{...i,bubbles:!0,clientX:n.x+2,clientY:n.y+2}),await b(e.ownerDocument.defaultView),await C.pointerMove(t,{...i,bubbles:!0,clientX:r.x,clientY:r.y}),await b(e.ownerDocument.defaultView),{pointerData:i,targetPosition:r}}async function p(e,t){await C.pointerUp(e,{...t.pointerData,buttons:0,bubbles:!0,clientX:t.targetPosition.x,clientY:t.targetPosition.y}),await b(e.ownerDocument.defaultView)}async function m(e){let t=e.getBoundingClientRect();await C.contextMenu(e,{bubbles:!0,clientX:t.left+t.width/2,clientY:t.top+12})}async function h(e,t,n){c(),await d(await _(e,`[data-sidebar-session-id="${t}"]`,`${t} card`),await _(e,`[data-sidebar-group-id="${n}"]`,`${n} section`)),await u({groupId:n,sessionId:t,targetIndex:0,type:`moveSessionToGroup`})}async function g(e,t,n){await w(()=>S(Array.from(e.querySelectorAll(`[data-sidebar-group-id="${t}"] [data-sidebar-session-id]`)).map(e=>e.getAttribute(`data-sidebar-session-id`))).toEqual(n))}async function _(e,t,n){let r;if(await w(()=>{let i=e.querySelector(t);if(!(i instanceof HTMLElement))throw Error(`Could not find ${n} with selector: ${t}`);return r=i,S(i).toBeTruthy()}),!r)throw Error(`Could not find ${n} with selector: ${t}`);return r}function v(e){let t=e.getBoundingClientRect();return{x:t.left+t.width/2,y:t.top+t.height/2}}async function y(e){await new Promise(t=>{setTimeout(t,e)})}async function b(e){await new Promise(t=>{if(!e||typeof e.requestAnimationFrame!=`function`){setTimeout(t,0);return}e.requestAnimationFrame(()=>{t(void 0)})})}function x(e,t){return Object.entries(t).every(([t,n])=>{let r=e[t];return Array.isArray(n)?JSON.stringify(r)===JSON.stringify(n):r===n})}var S,C,w,T=e((()=>{i(),{expect:S,fireEvent:C,waitFor:w}=__STORYBOOK_MODULE_TEST__})),E,D,O,k,A,j,M,N,P,F,I;e((()=>{i(),T(),r(),{expect:E,waitFor:D,within:O}=__STORYBOOK_MODULE_TEST__,k={title:`Sidebar/Interactions`,args:s,argTypes:a,decorators:o,render:t},A={args:{highlightedVisibleCount:2,visibleCount:2},play:async({canvas:e,canvasElement:t,step:n,userEvent:r})=>{let i=O(t.ownerDocument.body);await l(),c(),await n(`remove the global new session button`,async()=>{await E(e.queryByRole(`button`,{name:`New Session`})).toBeNull()}),await n(`request a new session inside a group`,async()=>{await r.click(e.getByRole(`button`,{name:`Create a session in Group 4`})),await u({groupId:`group-4`,type:`createSessionInGroup`})}),await n(`toggle sessions shown`,async()=>{c(),await r.click(e.getByRole(`button`,{name:`Toggle split mode for Group 4`})),await u({type:`setVisibleCount`,visibleCount:2})}),await n(`keep the split menu available on right click`,async()=>{c(),await m(e.getByRole(`button`,{name:`Toggle split mode for Group 4`})),await E(i.queryByRole(`menuitem`,{name:`3`})).toBeNull(),await E(i.queryByRole(`menuitem`,{name:`4`})).toBeNull(),await E(i.queryByRole(`menuitem`,{name:`6`})).toBeNull(),await E(i.queryByRole(`menuitem`,{name:`9`})).toBeNull(),await r.click(await i.findByRole(`menuitem`,{name:`Show 2 splits`})),await u({type:`setVisibleCount`,visibleCount:2})}),await n(`keep the layout selector hidden`,async()=>{await E(e.queryByRole(`button`,{name:`Open layout options for Group 4`})).toBeNull()}),await n(`open sidebar settings`,async()=>{c(),await r.click(e.getByRole(`button`,{name:`Open sidebar menu`})),await r.click(await i.findByRole(`menuitem`,{name:`Sidebar Settings`})),await u({type:`openSettings`})})}},j={play:async({canvas:e,canvasElement:t,step:n,userEvent:r})=>{let i=t.ownerDocument,a=O(i.body),o=await e.findByRole(`button`,{name:/Harbor Vale/i});c(),await n(`focus a session from its card`,async()=>{await r.click(o),await u({sessionId:`session-3`,type:`focusSession`})}),await n(`rename a session from the hover button`,async()=>{c(),await r.hover(o),await r.click(await e.findByRole(`button`,{name:`Rename session`})),await u({sessionId:`session-3`,type:`promptRenameSession`})}),await n(`rename through the session context menu`,async()=>{c(),await m(o),await r.click(await a.findByRole(`menuitem`,{name:`Rename`})),await u({sessionId:`session-3`,type:`promptRenameSession`})}),await n(`copy a resume command through the session context menu`,async()=>{c(),await m(o),await r.click(await a.findByRole(`menuitem`,{name:`Copy resume`})),await u({sessionId:`session-3`,type:`copyResumeCommand`})}),await n(`terminate through the session context menu`,async()=>{c(),await m(o),await r.click(await a.findByRole(`menuitem`,{name:`Terminate`})),await u({sessionId:`session-3`,type:`closeSession`})})}},M={play:async({canvas:e,canvasElement:t,step:n})=>{let r=t.ownerDocument.body,i=await _(r,`[data-sidebar-session-id="session-1"]`,`session-1 card`),a=await _(r,`[data-sidebar-session-id="session-2"]`,`session-2 card`),o=await _(r,`[data-sidebar-session-id="session-4"]`,`session-4 card`),s=await _(r,`[data-sidebar-session-id="session-5"]`,`session-5 card`);c(),await n(`keep each group-2 frame mapped to a single session while hovering`,async()=>{let e=await f(o,s);await D(()=>E(Array.from(r.querySelectorAll(`[data-sidebar-group-id="group-2"] .session-frame`)).map(e=>e.querySelectorAll(`.session`).length)).toEqual([1,1])),await p(s,e)}),await n(`reorder sessions inside a group`,async()=>{await d(i,a),await u({groupId:`group-1`,sessionIds:[`session-2`,`session-1`,`session-3`],type:`syncSessionOrder`}),await E(e.getAllByRole(`button`,{name:/show title in 2nd row|layout drift fix|Harbor Vale/i})[0]).toHaveTextContent(`layout drift fix`)})}},N={play:async({canvasElement:e,step:t})=>{let n=e.ownerDocument.body,r=await _(n,`[data-sidebar-session-id="session-3"]`,`session-3 card`),i=await _(n,`[data-sidebar-session-id="session-4"]`,`session-4 card`);c(),await t(`move a session into another group at the hovered slot`,async()=>{await d(r,i),await u({groupId:`group-2`,sessionId:`session-3`,targetIndex:0,type:`moveSessionToGroup`}),await g(n,`group-1`,[`session-1`,`session-2`]),await g(n,`group-2`,[`session-3`,`session-4`,`session-5`])})}},P={play:async({canvasElement:e,step:t})=>{let n=e.ownerDocument.body;await t(`move the same session back and forth across groups`,async()=>{c(),await d(await _(n,`[data-sidebar-session-id="session-3"]`,`session-3 card`),await _(n,`[data-sidebar-group-id="group-2"]`,`group-2 section`)),await u({groupId:`group-2`,sessionId:`session-3`,targetIndex:0,type:`moveSessionToGroup`}),await g(n,`group-2`,[`session-3`,`session-4`,`session-5`]),c(),await d(await _(n,`[data-sidebar-session-id="session-3"]`,`session-3 card`),await _(n,`[data-sidebar-group-id="group-1"]`,`group-1 section`)),await u({groupId:`group-1`,sessionId:`session-3`,targetIndex:0,type:`moveSessionToGroup`}),await g(n,`group-1`,[`session-3`,`session-1`,`session-2`]),await g(n,`group-2`,[`session-4`,`session-5`])})}},F={args:{fixture:`three-groups-stress`,highlightedVisibleCount:2,visibleCount:2},play:async({canvasElement:e,step:t})=>{let n=e.ownerDocument.body;await t(`move sessions across three groups until groups empty and refill`,async()=>{await h(n,`session-2`,`group-2`),await g(n,`group-1`,[`session-1`]),await g(n,`group-2`,[`session-2`,`session-3`,`session-4`]),await h(n,`session-1`,`group-3`),await g(n,`group-1`,[]),await g(n,`group-3`,[`session-1`,`session-5`,`session-6`]),await h(n,`session-3`,`group-1`),await g(n,`group-1`,[`session-3`]),await g(n,`group-2`,[`session-2`,`session-4`]),await h(n,`session-5`,`group-1`),await g(n,`group-1`,[`session-3`,`session-5`]),await g(n,`group-3`,[`session-1`,`session-6`]),await h(n,`session-4`,`group-3`),await g(n,`group-2`,[`session-2`]),await g(n,`group-3`,[`session-1`,`session-4`,`session-6`]),await h(n,`session-2`,`group-1`),await g(n,`group-1`,[`session-2`,`session-3`,`session-5`]),await g(n,`group-2`,[])})}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    highlightedVisibleCount: 2,
    visibleCount: 2
  },
  play: async ({
    canvas,
    canvasElement,
    step,
    userEvent
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitForReadyMessage();
    resetSidebarStoryMessages();
    await step("remove the global new session button", async () => {
      await expect(canvas.queryByRole("button", {
        name: "New Session"
      })).toBeNull();
    });
    await step("request a new session inside a group", async () => {
      await userEvent.click(canvas.getByRole("button", {
        name: "Create a session in Group 4"
      }));
      await expectMessage({
        groupId: "group-4",
        type: "createSessionInGroup"
      });
    });
    await step("toggle sessions shown", async () => {
      resetSidebarStoryMessages();
      await userEvent.click(canvas.getByRole("button", {
        name: "Toggle split mode for Group 4"
      }));
      await expectMessage({
        type: "setVisibleCount",
        visibleCount: 2
      });
    });
    await step("keep the split menu available on right click", async () => {
      resetSidebarStoryMessages();
      const splitModeButton = canvas.getByRole("button", {
        name: "Toggle split mode for Group 4"
      });
      await openContextMenu(splitModeButton);
      await expect(body.queryByRole("menuitem", {
        name: "3"
      })).toBeNull();
      await expect(body.queryByRole("menuitem", {
        name: "4"
      })).toBeNull();
      await expect(body.queryByRole("menuitem", {
        name: "6"
      })).toBeNull();
      await expect(body.queryByRole("menuitem", {
        name: "9"
      })).toBeNull();
      await userEvent.click(await body.findByRole("menuitem", {
        name: "Show 2 splits"
      }));
      await expectMessage({
        type: "setVisibleCount",
        visibleCount: 2
      });
    });
    await step("keep the layout selector hidden", async () => {
      await expect(canvas.queryByRole("button", {
        name: "Open layout options for Group 4"
      })).toBeNull();
    });
    await step("open sidebar settings", async () => {
      resetSidebarStoryMessages();
      await userEvent.click(canvas.getByRole("button", {
        name: "Open sidebar menu"
      }));
      await userEvent.click(await body.findByRole("menuitem", {
        name: "Sidebar Settings"
      }));
      await expectMessage({
        type: "openSettings"
      });
    });
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas,
    canvasElement,
    step,
    userEvent
  }) => {
    const storyDocument = canvasElement.ownerDocument;
    const body = within(storyDocument.body);
    const sessionCard = await canvas.findByRole("button", {
      name: /Harbor Vale/i
    });
    resetSidebarStoryMessages();
    await step("focus a session from its card", async () => {
      await userEvent.click(sessionCard);
      await expectMessage({
        sessionId: "session-3",
        type: "focusSession"
      });
    });
    await step("rename a session from the hover button", async () => {
      resetSidebarStoryMessages();
      await userEvent.hover(sessionCard);
      await userEvent.click(await canvas.findByRole("button", {
        name: "Rename session"
      }));
      await expectMessage({
        sessionId: "session-3",
        type: "promptRenameSession"
      });
    });
    await step("rename through the session context menu", async () => {
      resetSidebarStoryMessages();
      await openContextMenu(sessionCard);
      await userEvent.click(await body.findByRole("menuitem", {
        name: "Rename"
      }));
      await expectMessage({
        sessionId: "session-3",
        type: "promptRenameSession"
      });
    });
    await step("copy a resume command through the session context menu", async () => {
      resetSidebarStoryMessages();
      await openContextMenu(sessionCard);
      await userEvent.click(await body.findByRole("menuitem", {
        name: "Copy resume"
      }));
      await expectMessage({
        sessionId: "session-3",
        type: "copyResumeCommand"
      });
    });
    await step("terminate through the session context menu", async () => {
      resetSidebarStoryMessages();
      await openContextMenu(sessionCard);
      await userEvent.click(await body.findByRole("menuitem", {
        name: "Terminate"
      }));
      await expectMessage({
        sessionId: "session-3",
        type: "closeSession"
      });
    });
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas,
    canvasElement,
    step
  }) => {
    const storyRoot = canvasElement.ownerDocument.body;
    const firstSession = await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-1"]', "session-1 card");
    const secondSession = await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-2"]', "session-2 card");
    const firstGroupTwoSession = await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-4"]', "session-4 card");
    const secondGroupTwoSession = await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-5"]', "session-5 card");
    resetSidebarStoryMessages();
    await step("keep each group-2 frame mapped to a single session while hovering", async () => {
      const dragState = await dragToHover(firstGroupTwoSession, secondGroupTwoSession);
      await waitFor(() => {
        const frameSessionCounts = Array.from(storyRoot.querySelectorAll('[data-sidebar-group-id="group-2"] .session-frame')).map(frame => frame.querySelectorAll(".session").length);
        return expect(frameSessionCounts).toEqual([1, 1]);
      });
      await releaseDrag(secondGroupTwoSession, dragState);
    });
    await step("reorder sessions inside a group", async () => {
      await dragAndDrop(firstSession, secondSession);
      await expectMessage({
        groupId: "group-1",
        sessionIds: ["session-2", "session-1", "session-3"],
        type: "syncSessionOrder"
      });
      const reorderedSessionCards = canvas.getAllByRole("button", {
        name: /show title in 2nd row|layout drift fix|Harbor Vale/i
      });
      await expect(reorderedSessionCards[0]).toHaveTextContent("layout drift fix");
    });
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    step
  }) => {
    const storyRoot = canvasElement.ownerDocument.body;
    const sourceSession = await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-3"]', "session-3 card");
    const targetSession = await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-4"]', "session-4 card");
    resetSidebarStoryMessages();
    await step("move a session into another group at the hovered slot", async () => {
      await dragAndDrop(sourceSession, targetSession);
      await expectMessage({
        groupId: "group-2",
        sessionId: "session-3",
        targetIndex: 0,
        type: "moveSessionToGroup"
      });
      await expectSessionMembership(storyRoot, "group-1", ["session-1", "session-2"]);
      await expectSessionMembership(storyRoot, "group-2", ["session-3", "session-4", "session-5"]);
    });
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    step
  }) => {
    const storyRoot = canvasElement.ownerDocument.body;
    await step("move the same session back and forth across groups", async () => {
      resetSidebarStoryMessages();
      await dragAndDrop(await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-3"]', "session-3 card"), await findRequiredElement(storyRoot, '[data-sidebar-group-id="group-2"]', "group-2 section"));
      await expectMessage({
        groupId: "group-2",
        sessionId: "session-3",
        targetIndex: 0,
        type: "moveSessionToGroup"
      });
      await expectSessionMembership(storyRoot, "group-2", ["session-3", "session-4", "session-5"]);
      resetSidebarStoryMessages();
      await dragAndDrop(await findRequiredElement(storyRoot, '[data-sidebar-session-id="session-3"]', "session-3 card"), await findRequiredElement(storyRoot, '[data-sidebar-group-id="group-1"]', "group-1 section"));
      await expectMessage({
        groupId: "group-1",
        sessionId: "session-3",
        targetIndex: 0,
        type: "moveSessionToGroup"
      });
      await expectSessionMembership(storyRoot, "group-1", ["session-3", "session-1", "session-2"]);
      await expectSessionMembership(storyRoot, "group-2", ["session-4", "session-5"]);
    });
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  args: {
    fixture: "three-groups-stress",
    highlightedVisibleCount: 2,
    visibleCount: 2
  },
  play: async ({
    canvasElement,
    step
  }) => {
    const storyRoot = canvasElement.ownerDocument.body;
    await step("move sessions across three groups until groups empty and refill", async () => {
      await dragSessionToGroup(storyRoot, "session-2", "group-2");
      await expectSessionMembership(storyRoot, "group-1", ["session-1"]);
      await expectSessionMembership(storyRoot, "group-2", ["session-2", "session-3", "session-4"]);
      await dragSessionToGroup(storyRoot, "session-1", "group-3");
      await expectSessionMembership(storyRoot, "group-1", []);
      await expectSessionMembership(storyRoot, "group-3", ["session-1", "session-5", "session-6"]);
      await dragSessionToGroup(storyRoot, "session-3", "group-1");
      await expectSessionMembership(storyRoot, "group-1", ["session-3"]);
      await expectSessionMembership(storyRoot, "group-2", ["session-2", "session-4"]);
      await dragSessionToGroup(storyRoot, "session-5", "group-1");
      await expectSessionMembership(storyRoot, "group-1", ["session-3", "session-5"]);
      await expectSessionMembership(storyRoot, "group-3", ["session-1", "session-6"]);
      await dragSessionToGroup(storyRoot, "session-4", "group-3");
      await expectSessionMembership(storyRoot, "group-2", ["session-2"]);
      await expectSessionMembership(storyRoot, "group-3", ["session-1", "session-4", "session-6"]);
      await dragSessionToGroup(storyRoot, "session-2", "group-1");
      await expectSessionMembership(storyRoot, "group-1", ["session-2", "session-3", "session-5"]);
      await expectSessionMembership(storyRoot, "group-2", []);
    });
  }
}`,...F.parameters?.docs?.source}}},I=[`ToolbarActions`,`SessionCardActions`,`DragToReorderWithinGroup`,`DragToMoveAcrossGroups`,`DragAcrossGroupsRepeatedly`,`DragAcrossThreeGroupsStress`]}))();export{P as DragAcrossGroupsRepeatedly,F as DragAcrossThreeGroupsStress,N as DragToMoveAcrossGroups,M as DragToReorderWithinGroup,j as SessionCardActions,A as ToolbarActions,I as __namedExportsOrder,k as default};