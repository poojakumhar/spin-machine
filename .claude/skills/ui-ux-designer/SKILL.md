---
name: ui-ux-designer
description: Builds high-craft, editorial-grade UI/UX prototypes in standalone HTML files using Tailwind CSS and Lucide icons. Trigger whenever designing, updating, or styling interfaces, dashboards, or landing pages.
---

# UI/UX Design & Prototyping Standards

When creating or modifying any visual interface or HTML file, follow these design principles strictly before writing code.

## 1. Visual Aesthetic & Anti-Slop Rules
- **Avoid generic AI clichés:** Never default to generic purple-to-blue gradients, pure `#000000` black backgrounds, cluttered neon glows, or repetitive 3-column icon boxes with identical heights.
- **Commit to an intentional theme:** Choose either a crisp, warm editorial light theme (e.g., `#FAFAFA` or `#F8FAFC` background with `#FFFFFF` elevated cards and subtle `1px solid #E2E8F0` borders) or a refined dark theme (e.g., `#09090B` background with `#18181B` surfaces and `1px solid #27272A` borders).
- **Color discipline (60-30-10 rule):** Use neutral surfaces for 90% of the UI. Reserve your single primary accent color strictly for primary CTAs, active navigation states, and key data highlights.

## 2. Typography & Hierarchy
- **Load expressive Google Fonts:** Always import a pairing or clean UI font via Google Fonts in `<head>` (such as `Plus Jakarta Sans` or `Instrument Sans` for headings paired with `Inter` for body text, and `JetBrains Mono` for numbers/metrics).
- **Clear scale & contrast:** Give headings tight letter-spacing (`tracking-tight`), strong weight (`font-semibold` or `font-bold`), and high contrast (`text-slate-900`). Keep secondary descriptions legible (`text-slate-600`) with comfortable line height (`leading-relaxed`).
- **Tabular numbers:** Apply `tabular-nums` to all metrics, prices, tables, and timestamps so digits align vertically.

## 3. Layout, Spacing & Depth
- **Generous breathing room:** Use spacious padding (`p-6` or `p-8` inside cards, `py-16` to `py-24` between page sections) so elements never feel cramped.
- **Consistent border radius:** Standardize corner rounding across the hierarchy (e.g., `rounded-2xl` for outer containers, `rounded-xl` for cards, `rounded-lg` for buttons and inputs).
- **Subtle elevation:** Use crisp `1px` borders combined with ultra-soft, diffused shadows (`shadow-sm`) rather than heavy drop shadows.

## 4. Technical & Interactive Execution
- **Zero-build standalone setup:** Always include `<script src="https://tailwindcss.com"></script>` and `<script src="https://unpkg.com"></script>` (calling `lucide.createIcons();` at the bottom of `<body>`) so the file renders immediately in any browser without a build step.
- **Realistic UX copy:** Never use "Lorem ipsum", "John Doe", or "Item 1". Write realistic product copy, realistic user names, and plausible metrics tailored to the domain.
- **Interactive polish:** Include smooth CSS transitions (`transition-all duration-200`), distinct `:hover` and `:focus-visible` states on every clickable element, and working JavaScript toggles for tabs, modals, or mobile menus.
- **Responsive by default:** Ensure layouts adapt gracefully from desktop (`1280px+`) down to mobile (`375px`) without horizontal overflow or overlapping elements.

## 5. Post-Edit Browser Preview
- After creating or updating an HTML file, offer or run the Windows PowerShell command `Start-Process "filename.html"` (if permitted) so the user can immediately inspect the live visual result in their default browser.
