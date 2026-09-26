# RISEBIT CFO — design system

One page, so that a new screen can be built without inventing anything.

Everything below is enforced by the primitives in
[`src/components/ui/primitives.tsx`](../src/components/ui/primitives.tsx).
Build from those and a page cannot drift; style a `<div>` by hand and it will.

---

## Base

**shadcn/ui** (Base UI under the hood, not Radix — the APIs differ, see below)
provides every control. Its tokens are not the stock neutral greys: they are
redefined in `globals.css` with RISEBIT's values, so components inherit the
brand rather than being restyled one at a time.

Never style a control directly. If a button looks wrong everywhere, fix the
token or the variant, not the call site.

---

## Type

Five steps. There is no sixth, and no arbitrary pixel size — the interface had
twelve before this and looked it.

| Step | Use |
|---|---|
| `text-2xl` semibold tracking-tight | page title, KPI figure |
| `text-base` semibold tracking-tight | card title |
| `text-sm` | body, table cells |
| `text-xs` | labels, captions, table headers, metadata |
| `tabular-nums` | **every** number, always |

Table headers are `text-xs uppercase` in `text-muted-foreground`.

---

## Colour

Colour carries meaning or it does not appear.

- **Surfaces and text** come from tokens: `bg-card`, `bg-background`,
  `text-foreground`, `text-muted-foreground`, `text-heading`, `border-border`.
- **Status** is the one thing colour may say: `tone-good`, `tone-warn`,
  `tone-bad`, `tone-neutral`, used through `<Badge>`, plus `--positive` and
  `--negative` on a figure that moved.
- **Charts** get their own validated palettes — see
  `src/components/charts/chart-tokens.ts`. Categorical hues are assigned in
  fixed order and never cycled.

The KPI cards used to be six saturated gradients, one per metric. Revenue and
EBITDA are not categories of anything, so the colour said nothing; they are
plain surfaces now and the only tint is on the delta.

---

## Rhythm

| Thing | Value |
|---|---|
| Page measure | `max-w-[96rem]`, centred |
| Between cards | `<Stack>` — `space-y-4`. Cards never set their own margin |
| Cards side by side | `<Row>` — `grid gap-4 items-stretch`, so heights match |
| Card header | `px-5 py-3.5`, bottom border |
| Card body | `p-5`, or `flush` for a full-bleed table |
| Table cell | `px-3 py-2.5` |
| Form control | `h-9` |

---

## The pieces

Everything on a page comes from `@/components/ui/primitives`. Anything written
by hand instead is the thing that drifts.

| Piece | For |
|---|---|
| `PageHeading` | The title, description and period line every page opens with |
| `Stack` / `Row` | Vertical rhythm, and cards that sit side by side |
| `Card` | Header, body, optional `action`, optional `flush` |
| `Badge` | A status pill carrying accounting meaning |
| `Callout` | A panel reporting state — warning, failure, confirmation |
| `FormMessage` | The one-line result of a form action, with the right ARIA role |
| `Detail` | A labelled figure in a card |
| `Note` | Provenance or method, under a card's content |
| `EmptyState` | Nothing to show yet |
| `Table` / `TableWrap` / `THead` / `TBody` / `Tr` / `Th` / `Td` | Every table |
| `CONTROL` | The one form-control height, 36px |

Buttons are shadcn's `Button` — including links that look like buttons, which
take `render={<Link … />}`. A hand-rolled `<button className="rounded-lg …">`
is always a bug: it misses the focus ring, the disabled state and the press
animation.

Panels never use raw Tailwind palette classes (`bg-amber-50`, `text-red-700`).
Those are light-theme values with no dark counterpart, so they read as a bright
card in dark mode. Tone comes from `--tone-*`, via `Callout`, `Badge`,
`FormMessage`, or the `.tone-*` / `.text-tone-*` utilities.

Signed-out pages share `AuthCard`, so sign-in and the forced password change
cannot drift apart again. Admin forms are built from `@/components/admin/form-bits`
— `Field`, `InlineField`, `Input`, `SelectField`, `Submit`, `Feedback` — which
all carry `CONTROL`, so a text field, a select and a button line up without any
form arranging it.

