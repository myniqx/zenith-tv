# Design System Document: The Cinematic Stage
 
## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**
This design system is built to transform the IPTV experience from a utility into a premiere cinematic event. We are moving away from the "grid of posters" template found in entry-level apps. Instead, we embrace a high-end editorial approach that mimics the depth of a physical theater. 
 
The system utilizes **Intentional Asymmetry** and **Tonal Depth**. By overlapping high-fidelity imagery with glassmorphic layers and using a bold, disproportionate typographic scale, we create a sense of "10-foot" immersion. The UI does not sit *on* the screen; it lives *within* it, using the Tizen OS's hardware capabilities to render fluid transitions and deep, ink-black voids.
 
---
 
## 2. Colors: The High-Contrast Palette
We utilize a deep-sea foundation (`background` / #0e0e0e) to ensure that OLED panels on high-end Smart TVs achieve perfect black levels, allowing our vibrant electric accents to "pop" with neon-like intensity.
 
### Token Reference

| Token (shadcn) | Hex | Role |
|---|---|---|
| `background` | #0e0e0e | The infinite void — OLED base layer |
| `muted` | #131313 | Large sidebars and secondary content regions |
| `secondary` | #262626 | Cards, modals — "lifted" appearance |
| `card` / `popover` | #000000 | Behind movie posters — colors pop |
| `primary` | #b6a0ff | Electric lavender — focus & CTA accent |
| `ring` | #7e51ff | primary-dim — active/pressed states |
| `primary-foreground` | #000000 | Text on primary buttons |
| `foreground` | #ffffff | Primary text — on-surface |
| `muted-foreground` | #adaaaa | Secondary text — natural visual recession |
| `border` | #494847 | Ghost borders (use at 20% opacity) |
| `accent` | purple-tinted dark | secondary-container — focus fill for ghost buttons |

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. 
Structure must be defined through **Tonal Shifts**. For example:
- A sidebar uses `muted`.
- The main content area uses `background`.
- A featured content drawer uses `secondary`.
The boundary is the color change itself, creating a seamless, architectural feel.
 
### Surface Hierarchy & Nesting
Treat the UI as a series of stacked sheets of obsidian and frosted glass:
1.  **Base Layer:** `background` (#0e0e0e) – The infinite void.
2.  **Sectional Layer:** `muted` (#131313) – Used for large sidebars or secondary content regions.
3.  **Component Layer:** `secondary` (#262626) – Used for cards or modals to create a "lifted" appearance.
 
### The "Glass & Gradient" Rule
For headers and persistent playback overlays, use a "Glassmorphism" effect:
- **Fill:** `secondary` (#262626) at 60% opacity.
- **Effect:** 20px - 40px Backdrop Blur.
- **Signature Gradient:** For primary CTAs (like "Watch Now"), use a linear gradient from `primary` (#b6a0ff) to `ring` (#7e51ff). This adds a "soul" to the focus state that a flat color cannot provide.
 
---
 
## 3. Typography: Editorial Boldness
We use two distinct typefaces to create an authoritative hierarchy.
 
*   **Display & Headlines (Space Grotesk):** This is our "Voice." It is brutalist, wide, and modern. Use `display-lg` for movie titles and `headline-md` for category headers. It should feel intentional and slightly oversized to ensure legibility from 10 feet away.
*   **Body & Labels (Manrope):** This is our "Information." Manrope provides the technical clarity needed for synopsis text and metadata.
 
**Hierarchy Strategy:**
- **Primary Info:** Use `title-lg` in `foreground` (#ffffff).
- **Secondary Info:** Use `body-md` in `muted-foreground` (#adaaaa) to create a natural visual recession without needing smaller font sizes.
 
---
 
## 4. Elevation & Depth: Tonal Layering
On Tizen OS, traditional shadows can often look "dirty" or pixelated. We achieve depth through **Ambient Luminescence**.
 
*   **The Layering Principle:** Rather than shadows, use the "Surface Stack." A `card` (#000000) placed on a `muted` (#131313) background creates a "sunken" effect. Conversely, a `secondary` (#262626) card on a `background` creates "lift."
*   **The "Ghost Border" Fallback:** If a component requires a boundary for accessibility (e.g., a focused input field), use a "Ghost Border": `border` (#494847) at **20% opacity**. Never use 100% opaque lines.
*   **Focus State Glow:** When an element is focused via remote control, apply a subtle outer glow using `primary` (#b6a0ff) at 15% opacity with a 30px spread. This mimics the light bleed of a cinema screen.
 
---
 
## 5. Components
 
### Remote-Optimized Buttons
*   **Primary:** High-contrast gradient (`primary` to `ring`). Text is `primary-foreground` (Black).
*   **Secondary:** Ghost style. No fill, `border` token at 30% opacity. On focus, it fills with `accent`.
*   **Interaction:** On focus, a button should scale by **1.05x**. This kinetic feedback is vital for TV navigation.
 
### Cinematic Cards
*   **Rule:** Forbid the use of divider lines.
*   **Layout:** Content is separated by 24px (from the spacing scale).
*   **Visuals:** Image-first. The text metadata should live on a semi-transparent `card` gradient overlay at the bottom of the card.
*   **Focus:** The card should "lift" using a `primary` ghost border (20% opacity) and a scale-up animation.
 
### Glassmorphic Header (Tizen Optimized)
*   The header remains pinned. It uses `secondary` with a 70% opacity and a heavy backdrop blur.
*   The active navigation link uses `primary` typography and a small `ring`-colored dot underneath.
 
### Selection & Inputs
*   **Chips:** Use `muted` for unselected and `accent` for selected. Roundedness should be `full`.
*   **Checkboxes/Radios:** Use `primary` for the active state. The "Electric" nature of the lavender ensures high visibility on low-quality panels.
 
---
 
## 6. Do's and Don'ts
 
### Do:
*   **DO** use `card` (#000000) for the background behind movie posters to make colors pop.
*   **DO** use "Safe Zones." Keep all critical UI components at least 5% away from the screen edges to avoid overscan issues on older TVs.
*   **DO** use `ring` for "Active" states and `primary` for "Focus" states to differentiate between "where I am" and "what I am looking at."
 
### Don't:
*   **DON'T** use 1px borders. They flicker on many TV screens (interlacing artifacts).
*   **DON'T** use pure grey for shadows. Use a tinted shadow if necessary, or better yet, use tonal layering.
*   **DON'T** use more than 3 levels of nested surfaces. It confuses the eye's perception of depth.
*   **DON'T** use `body-sm` for any critical information. If it's not readable from 10 feet, it doesn't exist.
 
---
 
## 7. Motion & Transitions
Every movement must feel "heavy" and premium.
*   **Page Transitions:** Use a "Slide and Fade" (300ms, Ease-Out).
*   **Focus Movement:** Use a "Snap-to" animation with a slight elastic overshoot. This makes the remote control feel physically connected to the UI.
*   **State Changes:** Transition background colors over 200ms to avoid jarring "flashes" when navigating between dark and slightly-less-dark sections.
