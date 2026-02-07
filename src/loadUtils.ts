/**
 * Loader utilities: read Excel, apply mapping.json, and bulk-index into Elasticsearch.
 * Config comes from env (.env); mapping defines field names, types, and defaults.
 */
import path from "node:path";
import fs from "node:fs";
import { Client } from "@elastic/elasticsearch";
import { read as readXlsx, utils as xlsxUtils } from "xlsx";

// --- Types ---

/** Field list and types derived from mapping.json; used to turn each Excel row into a document. */
export interface LoaderConfig {
  fieldNames: string[];
  fieldTypes: Record<string, string>;
  defaults: Record<string, unknown>;
}

/** Run-time settings (paths, ES URL, index name, batch size). Built from env vars. */
export interface RunConfig {
  elasticsearchUrl: string;
  indexName: string;
  excelPath: string;
  mappingPath: string;
  batchSize: number;
}

// --- Entry point ---

/**
 * Full pipeline: load config from env, ensure the index exists, read Excel, map rows to docs, bulk index.
 * Returns the number of documents indexed and the index name.
 */
export async function runLoader(): Promise<{ indexed: number; indexName: string }> {
  const runConfig = getRunConfig();
  const mapping = loadMapping(runConfig.mappingPath);
  const client = new Client({ node: runConfig.elasticsearchUrl });
  await ensureIndex(client, mapping, runConfig.indexName);
  const loaderConfig = buildLoaderConfig(mapping);
  const indexed = await loadAndIndex(client, loaderConfig, runConfig);
  return { indexed, indexName: runConfig.indexName };
}

/** Builds run config from process.env. Paths are relative to the project root (parent of this file's dir). */
export function getRunConfig(): RunConfig {
  const rootDir = path.join(__dirname, "..");
  return {
    elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
    indexName: process.env.INDEX_NAME ?? "streets",
    excelPath:
      process.env.EXCEL_PATH ??
      path.join(rootDir, "data", process.env.EXCEL_FILE_NAME ?? "מטלת בית ארכיון שמות רחובות.xlsx"),
    mappingPath:
      process.env.MAPPING_PATH ?? path.join(rootDir, "elastic", process.env.MAPPING_FILE_NAME ?? "mapping.json"),
    batchSize: parseInt(process.env.BATCH_SIZE ?? "500", 10) || 500,
  };
}

// --- Mapping ---

/** Loads and parses the mapping JSON file (settings + mappings + optional defaults). Uses UTF-8. */
export function loadMapping(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, { encoding: "utf8" });
  return JSON.parse(raw);
}

/** List of indexable field names from mapping.properties, in order. Excludes "allText" (copy_to target). */
export function getFieldNames(mapping: Record<string, unknown>): string[] {
  const props = (mapping?.mappings as { properties?: Record<string, { type?: string }> })?.properties;
  if (!props) return [];
  return Object.keys(props).filter((name) => name !== "allText");
}

/** Returns the Elasticsearch type for a field (e.g. "text", "integer", "boolean"). */
export function getFieldType(mapping: Record<string, unknown>, fieldName: string): string {
  const props = (mapping?.mappings as { properties?: Record<string, { type?: string }> })?.properties;
  const def = props?.[fieldName];
  return def?.type ?? "text";
}

/** Reads the optional "defaults" object from mapping (for missing fields). Not sent to Elasticsearch. */
export function getDefaults(mapping: Record<string, unknown>): Record<string, unknown> {
  const defaults = mapping.defaults;
  return (defaults && typeof defaults === "object" && !Array.isArray(defaults))
    ? (defaults as Record<string, unknown>)
    : {};
}

/** Converts a raw cell value to the right type (number for integer/long, boolean, or string). */
export function coerce(raw: unknown, type: string): string | number | boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (type === "integer" || type === "long") {
    const n = Number(raw);
    return Number.isInteger(n) ? n : undefined;
  }
  if (type === "boolean") {
    if (typeof raw === "boolean") return raw;
    const s = String(raw).toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  const str = String(raw).trim() || undefined;
  if (str === undefined) return undefined;
  return str;
}

