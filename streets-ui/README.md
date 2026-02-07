# Streets UI

rontend for the Streets project: search street names and manage results. Built with React, TypeScript, and Vite.

**To run the full app (UI + API + Elasticsearch)** use Docker from the repo root—see the main [README](../README.md).

---

## Development

Run the UI in dev mode with hot reload. API requests are proxied to the backend.

**Prerequisites:** Node.js and npm. The API must be running (e.g. from repo root: `npm run build && npm start`, or start only Elasticsearch and the API in another terminal).

```bash
npm install
npm run dev
```

Open http://localhost:5173 (or the port Vite prints). The dev server proxies `/api` and `/health` to the backend. Default backend URL: `http://localhost:3001`. Override with a `.env` file:

```env
VITE_API_URL=http://localhost:3001
```

---

## Scripts

| Script    | Description                    |
|-----------|--------------------------------|
| `npm run dev`     | Start Vite dev server (proxy to API) |
| `npm run build`   | Type-check and build for production   |
| `npm run preview` | Serve the production build locally   |
| `npm run lint`    | Run ESLint                            |

The production build is served by the main backend when you run the app via Docker or `npm start` from the repo root.
