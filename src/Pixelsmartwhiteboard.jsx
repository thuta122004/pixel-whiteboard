import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  Square,
  Circle,
  StickyNote,
  Type,
  Eraser,
  Grid3x3,
  Undo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Coins,
  Sparkles,
  X,
  Heart,
  Plus,
  Check,
  Redo2,
  Keyboard,
} from "lucide-react";

/* ───────── storage: localStorage with in-memory fallback ───────── */
const KEY = "pixel-smart-whiteboard-v1";
const mem = {};
const store = {
  get() {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v) return JSON.parse(v);
    } catch (e) {}
    try {
      return mem[KEY] ? JSON.parse(mem[KEY]) : null;
    } catch (e) {
      return null;
    }
  },
  set(v) {
    const s = JSON.stringify(v);
    mem[KEY] = s;
    try {
      window.localStorage.setItem(KEY, s);
    } catch (e) {}
  },
};
function load() {
  const g = { ...DEFAULT, ...(store.get() || {}) };
  if (!Array.isArray(g.items)) g.items = [];
  if (!Array.isArray(g.tasks)) g.tasks = [];
  g.tasks = g.tasks.map((t) => (t.done ? { ...t, paid: true } : t)); // tasks already ticked in older saves count as paid
  if (!g.pets || typeof g.pets !== "object") g.pets = DEFAULT.pets;
  if (!g.pets[g.active]) g.active = Object.keys(g.pets)[0] || "slime";
  return g;
}
const DEFAULT = {
  items: [],
  tasks: [],
  xp: 0,
  coins: 0,
  minutes: 0,
  pets: { slime: { level: 1 } },
  active: "slime",
  sound: true,
};

/* ───────── Web Audio (synthesized, no files) ───────── */
const audio = { ctx: null };
function tone(on, f, d = 0.1, type = "square", vol = 0.05, delay = 0) {
  if (!on) return;
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    audio.ctx = audio.ctx || new A();
    const c = audio.ctx;
    if (c.state === "suspended") c.resume();
    const o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime + delay;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + d + 0.03);
  } catch (e) {}
}
const sfx = {
  click: (on) => tone(on, 740, 0.06),
  pop: (on) => tone(on, 520, 0.08, "triangle", 0.07),
  chime: (on) =>
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(on, f, 0.24, "square", 0.05, i * 0.14),
    ),
  up: (on) =>
    [659, 880, 1175].forEach((f, i) =>
      tone(on, f, 0.14, "triangle", 0.07, i * 0.09),
    ),
};

/* ───────── pixel sprites: 12×12 grids, '.' = transparent ───────── */
const C = {
  o: "#3D262A",
  e: "#3D262A",
  w: "#FFFDF9",
  p: "#FFB6C1",
  g: "#7CCB92",
  r: "#FF8FAB",
};
const PETS = [
  {
    id: "slime",
    name: "Pink Slime",
    cost: 0,
    pal: { b: "#FF9EB5", l: "#FFD6E0", p: "#FF6F91" },
    grid: [
      "............",
      "............",
      "....oooo....",
      "...obbbbo...",
      "..oblbbbbo..",
      "..obbbbbbo..",
      "..obebbebo..",
      ".obbbbbbbbo.",
      ".obpbbbbpbo.",
      ".obbbbbbbbo.",
      "..oooooooo..",
      "............",
    ],
  },
  {
    id: "bunny",
    name: "Pixel Bunny",
    cost: 40,
    pal: { b: "#FFFDF9", l: "#FFFFFF" },
    grid: [
      "..oo....oo..",
      ".obpo..obpo.",
      ".obpo..obpo.",
      "..obbbbbbo..",
      ".obbbbbbbbo.",
      ".obebbbbebo.",
      ".obbbbbbbbo.",
      ".obpbwwbpbo.",
      ".obbbbbbbbo.",
      "..obbbbbbo..",
      "...oooooo...",
      "............",
    ],
  },
  {
    id: "ghost",
    name: "Strawberry Ghost",
    cost: 80,
    pal: { b: "#FF6B81", l: "#FF9AA8", p: "#FFC2CC" },
    grid: [
      "....g..g....",
      "....gggg....",
      "...oooooo...",
      "..obbbbbbo..",
      ".obbbbbbbbo.",
      ".obebbbbebo.",
      ".obebbbbebo.",
      ".obpbbbbpbo.",
      ".obbbwwbbbo.",
      ".obbbbbbbbo.",
      ".obobbobbobo",
      "..o..oo..o..",
    ],
  },
];
const ACC5 = ["...rr..rr...", "....rrrr...."]; // ribbon at level 5+

function rects(grid, pal, dy = 0) {
  const out = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      const s = x;
      while (row[x] === ch) x++;
      out.push(
        <rect
          key={`${y}-${s}`}
          x={s}
          y={y + dy}
          width={x - s}
          height={1}
          fill={pal[ch] || "#000"}
        />,
      );
    }
  });
  return out;
}
function Sprite({ pet, lvl = 1, size = 80, blink, dim }) {
  const p = { ...C, ...pet.pal };
  if (blink) p.e = p.b;
  return (
    <svg
      viewBox="0 0 12 14"
      width={size}
      height={(size * 14) / 12}
      shapeRendering="crispEdges"
      className="pp-pix"
      style={{
        imageRendering: "pixelated",
        filter: dim ? "brightness(0)" : "none",
        opacity: dim ? 0.18 : 1,
      }}
      aria-hidden="true"
    >
      {rects(pet.grid, p, 2)}
      {lvl >= 5 && rects(ACC5, p)}
    </svg>
  );
}

