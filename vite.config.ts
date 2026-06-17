import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['TAURI_', 'VITE_'],
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      output: {
        // 仅把「首屏即用」的第三方库拆成独立缓存 chunk：更新时只有 app
        // 代码 chunk 变哈希，这些 vendor chunk 保持缓存，并可并行解析。
        // 注意：不设 catch-all 'vendor'，否则会把仅被动态 import 的重库
        // （jspdf / html2canvas / dompurify）从懒加载块拉进首屏，反而变慢。
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'framer-motion';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
          if (id.includes('lucide-react')) return 'icons';
        },
      },
    },
  },
});
