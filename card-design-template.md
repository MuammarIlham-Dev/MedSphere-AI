# Card Design System & CSS Structure

This document breaks down the CSS structure and Tailwind CSS classes used to create the premium card designs. The design relies heavily on modern UI principles, semantic coloring, smooth transitions, and subtle transparencies.

## 1. Philosophy & Core Concepts

The design achieves its premium feel through a few key techniques:
- **Semantic Colors:** Instead of hardcoding colors (e.g., `bg-white` or `text-black`), it uses semantic variables like `bg-background`, `bg-card`, `text-foreground`, and `text-muted-foreground`. This ensures seamless switching between Light and Dark modes.
- **Transparencies for Tints & States:** Instead of using opaque colors for hover or selected states, the design uses opacities of the primary and destructive colors (e.g., `bg-primary/10`, `hover:border-primary/30`). This allows the background to subtly bleed through, maintaining a cohesive look.
- **Rounded Geometries:** High `border-radius` values (`rounded-2xl`, `rounded-xl`, `rounded-lg`) are used consistently to create a soft, friendly, and modern appearance.
- **Subtle Borders & Shadows:** Borders are softened using opacity (`border-border/50`, `border-border/60`), and shadows (`shadow-xl`) provide depth. In dark mode, shadows blend into the background, and the subtle borders define the component boundaries instead.

---

## 2. Layout & Main Containers

### The Main Wrapper
The entire component is centered, constrained in width, and animated upon entry.
* **Classes:** `mt-5 max-w-[92%] sm:max-w-[600px] mx-auto space-y-5 relative z-10 opacity-0 animate-reveal-up`
* **Purpose:** Ensures the checkout doesn't stretch too wide on desktop (`max-w-[600px]`), maintains a small margin on mobile (`max-w-[92%]`), uses `space-y-5` to evenly gap all inner sections, and applies an entrance animation (`animate-reveal-up`).

### Section Cards (e.g., "Print Options", "Delivery")
Each major group of settings is wrapped in a distinct card.
* **Classes:** `p-5 sm:p-6 rounded-2xl bg-background border border-border/60 shadow-xl`
* **Details:** 
  * `rounded-2xl`: Large 16px corner radius.
  * `bg-background`: Matches the page background but stands out due to the border and shadow.
  * `border border-border/60`: A very subtle border (60% opacity) that defines the edge, crucial for dark mode where shadows are less visible.
  * `shadow-xl`: Casts a soft, widespread shadow, giving the card elevation in light mode.

### Section Headers
* **Classes:** `text-lg font-bold text-foreground mb-5 flex items-center gap-2`
* **Details:** Uses a flexbox layout to neatly align the section icon with the title text.

---

## 3. Inner Setting Cards (Options & Toggles)

Inside the Section Cards, individual settings (like Duplex or Copies) are grouped into smaller, tighter cards.

* **Container Classes:** `flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 mb-3`
* **Details:**
  * `rounded-xl`: Slightly smaller radius (12px) than the outer card, creating a nested "card-within-a-card" look.
  * `bg-card`: A slightly different background shade (often slightly lighter in dark mode, or pure white in light mode while the background is off-white).
  * `border border-border/50`: Even subtler border.

### Icon Wrappers (The square icon background)
* **Classes:** `w-9 h-9 rounded-lg bg-foreground/5 flex items-center justify-center`
* **Details:** Instead of placing an icon directly on the card, it's wrapped in a square (`w-9 h-9`) with rounded corners (`rounded-lg`) and a very faint background (`bg-foreground/5`). This adds visual weight and structure to the setting. The icon itself uses `w-5 h-5 text-foreground`.

---

## 4. Interactive & Selectable Cards (Grids)

For options where the user must choose between multiple items (e.g., Urgency: Standard vs. Express), the design uses grid layouts with selectable cards.

### Grid Wrapper
* **Classes:** `grid grid-cols-2 gap-3`

### Standard Option Card (Unselected State)
* **Classes:** `p-3 rounded-xl border text-center transition-all border-border bg-card hover:border-primary/30`
* **Details:** `transition-all` makes the border color and background color change smoothly on hover.

### Standard Option Card (Selected State)
* **Classes:** `p-3 rounded-xl border text-center transition-all border-primary bg-primary/10`
* **Details:** The border becomes fully colored (`border-primary`), and the background takes a 10% tint of the primary color (`bg-primary/10`).

### Destructive/Warning Option Card (Selected State - e.g., Express)
* **Classes:** `p-3 rounded-xl border text-center transition-all border-destructive bg-destructive/10`
* **Details:** Follows the exact same pattern but utilizes the semantic `destructive` color (usually red/orange) to signify urgency or extra cost.

