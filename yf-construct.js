/*! YF Construct v1.0.0 · the live 3x3 for the yfkk.co Home hero
 *
 *  Ported from the YFKK Landing MVP (github.com/yfagency/yfkk-landing-mvp,
 *  Brano Beres, 11 Aug 2026), which ported it from construct-lab. Brano's
 *  motion settings are kept as they stand: tempo 700, draw 500, out 300,
 *  snap 600, stagger 120, wander 45, travel 30, glide 700, logo every 10s,
 *  hold 2s. What changed is listed in README.md.
 *
 *  THE PAGE OWNS THE MARKUP. This script draws into elements that already
 *  exist in Webflow, so the Designer shows the real structure:
 *
 *    [data-yfconstruct]                      the construct (class yfconstruct)
 *      [data-yfconstruct-mark]               the drawing surface; holds a still of
 *                                      the resolved mark until the script runs
 *      [data-yfconstruct-action="play"]      button over the Y cell
 *      [data-yfconstruct-action="scroll"]    button over the F cell
 *    [data-yfconstruct-action=...]           any other trigger in the same section
 *                                      (the corner prompts)
 *    [data-yfconstruct-cursor]               the label that follows the pointer
 *    [data-yfconstruct-modal]                the reel modal (hidden by its class)
 *      [data-yfconstruct-frame]              where the reel iframe is mounted
 *      [data-yfconstruct-close]              the close button
 *
 *  SETTINGS ARE ATTRIBUTES ON [data-yfconstruct], all optional:
 *    data-reel-url       the video Play opens (Vimeo or YouTube URL)
 *    data-scroll-target  CSS selector Scroll goes to (default: next section)
 *    data-logo-every     ms between Y / F logo sequences (10000)
 *    data-tempo          base ms between cell changes (700)
 *    data-hold           ms the resolved logo is held (2000)
 *    data-wander         % chance a cell takes any form, not its own (45)
 *    data-travel         % chance two cells trade instead of one changing (30)
 *    data-stroke         stroke in px (default: size / 36, 4px at 144px)
 *
 *  SWITCHES ARE COMBO CLASSES ON .yfconstruct, toggled in the Designer:
 *    on-light   ink on a light ground (colour is the class's own; CSS only)
 *    still      no shuffle: the resolved mark, chevrons on hover
 *    no-logo    shuffle forever, never resolve to Y / F
 *    no-intro   start shuffling straight away instead of drawing the mark first
 *    no-fade    do not lift and fade as the hero scrolls away
 */
