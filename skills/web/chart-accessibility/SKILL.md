---
name: chart-accessibility
description: Make SVG-based data visualizations (Recharts, Tremor) accessible with ARIA roles, keyboard navigation, screen reader support, and WCAG 2.2 AA compliance.
license: MIT
metadata:
  author: oneshot
  version: "1.0.0"
---

# Chart Accessibility

Practical patterns for making React chart components perceivable, operable, and understandable for all users. Covers Recharts 3.x and Tremor, with WCAG 2.2 Level AA as the compliance target.

## When to Use

- Building dashboards or reports with Recharts or Tremor chart components.
- Auditing existing data visualizations for accessibility barriers.
- Adding keyboard navigation or screen reader support to custom SVG charts.
- Choosing color palettes that meet contrast requirements.

## 1. ARIA Roles for SVG Charts

SVG elements are hidden from screen readers by default (except `<a>` and text elements). You must explicitly expose chart structure.

### Container Roles

```jsx
// Wrapping an SVG chart for screen readers
<div role="figure" aria-label="Monthly revenue for 2025, showing growth from $12k to $47k">
  <svg role="img" aria-labelledby="chart-title chart-desc">
    <title id="chart-title">Monthly Revenue</title>
    <desc id="chart-desc">
      Bar chart showing monthly revenue from January to December 2025.
      Revenue grew steadily from $12,000 in January to $47,000 in December.
    </desc>
    {/* chart contents */}
  </svg>
</div>
```

### When to Use `role="img"` vs `role="application"`

| Role | Use When | Screen Reader Behavior |
|------|----------|----------------------|
| `role="img"` | Chart is static / informational only | Reader announces label, user moves past it |
| `role="application"` | Chart has interactive keyboard controls | Reader enters "forms mode", passes keystrokes to the page |

Recharts uses `role="application"` when `accessibilityLayer` is enabled because charts have arrow-key navigation. If your chart is purely decorative or static, use `role="img"` instead.

### W3C Graphics ARIA Roles (Emerging)

The WAI-ARIA Graphics Module defines specialized roles (`graphics-datachart`, `graphics-datagroup`, `graphics-dataitem`, `graphics-axis`, `graphics-legend`) but browser support is limited. Until it matures, use `role="img"` or `role="application"` on the container and `aria-label` on meaningful child groups.

## 2. Keyboard Navigation

WCAG 2.1.1 (Level A) requires all interactive functionality to be keyboard-operable.

### Expected Key Bindings

| Key | Action |
|-----|--------|
| `Tab` | Focus the chart (single tab stop -- not per-point) |
| `ArrowLeft` / `ArrowRight` | Navigate between data points |
| `ArrowUp` / `ArrowDown` | Switch between series (multi-series charts) |
| `Enter` / `Space` | Select or drill into a data point |
| `Escape` | Exit chart interaction, return focus to container |
| `Home` / `End` | Jump to first / last data point |

### Recharts Keyboard Support (Built-in)

Recharts 3.x enables `accessibilityLayer` by default. This adds:

- `role="application"` on the chart SVG
- `tabIndex={0}` so the chart enters the tab order
- `ArrowLeft` / `ArrowRight` handlers that move between data points and update the Tooltip

```jsx
// Recharts 3.x -- accessibility is on by default
<LineChart data={data} title="Page views by day">
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="views" stroke="#2563eb" />
</LineChart>

// Recharts 2.x -- you must opt in
<LineChart data={data} accessibilityLayer title="Page views by day">
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="views" stroke="#2563eb" />
</LineChart>
```

