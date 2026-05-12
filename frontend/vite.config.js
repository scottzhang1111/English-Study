import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dataMode = env.VITE_DATA_MODE || 'static';
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

  return {
    base: '/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: dataMode === 'api'
        ? {
            '/api': {
              target: apiBaseUrl,
              changeOrigin: true,
              secure: false
            }
          }
        : undefined
    }
  };
});
