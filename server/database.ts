import { Pool, type PoolClient } from 'pg';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export interface Database {
  dialect: 'sqlite' | 'postgres';
  query<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(url: string): Promise<Database> {
  if (url.startsWith('postgres')) {
    const pool = new Pool({ connectionString: url, max: 5 });
    const adapter = (client?: PoolClient): Database => ({
      dialect: 'postgres',
      query: async (sql, params = []) => {
        let n = 0;
        return (
          await (client || pool).query(
            sql.replace(/\?/g, () => `$${++n}`),
            params,
          )
        ).rows;
      },
      exec: async (sql) => {
        await (client || pool).query(sql);
      },
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const result = await fn(adapter(c));
          await c.query('COMMIT');
          return result;
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally {
          c.release();
        }
      },
      close: async () => {
        await pool.end();
      },
    });
    const db = adapter();
    await migrate(db);
    return db;
  }
  const path = url.replace(/^sqlite:/, '');
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const { DatabaseSync } = await import('node:sqlite').catch(() => {
    throw new Error(
      'SQLite requires Node 22.12+ and its startup flag. Use npm run dev / npm start, or upgrade to Node 24.',
    );
  });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const raw: Database = {
    dialect: 'sqlite',
    query: async (sql, params = []) => {
      const statement = sqlite.prepare(sql);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(sql) || /\bRETURNING\b/i.test(sql))
        return statement.all(...params) as any;
      statement.run(...params);
      return [];
    },
    exec: async (sql) => {
      sqlite.exec(sql);
    },
    transaction: async (fn) => fn(raw),
    close: async () => {
      sqlite.close();
    },
  };
  // Serialize all SQLite operations, including reads, around asynchronous transactions.
  let queue: Promise<any> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const db: Database = {
    dialect: 'sqlite',
    query: (sql, p) => locked(() => raw.query(sql, p)),
    exec: (sql) => locked(() => raw.exec(sql)),
    transaction: (fn) =>
      locked(async () => {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(raw);
          sqlite.exec('COMMIT');
          return result;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      }),
    close: () => locked(() => raw.close()),
  };
  await migrate(db);
  return db;
}
async function migrate(db: Database) {
  await db.exec(readFileSync(resolve('database/001_initial.sql'), 'utf8'));
  await db.query(
    'INSERT INTO migrations(version,applied_at) VALUES(?,?) ON CONFLICT(version) DO NOTHING',
    [1, new Date().toISOString()],
  );
}
