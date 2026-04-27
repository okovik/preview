# Ambient Forge

Ambient Forge is a local single-page prompt library manager for fantasy ambient YouTube production.

## Stack
- Vite
- React
- TypeScript
- Tailwind CSS
- Local-only storage (`themes.ts` + `localStorage`)

## Quick start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Open:
   - `http://localhost:5173/`
   - or the exact URL printed in terminal.

## If it does not open in browser
Most often this happens for one of these reasons:

1. **You opened `index.html` directly as a file** (`file:///.../index.html`).  
   Vite apps must run through the dev server, not by opening the file directly.

2. **Dependencies were not installed** (`node_modules` missing).  
   Run:
   ```bash
   npm install
   ```

3. **Port 5173 is busy**.  
   Run on another port:
   ```bash
   npm run dev -- --port 5174
   ```

4. **Dev server is bound to localhost only (WSL/Docker/remote machine)**.  
   Run with host enabled:
   ```bash
   npm run dev -- --host
   ```
   Then open the URL shown in terminal.

5. **Node.js version is too old**.  
   Check:
   ```bash
   node -v
   ```
   Recommended: Node 18+ (preferably 20+).

## Build
```bash
npm run build
npm run preview
```
