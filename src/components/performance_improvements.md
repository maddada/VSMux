• 1. Disable expensive tile chrome while panning
Remove backdrop-blur, large shadows, focus glow, and transitions only during active pan. Lowest effort, likely highest
immediate impact. 2. Disable or reduce scaling during normal pan
Keep translation during pan, but avoid combining it with scale(...) unless the user is actively zooming. Small-to-medium
effort, likely strong impact. 3. Profile and trim remaining CSS effects even outside pan
Flatten tile styling further: simpler borders, no blur, smaller shadows, fewer translucent layers. Low effort, medium
impact. 4. Freeze terminal surfaces only while panning
Show a lightweight snapshot/placeholder during drag, then restore live terminals on pointer-up. Medium effort, high
impact, but more UX tradeoff. 5. Throttle pan updates
Limit viewport updates during pointer move to requestAnimationFrame instead of every pointer event. Medium effort,
moderate impact. 6. Restructure away from one large transformed world container
Move to a different layout/compositing strategy so VS Code is not constantly recompositing one huge transformed scene.
High effort, potentially very high impact. 7. Rework the spatial model toward scroll-based navigation instead of freeform transformed canvas
Biggest architecture change, but likely the cleanest long-term solution if pan/compositing remains the bottleneck.

If you want the most pragmatic next step, I’d do them in this exact order:

1. pan-time chrome stripping
2. pan update throttling
3. reduce/remove scale during pan
4. pan-time frozen terminal surfaces

Summary: the best next fixes are pan-time chrome stripping first, then pan throttling, then reducing scale during pan; the
big architectural changes come last.
