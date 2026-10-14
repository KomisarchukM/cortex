import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { openDatabase } from './database.js';
import { createApp } from './app.js';
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const localHttp =
  process.env.ALLOW_INSECURE_LOCAL === '1' &&
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.APP_ORIGIN || '');
if (production && !localHttp && !process.env.APP_ORIGIN?.startsWith('https://'))
  throw new Error('Production APP_ORIGIN must use HTTPS.');
const db = await openDatabase(process.env.DATABASE_URL || 'sqlite:./data/cortex.db');
const app = createApp(db, {
  origin: process.env.APP_ORIGIN || `http://localhost:${port}`,
  secret: process.env.SESSION_SECRET || '',
  username: process.env.ADMIN_USERNAME || '',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  production,
  secureCookies: production && !localHttp,
  trustProxy: process.env.TRUST_PROXY === '1',
});
if (production) {
  app.use(express.static(resolve('dist'), { maxAge: '1h', index: false }));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 1 } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, process.env.HOST || '127.0.0.1', (error?: Error) => {
  if (error) {
    console.error(
      `CORTEX could not start: ${error.message}. Stop the existing server or change PORT and APP_ORIGIN together.`,
    );
    process.exit(1);
  }
  console.log(`CORTEX listening on ${process.env.APP_ORIGIN || `http://localhost:${port}`}`);
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
