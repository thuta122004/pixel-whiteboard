# Pixel Smart Whiteboard 🎨🐣

**Pixel Smart Whiteboard** is a cozy, retro-styled React productivity web application that combines an infinite, feature-rich pixel art canvas with a gamified Pomodoro timer, task manager, and collectible companion pets. Draw, sketch, write notes, calculate math inline, manage tasks, and earn rewards alongside your adorable pixel buddy—all accompanied by synthesized 8-bit sound effects.

---

## ✨ Features

* **Infinite Interactive Canvas:** Pan, zoom, and draw on a retro canvas complete with an optional pixel grid, mini-map navigator, and precise MS-Paint-style eraser support.
* **Rich Drawing & Formatting Tools:** Choose between a pencil (with pixel grid snapping support), a semi-transparent highlighter, custom shapes (rectangles, ellipses), sticky notes, and text boxes.
* **Smart Sticky Notes & Auto-Calc:** Type equations ending with `=` on sticky notes or text boxes for automatic calculations, and instantly summarize your notes using keyword analysis.
* **Gamified Pomodoro Timer:** Focus with built-in work blocks (25m) and breaks (5m) to earn XP and coins.
* **Integrated Task Manager:** Track your daily tasks, check them off to earn XP and coins, and keep your workflow organized.
* **Pet Collection & Evolution:** Collect pixel pets (Pink Slime, Pixel Bunny, Strawberry Ghost), level them up with coins, and unlock ribbon and special forms as they grow.
* **Synthesized 8-Bit Audio:** Fully custom Web Audio API-synthesized sound effects for clicks, pops, chimes, and level-ups—no external audio files required.
* **Persistence:** Automatically saves your board state, pet progress, and tasks using local storage with an in-memory fallback.

---

## 🛠️ Tech Stack

* **React** (Hooks: `useState`, `useEffect`, `useRef`, `useMemo`, Error Boundaries)
* **Tailwind CSS** (Utility styling layered with custom pixel-art and retro animations)
* **Lucide React** (UI Icons)
* **SVG & HTML5 Canvas** (Crisp, scalable pixel art rendering using pixelated CSS rules)
* **Web Audio API** (Procedural sound generation)

---

## 🚀 Quick Start / Installation

Because this project is built as a self-contained React component (`Pixelsmartwhiteboard.jsx`), you can drop it directly into any modern React project (such as a Vite or Next.js app) that has Tailwind CSS and `lucide-react` installed.

### 1. Prerequisites

Ensure you have Node.js installed, along with a React project initialized with Tailwind CSS.

### 2. Install Dependencies

Install the required icon library if you haven't already:

```bash
npm install lucide-react

```

### 3. Add the Component

Place `Pixelsmartwhiteboard.jsx` into your components directory (e.g., `src/components/Pixelsmartwhiteboard.jsx`) and import it into your main application entry point (`App.jsx`):

```jsx
import React from "react";
import PixelSmartWhiteboard from "./components/Pixelsmartwhiteboard";

export default function App() {
  return <PixelSmartWhiteboard />;
}

```

### 4. Run the Development Server

```bash
npm run dev

```

---

## 🕹️ How to Use

1. **Draw & Plan:** Pick a drawing tool (pencil, marker, shapes) or create sticky notes to jot down ideas. Use **Shift + drag** to easily constrain shapes like squares and circles.
2. **Auto-Calculate & Summarize:** Type math expressions (e.g., `12 * 4 =`) inside notes to get instant answers, or click the **Sparkles** tool to generate a keyword summary of all your notes.
3. **Focus & Earn:** Use the built-in Pomodoro timer to focus for 25 minutes, completing work sessions to earn XP and coins.
4. **Manage Tasks:** Add and check off daily items in the task list to secure bonus rewards.
5. **Collect & Level Pets:** Open the **Pets Gallery** to unlock and level up your companion buddies so they can nap or cheer you on while you work.