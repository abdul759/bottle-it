import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the database
import { BOTTLE_DATABASE } from "./src/data/items";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for looking up items in the static database
  app.get("/api/lookup/:barcode", (req, res) => {
    const { barcode } = req.params;
    const localItem = BOTTLE_DATABASE[barcode];
    if (localItem) {
      return res.json({ ...localItem, source: 'database' });
    }
    res.status(404).json({ error: 'Not found in local database' });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