---

## 5. Highlight Cards (Price Summary)

To draw the user's eye to the final total, a distinct highlight card is used.

* **Container Classes:** `p-4 rounded-xl bg-primary/10 border border-primary/20 text-center mb-4`
* **Total Text Classes:** `text-3xl font-extrabold text-primary`
* **Details:** By using a tinted background (`bg-primary/10`) and a matching subtle border (`border-primary/20`), this box immediately stands out from the rest of the form.

---

## 6. Action Buttons

The main "Print Now" button is designed to be highly prominent and satisfying to click.

* **Primary Button Classes:** `flex-1 py-3 sm:py-4 rounded-lg bg-foreground text-background font-bold text-2xl flex items-center justify-center gap-1 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden`
* **Details:** 
  * `bg-foreground text-background`: This is a high-contrast inversion. In light mode, it's a black button with white text. In dark mode, it's a white button with black text.
  * `text-2xl`: Very large text to emphasize the final action.
  * **Loading State:** When processing, it displays a custom CSS spinner: `w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin`.

---

## 7. Typography System

The component uses a strict hierarchy based on Tailwind's sizing and semantic colors:
* **Headers:** `text-lg font-bold text-foreground`
* **Item Titles:** `font-medium text-sm text-foreground`
* **Descriptions / Labels:** `text-xs text-muted-foreground`
* **Emphasized Values (Prices/Quantities):** `font-bold text-foreground`
* **Highlights (Discounts/Surcharges):** `text-primary` or `text-destructive`

---

## 8. Light vs. Dark Mode Behavior Deep-Dive

Because this design strictly uses CSS variables (via Tailwind classes), the transition between light and dark mode is completely automatic. Here is how the specific classes react:

| Class | Light Mode Behavior | Dark Mode Behavior |
| :--- | :--- | :--- |
| `bg-background` | Usually `#ffffff` (White) or very light gray. | Usually `#09090b` (Deep gray/black). |
| `bg-card` | Usually `#ffffff` with a subtle shadow. | Usually a slightly elevated dark gray (e.g., `#18181b`). |
| `text-foreground` | Very dark gray/black (e.g., `#09090b`). | Pure white or very light gray (e.g., `#fafafa`). |
| `text-muted-foreground`| Medium gray (e.g., `#71717a`). | Medium-light gray (e.g., `#a1a1aa`). |
| `border-border` | Light gray line. | Dark gray line. |
| `bg-primary/10` | 10% opacity of the primary color over white. | 10% opacity of the primary color over black/dark gray. |
| `bg-foreground/5` | 5% black (creates a very soft gray box). | 5% white (creates a very soft highlight box). |

**Why the shadow is not white in dark mode:** 
In Tailwind, shadows (e.g., `shadow-xl`) are typically rendered using `rgba(0, 0, 0, opacity)`. 
- In **light mode**, these black shadows create depth over white backgrounds. 
- In **dark mode**, a black shadow over a dark background is practically invisible. 
- **The Magic:** This design purposefully does NOT use a white shadow for dark mode. Instead, it compensates for the loss of shadow by using `border border-border/60`. This subtle border ensures the card geometry remains clearly defined even when the shadow fades into the dark background, maintaining a sleek, native feel without looking harsh or "glowing" like a white shadow would.

---

## 9. Quick Copy-Paste Template

Here is a simplified structural template you can copy to replicate this exact card style in any React/Tailwind project:

```tsx
<div className="p-5 sm:p-6 rounded-2xl bg-background border border-border/60 shadow-xl">
  
  {/* Header */}
  <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
    <Icon className="w-5 h-5 text-foreground" />
    Section Title
  </h3>

  {/* Standard Inner Card (Toggle/Setting) */}
  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 mb-3">
    <div className="flex items-center gap-3">
      {/* Icon Wrapper */}
      <div className="w-9 h-9 rounded-lg bg-foreground/5 flex items-center justify-center">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm text-foreground">Setting Title</p>
        <p className="text-xs text-muted-foreground">Setting description</p>
      </div>
    </div>
    {/* Right Side Control (Switch, Counter, etc) */}
    <div>Control</div>
  </div>

  {/* Selectable Grid Cards */}
  <div className="grid grid-cols-2 gap-3 mb-4">
    {/* Unselected State */}
    <button className="p-3 rounded-xl border border-border bg-card hover:border-primary/30 text-center transition-all">
      <p className="font-medium text-sm">Option A</p>
    </button>
    
    {/* Selected State */}
    <button className="p-3 rounded-xl border border-primary bg-primary/10 text-center transition-all">
      <p className="font-medium text-sm">Option B</p>
    </button>
  </div>

</div>
```