**Known limitation:** PieChart keyboard navigation may not trigger tooltips without a prior mouse interaction (recharts/recharts#6338). Test pie charts separately.

### Custom Keyboard Handler (Non-Recharts SVGs)

When wrapping a library without built-in keyboard support:

```tsx
function AccessibleChart({ data, children }: { data: DataPoint[]; children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const handlers: Record<string, () => void> = {
      ArrowRight: () => setActiveIndex((i) => Math.min(i + 1, data.length - 1)),
      ArrowLeft: () => setActiveIndex((i) => Math.max(i - 1, 0)),
      Home: () => setActiveIndex(0),
      End: () => setActiveIndex(data.length - 1),
      Escape: () => (e.target as HTMLElement).blur(),
    };
    if (handlers[e.key]) { e.preventDefault(); handlers[e.key](); }
  };

  return (
    <div
      role="application"
      tabIndex={0}
      aria-label={`Interactive chart with ${data.length} data points. Use arrow keys to navigate.`}
      aria-roledescription="interactive chart"
      onKeyDown={handleKeyDown}
    >
      {children}
      <div aria-live="polite" className="sr-only">
        {data[activeIndex].label}: {data[activeIndex].value}
      </div>
    </div>
  );
}
```

## 3. Screen Reader Patterns

### Announcing Data Values

Use an `aria-live="polite"` region that updates as the user navigates. This lets screen readers announce the current data point without interrupting other content.

```jsx
// Visually hidden live region -- updates on navigation
<span className="sr-only" aria-live="polite" aria-atomic="true">
  {activeSeries}, {activeLabel}: {activeValue}
</span>
```

The announcement should include three pieces of context:
1. **Series name** -- "Revenue" or "Expenses"
2. **Axis label** -- "March 2025" or "Category A"
3. **Value with units** -- "$34,500" or "89%"

### Chart Summary as Accessible Description

Provide a concise text summary of the chart's key takeaway, not a raw data dump:

```jsx
<figure aria-label="Quarterly sales trend">
  <figcaption id="chart-summary">
    Sales increased 23% quarter-over-quarter, reaching $2.1M in Q4 2025.
  </figcaption>
  <LineChart aria-describedby="chart-summary" data={salesData}>
    {/* ... */}
  </LineChart>
</figure>
```

### VoiceOver Caveat

VoiceOver on macOS does not automatically enter forms mode for `role="application"`. Users must disable QuickNav (left+right arrow simultaneously) to use arrow-key navigation. Consider adding a hint:

```jsx
<p className="sr-only">
  If using VoiceOver, turn off QuickNav to navigate this chart with arrow keys.
</p>
```

## 4. Recharts-Specific Patterns

### Accessibility Props Reference

| Prop | Default (3.x) | Effect |
|------|---------------|--------|
| `accessibilityLayer` | `true` | Adds ARIA roles, keyboard handlers |
| `tabIndex` | `0` (when a11y on) | Override to remove from tab order |
| `role` | `"application"` | Override to `"img"` for static charts |
| `title` | -- | Sets the `<title>` inside the SVG |

### Data Table Fallback

Screen readers cannot parse SVG spatial relationships. Provide a toggle to view chart data as an HTML `<table>` with `<caption>`, `<th scope="col">`, and proper semantics. Use a `<button aria-expanded={showTable}>` to switch between chart and table views.

## 5. Tremor-Specific Patterns

Tremor wraps Recharts internally and uses Radix UI for non-chart components. Its chart components inherit Recharts accessibility behavior.

### What Works

- Keyboard navigation via Recharts' `accessibilityLayer` (enabled by default in Tremor's Recharts 3.x dependency).
- Radix-based UI controls (Select, Dialog) are fully WAI-ARIA compliant.

### Gaps and Workarounds

Tremor's chart wrappers do not expose all Recharts accessibility props directly. Apply these workarounds:

```tsx
import { BarChart } from "@tremor/react";

// Tremor's BarChart does not forward `title` or `aria-describedby`.
// Wrap it in a figure with an explicit label.
<figure aria-label="Monthly active users">
  <figcaption className="text-sm text-gray-500 mb-2">
    Monthly active users grew 40% year-over-year.
  </figcaption>
  <BarChart
    data={userData}
    index="month"
    categories={["activeUsers"]}
    colors={["blue"]}
  />
</figure>
```

If Tremor's chart component does not pass through keyboard events properly, drop down to raw Recharts for that chart and apply the patterns from Section 4.

## 6. Color and Contrast

### WCAG Requirements

| Element | Minimum Contrast Ratio | WCAG Criterion |
|---------|----------------------|----------------|
| Chart text labels, axis labels, tick marks | 4.5:1 against background | 1.4.3 Contrast (Minimum) |
| Bars, lines, pie slices, data points | 3:1 against adjacent colors | 1.4.11 Non-text Contrast |
| Adjacent series in the same chart | 3:1 between each other | 1.4.11 Non-text Contrast |

### Accessible Palette Example

