# Documentation

Project overview, setup, and API reference live in the [main README](../README.md).

## Screenshots

UI captures for the README are stored in [`screenshots/`](./screenshots/).

Regenerate them while the app is running (`npm run dev` or `npm run lan`):

```bash
node scripts/capture-screenshots.mjs
```

Optional: `SCREENSHOT_URL=http://127.0.0.1:3001` when using `npm run lan`.

Requires a one-time Playwright Chromium install:

```bash
npx playwright install chromium
```
