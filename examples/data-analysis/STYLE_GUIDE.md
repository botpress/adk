# Design System & Style Guide

This document describes the visual design language for this application. The aesthetic is inspired by **consulting firm presentations** (McKinsey, Bain) — clean, confident, professional, with warm accents.

## Design Philosophy

- **Corporate elegance**: Professional without being sterile
- **Warm neutrals**: Off-white and warm grays instead of pure white/gray
- **Burgundy accents**: Used sparingly for emphasis (links, badges, logo)
- **Strong typography hierarchy**: Serif for headlines, sans-serif for body
- **No rounded corners**: All elements use sharp rectangular edges
- **Minimal color**: Mostly grayscale with burgundy as the only color accent
- **Dark mode default**: Dark theme is the primary experience

---

## Color Palette

### Light Theme
```css
/* Backgrounds - warm off-white tones */
--bg-primary: #f8f7f4;      /* Main background */
--bg-secondary: #fffffe;    /* Cards, sidebar */
--bg-tertiary: #f3f2ef;     /* Hover states, badges */
--bg-hover: #eceae6;        /* Interactive hover */

/* Borders - warm gray */
--border-color: #e0ddd8;
--border-color-light: #eeebe6;

/* Text - near-black to muted */
--text-primary: #1a1a1a;    /* Headlines, important text */
--text-secondary: #444444;  /* Body text */
--text-tertiary: #717171;   /* Secondary info */
--text-muted: #999999;      /* Disabled, hints */

/* Accent - dark for buttons */
--accent-color: #1a1a1a;
--accent-hover: #333333;

/* Highlight - burgundy for links and emphasis */
--highlight: #722F37;
--highlight-hover: #8a3a44;

/* Semantic */
--error-color: #c41e3a;
--error-bg: #fff5f5;
```

### Dark Theme
```css
/* Backgrounds - warm dark tones */
--bg-primary: #121110;      /* Main background */
--bg-secondary: #1a1918;    /* Cards, sidebar */
--bg-tertiary: #242220;     /* Hover states, badges */
--bg-hover: #2c2a28;        /* Interactive hover */

/* Borders - warm dark gray */
--border-color: #332f2c;
--border-color-light: #282624;

/* Text - off-white to muted */
--text-primary: #f5f4f2;    /* Headlines, important text */
--text-secondary: #cccac7;  /* Body text */
--text-tertiary: #888683;   /* Secondary info */
--text-muted: #5a5856;      /* Disabled, hints */

/* Accent - light for buttons */
--accent-color: #f5f4f2;
--accent-hover: #ffffff;

/* Highlight - lighter burgundy/rose for dark mode */
--highlight: #c4707a;
--highlight-hover: #d4858e;

/* Semantic */
--error-color: #ff6b6b;
--error-bg: #2a1a1a;
```

### Semantic Colors (Both Themes)
```css
/* Positive/Success - muted green */
#3d8c5c

/* Negative/Error - burgundy */
#722F37 (light) / #c4707a (dark)

/* Neutral/Stable */
var(--text-muted)
```

---

## Typography

### Font Families
```css
--font-display: 'Georgia', 'Times New Roman', serif;  /* Headlines, titles */
--font-body: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;  /* Body text */
--font-mono: 'SF Mono', 'Monaco', monospace;  /* Numbers, badges, code */
```

### Type Scale

| Element | Font | Size | Weight | Letter Spacing |
|---------|------|------|--------|----------------|
| Page title | Display (serif) | 22px | 700 | -0.02em |
| Section title | Display (serif) | 18px | 700 | -0.01em |
| Card title | Body (sans) | 15px | 600 | — |
| Body text | Body (sans) | 14px | 400 | — |
| Small text | Body (sans) | 13px | 400 | — |
| Labels | Body (sans) | 11-12px | 500-600 | 0.03-0.05em |
| Muted/Meta | Body (sans) | 11-12px | 400 | 0.02em |
| Numbers/Badges | Mono | 13-15px | 600-700 | — |

### Typography Patterns

**Headlines** — Serif, bold, tight letter-spacing:
```css
font-family: var(--font-display);
font-size: 22px;
font-weight: 700;
letter-spacing: -0.02em;
```

**Uppercase labels** — Small, spaced, medium weight:
```css
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--text-muted);
```

**Numeric badges** — Monospace, bold:
```css
font-family: var(--font-mono);
font-size: 13px;
font-weight: 700;
```

**Body text**:
```css
font-size: 14px;
font-weight: 400;
line-height: 1.6-1.7;
color: var(--text-secondary);
```

---

## Spacing

### Base Unit
Use **4px** as the base unit. Common values: 4, 8, 12, 16, 20, 24, 28, 32, 48, 64.

### Component Spacing
- **Card padding**: 20px 24px
- **Section padding**: 28px 32px
- **Header padding**: 24px 32px
- **Gap between cards**: 12-16px
- **Gap between elements in card**: 8-12px

---

## Components

### Cards
```css
background: var(--card-bg);
border: 1px solid var(--border-color);
padding: 20px 24px;
/* NO border-radius - sharp corners */

/* Hover state */
border-color: var(--text-muted);
```

