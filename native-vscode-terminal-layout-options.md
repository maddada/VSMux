# Native VS Code Terminal Layout Options

This note captures the practical constraints and options if Agent Canvas X moves away from rendering terminals inside a webview and instead uses VS Code's native terminals in the editor area.

## Short Answer

With native VS Code terminals, you can get a nice grid.

You cannot get a true infinite pannable plane.

## Hard Limitations

### No Absolute Positioning

The terminal editor API lets you place terminals in the editor area and split them relative to existing terminals, but it does not expose arbitrary `x/y/width/height` placement.

In practice, the placement model is based on:

- editor area placement
- view columns
- splitting beside an existing terminal

What you do **not** get:

- freeform coordinates
- arbitrary tile geometry
- canvas-style positioning

### No Native Panning Camera

VS Code editor groups are a workbench grid of panes.

They are not:

- a scrollable world
- a pannable surface
- a zoomable spatial canvas

You can create rows and columns and resize them with sashes, but you cannot pan around a larger 2D terminal world.

### No DOM-Level Control Over Workbench Layout

An extension cannot arbitrarily restyle or custom-position editor groups in the VS Code workbench.

The workbench owns:

- editor groups
- group geometry
- sash behavior
- terminal editor tabs

### Placement Primitives Are Limited

The useful terminal location primitives are basically:

- `TerminalLocation.Editor`
- `TerminalEditorLocationOptions`
- `TerminalSplitLocationOptions`

That is enough for editor-area terminals and splits, but not enough for a custom freeform grid engine.

### No First-Class API For Arbitrary Group Geometry Management

You can observe tab groups and editor state, but there is no first-class API like:

- place terminal at row `7`, column `12`
- set exact terminal width/height
- create a giant logical grid and pan through it natively

The editor layout remains workbench-owned.

## What You _Can_ Do

### 1. Fixed Visible Grid

Use editor groups as the layout surface directly.

Examples:

- `2x2`
- `3 columns`
- `3x3`

Approach:

- open each terminal in the editor area
- split beside existing terminals to build a stable layout
- let the user resize groups with VS Code sashes
- keep the layout stable with locked groups when needed

Benefits:

- native terminal rendering
- much less custom UI work
- low risk compared with a custom renderer

Tradeoff:

- the grid is limited to what VS Code workbench groups can represent
- no freeform spatial placement

### 2. Grid + Tabs Per Cell

Treat each editor group as one visible cell in the grid and allow multiple terminals as tabs inside that cell.

Benefits:

- scales better than making every terminal visible simultaneously
- stays fully native

Tradeoff:

- many terminals are not visible at the same time
- weaker spatial overview

### 3. Paged Grid

This is the closest native replacement for panning.

Approach:

- keep a larger logical grid in extension state
- store each terminal at a logical coordinate like `(x, y)`
- only materialize a visible window such as `3x3`
- when the user "pans", swap which terminals are shown in those visible editor groups

This gives the effect of moving a viewport across a larger space, but it is not true panning.

Tradeoffs:

- not continuous
- more like stepping a camera or changing pages
- layout remapping logic becomes the extension's responsibility

### 4. Navigator + Reveal

Use a lightweight side panel or small webview only as a navigator.

The navigator can show:

- a map of logical terminal positions
- cluster/group labels
- directional navigation controls

Interaction model:

- click a terminal in the navigator to reveal/focus it
- use keyboard commands to move north/south/east/west in the logical grid

Benefits:

- preserves some spatial model
- keeps terminals native

Tradeoff:

- still not a true canvas or pan model

### 5. Multiple Floating Windows

VS Code supports floating windows and custom layouts across windows.

Possible approach:

- use one window per cluster of terminals
- arrange windows across monitors or tasks

Benefits:

- more screen real estate
- still fully native

Tradeoff:

- still not one infinite spatial workspace

## Best Native Patterns If The Goal Is To Feel Spatial

The strongest native-feeling options are:

- `3x3` visible grid plus directional navigation commands
- `2x2` or `3x3` grid plus a minimap/navigator
- paged sectors with `north/south/east/west` movement commands
- locked editor groups to preserve layout stability

These do not recreate an infinite canvas, but they can still feel structured and navigable.

## What Native Terminals Cannot Really Give You

Native terminals are not a real fit if the product requires:

- infinite canvas
- arbitrary drag-to-position placement
- mouse panning over a large terminal field
- zoomable spatial workspace
- one continuous surface with hundreds of terminals arranged freely

## Bottom Line

If the real goal is:

- lower GPU usage
- less custom terminal rendering work
- strong native behavior

then native VS Code terminals are a strong option.

If the real goal is:

- spatial canvas
- freeform layout
- pannable terminal world

then native terminals cannot provide that directly.

The closest practical native model is:

- a paged viewport over a logical grid

That is likely the best compromise if native rendering becomes the priority.

## Possible Future Design Direction

If this route becomes interesting, a concrete design to explore would be:

- `3x3` visible native terminal grid
- logical `(x, y)` coordinates for every terminal
- directional pan commands that remap the visible `3x3`
- a navigator/minimap for jumping around the logical grid
- persistence of terminal-to-coordinate assignments across sessions

## Sources

- VS Code API reference: <https://code.visualstudio.com/api/references/vscode-api>
- VS Code extension capabilities overview: <https://code.visualstudio.com/api/extension-capabilities/overview>
- VS Code custom layout documentation: <https://code.visualstudio.com/docs/configure/custom-layout>
- VS Code terminal getting started / editor area: <https://code.visualstudio.com/docs/terminal/getting-started>
