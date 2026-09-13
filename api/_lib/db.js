import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pool = null;
let pgliteInstance = null;
let isUsingLocalFallback = false;

if (connectionString) {
  // Remote Postgres (Neon / Vercel Postgres / Supabase / Local Docker)
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  pool = new pg.Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle Postgres client:', err.message);
  });
} else {
  // Embedded local WASM Postgres fallback (PGlite) for zero-config testing
  isUsingLocalFallback = true;
}

async function getPglite() {
  if (!pgliteInstance) {
    const { PGlite } = await import('@electric-sql/pglite');
    // On Vercel, serverless filesystem is read-only except /tmp
    const isVercel = Boolean(process.env.VERCEL);
    const dataDir = process.env.PG_DATA_DIR || (isVercel ? '/tmp/pglite' : path.resolve(__dirname, '../../.data/pglite'));
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      } else {
        // Clean up stale postmaster.pid and lock files from crashed/killed processes
        const pidFile = path.join(dataDir, 'postmaster.pid');
        if (fs.existsSync(pidFile)) {
          try { fs.unlinkSync(pidFile); } catch (_) {}
        }
        const lockFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('.s.PGSQL') && f.includes('.lock'));
        lockFiles.forEach(f => {
          try { fs.unlinkSync(path.join(dataDir, f)); } catch (_) {}
        });
      }
    } catch (_) {}

    try {
      const instance = new PGlite(dataDir);
      await instance.waitReady;
      pgliteInstance = instance;
    } catch (err) {
      console.warn('PGlite data directory corrupted or failed to load. Re-initializing clean database...', err.message);
      try {
        if (typeof fs.rmSync === 'function') {
          fs.rmSync(dataDir, { recursive: true, force: true });
        }
        fs.mkdirSync(dataDir, { recursive: true });
        const cleanInstance = new PGlite(dataDir);
        await cleanInstance.waitReady;
        pgliteInstance = cleanInstance;
      } catch (fatalErr) {
        pgliteInstance = null;
        throw fatalErr;
      }
    }
  }
  return pgliteInstance;
}

export async function resetPglite(wipeDisk = false) {
  if (pgliteInstance) {
    try {
      if (typeof pgliteInstance.close === 'function') {
        await pgliteInstance.close().catch(() => {});
      }
    } catch (_) {}
    pgliteInstance = null;
  }
}

function isStaleFileError(err) {
  if (!err || !err.message) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('could not open file') ||
         msg.includes('no such file') ||
         msg.includes('closed') ||
         msg.includes('relation') ||
         msg.includes('cache lookup') ||
         err.code === 'XX000';
}

/**
 * Execute a parameterized query against either the Postgres pool or local PGlite.
 * @param {string} text - SQL statement
 * @param {Array} [params] - Parameter values
 * @returns {Promise<{ rows: Array, rowCount: number }>}
 */
export async function query(text, params = []) {
  if (pool) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.error('Database query error:', { query: text, error: err.message });
      throw err;
    }
  } else {
    // PGlite fallback with automatic recovery on stale file descriptors
    let pglite = await getPglite();
    try {
      const res = await pglite.query(text, params);
      return {
        rows: res.rows || [],
        rowCount: res.rows ? res.rows.length : (res.affectedRows || 0)
      };
    } catch (err) {
      if (isStaleFileError(err)) {
        console.warn('PGlite file descriptor error detected. Reconnecting client without wiping disk...', err.message);
        await resetPglite(false);
        pglite = await getPglite();
        const res = await pglite.query(text, params);
        return {
          rows: res.rows || [],
          rowCount: res.rows ? res.rows.length : (res.affectedRows || 0)
        };
      }
      console.error('PGlite query error:', { query: text, error: err.message });
      throw err;
    }
  }
}

/**
 * Execute a multi-statement SQL script (e.g. schema.sql)
 * @param {string} sql
 */
export async function exec(sql) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  } else {
    let pglite = await getPglite();
    try {
      await pglite.exec(sql);
    } catch (err) {
      if (isStaleFileError(err)) {
        console.warn('PGlite file descriptor error in exec. Reconnecting client without wiping disk...', err.message);
        await resetPglite(false);
        pglite = await getPglite();
        await pglite.exec(sql);
        return;
      }
      throw err;
    }
  }
}

/**
 * Acquire a transactional client
 */
export async function getClient() {
  if (pool) {
    const client = await pool.connect();
    return {
      query: (sql, params) => client.query(sql, params),
      release: () => client.release(),
    };
  } else {
    let pglite = await getPglite();
    return {
      query: async (sql, params) => {
        try {
          return await pglite.query(sql, params);
        } catch (err) {
          if (isStaleFileError(err)) {
            console.warn('PGlite transactional client error. Resetting instance and retrying...');
            await resetPglite();
            pglite = await getPglite();
            return await pglite.query(sql, params);
          }
          throw err;
        }
      },
      release: () => {},
    };
  }
}

/**
 * Check if the current environment is running on the local PGlite fallback
 */
export function isUsingFallback() {
  return isUsingLocalFallback;
}

/**
 * Gracefully close database connections
 */
export async function close() {
  if (pool) {
    await pool.end();
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
}

export default {
  query,
  getClient,
  isUsingFallback,
  close
};
