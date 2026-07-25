# Logic Runner // Winter Mute

A self-contained cyberpunk programming puzzle game.

This edition includes the complete game source, both image assets, generated
sound/music logic, and a standard Next.js static-export configuration. It does
not need a database, server API, secret key, or separate audio file.

## Fastest local start on Windows

1. Install the LTS edition of Node.js from <https://nodejs.org/>.
2. Double-click `START_LOCAL_WINDOWS.bat`.
3. Your browser opens at <http://localhost:3000>.
4. Keep the black command window open while playing.
5. Press `Ctrl+C` in that window to stop the game.

## Fastest public deployment

Use GitHub and Vercel. The exact click-by-click instructions are in
`DEPLOYMENT-GUIDE.md`.

## Project map

- `app/page.tsx` — game logic, missions, audio engine, intro, ending, and links
- `app/globals.css` — all visuals, animation, responsive layout, and glitch effects
- `app/layout.tsx` — page metadata and global shell
- `public/assets/architect-mark.png` — signature logo
- `public/assets/architect-node.png` — intro/outro artwork
- `public/favicon.svg` — browser-tab icon
- `next.config.ts` — creates a normal static website in the `out` folder
- `START_LOCAL_WINDOWS.bat` — one-click local development start
- `BUILD_STATIC_WINDOWS.bat` — one-click static production build

## Normal commands

```text
npm ci
npm run dev
npm run build
npm run lint
```

`npm run build` generates an upload-ready site in `out`.