/* ───────── styles (same class patterns as Pixel Pomodoro Pet) ───────── */
const CSS = `
html,body{margin:0}
.pp-root,.pp-root *,.pp-root *::before,.pp-root *::after{box-sizing:border-box}
.pp-root h1,.pp-root h2,.pp-root p{margin:0}
.pp-root button,.pp-root input,.pp-root textarea{font-family:inherit}
.fixed{position:fixed}.flex{display:flex}.flex-1{flex:1 1 0%}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.font-black{font-weight:900}.font-bold{font-weight:700}.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.inset-0{inset:0}.items-center{align-items:center}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.min-w-0{min-width:0}.mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.my-1{margin:.25rem 0}.p-3{padding:.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.px-4{padding-left:1rem;padding-right:1rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.text-center{text-align:center}.text-lg{font-size:1.125rem}.text-sm{font-size:.875rem}.text-xl{font-size:1.25rem}.text-xs{font-size:.75rem}.w-full{width:100%}.z-40{z-index:40}
.pp-root{min-height:100vh;color:#4A2E35;font-family:ui-rounded,'Nunito','Segoe UI',system-ui,sans-serif;background-color:#FFF0F5;background-image:radial-gradient(#FDE2E4 2px,transparent 2px);background-size:22px 22px}
.pp-pixel{font-family:'Courier New',ui-monospace,monospace;font-weight:900;letter-spacing:.06em}
.pp-pix{image-rendering:crisp-edges;image-rendering:pixelated}
.pp-card{background:#FFFDF9;border:3px solid #3D262A;border-radius:18px;box-shadow:4px 4px 0 #3D262A}
.pp-btn{background:#FFB6C1;color:#3D262A;border:3px solid #3D262A;border-radius:12px;box-shadow:0 4px 0 #3D262A;padding:.5rem .95rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;cursor:pointer;transition:transform .08s,box-shadow .08s}
.pp-btn:active:not(:disabled){transform:translateY(3px);box-shadow:0 1px 0 #3D262A}
.pp-btn:disabled{opacity:.45;cursor:not-allowed}
.pp-btn:focus-visible,.pp-in:focus-visible{outline:3px dashed #7A4FA3;outline-offset:2px}
.pp-btn.lav{background:#E2D4F0}.pp-btn.mint{background:#C9F0DD}.pp-btn.gold{background:#FFE9A8}.pp-btn.cream{background:#FFFDF9}
.pp-btn.sm{padding:.3rem .5rem;font-size:.8rem;border-radius:10px}
.pp-chip{display:inline-flex;align-items:center;gap:.35rem;background:#FFFDF9;border:3px solid #3D262A;border-radius:999px;padding:.15rem .65rem;font-weight:800;font-size:.85rem}
.pp-lcd{background:#FDE2E4;border:3px solid #3D262A;border-radius:14px;box-shadow:inset 0 4px 0 rgba(255,255,255,.6)}
.pp-in{background:#FFFDF9;border:3px solid #3D262A;border-radius:10px;padding:.3rem .5rem;font-weight:800;color:#3D262A;min-width:0}
.pp-bar{display:flex;gap:3px}.pp-bar i{flex:1;height:12px;background:#FFFDF9;border:2px solid #3D262A}.pp-bar i.on{background:#FFB6C1}
@keyframes pp-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pp-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes pp-pop{0%{transform:scale(.2)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes pp-zzz{0%{opacity:0;transform:translate(0,0)}30%{opacity:1}100%{opacity:0;transform:translate(10px,-22px)}}
.pp-bounce{animation:pp-bounce 1.1s steps(2,jump-none) infinite}
.pp-wobble{animation:pp-wobble 1.2s ease-in-out infinite;transform-origin:50% 90%}
.pp-pop{animation:pp-pop .5s ease-out both}
@media (prefers-reduced-motion:reduce){.pp-bounce,.pp-wobble,.pp-pop{animation:none}}
.wb-app{display:grid;grid-template-columns:auto 1fr 270px;grid-template-rows:auto 1fr;gap:12px;padding:12px;height:100vh}
.wb-head{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.wb-tools{display:flex;flex-direction:column;gap:6px;align-items:center;overflow:auto;padding:4px 6px 8px 2px}
.wb-tools,.wb-side{min-height:0}
.wb-sep{display:block;width:34px;border-top:3px dashed rgba(61,38,42,.3)}
.wb-board{user-select:none;-webkit-user-select:none;position:relative;overflow:hidden;min-height:300px;touch-action:none;background:#FFFDF9}
.wb-side{display:flex;flex-direction:column;gap:12px;overflow:auto;padding-right:4px}
.wb-sw{width:24px;height:24px;border:3px solid #3D262A;border-radius:6px;cursor:pointer;padding:0}
.wb-sw.on{box-shadow:0 0 0 3px #7A4FA3}
.wb-note{width:100%;height:100%;display:flex;flex-direction:column;border:3px solid #3D262A;border-radius:6px;box-shadow:3px 3px 0 #3D262A;box-sizing:border-box}
.wb-grip{touch-action:none;height:18px;cursor:grab;border-bottom:3px solid #3D262A;background:rgba(61,38,42,.12)}
.wb-note textarea,.wb-text textarea{user-select:text;-webkit-user-select:text;flex:1;width:100%;border:0;background:transparent;resize:none;outline:none;font:700 16px/1.35 ui-rounded,'Nunito','Segoe UI',sans-serif;color:#3D262A;caret-color:#3D262A;padding:8px;box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.wb-text{width:100%;height:100%;display:flex;flex-direction:column;border:2px dashed #3D262A;border-radius:6px;box-sizing:border-box;background:rgba(255,253,249,.92)}
.wb-resize{position:absolute;right:3px;bottom:3px;width:16px;height:16px;cursor:nwse-resize;z-index:2;touch-action:none;background:linear-gradient(135deg,transparent 0 48%,#3D262A 48% 58%,transparent 58% 72%,#3D262A 72% 82%,transparent 82%)}
.wb-sel{outline:3px dashed #7A4FA3;outline-offset:3px;border-radius:6px}
.pp-sel{filter:drop-shadow(0 0 0 #7A4FA3) drop-shadow(2px 2px 0 #7A4FA3)}
@media (max-width:820px){.wb-sep{width:0;height:30px;border-top:0;border-left:3px dashed rgba(61,38,42,.3)}.wb-app{grid-template-columns:1fr;grid-template-rows:auto auto 70vh auto;height:auto}.wb-tools{flex-direction:row;flex-wrap:wrap;justify-content:center}}
`;

