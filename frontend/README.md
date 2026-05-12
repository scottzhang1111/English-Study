# Frontend Setup

This project is a React SPA frontend. By default it runs in static data mode so local Vite and Vercel read the same JSON files from `public/data/`.

## Install dependencies

```bash
cd frontend
npm install
```

## Run development server

```bash
npm run dev
```

## Build for production

```bash
npm run build
```

## Notes

- Static JSON data lives in `public/data/`.
- The default data mode is `VITE_DATA_MODE=static`.
- To experiment with the legacy Flask backend locally, set `VITE_DATA_MODE=api` and optionally `VITE_API_BASE_URL=http://127.0.0.1:5000`. The React app should not depend on this mode for Vercel.
- If `npm` is not available in your environment, install Node.js first.
