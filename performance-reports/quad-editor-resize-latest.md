# Quad Editor Resize Performance

- URL: http://127.0.0.1:4317/?demo=quad-large-articles
- Captured at: 2026-06-05T12:59:13.482Z
- Editors: 4 independent UniversalMarkdownEditor instances
- Document size: 277,665 chars/editor
- Resize frames: 96

| Metric | Value |
| --- | ---: |
| Frame average | 13.47 ms |
| Frame p50 | 12.6 ms |
| Frame p75 | 15.4 ms |
| Frame p95 | 27 ms |
| Frame p99 | 27.9 ms |
| Frame max | 27.9 ms |
| Frames > 16.7 ms | 17/96 |
| Frames > 33.3 ms | 0/96 |
| Long tasks | 0 |
| Long task max | 0 ms |
| Long task total | 0 ms |
| Rendered CodeMirror lines avg total | 80 |
| Rendered CodeMirror lines max total | 80 |
| DOM nodes avg | 1280 |
| DOM nodes max | 1280 |
| JS heap | 29.75 -> 29.75 MB, peak 29.75 MB |
| All editors visible | 100.00% |
| Page failures | 0 |

## Notes

- The frame timing is measured from quadrant stage split mutation to the next animation frame.
- The test changes both row and column splits on every frame to force all four editors to remeasure together.
- CodeMirror line counts should stay bounded, proving editor virtualization remains active under multi-editor pressure.