```ts
// 8-color palette tested for 3:1 mutual contrast on white (#fff)
const ACCESSIBLE_PALETTE = [
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#059669", // emerald-600
  "#7c3aed", // violet-600
  "#d97706", // amber-600
  "#0891b2", // cyan-600
  "#be185d", // pink-700
  "#4b5563", // gray-600
] as const;
```

Verify your palette with a contrast checker (e.g., WebAIM or Colour Contrast Analyser) -- test every pair of adjacent series, not just series-vs-background.

### Dark Themes Expand Your Options

Dark backgrounds allow roughly 50% more colors to meet the 3:1 threshold compared to white backgrounds. If your dashboard supports dark mode, take advantage of this.

### Do Not Rely on Color Alone (WCAG 1.4.1)

Color must never be the sole differentiator between series. Always provide at least one additional encoding:

```jsx
// BAD: series distinguished only by color
<Line dataKey="revenue" stroke="#2563eb" />
<Line dataKey="expenses" stroke="#dc2626" />

// GOOD: color + stroke pattern + direct labels
<Line dataKey="revenue" stroke="#2563eb" strokeDasharray="0" />
<Line dataKey="expenses" stroke="#dc2626" strokeDasharray="5 5" />
<Legend />
```

Other non-color encodings: shape (circle vs square data points), texture/pattern fills for bars, direct value labels, distinct stroke widths.

## 7. Alt-Text Patterns for Chart Summaries

The `alt` / `aria-label` for a chart should convey the **insight**, not list raw data.

### Formula

> **[Chart type]** showing **[what is measured]** for **[time period / categories]**. **[Key takeaway]**.

### Examples

| Chart | Alt Text |
|-------|----------|
| Revenue line chart | "Line chart of monthly revenue, Jan-Dec 2025. Revenue grew 290% from $12k to $47k with strongest growth in Q3." |
| Browser share pie | "Pie chart of browser market share, April 2025. Chrome leads at 64%, followed by Safari at 19%." |
| Response time bar | "Bar chart comparing API response times across 5 endpoints. /search is the slowest at 820ms, 3x the average." |

Avoid: "Image of chart", "Chart showing data", or repeating every data point.

## 8. Common Mistakes

1. **Color-only series differentiation.** Colorblind users (8% of males) cannot distinguish series. Always add a second visual channel.

2. **Missing chart summary.** An SVG without `<title>`, `aria-label`, or surrounding `<figcaption>` is invisible to screen readers.

3. **Every data point is a tab stop.** A chart with 365 data points should be ONE tab stop with arrow-key navigation inside, not 365 tab presses to traverse.

4. **Tooltip only on hover.** If tooltips carry essential data, they must also appear on keyboard focus. Recharts handles this with `accessibilityLayer`; verify it works for your chart type.

5. **Animated data without `prefers-reduced-motion`.** Respect the user's motion preference:
   ```jsx
   <LineChart data={data}>
     <Line
       dataKey="value"
       isAnimationActive={!window.matchMedia("(prefers-reduced-motion: reduce)").matches}
     />
   </LineChart>
   ```

6. **Low-contrast gridlines and axis labels.** Axis text at `#ccc` on white fails the 4.5:1 requirement. Use at least `#737373` (gray-500) on white.

7. **No data table alternative.** Complex charts should offer a toggle to view the underlying data as an HTML table.

8. **Forgetting `aria-live` for dynamic updates.** When data refreshes or the user navigates, screen readers need a live region to announce changes.

## References

- [WCAG 2.2 Guidelines](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Graphics Module](https://www.w3.org/TR/graphics-aria-1.0/)
- [Recharts Accessibility Wiki](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility)
- [Recharts 3.0 Migration Guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [W3C SVG ARIA Roles for Charts](https://www.w3.org/wiki/SVG_Accessibility/ARIA_roles_for_charts)
- [Deque: How to Make Interactive Charts Accessible](https://www.deque.com/blog/how-to-make-interactive-charts-accessible/)
- [Smashing Magazine: Accessibility Standards for Chart Design](https://www.smashingmagazine.com/2024/02/accessibility-standards-empower-better-chart-visual-design/)
- [Highcharts: 10 Guidelines for DataViz Accessibility](https://www.highcharts.com/blog/tutorials/10-guidelines-for-dataviz-accessibility/)

## Related Skills

- `accessibility`
- `react-best-practices`
- `web-design-guidelines`
