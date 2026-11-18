# pearOS Nexus — Apple Design Analysis & Liquid Glass Implementation

Derived directly from `Apple-design-analysis` (`design.md`):
- **Single Interactive Accent**: Action Blue `#0066cc` (Focus `#0071e3`, On-Dark `#2997ff`).
- **Surface Palette**: Pure White `#ffffff`, Apple Parchment `#f5f5f7`, Pearl `#fafafc`, Near-Black Media Tile `#272729`, Translucent Chip `rgba(210, 210, 215, 0.64)`.
- **Ink Palette**: Near-Black Ink `#1d1d1f`, Ink Muted 80 `#333333`, Ink Muted 48 `#7a7a7a`, Hairline `#e0e0e0`.
- **Typography**: SF Pro Display / SF Pro Text (Inter fallback with `ss03`), strict `300 / 400 / 600` weight ladder (no weight 500), Apple-tight negative tracking (`-0.28px` to `-0.374px`), `17px` body reading pace.
- **Liquid Glass Chrome**: Zero decorative gradients. Frosted translucent Liquid Glass (`rgba(255,255,255,0.72)` / `rgba(245,245,247,0.78)` with `backdrop-filter: saturate(180%) blur(24px)`, 1px specular rim + hairline border) on floating navigation, sticky controls, and media overlays.
- **Elevation**: Flat UI chrome; single signature product drop-shadow (`3px 5px 30px rgba(0,0,0,0.22)`) reserved for media/camera/map stages. Universal `scale(0.95)` press feedback.
