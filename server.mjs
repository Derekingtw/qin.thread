import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import pg from "pg";

const { Pool } = pg;

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const dataDir = join(root, "data");
const stateFile = join(dataDir, "oa-state.json");
const backupFile = join(dataDir, "oa-state.backup.json");
const migrationBackupDir = join(root, "backups", "pre-postgres-migration");
const databaseUrl = process.env.DATABASE_URL || "";
let pool = null;

const initialState = () => ({
  products: [],
  partners: [],
  purchases: [],
  sales: [],
  qinLiveSales: [],
  invoiceUploads: [],
  yarnTracks: [],
  liveShows: [],
  liveSales: [],
  shipments: [],
  staff: [],
  leaveRequests: [],
  announcements: [],
  knitters: [],
  samples: [],
  yarnShipments: [],
  settings: { positions: [], users: [] },
  meta: { updatedAt: Date.now() },
});

const pwaHead = `
    <meta name="theme-color" content="#9f2f24" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="秦時線 OA" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/assets/qinxian-logo.svg" type="image/svg+xml" />`;
const pwaScript = `
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("/sw.js").catch(() => {});
        });
      }
    </script>`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
  ".ai": "application/pdf",
  ".svg": "image/svg+xml; charset=utf-8",
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function recordCount(data) {
  if (!data || typeof data !== "object") return 0;
  return [
    data.products,
    data.partners,
    data.purchases,
    data.sales,
    data.qinLiveSales,
    data.invoiceUploads,
    data.yarnTracks,
    data.liveShows,
    data.liveSales,
    data.shipments,
    data.staff,
    data.leaveRequests,
    data.announcements,
    data.knitters,
    data.samples,
    data.yarnShipments,
    data.tripRequests,
    data.purchaseRequests,
    data.proposalRequests,
    data.adminPayrolls,
    data.livePayrolls,
    data.partnerBonuses,
    data.tradeDocs,
    data.growthRecords,
    data.settings?.users,
  ].reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
}

const stateArrayKeys = [
  "products",
  "partners",
  "purchases",
  "sales",
  "qinLiveSales",
  "invoiceUploads",
  "yarnTracks",
  "liveShows",
  "liveSales",
  "shipments",
  "staff",
  "leaveRequests",
  "announcements",
  "knitters",
  "samples",
  "yarnShipments",
  "tripRequests",
  "purchaseRequests",
  "proposalRequests",
  "adminPayrolls",
  "livePayrolls",
  "partnerBonuses",
  "tradeDocs",
  "growthRecords",
];

function arrayCounts(data) {
  const counts = {};
  for (const key of stateArrayKeys) counts[key] = Array.isArray(data?.[key]) ? data[key].length : 0;
  counts.users = Array.isArray(data?.settings?.users) ? data.settings.users.length : 0;
  return counts;
}

function hasMeaningfulState(data) {
  return recordCount(data) > 0;
}

function shouldRefuseOverwrite(currentState, nextState) {
  const currentCount = recordCount(currentState);
  const nextCount = recordCount(nextState);
  if (!currentCount) return false;
  if (!nextCount) return true;
  const protectedPaths = [
    ["products"],
    ["staff"],
    ["settings", "users"],
  ];
  const countAt = (data, path) => {
    const value = path.reduce((next, key) => next?.[key], data);
    return Array.isArray(value) ? value.length : 0;
  };
  const keysAt = (data, path) => {
    const value = path.reduce((next, key) => next?.[key], data);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.map((item, index) => itemKey(item, index)));
  };
  if (protectedPaths.some((path) => countAt(nextState, path) < countAt(currentState, path))) return true;
  if (protectedPaths.some((path) => {
    const currentKeys = keysAt(currentState, path);
    const nextKeys = keysAt(nextState, path);
    for (const key of currentKeys) {
      if (!nextKeys.has(key)) return true;
    }
    return false;
  })) return true;
  return currentCount - nextCount >= 3;
}

function deletionSetFor(nextState, collection) {
  const deletedItems = Array.isArray(nextState?.meta?.deletedItems) ? nextState.meta.deletedItems : [];
  return new Set(deletedItems
    .filter((entry) => entry?.collection === collection && entry?.key)
    .map((entry) => String(entry.key)));
}

function itemKey(item, index) {
  return String(item?.id || item?.sku || item?.no || item?.phone || item?.username || `row-${index}`);
}