/* ───────── constants & helpers ───────── */
const GS = 16; // pixel-grid cell size in world units
const SW = ["#FFB6C1", "#E2D4F0", "#C9F0DD", "#FFE9A8", "#3D262A"];
const TOOLS = [
  ["select", MousePointer2, "Select / move", "v"],
  ["hand", Hand, "Pan · or hold Space", "h"],
  [
    "pencil",
    Pencil,
    "Pencil · Shift+drag = rectangle, Shift+Alt+drag = circle",
    "p",
  ],
  [
    "marker",
    Highlighter,
    "Marker · Shift+drag = rectangle, Shift+Alt+drag = circle",
    "m",
  ],
  ["rect", Square, "Rectangle", "r"],
  ["circle", Circle, "Ellipse", "o"],
  ["sticky", StickyNote, "Sticky note", "s"],
  ["text", Type, "Text box", "t"],
  [
    "eraser",
    Eraser,
    "Eraser · drag over lines & pixels, click shapes & notes",
    "e",
  ],
];
const KEYS = [
  ["Ctrl Z", "Undo"],
  ["Ctrl Y · Ctrl Shift Z", "Redo"],
  ["Ctrl C · X · V", "Copy, cut, paste"],
  ["Ctrl D", "Duplicate"],
  ["Ctrl S", "Save now"],
  ["Delete", "Delete selected"],
  ["Arrow keys", "Nudge (Shift = 10)"],
  ["Esc", "Deselect / close"],
  ["V · H · P · M", "Select, pan, pencil, marker"],
  ["R · O · S · T · E", "Rectangle, ellipse, sticky, text, eraser"],
  ["G", "Pixel grid on / off"],
  ["[  ]", "Smaller / larger brush"],
  ["1 – 5", "Pick a color"],
  ["+  −  0", "Zoom in, out, reset"],
  ["Space", "Hold to pan"],
  ["?", "This list"],
];
const STOP = new Set(
  "the a an and or to of in on for with is are was it this that we i you be as at by".split(
    " ",
  ),
);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const norm = (d) => ({
  ...d,
  x: d.w < 0 ? d.x + d.w : d.x,
  y: d.h < 0 ? d.y + d.h : d.y,
  w: Math.abs(d.w),
  h: Math.abs(d.h),
});
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* tiny safe expression parser for auto-calc (no eval) */
function calc(src) {
  const s = src
    .replace(/(\d)\s*[x×]\s*(?=[\d(])/gi, "$1*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];
  const num = () => {
    const m = /^\d*\.?\d+/.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const prim = () => {
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw 0;
      i++;
      return v;
    }
    return num();
  };
  const un = () => {
    if (peek() === "-") {
      i++;
      return -un();
    }
    if (peek() === "+") {
      i++;
      return un();
    }
    return prim();
  };
  const pow = () => {
    const b = un();
    if (peek() === "^") {
      i++;
      return Math.pow(b, pow());
    }
    return b;
  };
  const term = () => {
    let v = pow();
    while ("*/%".includes(peek() || " ")) {
      const o = s[i++],
        r = pow();
      v = o === "*" ? v * r : o === "/" ? v / r : v % r;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const o = s[i++],
        r = term();
      v = o === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = expr();
    return i === s.length && isFinite(v) && /[+\-*/%^]/.test(s.slice(1))
      ? +v.toFixed(8)
      : null;
  } catch (e) {
    return null;
  }
}
// when the user types "=" after an expression on the current line, append the answer
function autoCalc(v, ev) {
  if (!ev || ev.inputType !== "insertText" || ev.data !== "=") return v;
  const last = v.split("\n").pop();
  const m = /([\d.()+\-*/%^x×÷\s]+)=$/.exec(last);
  const r = m ? calc(m[1]) : null;
  return r == null ? v : v + " " + r;
}
const ER = [6, 12, 22, 40]; // eraser half-sizes (world units)
const PEN = [2, 4, 7, 11],
  MARK = [8, 14, 24, 38]; // pen / highlighter stroke widths
const stamp = (cx, cy, n) => {
  const o = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      o.push([cx - Math.floor(n / 2) + i, cy - Math.floor(n / 2) + j]);
  return o;
}; // n×n pixel brush
const rid = () => Math.random().toString(36).slice(2, 9);
/* MS-Paint-style square eraser: cuts strokes and pixel cells under the square */
function hitErase(items, p, r) {
  const out = [];
  for (const it of items) {
    const ox = it.x || 0,
      oy = it.y || 0;
    if (it.type === "stroke") {
      const h = r + it.sw / 2,
        pts = [];
      it.pts.forEach((q, i) => {
        if (i) {
          const a = it.pts[i - 1],
            n = Math.ceil(Math.hypot(q.x - a.x, q.y - a.y) / 4);
          for (let k = 1; k < n; k++)
            pts.push({
              x: a.x + ((q.x - a.x) * k) / n,
              y: a.y + ((q.y - a.y) * k) / n,
            });
        }
        pts.push(q);
      });
      const inside = (q) =>
        Math.abs(q.x + ox - p.x) <= h && Math.abs(q.y + oy - p.y) <= h;
      if (!pts.some(inside)) {
        out.push(it);
        continue;
      }
      let run = [];
      const flush = () => {
        if (run.length > 1) out.push({ ...it, id: rid(), pts: run });
        run = [];
      };
      pts.forEach((q) => (inside(q) ? flush() : run.push(q)));
      flush();
    } else if (it.type === "pix") {
      const cells = it.cells.filter(
        (c) =>
          !(
            c[0] * GS + ox < p.x + r &&
            c[0] * GS + ox + GS > p.x - r &&
            c[1] * GS + oy < p.y + r &&
            c[1] * GS + oy + GS > p.y - r
          ),
      );
      if (cells.length === it.cells.length) out.push(it);
      else if (cells.length) out.push({ ...it, cells });
    } else out.push(it);
  }
  return out;
}
function bbox(it) {
  const ox = it.x || 0,
    oy = it.y || 0;
  if (it.type === "stroke") {
    const xs = it.pts.map((p) => p.x),
      ys = it.pts.map((p) => p.y);
    return [
      ox + Math.min(...xs),
      oy + Math.min(...ys),
      ox + Math.max(...xs),
      oy + Math.max(...ys),
    ];
  }
  if (it.type === "pix") {
    const xs = it.cells.map((c) => c[0] * GS),
      ys = it.cells.map((c) => c[1] * GS);
    return [
      ox + Math.min(...xs),
      oy + Math.min(...ys),
      ox + Math.max(...xs) + GS,
      oy + Math.max(...ys) + GS,
    ];
  }
  return [ox, oy, ox + (it.w || 160), oy + (it.h || 140)];
}

const bbCache = new WeakMap(); // item objects keep identity unless edited, so cache their bounds
const bboxOf = (it) => {
  let b = bbCache.get(it);
  if (!b) {
    b = bbox(it);
    bbCache.set(it, b);
  }
  return b;
};

const SvgItem = React.memo(function SvgItem({ it, cls, cur, down }) {
  const common = {
    onPointerDown: (e) => down(e, it),
    className: cls,
    style: { cursor: cur },
    transform: `translate(${it.x || 0} ${it.y || 0})`,
  };
  if (it.type === "stroke")
    return (
      <g {...common}>
        <polyline
          points={it.pts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={it.color}
          strokeWidth={it.sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={it.alpha}
        />
      </g>
    );
  if (it.type === "pix")
    return (
      <g {...common} shapeRendering="crispEdges">
        {it.cells.map((c, i) => (
          <rect
            key={i}
            x={c[0] * GS}
            y={c[1] * GS}
            width={GS}
            height={GS}
            fill={it.color}
          />
        ))}
      </g>
    );
  if (it.type === "rect")
    return (
      <g {...common}>
        <rect
          width={it.w}
          height={it.h}
          rx={8}
          fill={it.color}
          stroke="#3D262A"
          strokeWidth={3}
        />
      </g>
    );
  if (it.type === "circle")
    return (
      <g {...common}>
        <ellipse
          cx={it.w / 2}
          cy={it.h / 2}
          rx={it.w / 2}
          ry={it.h / 2}
          fill={it.color}
          stroke="#3D262A"
          strokeWidth={3}
        />
      </g>
    );
  return null; // sticky + text boxes live in the HTML layer
});

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(61,38,42,.55)" }}
      onClick={onClose}
    >
      <div
        className="pp-card p-5 w-full"
        style={{ maxWidth: 460, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="pp-pixel text-lg">{title}</h2>
          <button
            className="pp-btn cream sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────── main app ───────── */
function Whiteboard() {
  const [G, setG] = useState(load);
  const Gr = useRef(G);
  const upd = (f) => {
    const n = f(Gr.current);
    Gr.current = n;
    setG(n);
    return n;
  }; // always reads fresh state
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState(SW[0]);
  const [grid, setGrid] = useState(false);
  const [view, setView] = useState({ x: -40, y: -40, z: 1 });
  const [box, setBox] = useState({ w: 800, h: 500 });
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [er, setEr] = useState(1);
  const [clearAsk, setClearAsk] = useState(false);
  const [help, setHelp] = useState(false);
  const [space, setSpace] = useState(false);
  const [sz, setSz] = useState({ pencil: 1, marker: 1 }); // size index per drawing tool
  const [cur, setCur] = useState(null);
  const [gallery, setGallery] = useState(false);
  const [toast, setToast] = useState(null);
  const [blink, setBlink] = useState(false);
  const [mode, setMode] = useState("focus");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [task, setTask] = useState("");
  const raf = useRef(0),
    pend = useRef(null),
    newNote = useRef(null),
    svgRef = useRef(null),
    drag = useRef(null),
    hist = useRef([]),
    fut = useRef([]),
    clip = useRef(null),
    pasteN = useRef(0),
    endAt = useRef(0);
  const total = (mode === "focus" ? 25 : 5) * 60;
  const snd = G.sound;
  const lvl = Math.floor(G.xp / 100) + 1;
  const say = (msg) => setToast({ msg, id: Date.now() });
  const click = (fn) => () => {
    sfx.click(snd);
    fn && fn();
  };

  const gain = (xp, coins) =>
    upd((g) => {
      const n = { ...g, xp: g.xp + xp, coins: g.coins + coins };
      if (Math.floor(n.xp / 100) > Math.floor(g.xp / 100)) {
        sfx.up(g.sound);
        say(`Level up! You are level ${Math.floor(n.xp / 100) + 1}`);
      }
      return n;
    });
  const snapshot = () => {
    hist.current = [...hist.current.slice(-29), Gr.current.items];
    fut.current = [];
  }; // a new action clears redo
  const setItems = (f, keep) => {
    if (!keep) snapshot();
    upd((g) => ({ ...g, items: f(g.items) }));
  };
  const patch = (id, p) =>
    setItems((a) => a.map((i) => (i.id === id ? { ...i, ...p } : i)), true);

  useEffect(() => {
    const t = setTimeout(() => store.set(G), 300);
    return () => clearTimeout(t);
  }, [G]); // debounced save
  useEffect(() => {
    const f = () => store.set(Gr.current);
    window.addEventListener("pagehide", f);
    return () => window.removeEventListener("pagehide", f);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3300);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);
  useEffect(() => {
    document.title = running
      ? `${fmt(left)} · Pixel Whiteboard`
      : "Pixel Whiteboard";
  }, [running, left]);

  // timestamp-based countdown; focus time on the board earns XP + coins
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(r);
      if (r <= 0) {
        clearInterval(id);
        setRunning(false);
        setLeft(total);
        sfx.chime(snd);
        if (mode === "focus") {
          upd((g) => ({ ...g, minutes: g.minutes + 25 }));
          gain(60, 15);
          say("Focus session done! +60 XP, +15 coins");
        } else say("Break over. Back to the board!");
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, mode]);
  const start = () => {
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
  };
  const switchMode = (m) => {
    setMode(m);
    setRunning(false);
    setLeft((m === "focus" ? 25 : 5) * 60);
  };

  const undo = () => {
    const h = hist.current;
    if (!h.length) return;
    const prev = h[h.length - 1];
    fut.current = [...fut.current, Gr.current.items];
    hist.current = h.slice(0, -1);
    upd((g) => ({ ...g, items: prev }));
    setSel(null);
  };
  const redo = () => {
    const f = fut.current;
    if (!f.length) return;
    const next = f[f.length - 1];
    hist.current = [...hist.current.slice(-29), Gr.current.items];
    fut.current = f.slice(0, -1);
    upd((g) => ({ ...g, items: next }));
    setSel(null);
  };

  /* ── canvas geometry ── */
  const toW = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: view.x + (e.clientX - r.left) / view.z,
      y: view.y + (e.clientY - r.top) / view.z,
    };
  };
  const snap = (p) =>
    grid ? { x: Math.round(p.x / GS) * GS, y: Math.round(p.y / GS) * GS } : p;
  const zoomAt = (f, cx = box.w / 2, cy = box.h / 2) =>
    setView((v) => {
      const z = clamp(v.z * f, 0.25, 3);
      return { z, x: v.x + cx / v.z - cx / z, y: v.y + cy / v.z - cy / z };
    });

  const newId = () => Math.random().toString(36).slice(2, 9);
  const down = (e) => {
    if (e.target.tagName === "TEXTAREA") return;
    const p = toW(e),
      s = snap(p);
    if (tool === "hand" || space || e.button === 1) {
      drag.current = { k: "pan", sx: e.clientX, sy: e.clientY, v: view };
    } else if (tool === "select") {
      setSel(null);
    } else if (tool === "eraser") {
      snapshot();
      drag.current = { k: "erase", last: p };
      setItems((a) => hitErase(a, p, ER[er]), true);
    } else if ((tool === "pencil" || tool === "marker") && e.shiftKey) {
      setDraft({
        id: newId(),
        type: e.altKey ? "circle" : "rect",
        x: s.x,
        y: s.y,
        w: 0,
        h: 0,
        color,
      });
      drag.current = { k: "shape", s };
    } else if (tool === "pencil" || tool === "marker") {
      if (grid) {
        const n = sz[tool] + 1,
          c = [Math.floor(p.x / GS), Math.floor(p.y / GS)];
        setDraft({
          id: newId(),
          type: "pix",
          cells: stamp(c[0], c[1], n),
          n,
          last: c,
          color,
          x: 0,
          y: 0,
        });
      } else
        setDraft({
          id: newId(),
          type: "stroke",
          pts: [p],
          color: tool === "marker" ? color : "#3D262A",
          sw: tool === "marker" ? MARK[sz.marker] : PEN[sz.pencil],
          alpha: tool === "marker" ? 0.45 : 1,
          x: 0,
          y: 0,
        });
      drag.current = { k: "draw" };
    } else if (tool === "rect" || tool === "circle") {
      setDraft({ id: newId(), type: tool, x: s.x, y: s.y, w: 0, h: 0, color });
      drag.current = { k: "shape", s };
    } else if (tool === "sticky" || tool === "text") {
      const id = newId();
      setItems((a) => [
        ...a,
        tool === "sticky"
          ? {
              id,
              type: "sticky",
              x: s.x,
              y: s.y,
              w: 200,
              h: 170,
              color,
              text: "",
            }
          : { id, type: "text", x: s.x, y: s.y, w: 220, h: 64, text: "" },
      ]);
      newNote.current = id;
      sfx.pop(snd);
      setSel(id);
      setTool("select");
      return;
    }
    if (drag.current) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (tool === "eraser") setCur(toW(e));
    const d = drag.current;
    if (!d) return;
    if (d.k === "pan")
      setView({
        ...d.v,
        x: d.v.x - (e.clientX - d.sx) / d.v.z,
        y: d.v.y - (e.clientY - d.sy) / d.v.z,
      });
    else if (d.k === "move") {
      const p = toW(e);
      patch(d.id, { x: d.ox + p.x - d.px, y: d.oy + p.y - d.py });
    } else if (d.k === "resize") {
      const p = toW(e);
      let w = Math.max(120, d.ow + p.x - d.px),
        h = Math.max(d.mh, d.oh + p.y - d.py);
      if (grid) {
        w = Math.round(w / GS) * GS;
        h = Math.round(h / GS) * GS;
      }
      patch(d.id, { w, h });
    } else if (d.k === "erase") {
      const p = toW(e),
        r = ER[er],
        n = Math.max(
          1,
          Math.ceil(Math.hypot(p.x - d.last.x, p.y - d.last.y) / (r / 2)),
        );
      const pts = Array.from({ length: n }, (_, i) => ({
        x: d.last.x + ((p.x - d.last.x) * (i + 1)) / n,
        y: d.last.y + ((p.y - d.last.y) * (i + 1)) / n,
      }));
      setItems((a) => pts.reduce((o, q) => hitErase(o, q, r), a), true);
      d.last = p;
    } else if (d.k === "draw") {
      const p = toW(e);
      setDraft((dr) => {
        if (!dr) return dr;
        if (dr.type === "pix") {
          const [lx, ly] = dr.last,
            cx = Math.floor(p.x / GS),
            cy = Math.floor(p.y / GS),
            m = Math.max(Math.abs(cx - lx), Math.abs(cy - ly));
          if (!m) return dr;
          const seen = new Set(dr.cells.map((c) => c.join())),
            add = [];
          for (let i = 1; i <= m; i++)
            stamp(
              Math.round(lx + ((cx - lx) * i) / m),
              Math.round(ly + ((cy - ly) * i) / m),
              dr.n,
            ).forEach((c) => {
              const k = c.join();
              if (!seen.has(k)) {
                seen.add(k);
                add.push(c);
              }
            });
          return { ...dr, cells: [...dr.cells, ...add], last: [cx, cy] };
        }
        return { ...dr, pts: [...dr.pts, p] };
      });
    } else if (d.k === "shape") {
      const s = snap(toW(e));
      let w = s.x - d.s.x,
        h = s.y - d.s.y;
      if (e.shiftKey && (tool === "rect" || tool === "circle")) {
        const m = Math.max(Math.abs(w), Math.abs(h));
        w = (w < 0 ? -1 : 1) * m;
        h = (h < 0 ? -1 : 1) * m;
      }
      setDraft((dr) => dr && { ...dr, w, h });
    }
  };
  const onMove = (e) => {
    const k = drag.current && drag.current.k;
    if (k === "move" || k === "resize" || k === "pan") {
      // coalesce fast drags into one update per frame
      pend.current = e;
      if (!raf.current)
        raf.current = requestAnimationFrame(() => {
          raf.current = 0;
          const ev = pend.current;
          pend.current = null;
          if (ev && drag.current) move(ev);
        });
    } else move(e);
  };
  const up = () => {
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      const ev = pend.current;
      pend.current = null;
      if (ev && drag.current) move(ev);
    } // land on the final position
    const d = drag.current;
    drag.current = null;
    if (d && d.k === "draw" && draft) setItems((a) => [...a, draft]);
    if (
      d &&
      d.k === "shape" &&
      draft &&
      (Math.abs(draft.w) > 4 || Math.abs(draft.h) > 4)
    )
      setItems((a) => [...a, norm(draft)]);
    if (d && (d.k === "draw" || d.k === "shape")) sfx.pop(snd);
    setDraft(null);
  };
  const itemDown = (it) => (e) => {
    if (space) return; // Space held: let the canvas pan instead
    if (tool === "eraser") {
      if (it.type === "stroke" || it.type === "pix") return; // bubbles up to the canvas: pixel-erase
      e.stopPropagation();
      setItems((a) => a.filter((i) => i.id !== it.id));
      sfx.click(snd);
      return;
    }
    if (tool !== "select") return;
    e.stopPropagation();
    setSel(it.id);
    const p = toW(e);
    snapshot();
    drag.current = {
      k: "move",
      id: it.id,
      px: p.x,
      py: p.y,
      ox: it.x || 0,
      oy: it.y || 0,
    };
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const resizeDown = (it) => (e) => {
    e.stopPropagation();
    setSel(it.id);
    const p = toW(e);
    snapshot();
    drag.current = {
      k: "resize",
      id: it.id,
      px: p.x,
      py: p.y,
      ow: it.w,
      oh: it.h,
      mh: it.type === "text" ? 56 : 90,
    };
    svgRef.current.setPointerCapture(e.pointerId);
  };

  /* ── smart sticky summary: top keywords across all notes ── */
  const summarize = () => {
    const notes = G.items.filter(
      (i) => i.type === "sticky" && !i.summary && i.text.trim(),
    );
    if (!notes.length) return say("Write something on a sticky note first!");
    const words = (t) => [
      ...new Set(
        (t.toLowerCase().match(/[a-z0-9']{3,}/g) || []).filter(
          (w) => !STOP.has(w),
        ),
      ),
    ];
    const freq = {};
    notes.forEach((n) =>
      words(n.text).forEach((w) => (freq[w] = (freq[w] || 0) + 1)),
    );
    const groups = {}; // cluster notes under their most-shared keyword
    notes.forEach((n) => {
      const best = words(n.text).sort((a, b) => freq[b] - freq[a])[0];
      const k = best && freq[best] > 1 ? best : "other";
      (groups[k] = groups[k] || []).push(n);
    });
    const clip = (t) => {
      const l = t.trim().split("\n")[0];
      return l.length > 24 ? l.slice(0, 23) + "…" : l;
    };
    const lines = [`SUMMARY · ${notes.length} NOTES`];
    Object.entries(groups).forEach(([k, g]) => {
      lines.push("", `${k.toUpperCase()} (${g.length})`);
      g.slice(0, 4).forEach((n) => lines.push(`• ${clip(n.text)}`));
      if (g.length > 4) lines.push(`+${g.length - 4} more`);
    });
    const text = lines.join("\n"),
      h = clamp(40 + lines.length * 24, 170, 520);
    const bs = notes.map(bbox),
      x = Math.max(...bs.map((b) => b[2])) + 30,
      y = Math.min(...bs.map((b) => b[1]));
    const old = G.items.find((i) => i.summary);
    if (old)
      setItems((a) =>
        a.map((i) => (i.id === old.id ? { ...i, text, h, x, y } : i)),
      );
    else
      setItems((a) => [
        ...a,
        {
          id: newId(),
          type: "sticky",
          summary: true,
          x,
          y,
          w: 240,
          h,
          color: "#FFE9A8",
          text,
        },
      ]);
    setView((v) => ({
      ...v,
      x: x + 120 - box.w / v.z / 2,
      y: y + h / 2 - box.h / v.z / 2,
    }));
    sfx.chime(snd);
    gain(5, 2);
  };

  /* ── tasks ── */
  const addTask = () => {
    if (!task.trim()) return;
    upd((g) => ({
      ...g,
      tasks: [...g.tasks, { id: newId(), t: task.trim(), done: false }],
    }));
    setTask("");
    sfx.click(snd);
  };
  const toggle = (id) => {
    const t = G.tasks.find((x) => x.id === id);
    const reward = !t.done && !t.paid; // each task pays out only once, however often it is re-checked
    upd((g) => ({
      ...g,
      tasks: g.tasks.map((x) =>
        x.id === id ? { ...x, done: !x.done, paid: x.paid || !x.done } : x,
      ),
    }));
    if (reward) {
      sfx.chime(snd);
      gain(10, 5);
      say("Task done! +10 XP, +5 coins");
    } else sfx.click(snd);
  };

  /* ── pets ── */
  const unlock = (p) => {
    if (G.coins < p.cost) return;
    sfx.up(snd);
    upd((g) => ({
      ...g,
      coins: g.coins - p.cost,
      pets: { ...g.pets, [p.id]: { level: 1 } },
      active: p.id,
    }));
  };
  const levelUp = (id) => {
    const c = 25 * G.pets[id].level;
    if (G.coins < c || G.pets[id].level >= 10) return;
    sfx.up(snd);
    upd((g) => ({
      ...g,
      coins: g.coins - c,
      pets: { ...g.pets, [id]: { level: g.pets[id].level + 1 } },
    }));
  };
  const buddy = PETS.find((p) => p.id === G.active) || PETS[0];

  /* ── mini-map ── */
  const mm = useMemo(() => {
    const vb = [
      view.x,
      view.y,
      view.x + box.w / view.z,
      view.y + box.h / view.z,
    ];
    const bs = G.items.map(bboxOf),
      all = [vb, ...bs];
    const x0 = Math.min(...all.map((b) => b[0])) - 20,
      y0 = Math.min(...all.map((b) => b[1])) - 20;
    const x1 = Math.max(...all.map((b) => b[2])) + 20,
      y1 = Math.max(...all.map((b) => b[3])) + 20;
    return { vb, bs, x0, y0, w: x1 - x0, h: y1 - y0 };
  }, [G.items, view, box]);
  const mmClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect(),
      s = Math.max(mm.w / r.width, mm.h / r.height);
    const ox = (r.width - mm.w / s) / 2,
      oy = (r.height - mm.h / s) / 2;
    setView((v) => ({
      ...v,
      x: mm.x0 + (e.clientX - r.left - ox) * s - box.w / v.z / 2,
      y: mm.y0 + (e.clientY - r.top - oy) * s - box.h / v.z / 2,
    }));
  };

  const itemDownRef = useRef(null);
  itemDownRef.current = itemDown;
  const sd = useMemo(() => (e, it) => itemDownRef.current(it)(e), []); // stable handler so SvgItem can stay memoized

  /* sticky notes / text boxes: real HTML (not scaled SVG), so text stays sharp */
  const noteLayer = G.items
    .filter((i) => i.type === "sticky" || i.type === "text")
    .map((it) => {
      const sticky = it.type === "sticky";
      return (
        <div
          key={it.id}
          className={sel === it.id ? "wb-sel" : ""}
          onPointerDown={tool === "eraser" ? itemDown(it) : undefined}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${it.x}px, ${it.y}px)`,
            width: it.w,
            height: it.h,
            pointerEvents:
              !space && (tool === "select" || tool === "eraser")
                ? "auto"
                : "none",
          }}
        >
          <div
            className={sticky ? "wb-note" : "wb-text"}
            style={sticky ? { background: it.color } : undefined}
          >
            <div className="wb-grip" onPointerDown={itemDown(it)} />
            <textarea
              value={it.text}
              ref={(el) => {
                if (el && newNote.current === it.id) {
                  newNote.current = null;
                  el.focus();
                }
              }}
              spellCheck={false}
              onChange={(e) => {
                const t = e.target,
                  nv = autoCalc(t.value, e.nativeEvent),
                  extra = t.scrollHeight - t.clientHeight; // grow the note when text overflows
                if (nv !== t.value) sfx.pop(snd);
                patch(
                  it.id,
                  extra > 0 ? { text: nv, h: it.h + extra } : { text: nv },
                );
              }}
              onFocus={() => setSel(it.id)}
            />
            <div
              className="wb-resize"
              title="Drag to resize"
              onPointerDown={resizeDown(it)}
            />
          </div>
        </div>
      );
    });
  /* ── clipboard actions (selected item) ── */
  const copy = (cut) => {
    const it = G.items.find((i) => i.id === sel);
    if (!it) return;
    clip.current = JSON.parse(JSON.stringify(it));
    pasteN.current = 0;
    sfx.click(snd);
    if (cut) {
      setItems((a) => a.filter((i) => i.id !== sel));
      setSel(null);
    }
  };
  const paste = () => {
    if (!clip.current) return;
    pasteN.current += 1;
    const d = (grid ? GS : 20) * pasteN.current,
      c = JSON.parse(JSON.stringify(clip.current));
    delete c.summary;
    const it = { ...c, id: newId(), x: (c.x || 0) + d, y: (c.y || 0) + d };
    setItems((a) => [...a, it]);
    setSel(it.id);
    sfx.pop(snd);
  };
  const bump = (d) => {
    if (tool === "eraser") setEr((v) => clamp(v + d, 0, 3));
    else if (tool === "pencil" || tool === "marker")
      setSz((z) => ({ ...z, [tool]: clamp(z[tool] + d, 0, 3) }));
  };

  /* ── keyboard shortcuts (ignored while typing in a note or input) ── */
  useEffect(() => {
    const typing = (t) =>
      /^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName) || t.isContentEditable;
    const kd = (e) => {
      if (e.isComposing) return;
      const key = e.key.toLowerCase(),
        mod = e.ctrlKey || e.metaKey;
      if (key === "escape") {
        if (clearAsk || gallery || help) {
          setClearAsk(false);
          setGallery(false);
          setHelp(false);
        } else {
          setSel(null);
          setDraft(null);
          drag.current = null;
          if (document.activeElement && document.activeElement.blur)
            document.activeElement.blur();
        }
        return;
      }
      if (typing(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      if (clearAsk || gallery || help) return;
      if (mod) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          e.preventDefault();
          redo();
        } else if (key === "c") copy(false);
        else if (key === "x") {
          if (sel) {
            e.preventDefault();
            copy(true);
          }
        } else if (key === "v") {
          if (clip.current) {
            e.preventDefault();
            paste();
          }
        } else if (key === "d") {
          e.preventDefault();
          copy(false);
          paste();
        } else if (key === "s") {
          e.preventDefault();
          store.set(Gr.current);
          say("Saved");
        }
        return;
      }
      if (key === " ") {
        e.preventDefault();
        if (
          document.activeElement &&
          document.activeElement.tagName === "BUTTON"
        )
          document.activeElement.blur();
        if (!e.repeat) setSpace(true);
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (sel) {
          e.preventDefault();
          setItems((a) => a.filter((i) => i.id !== sel));
          setSel(null);
        }
        return;
      }
      if (key.startsWith("arrow")) {
        const it = sel && Gr.current.items.find((i) => i.id === sel);
        if (!it) return;
        e.preventDefault();
        const st = e.shiftKey ? 10 : grid ? GS : 1;
        if (!e.repeat) snapshot();
        patch(sel, {
          x:
            (it.x || 0) +
            (key === "arrowleft" ? -st : key === "arrowright" ? st : 0),
          y:
            (it.y || 0) +
            (key === "arrowup" ? -st : key === "arrowdown" ? st : 0),
        });
        return;
      }
      const t = TOOLS.find((x) => x[3] === key);
      if (t) {
        setTool(t[0]);
        sfx.click(snd);
      } else if (key === "g") {
        setGrid((g) => !g);
        sfx.click(snd);
      } else if (key === "[") bump(-1);
      else if (key === "]") bump(1);
      else if (key === "+" || key === "=") zoomAt(1.2);
      else if (key === "-") zoomAt(1 / 1.2);
      else if (key === "0") setView({ x: -40, y: -40, z: 1 });
      else if (/^[1-5]$/.test(key)) setColor(SW[+key - 1]);
    };
    const ku = (e) => {
      if (e.key === " ") setSpace(false);
    };
    const bl = () => setSpace(false);
    // pasting plain text (when no board item was copied) creates a sticky note
    const pe = (e) => {
      if (typing(e.target) || clip.current) return;
      const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
      if (!text.trim()) return;
      e.preventDefault();
      const id = newId();
      setItems((a) => [
        ...a,
        {
          id,
          type: "sticky",
          x: view.x + box.w / 2 / view.z - 100,
          y: view.y + box.h / 2 / view.z - 85,
          w: 200,
          h: 170,
          color,
          text: text.slice(0, 600),
        },
      ]);
      setSel(id);
      sfx.pop(snd);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", bl);
    window.addEventListener("paste", pe);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", bl);
      window.removeEventListener("paste", pe);
    };
  });

  const done = G.tasks.filter((t) => t.done).length;

  return (
    <div className="pp-root">
      <style>{CSS}</style>
      <div className="wb-app">
        <header className="wb-head">
          <h1 className="pp-pixel text-xl">PIXEL WHITEBOARD</h1>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="pp-chip">
              <Sparkles size={14} />
              Lv {lvl} · {G.xp % 100}/100
            </span>
            <span className="pp-chip">
              <Coins size={14} />
              {G.coins}
            </span>
            <button
              className="pp-btn sm cream"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
              onClick={click(() => setHelp(true))}
            >
              <Keyboard size={14} />
            </button>
            <button
              className="pp-btn sm lav"
              disabled={!G.items.length}
              onClick={click(() => setClearAsk(true))}
            >
              <Trash2 size={14} />
              Clear all
            </button>
            <button
              className="pp-btn sm gold"
              onClick={click(() => setGallery(true))}
            >
              <Trophy size={14} />
              Pets
            </button>
            <button
              className="pp-btn sm cream"
              aria-label="Toggle sound"
              onClick={() => {
                upd((g) => ({ ...g, sound: !g.sound }));
                sfx.click(!snd);
              }}
            >
              {snd ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        </header>

        <nav className="wb-tools" aria-label="Tools">
          {TOOLS.map(([id, Ic, label, hk]) => (
            <button
              key={id}
              title={`${label} (${hk.toUpperCase()})`}
              aria-label={label}
              className={`pp-btn sm ${tool === id ? "gold" : "cream"}`}
              onClick={click(() => setTool(id))}
            >
              <Ic size={18} />
            </button>
          ))}
          <i className="wb-sep" />
          {["eraser", "pencil", "marker"].includes(tool) && (
            <div
              className="flex flex-wrap gap-1 justify-center"
              style={{ maxWidth: 64 }}
            >
              {ER.map((_, i) => {
                const on = (tool === "eraser" ? er : sz[tool]) === i,
                  d = 4 + i * 3;
                return (
                  <button
                    key={i}
                    aria-label={`${tool} size ${i + 1}`}
                    className={`pp-btn sm ${on ? "gold" : "cream"}`}
                    style={{ width: 28, height: 28, padding: 0 }}
                    onClick={click(() =>
                      tool === "eraser"
                        ? setEr(i)
                        : setSz((z) => ({ ...z, [tool]: i })),
                    )}
                  >
                    <span
                      style={{
                        display: "block",
                        width: d,
                        height: d,
                        borderRadius: tool === "eraser" ? 0 : "50%",
                        background: tool === "marker" ? color : "#3D262A",
                        border:
                          tool === "marker" ? "2px solid #3D262A" : "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
          <div
            className="flex flex-wrap gap-1 justify-center"
            style={{ maxWidth: 64 }}
          >
            {SW.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                className={`wb-sw ${color === c ? "on" : ""}`}
                style={{ background: c }}
                onClick={click(() => setColor(c))}
              />
            ))}
          </div>
          <i className="wb-sep" />
          <button
            title="Pixel grid mode"
            aria-label="Pixel grid mode"
            className={`pp-btn sm ${grid ? "mint" : "cream"}`}
            onClick={click(() => setGrid(!grid))}
          >
            <Grid3x3 size={18} />
          </button>
          <button
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="pp-btn sm cream"
            onClick={click(undo)}
          >
            <Undo2 size={18} />
          </button>
          <button
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className="pp-btn sm cream"
            onClick={click(redo)}
          >
            <Redo2 size={18} />
          </button>
          <button
            title="Delete selected"
            aria-label="Delete selected"
            className="pp-btn sm lav"
            disabled={!sel}
            onClick={click(() => {
              setItems((a) => a.filter((i) => i.id !== sel));
              setSel(null);
            })}
          >
            <Trash2 size={18} />
          </button>
          <button
            title="Summarize sticky notes"
            aria-label="Summarize notes"
            className="pp-btn sm pink"
            onClick={summarize}
          >
            <Sparkles size={18} />
          </button>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            className="pp-btn sm cream"
            onClick={click(() => zoomAt(1.2))}
          >
            <ZoomIn size={18} />
          </button>
          <button
            title="Zoom out"
            aria-label="Zoom out"
            className="pp-btn sm cream"
            onClick={click(() => zoomAt(1 / 1.2))}
          >
            <ZoomOut size={18} />
          </button>
        </nav>

        <main className="pp-card wb-board">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${view.x} ${view.y} ${box.w / view.z} ${box.h / view.z}`}
            style={{
              display: "block",
              cursor:
                tool === "hand" || space
                  ? "grab"
                  : tool === "select"
                    ? "default"
                    : tool === "eraser"
                      ? "none"
                      : "crosshair",
            }}
            onPointerLeave={() => setCur(null)}
            onPointerDown={down}
            onPointerMove={onMove}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <defs>
              <pattern
                id="dots"
                width={grid ? GS : 32}
                height={grid ? GS : 32}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width={grid ? 1.5 : 2}
                  height={grid ? 1.5 : 2}
                  fill={grid ? "#3D262A" : "#E8C5CB"}
                />
              </pattern>
            </defs>
            <rect
              x={view.x}
              y={view.y}
              width={box.w / view.z}
              height={box.h / view.z}
              fill="url(#dots)"
            />
            {G.items.map((it) => (
              <SvgItem
                key={it.id}
                it={it}
                cls={sel === it.id ? "pp-sel" : ""}
                cur={
                  tool === "eraser"
                    ? "none"
                    : tool === "select"
                      ? "move"
                      : "inherit"
                }
                down={sd}
              />
            ))}
            {draft && draft.type === "pix" && (
              <g shapeRendering="crispEdges">
                {draft.cells.map((c, i) => (
                  <rect
                    key={i}
                    x={c[0] * GS}
                    y={c[1] * GS}
                    width={GS}
                    height={GS}
                    fill={draft.color}
                  />
                ))}
              </g>
            )}
            {draft && draft.type === "stroke" && (
              <polyline
                points={draft.pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={draft.color}
                strokeWidth={draft.sw}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={draft.alpha}
              />
            )}
            {draft &&
              draft.type === "rect" &&
              (() => {
                const d = norm(draft);
                return (
                  <rect
                    x={d.x}
                    y={d.y}
                    width={d.w}
                    height={d.h}
                    rx={8}
                    fill={d.color}
                    stroke="#3D262A"
                    strokeWidth={3}
                  />
                );
              })()}
            {draft &&
              draft.type === "circle" &&
              (() => {
                const d = norm(draft);
                return (
                  <ellipse
                    cx={d.x + d.w / 2}
                    cy={d.y + d.h / 2}
                    rx={d.w / 2}
                    ry={d.h / 2}
                    fill={d.color}
                    stroke="#3D262A"
                    strokeWidth={3}
                  />
                );
              })()}
            {tool === "eraser" && cur && (
              <rect
                x={cur.x - ER[er]}
                y={cur.y - ER[er]}
                width={ER[er] * 2}
                height={ER[er] * 2}
                fill="#FFFDF9"
                stroke="#3D262A"
                strokeWidth={2 / view.z}
                pointerEvents="none"
              />
            )}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transformOrigin: "0 0",
                transform: `scale(${view.z}) translate(${-view.x}px, ${-view.y}px)`,
              }}
            >
              {noteLayer}
            </div>
          </div>

          {/* mini-map */}
          <div
            className="pp-card"
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              width: 140,
              height: 92,
              boxShadow: "3px 3px 0 #3D262A",
              overflow: "hidden",
              background: "#FDE2E4",
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`${mm.x0} ${mm.y0} ${mm.w} ${mm.h}`}
              preserveAspectRatio="xMidYMid meet"
              onClick={mmClick}
              style={{ cursor: "pointer", display: "block" }}
              shapeRendering="crispEdges"
            >
              {mm.bs.map((b, i) => (
                <rect
                  key={i}
                  x={b[0]}
                  y={b[1]}
                  width={b[2] - b[0]}
                  height={b[3] - b[1]}
                  fill="#FFB6C1"
                  stroke="#3D262A"
                  strokeWidth={Math.max(mm.w, mm.h) / 90}
                />
              ))}
              <rect
                x={mm.vb[0]}
                y={mm.vb[1]}
                width={mm.vb[2] - mm.vb[0]}
                height={mm.vb[3] - mm.vb[1]}
                fill="rgba(255,255,255,.35)"
                stroke="#7A4FA3"
                strokeWidth={Math.max(mm.w, mm.h) / 50}
              />
            </svg>
          </div>

          {/* companion pet */}
          <div
            style={{
              position: "absolute",
              left: 10,
              bottom: 6,
              pointerEvents: "none",
            }}
          >
            {!running && (
              <span
                className="pp-pixel"
                style={{
                  position: "absolute",
                  left: 60,
                  top: 0,
                  fontSize: 14,
                  animation: "pp-zzz 2.4s ease-out infinite",
                }}
              >
                Zzz
              </span>
            )}
            <div className={running ? "pp-bounce" : ""}>
              <Sprite
                pet={buddy}
                lvl={G.pets[buddy.id]?.level}
                size={64}
                blink={!running || blink}
              />
            </div>
          </div>
        </main>

        <aside className="wb-side">
          <section className="pp-card p-4">
            <div className="flex gap-2 mb-3">
              <button
                className={`pp-btn sm ${mode === "focus" ? "pink" : "cream"}`}
                onClick={click(() => switchMode("focus"))}
              >
                Focus 25
              </button>
              <button
                className={`pp-btn sm ${mode === "break" ? "mint" : "cream"}`}
                onClick={click(() => switchMode("break"))}
              >
                Break 5
              </button>
            </div>
            <div className="pp-lcd text-center py-3 mb-3">
              <span className="pp-pixel" style={{ fontSize: 40 }}>
                {fmt(left)}
              </span>
            </div>
            <div className="pp-bar mb-3" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <i
                  key={i}
                  className={
                    i < Math.round((1 - left / total) * 20) ? "on" : ""
                  }
                />
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              {running ? (
                <button
                  className="pp-btn lav"
                  onClick={click(() => {
                    setLeft(
                      Math.max(
                        1,
                        Math.ceil((endAt.current - Date.now()) / 1000),
                      ),
                    );
                    setRunning(false);
                  })}
                >
                  <Pause size={16} />
                  Pause
                </button>
              ) : (
                <button className="pp-btn mint" onClick={click(start)}>
                  <Play size={16} />
                  {left < total ? "Resume" : "Start"}
                </button>
              )}
              <button
                className="pp-btn cream"
                disabled={left === total && !running}
                onClick={click(() => {
                  setRunning(false);
                  setLeft(total);
                })}
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <p
              className="text-xs font-bold text-center"
              style={{ opacity: 0.7, marginTop: 16 }}
            >
              {G.minutes} min focused in total
            </p>
          </section>

          <section className="pp-card p-4">
            <h2 className="pp-pixel mb-2">
              TASKS {done}/{G.tasks.length}
            </h2>
            <div className="flex gap-2 mb-2">
              <input
                className="pp-in flex-1"
                value={task}
                aria-label="New task"
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <button
                className="pp-btn sm gold"
                aria-label="Add task"
                onClick={addTask}
              >
                <Plus size={16} />
              </button>
            </div>
            <ul
              style={{ listStyle: "none", padding: 0, margin: 0 }}
              className="flex flex-col gap-2"
            >
              {G.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <button
                    className={`pp-btn sm ${t.done ? "mint" : "cream"}`}
                    aria-label={t.done ? "Mark not done" : "Mark done"}
                    onClick={() => toggle(t.id)}
                    style={{ width: 30, height: 30, padding: 0 }}
                  >
                    {t.done && <Check size={14} />}
                  </button>
                  <span
                    className="flex-1 text-sm font-bold"
                    style={{
                      textDecoration: t.done ? "line-through" : "none",
                      opacity: t.done ? 0.55 : 1,
                    }}
                  >
                    {t.t}
                  </span>
                  <button
                    className="pp-btn sm cream"
                    aria-label="Remove task"
                    onClick={click(() =>
                      upd((g) => ({
                        ...g,
                        tasks: g.tasks.filter((x) => x.id !== t.id),
                      })),
                    )}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 20,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 70,
          }}
        >
          <div
            className="pp-card pp-pop px-4 py-2 font-black text-sm"
            style={{ background: "#FFE9A8" }}
            role="status"
          >
            {toast.msg}
          </div>
        </div>
      )}

      {help && (
        <Modal title="Keyboard shortcuts" onClose={() => setHelp(false)}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "10px 14px",
              alignItems: "center",
            }}
          >
            {KEYS.map(([k, d]) => (
              <React.Fragment key={k}>
                <span
                  className="pp-chip pp-pixel"
                  style={{
                    justifySelf: "start",
                    fontSize: ".72rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {k}
                </span>
                <span className="text-sm font-bold">{d}</span>
              </React.Fragment>
            ))}
          </div>
        </Modal>
      )}

      {clearAsk && (
        <Modal title="Delete everything?" onClose={() => setClearAsk(false)}>
          <p className="text-sm font-bold mb-3" style={{ marginBottom: 16 }}>
            All drawings, shapes and notes on the board will be removed.
          </p>
          <div className="flex gap-2">
            <button
              className="pp-btn lav"
              onClick={() => {
                setItems(() => []);
                setSel(null);
                setDraft(null);
                setView({ x: -40, y: -40, z: 1 });
                setClearAsk(false);
                sfx.pop(snd);
                say("Board cleared");
              }}
            >
              <Trash2 size={16} />
              Delete all
            </button>
            <button
              className="pp-btn cream"
              onClick={click(() => setClearAsk(false))}
            >
              Keep
            </button>
          </div>
        </Modal>
      )}

      {gallery && (
        <Modal title="Companion Gallery" onClose={() => setGallery(false)}>
          <p
            className="text-sm font-bold"
            style={{ marginBottom: 16, lineHeight: 1.45 }}
          >
            Spend coins to unlock buddies and level them up. They sit beside
            your board and nap when the timer is idle.
          </p>
          <div className="flex flex-col gap-3">
            {PETS.map((p) => {
              const d = G.pets[p.id],
                isA = G.active === p.id;
              return (
                <div
                  key={p.id}
                  className="pp-card p-3 flex items-center gap-3"
                  style={{ background: d ? "#FFFDF9" : "#FDE2E4" }}
                >
                  <div className={isA ? "pp-bounce" : ""}>
                    <Sprite pet={p} lvl={d?.level} size={64} dim={!d} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black flex items-center gap-1">
                      {d ? p.name : "Locked"}
                      {isA && <Heart size={14} fill="#FF8FAB" />}
                    </p>
                    {d ? (
                      <>
                        <p className="text-xs font-bold">
                          Lv {d.level}/10{d.level >= 5 ? " · Ribbon form" : ""}
                        </p>
                        <div className="pp-bar my-1" aria-hidden="true">
                          {Array.from({ length: 10 }, (_, i) => (
                            <i key={i} className={i < d.level ? "on" : ""} />
                          ))}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            className="pp-btn sm gold"
                            disabled={d.level >= 10 || G.coins < 25 * d.level}
                            onClick={() => levelUp(p.id)}
                          >
                            <Coins size={12} />
                            {d.level >= 10 ? "Max" : 25 * d.level}
                          </button>
                          <button
                            className="pp-btn sm mint"
                            disabled={isA}
                            onClick={click(() =>
                              upd((g) => ({ ...g, active: p.id })),
                            )}
                          >
                            {isA ? "Active" : "Make buddy"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        className="pp-btn sm gold mt-1"
                        disabled={G.coins < p.cost}
                        onClick={() => unlock(p)}
                      >
                        <Coins size={12} />
                        Unlock {p.cost}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* if saved data is ever corrupted, offer a clean restart instead of a blank page */
class Boundary extends React.Component {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="pp-root">
        <style>{CSS}</style>
        <div
          className="pp-card p-5 text-center"
          style={{ maxWidth: 340, margin: "20vh auto 0" }}
        >
          <h2 className="pp-pixel text-lg mb-3">OOPS!</h2>
          <button
            className="pp-btn"
            onClick={() => {
              store.set(null);
              window.location.reload();
            }}
          >
            Reset &amp; reload
          </button>
        </div>
      </div>
    );
  }
}
export default function PixelSmartWhiteboard() {
  return (
    <Boundary>
      <Whiteboard />
    </Boundary>
  );
}
