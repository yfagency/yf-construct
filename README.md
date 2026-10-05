# YF Construct

The live 3x3 construct for the yfkk.co Home hero. It shuffles its seven forms
(Y, F, X, O, +, / and \\), resolves to the Y / F logo every 10 seconds, and
turns into the two options on hover: a play chevron in the Y cell and a
scroll chevron in the F cell.

Lifted from **YFKK Landing MVP** (`yfagency/yfkk-landing-mvp`, Brano Beres,
11 Aug 2026) and rebuilt as a standalone script for Webflow. `index.html` is a
working demo with the same markup the Webflow page has.

## How it is wired in Webflow

The markup lives in Webflow as real elements, so the Designer shows it. In the
Home hero you'll find **Hero Construct**, **Construct Prompts**, **Construct Cursor
Label** and **Reel Modal**, all named in the Navigator and all `yfconstruct-*`
classes bound to site variables. This script finds them by `data-yfconstruct*`
attributes and draws into **Construct Mark**. Until the script runs (in the
Designer, or with JS off), the Designer shows **Construct Still**: the resolved
mark, drawn with a CSS mask.

The script is registered in Webflow as **YFConstruct** and applied to the
Home page footer. It's hosted from this repo through jsDelivr, pinned to a
tag, with an integrity hash.

## Readability over video

The video is darkened, not the mark. **Hero Scrim** is a plain Webflow element
directly above the video wrapper: class `yfhero-scrim`, Brand/Dark at
**opacity 0.5**. The
construct, prompts, cursor label and scroll line all sit above it, so the reel
reads as a background layer and the mark as a separate layer on top. Why 50%: the mark is a graphic, so it needs at least 3:1 contrast,
and 49.5% is the lowest scrim that holds 3:1 on a pure white frame. At the
first setting, 40%, it measured 2.4:1 on white and 2.8:1 on yellow. The corner
prompts sit at full opacity for the same reason. To retune, change the opacity
on the class. It shows in the Designer.

**Never outlines (Z, 5 Oct 2026).** A thin dark outline on the strokes was
tried and removed. Invert (`mix-blend-mode: difference`) was also tried and
rejected: it disappears on mid-tones.

## Settings (custom attributes on Hero Construct)

| Attribute | Default | What it does |
|---|---|---|
| `data-reel-url` | — | The video Play opens. Vimeo or YouTube page URL |
| `data-scroll-target` | next section | CSS selector Scroll goes to |
| `data-logo-every` | 10000 | ms between logo sequences |
| `data-tempo` | 700 | base ms between cell changes |
| `data-hold` | 2000 | ms the resolved logo holds |
| `data-wander` | 45 | % chance a cell takes any form, not its own |
| `data-travel` | 30 | % chance two cells trade places |
| `data-stroke` | size / 36 | stroke in px (4px at 144px) |
| `data-hover` | 450 | ms the hover transition takes, in and out. Matches the capsule buttons' 450ms wipe and uses the same curve |

## Switches (combo classes on Hero Construct)

| Combo | Effect |
|---|---|
| `on-light` | dark mark for a light background (give the combo colour Brand/Dark) |
| `still` | no shuffle: the resolved mark, chevrons on hover |
| `no-logo` | shuffle forever, never resolve to Y / F |
| `no-intro` | start shuffling straight away |
| `no-fade` | don't lift and fade as the hero scrolls away |

## What changed from the MVP

**Kept:** Brano's motion settings (tempo, draw, out, snap, stagger, wander,
travel, glide, burst, flick, 10s logo interval, 2s hold), the seven-form set,
the outside-in converge, the hover state (the slash stays, Y becomes play and
F becomes scroll), the three-chevron nudge, the cursor label, reduced motion
showing the resolved mark, and pausing when the hero is off screen.

**Animation**
- **One geometry.** Every form sits on whole nodes, six to a cell. The MVP's
  three X's were drawn at three slightly different insets. Now they're one
  form, and X, Y, F and O share the same 4-node box.
- **No X step.** The MVP drew an X before the slash. Its backslash crossed
  out the Y and F, so the logo now resolves as field clears, then Y, F,
  slash. The slash draws once.
- **Intro.** The page opens on the mark: Y and F draw, the slash crosses,
  and then the seven cells grow in. Switch off with `no-intro`.
- **Hover is choreographed.** Entering gathers the cells outside-in and draws
  the chevrons on. Leaving regrows them in reverse. In the MVP everything
  collapsed and reappeared at once.
- **No stuck strokes.** Every timer belongs to the instance and is cancelled
  on each state change. In the MVP a quick hover in and out could let a late
  callback blank a freshly painted cell.
- **A change is a change.** A cell never repaints the form it already holds.
- Also pauses in background tabs, not only off screen.

**Code**
- Standalone: no lattice, no page-cell maths, no dev HUD, no token
  silhouettes. 28 KB of commented source, against the MVP's 845 KB page.
- SVG styles are scoped to `.yfconstruct-svg`, so nothing leaks into the site.
- Timing and behaviour are set in the Designer (attributes and combo classes),
  not in code.

## Changelog

**1.3.0** (5 Oct 2026). The O is always a whole ring. It used to draw on as a
stroke like the other forms, and the slow end of that draw held the last gap
open, so it often read as a "C". It now grows from its centre and shrinks back
on the same timing.

**1.2.0** (5 Oct 2026). The logo never appears crossed out. The X step is
gone from the logo sequence: its backslash ran corner to corner through the
Y and F cells. Now the field clears, Y and F draw, and the slash crosses. The
shuffle also can't randomly land Y top-left, F bottom-right and an X or
backslash in the centre. Includes the 1.1.0 hover changes.

**1.1.0** (5 Oct 2026). The hover transition now runs in 450ms on the capsule
buttons' curve, `cubic-bezier(0,0,.58,1)`, instead of about 1.3s. Z: at the old
speed it didn't feel like anything was happening. The cells retract together
while the chevrons draw over them, and leaving regrows the cells within the
same 450ms. Tunable with `data-hover`. When you hover an option, its chevron
march starts already drawn. Also fixed: a stroke with no delay could skip its
draw and pop on.

**1.0.0** (5 Oct 2026). First release.

## Releasing a new version

1. Edit `yf-construct.js` and bump the version in its header and in
   `window.YFConstruct`.
2. Commit, tag `vX.Y.Z`, push.
3. In Webflow, register a new version of **YFConstruct** with the new jsDelivr
   URL (`https://cdn.jsdelivr.net/gh/yfagency/yf-construct@vX.Y.Z/yf-construct.js`)
   and its hash (`openssl dgst -sha384 -binary yf-construct.js | openssl base64 -A`).
   Then switch the Home page to that version and publish.

A tag is never moved: the hash is tied to its exact bytes.
