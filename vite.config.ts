import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { htmlPrerender } from 'vite-plugin-html-prerender';
import { componentTagger } from "lovable-tagger";
import { GoogleGenAI, Modality } from "@google/genai";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const ephemeralTokenPlugin = () => ({
    name: 'vite-ephemeral-token',
    configureServer(server: any) {
      server.middlewares.use('/api/ephemeral', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const url = new URL(req.url || '', 'http://local');
          const modelParam = url.searchParams.get('model');
          const model = modelParam && modelParam.trim().length > 0
            ? modelParam
            : 'models/gemini-2.5-flash-live-preview';

          const apiKey = env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
          if (!apiKey) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Missing VITE_GEMINI_API_KEY in environment' }));
            return;
          }

          const ai = new GoogleGenAI({ apiKey });
          const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          const token = await ai.authTokens.create({
            config: {
              uses: 1,
              expireTime,
              liveConnectConstraints: {
                model,
                config: {
                  responseModalities: [Modality.AUDIO],
                },
              },
              httpOptions: { apiVersion: 'v1alpha' },
            },
          });

          res.end(JSON.stringify({ token: token.name }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || 'Failed to create ephemeral token' }));
        }
      });
    },
  });

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      // React 19.2: SWC provides automatic optimizations
      // Automatic batching, concurrent rendering, and optimizations built-in
      react(),
      mode === 'development' && componentTagger(),
      mode === 'development' && ephemeralTokenPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt'],
        manifest: {
          name: 'Ojas Health Aid',
          short_name: 'Ojas',
          start_url: '/app',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ea580c',
          icons: [
            { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }
          ]
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/__\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*$/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts' }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp|svg)$/i,
              handler: 'CacheFirst',
              options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 2592000 } }
            }
          ]
        }
      }),
      // Prerender static HTML for marketing routes (SSG)
      htmlPrerender({
        staticDir: path.join(__dirname, 'dist'),
        routes: ['/', '/about', '/contact', '/faq', '/privacy', '/terms'],
        selector: '#root',
        minify: {
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          decodeEntities: true,
          keepClosingSlash: true,
          sortAttributes: true,
        }
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // React 19.2 Performance optimizations
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover'],
            'firebase': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              'firebase/database',
              'firebase/storage',
              'firebase/functions',
            ],
          }
        }
      },
      chunkSizeWarningLimit: 1500
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      esbuildOptions: {
        target: 'esnext',
      }
    },
  };
});