/** Builds LoaderConfig from mapping: field names, their types, and defaults. Throws if no indexable fields. */
export function buildLoaderConfig(mapping: Record<string, unknown>): LoaderConfig {
  const fieldNames = getFieldNames(mapping);
  if (fieldNames.length === 0) throw new Error("No indexable fields in mapping");
  const fieldTypes: Record<string, string> = {};
  fieldNames.forEach((name) => {
    fieldTypes[name] = getFieldType(mapping, name);
  });
  return { fieldNames, fieldTypes, defaults: getDefaults(mapping) };
}

// --- Loader (private) ---

/**
 * Ensures the Elasticsearch index exists. If it does not, creates it with the given mapping.
 * The mapping's "defaults" key is removed before sending to ES (defaults are only used when building docs).
 */
async function ensureIndex(
  client: Client,
  mapping: Record<string, unknown>,
  indexName: string,
): Promise<void> {
  const exists = await client.indices.exists({ index: indexName });
  if (!exists) {
    const { defaults: _, ...indexParams } = mapping;
    await client.indices.create({ index: indexName, ...indexParams });
  }
}

/**
 * Reads the Excel file at excelPath and returns all data rows as an array of arrays.
 * Uses the first sheet; row 1 is treated as a header and skipped. Each row is an array of cell values
 * (column A = index 0, B = 1, ...). Throws if the file is missing or has no data rows.
 */
function loadExcelRows(excelPath: string): (string | number | boolean | undefined)[][] {
  if (!fs.existsSync(excelPath)) throw new Error(`Excel file not found: ${excelPath}`);
  const buffer = fs.readFileSync(excelPath);
  const workbook = readXlsx(buffer, { type: "buffer", codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook has no sheets");
  const rows = xlsxUtils.sheet_to_json<(string | number | boolean)[]>(sheet, { header: 1 });
  if (rows.length < 2) throw new Error("No data rows in sheet");
  return rows.slice(1) as (string | number | boolean | undefined)[][];
}

/**
 * Converts one Excel row (array of cell values) into an Elasticsearch document.
 * For each field: takes the cell at the same index, coerces it using the field's type, and sets the doc key.
 * Then applies defaults for any field that is still missing. Returns null if the row produced an empty doc.
 */
function rowToDoc(
  row: (string | number | boolean | undefined)[],
  fieldNames: string[],
  fieldTypes: Record<string, string>,
  defaults: Record<string, unknown>,
): Record<string, unknown> | null {
  const doc: Record<string, unknown> = {};
  fieldNames.forEach((name, i) => {
    const value = coerce(row[i], fieldTypes[name]);
    if (value !== undefined) doc[name] = value;
  });
  Object.entries(defaults).forEach(([key, value]) => {
    if (doc[key] === undefined) doc[key] = value;
  });
  return Object.keys(doc).length > 0 ? doc : null;
}

/**
 * Sends a batch of documents to Elasticsearch using the bulk API. Each doc is sent as an "index" action
 * into the given indexName. Does nothing if the batch is empty. refresh: false to avoid refreshing after each batch.
 */
async function flushBatch(
  client: Client,
  batch: Record<string, unknown>[],
  indexName: string,
): Promise<void> {
  if (batch.length === 0) return;
  const operations: unknown[] = [];
  for (const doc of batch) {
    operations.push({ index: { _index: indexName } }, doc);
  }
  await client.bulk({ operations, refresh: false });
}

/**
 * Runs the load-and-index pipeline: reads all rows from the Excel file, converts each row to a document
 * with rowToDoc, accumulates docs in a batch, and flushes the batch to ES when it reaches batchSize.
 * Flushes any remaining docs at the end. Returns the total number of documents indexed.
 */
async function loadAndIndex(
  client: Client,
  config: LoaderConfig,
  runConfig: RunConfig,
): Promise<number> {
  const { fieldNames, fieldTypes, defaults } = config;
  const rows = loadExcelRows(runConfig.excelPath);
  const batch: Record<string, unknown>[] = [];
  let indexed = 0;

  for (const row of rows) {
    const doc = rowToDoc(row, fieldNames, fieldTypes, defaults);
    if (doc) {
      batch.push(doc);
      if (batch.length >= runConfig.batchSize) {
        await flushBatch(client, batch, runConfig.indexName);
        indexed += batch.length;
        batch.length = 0;
      }
    }
  }
  await flushBatch(client, batch, runConfig.indexName);
  indexed += batch.length;
  return indexed;
}
