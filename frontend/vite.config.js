import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { webpPlugin } from './scripts/viteWebPPlugin.js';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true
    }),
    webpPlugin({
      quality: 80, // Reduced for faster loading
      extensions: ['.jpg', '.jpeg', '.png'],
      inputDirs: ['src/assets', 'public']
    }),
    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10kb
      deleteOriginFile: false
    }),
    // Brotli compression (better than gzip)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false
    })
  ],
  server: {
    port: 3001,
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: false
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'false',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' http://localhost:5000 https://api.radheconsultancy.co.in https://www.api.radheconsultancy.co.in wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: blob: https: http:; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; frame-src https://accounts.google.com;"
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    // Disable source maps in production for smaller bundle
    sourcemap: false,
    // Optimize chunks
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React and core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-vendor': ['antd', 'react-icons', 'lucide-react'],
          // Charts
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          // Form libraries
          'form-vendor': ['react-datepicker', 'react-select', 'react-phone-number-input'],
          // Other libraries
          'other-vendor': ['axios', 'jwt-decode', 'react-toastify']
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
      },
      format: {
        comments: false // Remove all comments
      }
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize assets
    assetsInlineLimit: 4096, // 4kb - inline smaller assets as base64
    // Build target
    target: 'esnext',
    // Ensure tree shaking
    modulePreload: {
      polyfill: true
    }
  },
  define: {
    'process.env': process.env
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      'axios',
      'react-toastify',
      'lottie-react'
    ],
    // Exclude large dependencies that should be loaded on demand
    exclude: ['chart.js']
  },
  css: {
    devSourcemap: false,
    // CSS optimization
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: (atRule) => {
              if (atRule.name === 'charset') {
                atRule.remove();
              }
            }
          }
        }
      ]
    }
  },
  // Performance optimizations
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    // Minify identifiers for smaller bundle
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  }
});
