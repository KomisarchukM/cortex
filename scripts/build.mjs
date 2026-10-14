import { execFileSync } from 'node:child_process';
// A development .env must never select React's development bundle during build.
const env = { ...process.env, NODE_ENV: 'production' };
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env,
});
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.server.json'], {
  stdio: 'inherit',
  env,
});
