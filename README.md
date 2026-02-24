# CityBlocks 🌾

A visual, node-based farming simulation game built with React, Three.js, and Electron.

## What is it?

CityBlocks is a programming game where you control a drone that farms a grid of tiles. Instead of writing raw code, you build programs visually using **snap blocks** — drag-and-drop style blocks that stack into sequences, just like Scratch.

You can plant crops, wait for them to grow, harvest them, and use the wheat to expand your farm. The twist: you program the drone's behavior yourself using the block editor.

## Features

- **Visual Block Editor** — Build programs by snapping blocks together. No typing required.
- **Built-in Blocks** — `plant`, `harvest`, `move`, `wait`, `bag`, `repeat`, `while`
- **Loop Blocks** — `repeat N times` and `while condition` blocks with nested body areas
- **Custom Blocks** — Write raw code, give it a name and color, and it becomes a reusable block in your palette
- **Routine Cards** — Break your program into named subroutines, each with its own block canvas
- **3D Farm Scene** — Watch your drone move around and farm in real time using Three.js
- **Expandable Farm** — Earn wheat and spend it to unlock new tiles in any direction

## How to Play

1. Open the **main** card and build your program using snap blocks
2. Use `+ farm_tile` to call your farming routine
3. Hit **▶ RUN** to watch the drone execute your program
4. Use **■ STOP** to stop at any time
5. Earn wheat → spend it on new tiles using the arrow buttons (top right)

### Block Types

| Block | Description |
|-------|-------------|
| 🌱 plant | Plant wheat on the current tile |
| 🌾 harvest | Wait for crop to be ready, then harvest |
| ➡️ move | Move the drone in a direction (up/down/left/right) |
| 🎒 bag | Log the current bag contents |
| ⏱ wait | Pause for N seconds |
| 🔄 repeat | Repeat the nested blocks N times |
| 🔁 while | Loop the nested blocks while a condition is true |
| 📦 custom | Call a custom block you defined |

### Custom Blocks

Click **+ custom block** in any card footer to define a new block:
- Give it a name and color
- Write the code body (supports all built-in commands)
- It instantly appears as a reusable block in every card's palette

## Tech Stack

- **React** — UI and block editor
- **Three.js / React Three Fiber** — 3D farm scene
- **Zustand** — Game state management
- **Electron** — Desktop app wrapper
- **Vite** — Build tooling

## Getting Started

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches the Electron window.

To build a distributable:

```bash
npm run build
npm run electron
```

## Controls

- **C** — Toggle the block editor panels on/off
- **▶ RUN** — Execute your program
- **■ STOP** — Stop execution
- **Arrow buttons (HUD)** — Buy new farm tiles (costs 3 wheat each)
