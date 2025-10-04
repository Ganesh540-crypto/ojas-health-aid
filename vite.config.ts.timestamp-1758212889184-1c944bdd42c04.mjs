// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/lovable-tagger/dist/index.js";
import { GoogleGenAI, Modality } from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/@google/genai/dist/node/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\ganes\\Downloads\\Ojas-ai";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ephemeralTokenPlugin = () => ({
    name: "vite-ephemeral-token",
    configureServer(server) {
      server.middlewares.use("/api/ephemeral", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        try {
          const url = new URL(req.url || "", "http://local");
          const modelParam = url.searchParams.get("model");
          const model = modelParam && modelParam.trim().length > 0 ? modelParam : "models/gemini-2.5-flash-live-preview";
          const apiKey = env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
          if (!apiKey) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Missing VITE_GEMINI_API_KEY in environment" }));
            return;
          }
          const ai = new GoogleGenAI({ apiKey });
          const expireTime = new Date(Date.now() + 30 * 60 * 1e3).toISOString();
          const token = await ai.authTokens.create({
            config: {
              uses: 1,
              expireTime,
              liveConnectConstraints: {
                model,
                config: {
                  responseModalities: [Modality.AUDIO]
                }
              },
              httpOptions: { apiVersion: "v1alpha" }
            }
          });
          res.end(JSON.stringify({ token: token.name }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || "Failed to create ephemeral token" }));
        }
      });
    }
  });
  return {
    server: {
      host: "::",
      port: 8080
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "development" && ephemeralTokenPlugin()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxnYW5lc1xcXFxEb3dubG9hZHNcXFxcT2phcy1haVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZ2FuZXNcXFxcRG93bmxvYWRzXFxcXE9qYXMtYWlcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2dhbmVzL0Rvd25sb2Fkcy9PamFzLWFpL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcbmltcG9ydCB7IEdvb2dsZUdlbkFJLCBNb2RhbGl0eSB9IGZyb20gXCJAZ29vZ2xlL2dlbmFpXCI7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJyk7XHJcblxyXG4gIGNvbnN0IGVwaGVtZXJhbFRva2VuUGx1Z2luID0gKCkgPT4gKHtcclxuICAgIG5hbWU6ICd2aXRlLWVwaGVtZXJhbC10b2tlbicsXHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyOiBhbnkpIHtcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2FwaS9lcGhlbWVyYWwnLCBhc3luYyAocmVxOiBhbnksIHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsIHx8ICcnLCAnaHR0cDovL2xvY2FsJyk7XHJcbiAgICAgICAgICBjb25zdCBtb2RlbFBhcmFtID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ21vZGVsJyk7XHJcbiAgICAgICAgICBjb25zdCBtb2RlbCA9IG1vZGVsUGFyYW0gJiYgbW9kZWxQYXJhbS50cmltKCkubGVuZ3RoID4gMFxyXG4gICAgICAgICAgICA/IG1vZGVsUGFyYW1cclxuICAgICAgICAgICAgOiAnbW9kZWxzL2dlbWluaS0yLjUtZmxhc2gtbGl2ZS1wcmV2aWV3JztcclxuXHJcbiAgICAgICAgICBjb25zdCBhcGlLZXkgPSBlbnYuVklURV9HRU1JTklfQVBJX0tFWSB8fCBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWSB8fCAnJztcclxuICAgICAgICAgIGlmICghYXBpS2V5KSB7XHJcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdNaXNzaW5nIFZJVEVfR0VNSU5JX0FQSV9LRVkgaW4gZW52aXJvbm1lbnQnIH0pKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGNvbnN0IGFpID0gbmV3IEdvb2dsZUdlbkFJKHsgYXBpS2V5IH0pO1xyXG4gICAgICAgICAgY29uc3QgZXhwaXJlVGltZSA9IG5ldyBEYXRlKERhdGUubm93KCkgKyAzMCAqIDYwICogMTAwMCkudG9JU09TdHJpbmcoKTtcclxuICAgICAgICAgIGNvbnN0IHRva2VuID0gYXdhaXQgYWkuYXV0aFRva2Vucy5jcmVhdGUoe1xyXG4gICAgICAgICAgICBjb25maWc6IHtcclxuICAgICAgICAgICAgICB1c2VzOiAxLFxyXG4gICAgICAgICAgICAgIGV4cGlyZVRpbWUsXHJcbiAgICAgICAgICAgICAgbGl2ZUNvbm5lY3RDb25zdHJhaW50czoge1xyXG4gICAgICAgICAgICAgICAgbW9kZWwsXHJcbiAgICAgICAgICAgICAgICBjb25maWc6IHtcclxuICAgICAgICAgICAgICAgICAgcmVzcG9uc2VNb2RhbGl0aWVzOiBbTW9kYWxpdHkuQVVESU9dLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIGh0dHBPcHRpb25zOiB7IGFwaVZlcnNpb246ICd2MWFscGhhJyB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHRva2VuOiB0b2tlbi5uYW1lIH0pKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVycj8ubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBlcGhlbWVyYWwgdG9rZW4nIH0pKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBob3N0OiBcIjo6XCIsXHJcbiAgICAgIHBvcnQ6IDgwODAsXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICByZWFjdCgpLFxyXG4gICAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gICAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmIGVwaGVtZXJhbFRva2VuUGx1Z2luKCksXHJcbiAgICBdLmZpbHRlcihCb29sZWFuKSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFIsU0FBUyxjQUFjLGVBQWU7QUFDbFUsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGFBQWEsZ0JBQWdCO0FBSnRDLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUUzQyxRQUFNLHVCQUF1QixPQUFPO0FBQUEsSUFDbEMsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQWE7QUFDM0IsYUFBTyxZQUFZLElBQUksa0JBQWtCLE9BQU8sS0FBVSxRQUFhO0FBQ3JFLFlBQUksVUFBVSxnQkFBZ0Isa0JBQWtCO0FBQ2hELFlBQUk7QUFDRixnQkFBTSxNQUFNLElBQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxjQUFjO0FBQ2pELGdCQUFNLGFBQWEsSUFBSSxhQUFhLElBQUksT0FBTztBQUMvQyxnQkFBTSxRQUFRLGNBQWMsV0FBVyxLQUFLLEVBQUUsU0FBUyxJQUNuRCxhQUNBO0FBRUosZ0JBQU0sU0FBUyxJQUFJLHVCQUF1QixRQUFRLElBQUksa0JBQWtCO0FBQ3hFLGNBQUksQ0FBQyxRQUFRO0FBQ1gsZ0JBQUksYUFBYTtBQUNqQixnQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sNkNBQTZDLENBQUMsQ0FBQztBQUMvRTtBQUFBLFVBQ0Y7QUFFQSxnQkFBTSxLQUFLLElBQUksWUFBWSxFQUFFLE9BQU8sQ0FBQztBQUNyQyxnQkFBTSxhQUFhLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLEtBQUssR0FBSSxFQUFFLFlBQVk7QUFDckUsZ0JBQU0sUUFBUSxNQUFNLEdBQUcsV0FBVyxPQUFPO0FBQUEsWUFDdkMsUUFBUTtBQUFBLGNBQ04sTUFBTTtBQUFBLGNBQ047QUFBQSxjQUNBLHdCQUF3QjtBQUFBLGdCQUN0QjtBQUFBLGdCQUNBLFFBQVE7QUFBQSxrQkFDTixvQkFBb0IsQ0FBQyxTQUFTLEtBQUs7QUFBQSxnQkFDckM7QUFBQSxjQUNGO0FBQUEsY0FDQSxhQUFhLEVBQUUsWUFBWSxVQUFVO0FBQUEsWUFDdkM7QUFBQSxVQUNGLENBQUM7QUFFRCxjQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxNQUFNLEtBQUssQ0FBQyxDQUFDO0FBQUEsUUFDL0MsU0FBUyxLQUFVO0FBQ2pCLGNBQUksYUFBYTtBQUNqQixjQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxLQUFLLFdBQVcsbUNBQW1DLENBQUMsQ0FBQztBQUFBLFFBQ3ZGO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQUEsTUFDMUMsU0FBUyxpQkFBaUIscUJBQXFCO0FBQUEsSUFDakQsRUFBRSxPQUFPLE9BQU87QUFBQSxJQUNoQixTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