function mergeArrayById(currentItems = [], nextItems = [], deletedKeys = new Set()) {
  const merged = [];
  const seen = new Set();
  nextItems.forEach((item, index) => {
    const key = itemKey(item, index);
    if (deletedKeys.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  currentItems.forEach((item, index) => {
    const key = itemKey(item, index);
    if (deletedKeys.has(key)) return;
    if (!seen.has(key)) merged.push(item);
  });
  return merged;
}

function mergeWithoutDataLoss(currentState, nextState) {
  if (!currentState || !nextState) return nextState;
  const merged = { ...currentState, ...nextState };
  for (const key of stateArrayKeys) {
    const currentItems = Array.isArray(currentState[key]) ? currentState[key] : [];
    const nextItems = Array.isArray(nextState[key]) ? nextState[key] : [];
    const deletedKeys = deletionSetFor(nextState, key);
    merged[key] = nextItems.length < currentItems.length || deletedKeys.size ? mergeArrayById(currentItems, nextItems, deletedKeys) : nextItems;
  }
  merged.settings = { ...(currentState.settings || {}), ...(nextState.settings || {}) };
  const currentUsers = Array.isArray(currentState.settings?.users) ? currentState.settings.users : [];
  const nextUsers = Array.isArray(nextState.settings?.users) ? nextState.settings.users : [];
  const deletedUsers = deletionSetFor(nextState, "settings.users");
  merged.settings.users = nextUsers.length < currentUsers.length || deletedUsers.size ? mergeArrayById(currentUsers, nextUsers, deletedUsers) : nextUsers;
  merged.meta = { ...(currentState.meta || {}), ...(nextState.meta || {}), mergedAt: Date.now() };
  return merged;
}

async function getStateSummary() {
  const currentState = await getAppState();
  const backups = pool
    ? (await pool.query(`
        select backup_id, reason, created_at,
          jsonb_array_length(coalesce(state->'products', '[]'::jsonb)) as products,
          jsonb_array_length(coalesce(state->'staff', '[]'::jsonb)) as staff,
          jsonb_array_length(coalesce(state->'settings'->'users', '[]'::jsonb)) as users
        from app_state_backups
        order by backup_id desc
        limit 8
      `)).rows
    : [];
  return {
    ok: true,
    storage: pool ? "postgres" : "json",
    databaseConfigured: Boolean(databaseUrl),
    updatedAt: currentState?.meta?.updatedAt || null,
    counts: arrayCounts(currentState),
    totalRecords: recordCount(currentState),
    backups,
  };
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to read JSON ${filePath}:`, error.message);
    return null;
  }
}

async function backupJsonFile(filePath, label) {
  if (!existsSync(filePath)) return;
  await mkdir(migrationBackupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(migrationBackupDir, `${label}-${stamp}.json`);
  await writeFile(target, await readFile(filePath, "utf8"), "utf8");
}

async function connectDatabase() {
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. PostgreSQL is disabled; using JSON fallback only.");
    return null;
  }
  const needsSsl = /sslmode=require/i.test(databaseUrl) || process.env.DB_SSL === "true";
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });
  await pool.query("select 1");
  console.log("PostgreSQL connection ready.");
  return pool;
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    create table if not exists app_state (
      id text primary key,
      state jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `);
  await pool.query(`
    create table if not exists app_state_backups (
      backup_id bigserial primary key,
      state_id text not null,
      state jsonb not null,
      reason text not null,
      created_at timestamptz default now()
    )
  `);
}

async function getStateFromDatabase() {
  if (!pool) return null;
  const result = await pool.query("select state from app_state where id = $1", ["main"]);
  return result.rows[0]?.state || null;
}

async function backupDatabaseState(reason = "before_update") {
  if (!pool) return;
  await pool.query(`
    insert into app_state_backups (state_id, state, reason)
    select id, state, $2
    from app_state
    where id = $1
  `, ["main", reason]);
}

async function saveStateToDatabase(nextState) {
  if (!pool) return false;
  const currentState = await getStateFromDatabase();
  if (shouldRefuseOverwrite(currentState, nextState)) {
    const mergedState = mergeWithoutDataLoss(currentState, nextState);
    const hasExplicitDeletes = Array.isArray(nextState?.meta?.deletedItems) && nextState.meta.deletedItems.length > 0;
    if (!hasExplicitDeletes && shouldRefuseOverwrite(currentState, mergedState)) {
      const error = new Error("refuse_possible_data_loss");
      error.statusCode = 409;
      throw error;
    }
    await backupDatabaseState("before_merge_save");
    await pool.query(`
      insert into app_state (id, state)
      values ($1, $2::jsonb)
      on conflict (id)
      do update set state = excluded.state, updated_at = now()
    `, ["main", JSON.stringify(mergedState)]);
    return { merged: true };
  }
  if (currentState) await backupDatabaseState("before_update");
  await pool.query(`
    insert into app_state (id, state)
    values ($1, $2::jsonb)
    on conflict (id)
    do update set state = excluded.state, updated_at = now()
  `, ["main", JSON.stringify(nextState)]);
  return { merged: false };
}

async function restoreLargestDatabaseBackup() {
  if (!pool) {
    const error = new Error("postgres_unavailable");
    error.statusCode = 503;
    throw error;
  }
  const result = await pool.query(`
    select backup_id, state
    from app_state_backups
    order by
      jsonb_array_length(coalesce(state->'products', '[]'::jsonb)) desc,
      jsonb_array_length(coalesce(state->'settings'->'users', '[]'::jsonb)) desc,
      backup_id desc
    limit 1
  `);
  const backup = result.rows[0];
  if (!backup?.state || !hasMeaningfulState(backup.state)) {
    const error = new Error("backup_not_found");
    error.statusCode = 404;
    throw error;
  }
  const currentState = await getStateFromDatabase();
  if (currentState) await backupDatabaseState("before_manual_restore");
  await pool.query(`
    insert into app_state (id, state)
    values ($1, $2::jsonb)
    on conflict (id)
    do update set state = excluded.state, updated_at = now()
  `, ["main", JSON.stringify(backup.state)]);
  return { backupId: backup.backup_id, state: backup.state };
}

async function removeSaveCheckProducts() {
  if (!pool) {
    const error = new Error("postgres_unavailable");
    error.statusCode = 503;
    throw error;
  }
  const currentState = await getStateFromDatabase();
  if (!currentState) return { removed: 0, products: 0 };
  const products = Array.isArray(currentState.products) ? currentState.products : [];
  const nextProducts = products.filter((product) => (
    product?.sku !== "TEST-SAVE-CHECK" &&
    !String(product?.name || "").includes("儲存測試")
  ));
  const removed = products.length - nextProducts.length;
  if (!removed) return { removed: 0, products: products.length };
  await backupDatabaseState("before_remove_save_check_product");
  const nextState = { ...currentState, products: nextProducts, meta: { ...(currentState.meta || {}), cleanedAt: Date.now() } };
  await pool.query(`
    insert into app_state (id, state)
    values ($1, $2::jsonb)
    on conflict (id)
    do update set state = excluded.state, updated_at = now()
  `, ["main", JSON.stringify(nextState)]);
  return { removed, products: nextProducts.length };
}

async function getStateFromJsonFallback() {
  const state = await readJsonIfExists(stateFile);
  if (hasMeaningfulState(state)) return state;
  const backup = await readJsonIfExists(backupFile);
  if (hasMeaningfulState(backup)) return backup;
  return initialState();
}

async function saveStateToJsonFallback(nextState) {
  if (existsSync(stateFile)) {
    const currentState = await readJsonIfExists(stateFile);
    if (shouldRefuseOverwrite(currentState, nextState)) {
      const error = new Error("refuse_possible_data_loss");
      error.statusCode = 409;
      throw error;
    }
  }
  await mkdir(dataDir, { recursive: true });
  if (existsSync(stateFile)) {
    await writeFile(backupFile, await readFile(stateFile, "utf8"), "utf8");
  }
  await writeFile(stateFile, JSON.stringify(nextState), "utf8");
}

async function migrateOldJsonIfNeeded() {
  if (!pool) return;
  const existing = await getStateFromDatabase();
  if (existing) {
    await backupDatabaseState("pre_migration_existing_state");
    return;
  }
  const oldState = await getStateFromJsonFallback();
  if (!hasMeaningfulState(oldState)) return;
  await backupJsonFile(stateFile, "oa-state-before-postgres-import");
  await backupJsonFile(backupFile, "oa-state-backup-before-postgres-import");
  await saveStateToDatabase(oldState);
  console.log(`Imported old JSON state into PostgreSQL with ${recordCount(oldState)} records.`);
}

async function getAppState() {
  const dbState = await getStateFromDatabase();
  if (dbState) return dbState;
  return await getStateFromJsonFallback();
}

async function saveAppState(nextState) {
  if (pool) {
    return await saveStateToDatabase(nextState);
  }
  await saveStateToJsonFallback(nextState);
  return { merged: false };
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

async function authenticateUser(phone, password) {
  const state = await getAppState();
  const normalizedPhone = normalizePhone(phone);
  const users = Array.isArray(state.settings?.users) ? state.settings.users : [];
  const user = users.find((item) => (
    normalizePhone(item.phone || item.username) === normalizedPhone &&
    String(item.password || "") === String(password || "")
  ));
  if (!user) return null;
  const staff = (Array.isArray(state.staff) ? state.staff : []).find((item) => item.id === user.staffId || normalizePhone(item.phone) === normalizedPhone) || null;
  const { password: _password, ...safeUser } = user;
  return { user: safeUser, staff };
}

async function jsonResponse(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

async function start() {
  try {
    await connectDatabase();
    await ensureSchema();
    await migrateOldJsonIfNeeded();
  } catch (error) {
    console.error("PostgreSQL initialization failed:", error.message);
    console.error("Server will continue with JSON fallback to avoid downtime.");
    pool = null;
  }

  createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname === "/api/state" && req.method === "GET") {
      try {
        await jsonResponse(res, 200, await getAppState());
      } catch (error) {
        console.error("GET /api/state failed:", error.message);
        await jsonResponse(res, 500, { ok: false, error: "state_read_failed" });
      }
      return;
    }
    if (url.pathname === "/api/storage-status" && req.method === "GET") {
      await jsonResponse(res, 200, {
        ok: true,
        storage: pool ? "postgres" : "json",
        databaseConfigured: Boolean(databaseUrl),
      });
      return;
    }
    if (url.pathname === "/api/state-summary" && req.method === "GET") {
      try {
        await jsonResponse(res, 200, await getStateSummary());
      } catch (error) {
        console.error("GET /api/state-summary failed:", error.message);
        await jsonResponse(res, 500, { ok: false, error: "state_summary_failed" });
      }
      return;
    }
    if (url.pathname === "/api/login" && req.method === "POST") {
      try {
        const body = JSON.parse(await readBody(req));
        const auth = await authenticateUser(body.phone || body.username, body.password);
        if (!auth) {
          await jsonResponse(res, 401, { ok: false, reason: "invalid_credentials" });
          return;
        }
        await jsonResponse(res, 200, { ok: true, ...auth });
      } catch (error) {
        console.error("POST /api/login failed:", error.message);
        await jsonResponse(res, 400, { ok: false, reason: "login_failed" });
      }
      return;
    }
    if (url.pathname === "/api/admin/restore-largest-backup" && req.method === "POST") {
      if (!process.env.ADMIN_RESTORE_TOKEN || req.headers["x-admin-token"] !== process.env.ADMIN_RESTORE_TOKEN) {
        await jsonResponse(res, 403, { ok: false, reason: "forbidden" });
        return;
      }
      try {
        const restored = await restoreLargestDatabaseBackup();
        await jsonResponse(res, 200, {
          ok: true,
          backupId: restored.backupId,
          products: Array.isArray(restored.state.products) ? restored.state.products.length : 0,
          users: Array.isArray(restored.state.settings?.users) ? restored.state.settings.users.length : 0,
          staff: Array.isArray(restored.state.staff) ? restored.state.staff.length : 0,
        });
      } catch (error) {
        await jsonResponse(res, error.statusCode || 500, { ok: false, reason: error.message || "restore_failed" });
      }
      return;
    }
    if (url.pathname === "/api/admin/remove-save-check-products" && req.method === "POST") {
      if (!process.env.ADMIN_RESTORE_TOKEN || req.headers["x-admin-token"] !== process.env.ADMIN_RESTORE_TOKEN) {
        await jsonResponse(res, 403, { ok: false, reason: "forbidden" });
        return;
      }
      try {
        await jsonResponse(res, 200, { ok: true, ...(await removeSaveCheckProducts()) });
      } catch (error) {
        await jsonResponse(res, error.statusCode || 500, { ok: false, reason: error.message || "cleanup_failed" });
      }
      return;
    }
    if (url.pathname === "/api/state" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const nextState = JSON.parse(body);
        const result = await saveAppState(nextState);
        await jsonResponse(res, 200, { ok: true, ...(result || {}) });
      } catch (error) {
        const status = error.statusCode || 400;
        console.error("POST /api/state failed:", error.message);
        await jsonResponse(res, status, { ok: false, reason: error.message || "state_write_failed" });
      }
      return;
    }
    const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = normalize(join(root, requestPath));

    if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
    if (requestPath === "/index.html") {
      const html = await readFile(filePath, "utf8");
      res.end(html
        .replace("</head>", `${pwaHead}\n  </head>`)
        .replace("</body>", `${pwaScript}\n  </body>`));
      return;
    }
    createReadStream(filePath).pipe(res);
  }).listen(port, () => {
    console.log(`OA system running at http://localhost:${port}`);
  });
}

start();