### Primary Buttons
```css
padding: 10px 20px;
font-size: 12px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.03em;
background: var(--accent-color);
color: var(--bg-secondary);
border: none;
/* NO border-radius */
```

### Secondary/Ghost Buttons
```css
padding: 10px 20px;
font-size: 12px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.03em;
background: var(--bg-secondary);
border: 1px solid var(--border-color);
color: var(--text-secondary);

/* Hover */
border-color: var(--text-muted);
color: var(--text-primary);
```

### Badges
```css
padding: 4px 10px;
font-size: 12-13px;
font-weight: 600-700;
font-family: var(--font-mono);
background: var(--bg-tertiary);  /* or var(--highlight) for emphasis */
color: var(--text-secondary);    /* or #fffffe on highlight */
/* NO border-radius */
```

### Navigation Tabs
```css
padding: 14px 20px;
font-size: 13px;
font-weight: 500;
color: var(--text-tertiary);
border-bottom: 2px solid transparent;
background: none;

/* Active state */
color: var(--text-primary);
border-bottom-color: var(--highlight);
```

### Input Fields
```css
padding: 8px 12px;
font-size: 13px;
background: var(--bg-secondary);
border: 1px solid var(--border-color);
color: var(--text-primary);
/* NO border-radius */

/* Focus */
border-color: var(--highlight);
outline: none;
```

---

## Visual Patterns

### Severity/Score Indicators
Use color to indicate levels:

| Level | Light Mode | Dark Mode |
|-------|------------|-----------|
| Critical/Poor | #722F37 (burgundy) | #722F37 |
| High/Warning | #c4707a (light burgundy) | #c4707a |
| Medium | var(--bg-tertiary) | var(--bg-tertiary) |
| Good/Positive | #3d8c5c (green) | #3d8c5c |

### Trend Indicators
- **Up/Positive**: #3d8c5c with ↑
- **Down/Negative**: #722F37 with ↓
- **Stable**: var(--text-muted) with →

### Sentiment Bars
Horizontal bar split between positive (green) and negative (burgundy):
```css
.sentiment-positive { background: #3d8c5c; }
.sentiment-negative { background: #722F37; }
```

### Sample Quotes
Italic text with left border accent:
```css
padding: 12px;
background: var(--bg-tertiary);
border-left: 3px solid #3d8c5c;  /* or #722F37 for negative */
font-style: italic;
font-size: 13px;
color: var(--text-secondary);
```

---

## Shadows

Minimal, subtle shadows:
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);  /* Light mode */
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);

/* Dark mode - slightly stronger */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
```

---

## Transitions

Standard transition for interactive elements:
```css
transition: all 0.15s ease;
```

---

## Layout

### Sidebar
- Fixed width: 64px
- Contains logo and icon navigation
- Logo is a single letter mark with burgundy background

### Main Content
- Flexible width with left margin for sidebar
- Max content width: ~1200px for readability

### Grids
- Cards: 2-4 columns depending on content type
- Gap: 16-20px
- Responsive breakpoints at 700px, 900px, 1100px, 1400px

---

## Do's and Don'ts

### Do
- Use burgundy sparingly (logo, links, critical badges, active indicators)
- Use serif fonts only for major headings
- Keep buttons uppercase with letter-spacing
- Use monospace for numbers and data
- Maintain warm undertones in all grays

### Don't
- Use rounded corners anywhere
- Use bright/saturated colors besides burgundy and green
- Use pure white (#ffffff) or pure black (#000000)
- Overuse burgundy - it should feel like an accent
- Add decorative elements or icons unnecessarily

---

## Example CSS Variables Block

Copy this into your root CSS:

```css
:root {
  /* Light theme */
  --bg-primary: #f8f7f4;
  --bg-secondary: #fffffe;
  --bg-tertiary: #f3f2ef;
  --bg-hover: #eceae6;
  --border-color: #e0ddd8;
  --border-color-light: #eeebe6;
  --text-primary: #1a1a1a;
  --text-secondary: #444444;
  --text-tertiary: #717171;
  --text-muted: #999999;
  --accent-color: #1a1a1a;
  --accent-hover: #333333;
  --highlight: #722F37;
  --highlight-hover: #8a3a44;
  --card-bg: #fffffe;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);

  --font-display: 'Georgia', 'Times New Roman', serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  --font-mono: 'SF Mono', 'Monaco', monospace;
}

.dark {
  --bg-primary: #121110;
  --bg-secondary: #1a1918;
  --bg-tertiary: #242220;
  --bg-hover: #2c2a28;
  --border-color: #332f2c;
  --border-color-light: #282624;
  --text-primary: #f5f4f2;
  --text-secondary: #cccac7;
  --text-tertiary: #888683;
  --text-muted: #5a5856;
  --accent-color: #f5f4f2;
  --accent-hover: #ffffff;
  --highlight: #c4707a;
  --highlight-hover: #d4858e;
  --card-bg: #1a1918;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
}
```
