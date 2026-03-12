import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/jetopcms': {
        target: 'https://test1.tepc.cn',
        changeOrigin: true,
        secure: false
      },
      '/thirdpartservice': {
        target: 'https://lolapi.tepc.cn',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
