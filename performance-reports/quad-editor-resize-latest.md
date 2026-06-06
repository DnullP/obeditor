# Quad Editor Resize Performance

- URL: http://127.0.0.1:4317/?demo=quad-large-articles
- Captured at: 2026-06-06T15:32:31.389Z
- Editors: 4 independent UniversalMarkdownEditor instances
- Document size: 277,665 chars/editor
- Resize frames: 96
- Layout lightweight gate: data-layout-lightweight=true during resize, flushed once after release

| Metric | Value |
| --- | ---: |
| Frame average | 12.61 ms |
| Frame p50 | 10.4 ms |
| Frame p75 | 14.8 ms |
| Frame p95 | 25.8 ms |
| Frame p99 | 26.2 ms |
| Frame max | 26.2 ms |
| Frames > 16.7 ms | 14/96 |
| Frames > 33.3 ms | 0/96 |
| Settle frame after release | 16.8 ms |
| Long tasks | 0 |
| Long task max | 0 ms |
| Long task total | 0 ms |
| Integrity samples | 3 |
| Rendered CodeMirror lines avg total | 80 |
| Rendered CodeMirror lines max total | 80 |
| DOM nodes avg | 1280 |
| DOM nodes max | 1280 |
| JS heap | 29.75 -> 29.75 MB, peak 29.75 MB |
| All editors visible | 100.00% |
| Page failures | 0 |

## Notes

- Resize frame timing is measured from quadrant stage split mutation to the next animation frame.
- Per-frame timing avoids geometry reads; DOM geometry and rendered line counts are collected as separate integrity samples.
- The test changes both row and column splits on every frame while the document-level lightweight layout gate is active.
- The settle frame removes the gate and captures the one post-resize measurement flush separately from drag frames.
- CodeMirror line counts should stay bounded, proving editor virtualization remains active under multi-editor pressure.
