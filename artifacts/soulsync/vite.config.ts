import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

function localSyncPlugin() {
  const dmsList: Array<any> = [];
  const callsList: Array<any> = [];

  return {
    name: "local-sync-plugin",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const urlObj = new URL(req.url || "/", "http://localhost");

        if (urlObj.pathname === "/api/sync/dms") {
          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk: any) => { body += chunk; });
            req.on("end", () => {
              try {
                const data = JSON.parse(body);
                data.timestamp = Date.now();
                dmsList.push(data);
                if (dmsList.length > 500) dmsList.shift();
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              } catch {
                res.statusCode = 400;
                res.end("Invalid JSON");
              }
            });
            return;
          } else {
            const since = Number(urlObj.searchParams.get("since") || 0);
            const items = dmsList.filter(d => d.timestamp > since);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(items));
            return;
          }
        }

        if (urlObj.pathname === "/api/sync/calls") {
          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk: any) => { body += chunk; });
            req.on("end", () => {
              try {
                const data = JSON.parse(body);
                data.timestamp = Date.now();
                callsList.push(data);
                if (callsList.length > 100) callsList.shift();
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              } catch {
                res.statusCode = 400;
                res.end("Invalid JSON");
              }
            });
            return;
          } else {
            const since = Number(urlObj.searchParams.get("since") || 0);
            const items = callsList.filter(c => c.timestamp > since);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(items));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    localSyncPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
