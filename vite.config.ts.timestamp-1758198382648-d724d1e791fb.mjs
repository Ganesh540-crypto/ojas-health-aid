// vite.config.ts
import { defineConfig } from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/lovable-tagger/dist/index.js";
import { GoogleGenAI } from "file:///C:/Users/ganes/Downloads/Ojas-ai/node_modules/@google/genai/dist/node/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\ganes\\Downloads\\Ojas-ai";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Dev-only middleware to mint Ephemeral Tokens for Live API
    mode === "development" && /* @__PURE__ */ function ephemeralTokenPlugin() {
      return {
        name: "vite-ephemeral-token",
        configureServer(server) {
          server.middlewares.use("/api/ephemeral", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            try {
              const url = new URL(req.url || "", "http://local");
              const modelParam = url.searchParams.get("model");
              const model = modelParam && modelParam.trim().length > 0 ? modelParam : "models/gemini-2.5-flash-live-preview";
              const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
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
                      responseModalities: ["AUDIO"]
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
      };
    }()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxnYW5lc1xcXFxEb3dubG9hZHNcXFxcT2phcy1haVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZ2FuZXNcXFxcRG93bmxvYWRzXFxcXE9qYXMtYWlcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2dhbmVzL0Rvd25sb2Fkcy9PamFzLWFpL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcbmltcG9ydCB7IEdvb2dsZUdlbkFJIH0gZnJvbSBcIkBnb29nbGUvZ2VuYWlcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiZcclxuICAgIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gICAgLy8gRGV2LW9ubHkgbWlkZGxld2FyZSB0byBtaW50IEVwaGVtZXJhbCBUb2tlbnMgZm9yIExpdmUgQVBJXHJcbiAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmIChmdW5jdGlvbiBlcGhlbWVyYWxUb2tlblBsdWdpbigpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiAndml0ZS1lcGhlbWVyYWwtdG9rZW4nLFxyXG4gICAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXI6IGFueSkge1xyXG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2FwaS9lcGhlbWVyYWwnLCBhc3luYyAocmVxOiBhbnksIHJlczogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsIHx8ICcnLCAnaHR0cDovL2xvY2FsJyk7XHJcbiAgICAgICAgICAgICAgY29uc3QgbW9kZWxQYXJhbSA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdtb2RlbCcpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IG1vZGVsID0gbW9kZWxQYXJhbSAmJiBtb2RlbFBhcmFtLnRyaW0oKS5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgICAgICA/IG1vZGVsUGFyYW1cclxuICAgICAgICAgICAgICAgIDogJ21vZGVscy9nZW1pbmktMi41LWZsYXNoLWxpdmUtcHJldmlldyc7XHJcblxyXG4gICAgICAgICAgICAgIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52LlZJVEVfR0VNSU5JX0FQSV9LRVkgfHwgcHJvY2Vzcy5lbnYuR0VNSU5JX0FQSV9LRVkgfHwgJyc7XHJcbiAgICAgICAgICAgICAgaWYgKCFhcGlLZXkpIHtcclxuICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTWlzc2luZyBWSVRFX0dFTUlOSV9BUElfS0VZIGluIGVudmlyb25tZW50JyB9KSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICBjb25zdCBhaSA9IG5ldyBHb29nbGVHZW5BSSh7IGFwaUtleSB9KTtcclxuICAgICAgICAgICAgICBjb25zdCBleHBpcmVUaW1lID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIDMwICogNjAgKiAxMDAwKS50b0lTT1N0cmluZygpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gYXdhaXQgYWkuYXV0aFRva2Vucy5jcmVhdGUoe1xyXG4gICAgICAgICAgICAgICAgY29uZmlnOiB7XHJcbiAgICAgICAgICAgICAgICAgIHVzZXM6IDEsXHJcbiAgICAgICAgICAgICAgICAgIGV4cGlyZVRpbWUsXHJcbiAgICAgICAgICAgICAgICAgIGxpdmVDb25uZWN0Q29uc3RyYWludHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBtb2RlbCxcclxuICAgICAgICAgICAgICAgICAgICBjb25maWc6IHtcclxuICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlTW9kYWxpdGllczogWydBVURJTyddLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIGh0dHBPcHRpb25zOiB7IGFwaVZlcnNpb246ICd2MWFscGhhJyB9LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHRva2VuOiB0b2tlbi5uYW1lIH0pKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcclxuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVycj8ubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBlcGhlbWVyYWwgdG9rZW4nIH0pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfTtcclxuICAgIH0pKCksXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0UixTQUFTLG9CQUFvQjtBQUN6VCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsbUJBQW1CO0FBSjVCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUEsRUFDekMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFNBQVMsaUJBQ1QsZ0JBQWdCO0FBQUE7QUFBQSxJQUVoQixTQUFTLGlCQUFrQix5QkFBUyx1QkFBdUI7QUFDekQsYUFBTztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sZ0JBQWdCLFFBQWE7QUFDM0IsaUJBQU8sWUFBWSxJQUFJLGtCQUFrQixPQUFPLEtBQVUsUUFBYTtBQUNyRSxnQkFBSSxVQUFVLGdCQUFnQixrQkFBa0I7QUFDaEQsZ0JBQUk7QUFDRixvQkFBTSxNQUFNLElBQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxjQUFjO0FBQ2pELG9CQUFNLGFBQWEsSUFBSSxhQUFhLElBQUksT0FBTztBQUMvQyxvQkFBTSxRQUFRLGNBQWMsV0FBVyxLQUFLLEVBQUUsU0FBUyxJQUNuRCxhQUNBO0FBRUosb0JBQU0sU0FBUyxRQUFRLElBQUksdUJBQXVCLFFBQVEsSUFBSSxrQkFBa0I7QUFDaEYsa0JBQUksQ0FBQyxRQUFRO0FBQ1gsb0JBQUksYUFBYTtBQUNqQixvQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sNkNBQTZDLENBQUMsQ0FBQztBQUMvRTtBQUFBLGNBQ0Y7QUFFQSxvQkFBTSxLQUFLLElBQUksWUFBWSxFQUFFLE9BQU8sQ0FBQztBQUNyQyxvQkFBTSxhQUFhLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLEtBQUssR0FBSSxFQUFFLFlBQVk7QUFDckUsb0JBQU0sUUFBUSxNQUFNLEdBQUcsV0FBVyxPQUFPO0FBQUEsZ0JBQ3ZDLFFBQVE7QUFBQSxrQkFDTixNQUFNO0FBQUEsa0JBQ047QUFBQSxrQkFDQSx3QkFBd0I7QUFBQSxvQkFDdEI7QUFBQSxvQkFDQSxRQUFRO0FBQUEsc0JBQ04sb0JBQW9CLENBQUMsT0FBTztBQUFBLG9CQUM5QjtBQUFBLGtCQUNGO0FBQUEsa0JBQ0EsYUFBYSxFQUFFLFlBQVksVUFBVTtBQUFBLGdCQUN2QztBQUFBLGNBQ0YsQ0FBQztBQUVELGtCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxNQUFNLEtBQUssQ0FBQyxDQUFDO0FBQUEsWUFDL0MsU0FBUyxLQUFVO0FBQ2pCLGtCQUFJLGFBQWE7QUFDakIsa0JBQUksSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLEtBQUssV0FBVyxtQ0FBbUMsQ0FBQyxDQUFDO0FBQUEsWUFDdkY7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLElBQ0YsRUFBRztBQUFBLEVBQ0wsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
