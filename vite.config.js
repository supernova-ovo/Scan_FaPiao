import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true, // Auto open browser
    proxy: {
      '/thirdpartservice': {
        target: 'https://lolapi.tepc.cn',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
