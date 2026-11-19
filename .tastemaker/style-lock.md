# Style lock: slot machine kiosk

Surface: fixed 1920x1080 kiosk stage (app/kiosk screen, not a marketing page). Admin is a plain responsive tool.
Mood: warm / ornate. Type: Rozha One (display, Latin + Devanagari), Cormorant Garamond (captions).

## Color contract (check_contrast.py --matrix)
text #7a0c17, bg #fde9c3, surface #f0cf94, primary #b01524, accent #d89d4d, border #8a5a10, on-primary #fff4d6
Text-safe: text/on-primary 10.13, text/bg 9.31, text/surface 7.43, primary/on-primary 6.43, bg/primary 5.92, text/accent 4.68
UI-safe: surface/border 3.96
Decorative only: accent on bg/surface (gold is never used for text)
In use: word + animal name = text on surface/bg (9.3 / 7.4). PULL label = on-primary on primary (6.4). Caption = text on bg.

## Structure
Brief-fixed: one machine, one button. Structure rotation not applicable (single-screen kiosk).
Motion: spin/stop easing is functional; ambient loops (pulse, glow, blink) use symmetric cubic-bezier; reduced-motion handled.

## Admin (app/admin, components/admin)
Surface: app shell / data views (responsive 768 to 1920, no kiosk stage). Same palette and serif headings as the kiosk.
Direction: deep-red sidebar (becomes a tab bar under 900px), cream page, ruled lists instead of repeated cards, one memorable object: the gold "Next spin" chip.
Type: Rozha One headings; system sans for UI (16px body, 15px minimum); Playfair Display Black only inside reel previews, matching the kiosk.
Tokens: cream #f6e8c6, parchment #fde9c3, ink #2a1a08, muted #5c3d12, red #7a0c17, red-deep #5c0710, danger text #a40d1b, gold #ffd23a/#f0a014, rim #a95002.
Contrast (check_contrast.py): muted on cream 8.11, danger text on cream 6.51, cream-on-red 10.13, red-deep on gold 6.53, parchment on red-deep 11.80, ink on field 16.15. axe (WCAG 2.1 A/AA) clean in every captured state.
Buttons: primary = gold gradient (strongest), secondary = outlined red, danger = filled deep red, quiet = underlined text. All controls at least 44px.
Structure rotation: not applicable (fixed app shell, sections dictated by the brief).

## Admin palette update (from the Updhan 2026 banner, extract_palette.py + sampled lettering)
Brand: deep brown #5b360d (headings, sidebar), headline brown #8d591f (primary actions, links), sunrise gold #b36f10 / #ffd99d (accents, active marker, bars), cream #fce4bc / #ffefd2, taupe #8e8776 (control borders).
Neutrals: page #f7f5f1, surface #ffffff, surface-2 #f1eee8, border #e2ddd2 / #cbc3b3, text #1f1b16, muted #665d50, error #b42318 on #fdecea.
Contrast (check_contrast.py): text on page 15.72, muted on page 5.94, brown heading on white 10.62, white on #8d591f 5.86, white on error red 6.57, cream on sidebar brown 8.57, control border on white 3.57 (UI floor 3.0). Gold #b36f10 is decorative only (4.04 on white).
Spin script UI is switched off (SCRIPT_UI=false in components/admin/types.ts); backend and screens are kept.