(function () {
  "use strict";
  if (window.YFConstruct) return;

  var NS = "http://www.w3.org/2000/svg";

  /* ── GEOMETRY ──────────────────────────────────────────────────────────────
     One unit is one node: six to a cell, eighteen across the construct. Every
     form sits on whole nodes. The named forms share one 4-node box (nodes 1 to
     5), the same inset construct-v3's X uses; the corner slashes and the plus
     span their cell. Y and F are the yf33 letters, mitred, one path per stroke
     run, so no corner overshoots. */
  var FORMS = {
    "Y":  [[[1, 1], [3, 3], [5, 1]], [[3, 3], [3, 5]]],
    "F":  [[[5, 1], [2, 1], [2, 5]], [[2, 3], [4, 3]]],
    "X":  [[[5, 1], [1, 5]], [[1, 1], [5, 5]]],
    "+":  [[[3, 0], [3, 6]], [[0, 3], [6, 3]]],
    "O":  "circle",
    "/":  [[[6, 0], [0, 6]]],
    "\\": [[[0, 0], [6, 6]]]
  };
  var FORM_NAMES = Object.keys(FORMS);
  /* each cell's own forms, as Brano authored them in construct-lab */
  var CELL_FORMS = [
    ["Y", "/", "\\"], ["X", "/", "\\"], ["/", "\\"],
    ["+", "/", "\\"], ["X", "/", "\\"], ["X", "/", "\\"],
    ["/", "\\"],      ["O", "/", "\\"], ["F", "/", "\\"]
  ];
  var SLASH = [[18, 0], [0, 18]];          /* drawn top-right to bottom-left */
  var BACKSLASH = [[0, 0], [18, 18]];
  /* the seven non-logo cells, outside-in. Y (0) and F (8) never leave. */
  var CONVERGE = [2, 6, 1, 7, 3, 5, 4];

  var BASE = {
    tempo: 700, draw: 500, out: 300, snap: 600, stagger: 120,
    wander: 45, travel: 30, glide: 700,
    logoEvery: 10000, buildStep: 500, hold: 2000,
    converge: 110, regrow: 110,
    gather: 45            /* hover: faster outside-in than the logo's 110 */
  };
  var EASE_SNAP = "cubic-bezier(.2,1.5,.3,1)";
  var EASE_DRAW = "cubic-bezier(.16,.9,.2,1)";
  var EASE_OUT = "cubic-bezier(.6,0,.9,.3)";
  var EASE_GLIDE = "cubic-bezier(.3,1.15,.3,1)";

  /* Styles that only exist inside the drawn SVG, every rule scoped to
     .yfconstruct-svg (an inline <style> is page-global). Nothing here touches
     an element Webflow owns; the page's own classes stay the source of truth for
     size, colour and placement. */
  var SVG_CSS =
    ".yfconstruct-svg .k{fill:none;stroke:currentColor;stroke-width:var(--yfconstruct-sw,.5);" +
      "stroke-linejoin:miter;stroke-miterlimit:2;stroke-linecap:butt}" +
    ".yfconstruct-svg .d{stroke-dasharray:1;stroke-dashoffset:1;" +
      "transition:stroke-dashoffset var(--yfconstruct-draw,500ms) " + EASE_DRAW + "}" +
    ".yfconstruct-svg .d.on{stroke-dashoffset:0}" +
    ".yfconstruct-svg .d.out{stroke-dashoffset:1;transition:stroke-dashoffset var(--yfconstruct-out,300ms) " + EASE_OUT + "}" +
    ".yfconstruct-svg .s{transform-origin:3px 3px}" +
    ".yfconstruct-svg .s.snap{animation:yfconstructSpin var(--yfconstruct-snap,600ms) " + EASE_SNAP + " both}" +
    ".yfconstruct-svg .p.glide{transition:transform var(--yfconstruct-glide,700ms) " + EASE_GLIDE + "}" +
    "@keyframes yfconstructSpin{from{transform:rotate(-32deg) scale(.7)}to{transform:none}}" +
    "@keyframes yfconstructNudge{0%,6%{stroke-dashoffset:1}36%,64%{stroke-dashoffset:0}94%,100%{stroke-dashoffset:1}}" +
    ".yfconstruct-svg .n{stroke-dasharray:1;stroke-dashoffset:1;animation:yfconstructNudge 1.25s " + EASE_DRAW + " infinite}" +
    ".yfconstruct-svg.still .n{animation:none;stroke-dashoffset:0}";

  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var uid = 0;

  function num(el, name, fallback) {
    var v = parseFloat(el.getAttribute(name));
    return isFinite(v) && v >= 0 ? v : fallback;
  }
  function pathD(pts) {
    return "M" + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" L");
  }
  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  /* the strokes of one form, in cell-local node units */
  function strokesOf(name) {
    if (FORMS[name] === "circle") return [el("circle", { cx: 3, cy: 3, r: 2, "class": "k" })];
    return FORMS[name].map(function (pts) { return el("path", { d: pathD(pts), "class": "k" }); });
  }
  /* a chevron, apex on (cx, cy), run r: right-pointing or down-pointing */
  function chevron(dir, cx, cy, r) {
    var pts = dir === "r"
      ? [[cx - r, cy - r], [cx, cy], [cx - r, cy + r]]
      : [[cx - r, cy - r], [cx, cy], [cx + r, cy - r]];
    return el("path", { d: pathD(pts), "class": "k" });
  }

  function Construct(root) {
    this.root = root;
    this.scope = root.closest("section") || document.body;
    this.id = ++uid;
    this.timers = [];
    this.state = "idle";
    this.visible = true;
    this.read();
    this.build();
    this.wire();
    this.start();
  }

  Construct.prototype.read = function () {
    var r = this.root, cl = r.classList;
    this.t = {
      tempo: num(r, "data-tempo", BASE.tempo),
      logoEvery: num(r, "data-logo-every", BASE.logoEvery),
      hold: num(r, "data-hold", BASE.hold),
      wander: num(r, "data-wander", BASE.wander),
      travel: num(r, "data-travel", BASE.travel)
    };
    this.sw = {
      still: REDUCE || cl.contains("still"),
      noLogo: cl.contains("no-logo"),
      noIntro: cl.contains("no-intro"),
      noFade: cl.contains("no-fade")
    };
  };

  /* ── DRAWING SURFACE ─────────────────────────────────────────────────────── */
  Construct.prototype.build = function () {
    var host = this.root.querySelector("[data-yfconstruct-mark]") || this.root;
    var svg = el("svg", { viewBox: "0 0 18 18", "aria-hidden": "true", focusable: "false", "class": "yfconstruct-svg" });
    svg.style.cssText = "display:block;width:100%;height:100%;overflow:visible";
    var clipId = "yfconstructClip" + this.id;
    var style = el("style", {});
    style.textContent = SVG_CSS;
    var defs = el("defs", {});
    var cp = el("clipPath", { id: clipId });
    cp.appendChild(el("rect", { x: 0, y: 0, width: 6, height: 6 }));
    defs.appendChild(cp);
    svg.appendChild(style);
    svg.appendChild(defs);
    this.cells = [];
    for (var i = 0; i < 9; i++) {
      var g = el("g", { transform: "translate(" + (i % 3) * 6 + " " + Math.floor(i / 3) * 6 + ")",
                        "clip-path": "url(#" + clipId + ")" });
      svg.appendChild(g);
      this.cells.push({ i: i, g: g, form: null, p: null });
    }
    this.logo = el("g", {});
    svg.appendChild(this.logo);
    if (this.sw.still) svg.classList.add("still");
    host.textContent = "";            /* drops the Designer's still image */
    host.appendChild(svg);
    this.svg = svg;
    this.resize();
  };

  /* stroke in node units = px / (px per node). Re-measured on resize so the
     line stays the same weight as the page's rules at every breakpoint. */
  Construct.prototype.resize = function () {
    var size = this.svg.getBoundingClientRect().width || 144;
    var px = num(this.root, "data-stroke", size / 36);
    this.svg.style.setProperty("--yfconstruct-sw", (px * 18 / size).toFixed(4));
  };

  /* ── TIMERS: every one belongs to the instance and dies on a state change ──
     The MVP's draw staggers and retract callbacks were loose setTimeouts, so a
     quick hover in and out let a late retract empty a cell that had just been
     repainted: blank cells and stray half-strokes. Now nothing outlives the
     state that scheduled it. */
  Construct.prototype.at = function (fn, ms) {
    var self = this;
    var id = setTimeout(function () {
      self.timers.splice(self.timers.indexOf(id), 1);
      fn.call(self);
    }, Math.max(0, ms));
    this.timers.push(id);
  };
  Construct.prototype.clear = function () {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  };
  Construct.prototype.go = function (state) {
    this.clear();
    this.state = state;
  };

  /* draw a set of strokes on, one after another */
  Construct.prototype.drawOn = function (nodes, startDelay) {
    var self = this;
    nodes.forEach(function (k, n) {
      k.setAttribute("pathLength", "1");
      if (self.sw.still) return;
      k.classList.add("d");
      self.at(function () { k.classList.add("on"); }, (startDelay || 0) + n * BASE.stagger);
    });
  };
  /* retract strokes, then remove them */
  Construct.prototype.drawOff = function (nodes, then) {
    if (this.sw.still || !nodes.length) {
      nodes.forEach(function (k) { if (k.parentNode) k.parentNode.removeChild(k); });
      if (then) then.call(this);
      return;
    }
    nodes.forEach(function (k) { k.classList.remove("on"); k.classList.add("out"); });
    this.at(function () {
      nodes.forEach(function (k) { if (k.parentNode) k.parentNode.removeChild(k); });
      if (then) then.call(this);
    }, BASE.out + 20);
  };

  /* ── CELLS ───────────────────────────────────────────────────────────────── */
  Construct.prototype.pick = function (cell) {
    var name, guard = 0;
    do {
      name = Math.random() * 100 < this.t.wander
        ? FORM_NAMES[Math.floor(Math.random() * FORM_NAMES.length)]
        : CELL_FORMS[cell.i][Math.floor(Math.random() * CELL_FORMS[cell.i].length)];
    } while (name === cell.form && ++guard < 12);   /* a change is a change */
    return name;
  };

  /* paint a form into a cell. `from` slides it in from another cell's place
     (a trade); otherwise it spins in and draws on. */
  Construct.prototype.paint = function (cell, name, from) {
    var s = el("g", { "class": "s" });
    var p = el("g", { "class": "p" });
    var strokes = strokesOf(name);
    strokes.forEach(function (k) { p.appendChild(k); });
    s.appendChild(p);
    cell.g.textContent = "";
    cell.g.appendChild(s);
    cell.form = name; cell.p = p;
    if (from && !this.sw.still) {
      p.style.transform = "translate(" + from[0] + "px," + from[1] + "px)";
      void p.getBoundingClientRect();
      p.classList.add("glide");
      p.style.transform = "translate(0,0)";
      strokes.forEach(function (k) { k.setAttribute("pathLength", "1"); });
      return;
    }
    if (!this.sw.still) s.classList.add("snap");
    this.drawOn(strokes);
  };
  Construct.prototype.retract = function (cell) {
    var nodes = [].slice.call(cell.g.querySelectorAll(".k"));
    cell.form = null; cell.p = null;
    var g = cell.g;
    this.drawOff(nodes, function () { g.textContent = ""; });
  };
  Construct.prototype.trade = function (a, b) {
    var fa = a.form, fb = b.form;
    if (!fa || !fb) return;
    var dax = ((b.i % 3) - (a.i % 3)) * 6, day = (Math.floor(b.i / 3) - Math.floor(a.i / 3)) * 6;
    this.paint(a, fb, [dax, day]);
    this.paint(b, fa, [-dax, -day]);
  };

  /* ── THE LOGO GROUP: slash, X, chevrons, all unclipped across 18 nodes ──── */
  Construct.prototype.logoStroke = function (pts, cls) {
    var k = el("path", { d: pathD(pts), "class": "k" + (cls ? " " + cls : "") });
    this.logo.appendChild(k);
    return k;
  };
  Construct.prototype.logoClear = function (then) {
    this.drawOff([].slice.call(this.logo.childNodes), then);
  };

  /* ── STATES ──────────────────────────────────────────────────────────────── */
  Construct.prototype.start = function () {
    if (this.sw.still) return this.resolved();
    if (this.sw.noIntro || this.sw.noLogo) return this.fillThen(this.shuffle);
    this.intro();
  };

  /* the resolved mark, painted at once: Y, the slash, F */
  Construct.prototype.resolved = function () {
    this.go("still");
    this.cells.forEach(function (c) { c.g.textContent = ""; c.form = null; });
    this.logo.textContent = "";
    this.paint(this.cells[0], "Y");
    this.paint(this.cells[8], "F");
    this.logoStroke(SLASH).setAttribute("pathLength", "1");
  };

  /* NEW: the page opens on the mark. Y and F draw, the slash crosses, it
     holds, and the seven grow in around it. The same ending as the logo
     sequence, played as a beginning. */
  Construct.prototype.intro = function () {
    this.go("intro");
    this.paint(this.cells[0], "Y");
    this.paint(this.cells[8], "F");
    var k = this.logoStroke(SLASH);
    this.drawOn([k], BASE.draw);
    this.at(this.regrow, BASE.draw * 2 + Math.min(this.t.hold, 1200));
  };

  /* fill any empty cell, then continue (used after pausing and on exit) */
  Construct.prototype.fillThen = function (next) {
    var self = this, n = 0;
    CONVERGE.slice().reverse().concat([0, 8]).forEach(function (idx) {
      var c = self.cells[idx];
      if (!c.form) self.at(function () { self.paint(c, self.pick(c)); }, (n++) * BASE.regrow);
    });
    this.at(next, n * BASE.regrow + BASE.draw);
  };

  Construct.prototype.shuffle = function () {
    this.go("shuffle");
    this.sinceLogo = 0;
    this.burst = 0;
    this.lastCell = -1;
    this.tick();
  };
  Construct.prototype.tick = function () {
    var gap;
    if (this.burst > 0) { gap = BASE.tempo * 0.34; this.burst--; }
    else {
      gap = this.t.tempo * (0.7 + Math.random() * 0.9);
      if (Math.random() < 0.22) this.burst = 2 + Math.floor(Math.random() * 3);
    }
    this.sinceLogo += gap;
    if (!this.sw.noLogo && this.sinceLogo >= this.t.logoEvery) {
      this.at(this.logoSequence, gap);
      return;
    }
    if (Math.random() * 100 < this.t.travel) {
      var a = Math.floor(Math.random() * 9), b;
      do { b = Math.floor(Math.random() * 9); } while (b === a);
      this.trade(this.cells[a], this.cells[b]);
      this.lastCell = -1;
    } else {
      var c;
      do { c = Math.floor(Math.random() * 9); } while (c === this.lastCell);
      this.lastCell = c;
      var cell = this.cells[c];
      this.paint(cell, this.pick(cell));
      if (Math.random() < 0.16) {                       /* the flick */
        this.at(function () { this.paint(cell, this.pick(cell)); }, Math.max(90, gap * 0.42));
      }
    }
    this.at(this.tick, gap);
  };

  /* Converge: the seven retract outside-in, leaving Y and F standing. The X
     draws across; its backslash then RETRACTS, so the slash that remains is
     the one that was drawn (the MVP repainted it from nothing, which read as a
     second, unexplained draw). Hold, then regrow. */
  Construct.prototype.logoSequence = function () {
    this.go("logo");
    var self = this;
    if (this.cells[0].form !== "Y") this.paint(this.cells[0], "Y");
    if (this.cells[8].form !== "F") this.paint(this.cells[8], "F");
    CONVERGE.forEach(function (idx, n) {
      self.at(function () { self.retract(self.cells[idx]); }, n * BASE.converge);
    });
    var t = CONVERGE.length * BASE.converge + BASE.out;
    var slash, back;
    this.at(function () {
      this.logo.textContent = "";
      slash = this.logoStroke(SLASH);
      back = this.logoStroke(BACKSLASH);
      this.drawOn([slash, back]);
    }, t);
    this.at(function () { this.drawOff([back]); }, t + BASE.buildStep * 2);
    this.at(this.regrow, t + BASE.buildStep * 2 + BASE.out + this.t.hold);
  };

  Construct.prototype.regrow = function () {
    this.go("regrow");
    this.logoClear();
    this.fillThen(this.shuffle);
  };

  /* ── HOVER: THE MARK BECOMES THE TWO OPTIONS ────────────────────────────────
     The slash stays. Y's cell carries the play chevron, F's the scroll
     chevron. NEW: entering gathers the seven outside-in and draws the
     chevrons on, leaving regrows them in reverse, the same gesture the logo
     sequence uses, instead of every cell collapsing at once. */
  Construct.prototype.offer = function (which) {
    this.want = which;
    if (this.state === "offer") { if (this.gathered) this.chevrons(which); return; }
    this.go("offer");
    this.gathered = false;
    var self = this;
    var order = this.sw.still ? [] : CONVERGE.concat([0, 8]);
    if (this.sw.still) { this.cells[0].g.textContent = ""; this.cells[8].g.textContent = ""; }
    order.forEach(function (idx, n) {
      self.at(function () { if (self.cells[idx].form) self.retract(self.cells[idx]); }, n * BASE.gather);
    });
    var hasSlash = this.logo.querySelector("path:not(.out)");
    this.at(function () {
      this.logo.textContent = "";
      var s = this.logoStroke(SLASH);
      if (hasSlash || this.sw.still) s.setAttribute("pathLength", "1");
      else this.drawOn([s]);
      this.which = null;
      this.gathered = true;
      this.chevrons(this.want, true);
    }, this.sw.still ? 0 : order.length * BASE.gather + BASE.out);
  };
  /* rest: one chevron per letter cell. Hovering an option marches three of
     them across that cell, a seventh of a second apart. */
  Construct.prototype.chevrons = function (which, first) {
    if (this.which === which && !first) return;
    this.which = which;
    [].slice.call(this.logo.querySelectorAll(".chev")).forEach(function (k) { k.parentNode.removeChild(k); });
    var add = [], self = this;
    function put(k, live, n) {
      k.classList.add("chev");
      k.setAttribute("pathLength", "1");
      if (live) { k.classList.add("n"); k.style.animationDelay = (n * 0.14).toFixed(2) + "s"; }
      self.logo.appendChild(k);
      if (!live) add.push(k);
    }
    if (which === "play") for (var a = 0; a < 3; a++) put(chevron("r", 2 + a * 2, 3, 2), true, a);
    else put(chevron("r", 4, 3, 2), false);
    if (which === "scroll") for (var b = 0; b < 3; b++) put(chevron("d", 15, 14 + b * 2, 2), true, b);
    else put(chevron("d", 15, 16, 2), false);
    if (first) this.drawOn(add); else add.forEach(function (k) { k.classList.add("d", "on"); });
  };
  Construct.prototype.release = function () {
    if (this.state !== "offer") return;
    if (this.sw.still) return this.resolved();
    this.go("release");
    this.which = null;
    this.logoClear();
    this.at(function () { this.fillThen(this.shuffle); }, BASE.out);
  };

  /* ── PAUSE: off screen or in a background tab, nothing runs ──────────────── */
  Construct.prototype.setVisible = function (v) {
    if (v === this.visible) return;
    this.visible = v;
    if (this.sw.still || this.state === "offer") return;
    if (!v) { this.go("paused"); return; }
    this.logoClear();
    this.fillThen(this.shuffle);
  };

  /* ── WIRING ──────────────────────────────────────────────────────────────── */
  Construct.prototype.wire = function () {
    var self = this, root = this.root, scope = this.scope;
    var cursor = document.querySelector("[data-yfconstruct-cursor]");
    var triggers = [].slice.call(scope.querySelectorAll("[data-yfconstruct-action]"));

    function label(text, e) {
      if (!cursor) return;
      if (!text) { cursor.style.opacity = "0"; return; }
      if (cursor.textContent !== text) cursor.textContent = text;
      var off = root.getBoundingClientRect().width / 9;    /* a third of a cell */
      cursor.style.left = (e.clientX + off) + "px";
      cursor.style.top = (e.clientY + off) + "px";
      cursor.style.opacity = "1";
    }

    root.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch") return;
      self.offer(null);
    });
    root.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch") return;
      label("");
      self.release();
    });

    triggers.forEach(function (t) {
      var action = t.getAttribute("data-yfconstruct-action");
      var inMark = root.contains(t);
      t.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        self.offer(action);
      });
      t.addEventListener("pointermove", function (e) {
        if (inMark && e.pointerType !== "touch") label(t.getAttribute("aria-label") || t.textContent.trim(), e);
      });
      t.addEventListener("pointerleave", function (e) {
        if (e.pointerType === "touch") return;
        label("");
        if (inMark) self.offer(null); else self.release();
      });
      t.addEventListener("focus", function () { self.offer(action); });
      t.addEventListener("blur", function () {
        setTimeout(function () {
          if (!scope.contains(document.activeElement) || !document.activeElement.hasAttribute("data-yfconstruct-action")) self.release();
        }, 0);
      });
      t.addEventListener("click", function (e) {
        e.preventDefault();
        if (action === "play") self.play(t); else self.scroll();
      });
    });

    if ("ResizeObserver" in window) new ResizeObserver(function () { self.resize(); }).observe(this.svg);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        self.onScreen = es[0].isIntersecting;
        self.setVisible(self.onScreen && !document.hidden);
      }, { threshold: 0 }).observe(root);
    }
    document.addEventListener("visibilitychange", function () {
      self.setVisible(self.onScreen !== false && !document.hidden);
    });

    /* lift and fade as the hero leaves, as in the MVP: the mark rises five of
       its own cells and is gone by 58% of the hero's height */
    if (!this.sw.noFade && !REDUCE) {
      var prompts = scope.querySelector("[data-yfconstruct-prompts]");
      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var r = scope.getBoundingClientRect(), h = Math.max(1, r.height);
          var hp = Math.max(0, Math.min(1, -r.top / (h * 0.8)));
          var cell = root.getBoundingClientRect().height / 3;
          root.style.transform = hp ? "translate3d(0," + (-hp * cell * 5).toFixed(1) + "px,0)" : "";
          root.style.opacity = hp ? (1 - smooth(hp, 0.26, 0.58)).toFixed(3) : "";
          if (prompts) prompts.style.opacity = hp ? (1 - smooth(hp, 0.10, 0.34)).toFixed(3) : "";
        });
      };
      addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  };
  function smooth(x, a, b) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ── THE TWO ACTIONS ─────────────────────────────────────────────────────── */
  Construct.prototype.scroll = function () {
    var sel = this.root.getAttribute("data-scroll-target");
    var target = (sel && document.querySelector(sel)) || this.scope.nextElementSibling;
    if (target) target.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "start" });
  };

  /* Vimeo and YouTube page URLs become their player embeds; anything else is
     used as given. Autoplay with sound is allowed here because it follows a
     click. */
  function embedUrl(url) {
    var m;
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/))) {
      return "https://player.vimeo.com/video/" + m[1] + "?autoplay=1&title=0&byline=0&portrait=0&dnt=1" +
        (m[2] ? "&h=" + m[2] : "");
    }
    if ((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/))) {
      return "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0&modestbranding=1";
    }
    return url;
  }

  Construct.prototype.play = function (opener) {
    var url = this.root.getAttribute("data-reel-url");
    var modal = document.querySelector("[data-yfconstruct-modal]");
    if (!url) return;
    if (!modal) { window.open(url, "_blank", "noopener"); return; }
    var frame = modal.querySelector("[data-yfconstruct-frame]") || modal;
    var close = modal.querySelector("[data-yfconstruct-close]");
    var iframe = document.createElement("iframe");
    iframe.src = embedUrl(url);
    iframe.title = "YF reel";
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "");
    iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";
    frame.textContent = "";
    frame.appendChild(iframe);
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    var self = this;
    function shut() {
      frame.textContent = "";                       /* stops the video */
      modal.style.display = "";
      modal.setAttribute("aria-hidden", "true");
      document.documentElement.style.overflow = "";
      removeEventListener("keydown", onKey);
      if (close) close.removeEventListener("click", onClose);
      modal.removeEventListener("click", onBackdrop);
      if (opener && opener.focus) opener.focus();
      self.release();
    }
    function onKey(e) { if (e.key === "Escape") shut(); }
    function onClose(e) { e.preventDefault(); shut(); }
    function onBackdrop(e) { if (e.target === modal) shut(); }
    addEventListener("keydown", onKey);
    if (close) { close.addEventListener("click", onClose); close.focus(); }
    modal.addEventListener("click", onBackdrop);
  };

  /* ── BOOT ────────────────────────────────────────────────────────────────── */
  var instances = [];
  function boot() {
    [].slice.call(document.querySelectorAll("[data-yfconstruct]")).forEach(function (r) {
      if (r.__yfconstruct) return;
      r.__yfconstruct = new Construct(r);
      instances.push(r.__yfconstruct);
    });
  }
  window.YFConstruct = { version: "1.0.0", boot: boot, instances: instances };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
