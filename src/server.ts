import path from "node:path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@elastic/elasticsearch";

const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

const ES_URL = process.env.ELASTICSEARCH_URL ?? "http://localhost:9200";
const INDEX_NAME = process.env.INDEX_NAME ?? "streets";
const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const client = new Client({ node: ES_URL });

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
  })
);

// Ensure JSON responses declare UTF-8 so Hebrew/Unicode display correctly
app.use((_req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (body: unknown) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return origJson(body);
  };
  next();
});

type Mode = "free" | "any" | "phrase";

/**
 * Build the query according to assignment modes:
 * - free: free text search ONLY on namePrimary
 * - any: at least one word matches across all fields (we use allText)
 * - phrase: full phrase matches across all fields (we use allText)
 *
 * We also always filter out logically deleted documents (isDeleted=true).
 */
function buildEsQuery(q: string, mode: Mode) {
  const mustQuery =
    mode === "free"
      ? { match: { namePrimary: { query: q } } }
      : mode === "phrase"
        ? { match_phrase: { allText: { query: q } } }
        : { match: { allText: { query: q, operator: "or" as const } } };

  return {
    bool: {
      must: [mustQuery],
      filter: [{ term: { isDeleted: false } }],
    },
  };
}

app.get("/health", async (_req, res) => {
  try {
    const r = await client.info();
    res.json({ ok: true, es: r.version.number });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Elasticsearch not reachable" });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const modeRaw = String(req.query.mode ?? "free").trim();

    if (!q) return res.json({ hits: [] });

    const mode: Mode = (["free", "any", "phrase"].includes(modeRaw) ? modeRaw : "free") as Mode;

    const result = await client.search({
      index: INDEX_NAME,
      size: 200,
      query: buildEsQuery(q, mode),
      // Return only the 6 fields required for display and use _id for delete
      _source: ["namePrimary", "title", "nameSecondary", "group", "kind", "neighborhood"],
    });

    const hits = (result.hits.hits ?? []).map((h) => ({
      id: h._id,
      ...(h._source ?? {}),
    }));

    res.json(hits);
  } catch (err: any) {
    const details = err?.message ?? String(err);
    console.error("[GET /api/search]", details);
    res.status(500).json({ error: "Search failed", details });
  }
});

app.delete("/api/streets/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Missing id" });

    // Logical delete: do not physically delete the document
    await client.update({
      index: INDEX_NAME,
      id,
      doc: { isDeleted: true },
      refresh: true,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Delete failed", details: err?.message ?? String(err) });
  }
});

// Serve built streets-ui (static assets and SPA fallback for GET /)
const uiDist = path.join(rootDir, "streets-ui", "dist");
app.use(express.static(uiDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(uiDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Elasticsearch: ${ES_URL}  Index: ${INDEX_NAME}`);
});
