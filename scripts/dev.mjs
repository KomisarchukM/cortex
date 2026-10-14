import { spawn } from 'node:child_process';
import { watch, watchFile, unwatchFile, existsSync, statSync } from 'node:fs';
let child,
  restarting = false,
  closing = false,
  timer;
const watchers = [];
function start() {
  child = spawn(process.execPath, ['--experimental-sqlite', '--import', 'tsx', 'server/index.ts'], {
    stdio: 'inherit',
  });
  child.once('exit', () => {
    child = undefined;
    if (closing) process.exit(0);
    if (restarting) {
      restarting = false;
      start();
    } else console.log('Server stopped. Waiting for a source or .env change…');
  });
}
function restart() {
  if (closing) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log('CORTEX: restarting after a source/configuration change…');
    if (child) {
      restarting = true;
      child.kill();
    } else start();
  }, 300);
}
for (const directory of ['server', 'shared'])
  watchers.push(
    watch(directory, { recursive: true }, (_event, name) => {
      if (name && /\.(ts|js)$/.test(String(name))) restart();
    }),
  );
// fs.watch misses atomic replacement of .env on some platforms; poll this one small file.
let envTimestamp = existsSync('.env') ? statSync('.env').mtimeMs : 0;
watchFile('.env', { interval: 500 }, (current) => {
  if (current.mtimeMs !== envTimestamp) {
    envTimestamp = current.mtimeMs;
    restart();
  }
});
function stop() {
  closing = true;
  clearTimeout(timer);
  watchers.forEach((w) => w.close());
  unwatchFile('.env');
  if (child) child.kill();
  else process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
start();
