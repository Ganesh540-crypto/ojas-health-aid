import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { GoogleGenAI, Modality } from "@google/genai";

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
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          }
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      esbuildOptions: {
        target: 'esnext',
      }
    },
  };
});
