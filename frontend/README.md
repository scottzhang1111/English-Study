# Frontend Setup

This project is a React SPA frontend. App data is loaded and saved through the Flask API.

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

- App data is loaded and saved through the Flask API. For local development, set `VITE_API_BASE_URL=http://127.0.0.1:5000` when the backend is not on the same origin.
- If `npm` is not available in your environment, install Node.js first.
