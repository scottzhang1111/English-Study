# Frontend Setup

This project is a React SPA frontend for the existing Flask app.

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

- The frontend proxies `/api` requests to the Flask backend at `http://127.0.0.1:5000`.
- The Flask backend already exposes JSON endpoints used by the React app such as `/api/home`, `/api/flashcard`, `/api/quiz`, `/api/pokedex`, `/api/petroom`, `/api/petlevel`, and `/api/progress`.
- Production builds are served under `/app/` with Flask via the new `serve_react_app` route.
- The Flask root path `/` redirects to the React SPA, and legacy page endpoints like `/flashcard`, `/quiz`, `/pokedex`, `/petroom`, `/petlevel`, `/progress`, and `/settings` also redirect into `/app/`.
- If `npm` is not available in your environment, install Node.js first.