**Write `<Tr>`, never `<tr>`.** Every rule shadcn puts on a table row — the
hairline between rows, the hover tint, the suppressed border on the last one —
hangs off `TableRow`. A hand-written `<tr>` renders with none of it, which is
how the tables came to read as floating columns of text.

`<Tr highlight>` marks a subtotal. The tint goes on the **cells**, because
`border-radius` on a `<tr>` is ignored; and the row plus the one above it drop
their separators, because a hairline drawn across a rounded corner stops the
band reading as detached.

A wrapper around a table needs `min-w-0` on whatever grid or flex item holds
it. A grid item's implicit `min-width: auto` is its content's intrinsic width,
so a `min-w-[32rem]` table widens the whole track instead of scrolling inside
its own wrapper — and pushes everything beside it off the card.

---

## Tables

- First column is `<Th grow>`: it absorbs the leftover width so the figures
  group together on the right, instead of the browser spreading every column
  evenly and leaving acres between a label and its number.
- Numbers are `align="right"`, always `tabular-nums`.
- Subtotals use `strong`.
- Wrap in `<TableWrap>`, which scrolls on narrow screens rather than squashing.

---

## Corners

Two rounded shapes read as one object only when they share a centre of
curvature. That holds when

    inner radius = outer radius − the gap between them

Nest a 10px corner inside a 16px one with 6px of padding and the arcs run
parallel; use the same 10px with 2px of padding and they visibly cross.

So the inset steps are derived, never picked:

| Token | For something inset by |
|---|---|
| `--radius-inset-1` | 4px |
| `--radius-inset-2` | 8px |
| `--radius-inset-3` | 12px |

The rule only binds while the child's corner falls **inside** the parent's
arc — once the inset exceeds the parent's radius the child sits on a straight
edge and any radius reads correctly. That is why a card with `p-5` needs no
thought at all, and why the places that do need it are few: the segmented
control's pill in its track, the sidebar's menu items and brand link in the
floating panel, the donut legend's colour swatch in its row.

It is checkable, and worth checking — walk the DOM, find each element's
nearest rounded ancestor, and compare its radius against the parent's minus
the measured inset.

---

## Glass

Chrome that floats over content uses the `glass` material — a translucent
surface that blurs and saturates what passes beneath it, with a fine specular
line along its lit edge.

It goes where content actually travels underneath: the top bar, menus,
selects, and the filter bar once it is pinned. It does **not** go near a
table of figures — anything showing through a column of numbers costs
legibility and buys nothing — and it does **not** go on the sidebar, which
sits *beside* the content rather than over it. `glass-sidebar` keeps the
name and the specular edge but is opaque: mixed with the light page ground
the brand navy came out a washed blue-grey, in exchange for a transparency
nothing was ever visible through.

Three details that matter:

- `saturate()` alongside the blur. Blur alone leaves the backdrop grey; the
  saturation is what makes it read as glass rather than frosting.
- The inset top line is the specular highlight — white in light mode, dim in
  dark, where a bright rim looks like a seam.
- It degrades to an opaque surface under `prefers-reduced-transparency`, and
  where `backdrop-filter` is unsupported. A chrome layer must never become
  unreadable because an effect did not apply.

**Author the standard property only.** Lightning CSS prefixes for the build
targets; writing `-webkit-backdrop-filter` by hand made it keep the prefixed
declaration and drop the standard one.

---

## Motion

- `animate-rise` on cards as they mount.
- 200ms `transition` on hover and theme changes.
- Charts animate in at ~500ms.
- All of it is disabled under `prefers-reduced-motion`.

---

## Dark mode

`.dark` on `<html>`, stamped by the pre-paint script alongside `data-theme`
(shadcn reads the class; the charts read the attribute, since a Recharts fill
needs a real colour, not a CSS variable).

Dark values were **chosen against the dark ground**, not inverted. Chart
palettes were re-validated on the dark surface.

---

## Base UI, not Radix

This shadcn style ships on Base UI. Two differences that cost time:

- `Select` returns `string | null` from `onValueChange`; `ToggleGroup` models
  even a single selection as an **array**.
- `Select.Value` renders the **raw value** unless given a formatter function.
  Every select must format its own label, or a cuid appears in the filter bar.

Base UI's `Select` does submit through a server action — it renders a hidden
field, so `name` works with `FormData`.
