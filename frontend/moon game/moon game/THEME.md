# Little Astro's Adventure: Team Theme Guide

Style: realistic space (dark, cinematic) with colourful, fun buttons and title. Start every new page from `template.html`.

## 3 rules
1. Copy `template.html`, rename it, change only the parts marked `>>> CHANGE`.
2. Use only the colors, fonts and classes below. Do not add new ones.
3. Short text. One idea per screen. One main button per screen.

## Fonts (already linked in the template)
Headings: **Big Shoulders Display** (uppercase). Body: **Barlow**.

## Colors (CSS variables in style.css)
| Variable | Hex | Use |
|---|---|---|
| --space | #02040a | page background |
| --space-2 | #0d1526 | panels |
| --cyan | #6ab4ff | Earth-blue accent, info |
| --pink | #ffb066 | amber warnings |
| --lemon | #f1ede4 | highlights |
| --mint | #7ddba3 | success |
| --white | #eef1f6 | text |

## Classes you can use
| Class | What it is |
|---|---|
| `.screen` | wraps the page content (centers it) |
| `.game-title` | big title (use only on page 1) |
| `.h2` | page heading |
| `.lead` | one-line intro |
| `.panel` (+ `.selected`) | card for text, forms, choices |
| `.btn .btn-play` | main button (orange-pink gradient) |
| `.btn .btn-ghost` | secondary button (cyan-purple) |
| `.chip` (+ `.chip-lemon`, `.chip-pink`, `.chip-mint`) | small colourful badge |
| `.field` + `.hint` + `.error` | form row; add `invalid` to `.field` for errors |
| `.level` + `.level-bar` + `.level-fill` | progress bar, set `--pct:25%` to `100%` |

## Shared data (localStorage)
- `astronaut` = `{"name":"","age":0,"role":"Commander","callsign":"","suit":"#ff8a3d"}`
- `crew` = static default crew (Flight Engineer, Medical Officer, Geologist)
- `mode` = `"A"` (Core Survival) or `"B"` (Advanced Survival = A + radiation shielding + food production)

## Page flow
`index.html` (start) > `briefing.html` > `register.html` > `mode.html` > game

## Notes
- `index.html` uses Three.js (`scene.js`) for the 3D Moon, Earth and spacecraft. Other pages use the simple starfield only.
- Test every page on phone width and desktop width before pushing.
