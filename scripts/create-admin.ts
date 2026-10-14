import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createInterface, emitKeypressEvents } from 'node:readline';
import { passwordHash, token } from '../server/auth.js';
const generated = process.argv.includes('--generate');
async function readHidden(prompt: string) {
  if (!process.stdin.isTTY)
    throw new Error('Use an interactive terminal, or --generate for local development.');
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let text = '';
    const onKey = (_str: string, key: any) => {
      if (key.ctrl && key.name === 'c') {
        clean();
        reject(new Error('Canceled'));
      } else if (key.name === 'return') {
        clean();
        resolve(text);
      } else if (key.name === 'backspace') text = text.slice(0, -1);
      else if (key.sequence && !key.ctrl && !key.meta && !key.sequence.includes('\u001b'))
        text += key.sequence;
    };
    function clean() {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    }
    process.stdin.on('keypress', onKey);
  });
}
let username = 'operator',
  password: string;
if (generated) {
  password = token();
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  username = await new Promise<string>((resolve) =>
    rl.question('Operator username [operator]: ', (value) => resolve(value.trim() || 'operator')),
  );
  rl.close();
  password = await readHidden('Choose a password (12+ characters; input hidden): ');
}
const hash = await passwordHash(password);
let env = existsSync('.env') ? readFileSync('.env', 'utf8') : readFileSync('.env.example', 'utf8');
function set(name: string, value: string) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, line) : `${env}\n${line}\n`;
}
set('ADMIN_USERNAME', JSON.stringify(username));
set('ADMIN_PASSWORD_HASH', hash);
if (!/^SESSION_SECRET=.{32,}$/m.test(env)) set('SESSION_SECRET', token());
writeFileSync('.env', env, { mode: 0o600 });
if (generated) {
  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/operator-credentials.txt',
    `Local development only\nUsername: ${username}\nPassword: ${password}\nAdmin: http://localhost:3000/admin\nDelete this file after storing the password.\n`,
    { mode: 0o600 },
  );
  console.log(
    'Local credentials written to ignored data/operator-credentials.txt. Secrets configured in .env.',
  );
} else {
  if (existsSync('data/operator-credentials.txt')) unlinkSync('data/operator-credentials.txt');
  console.log(
    'Admin hash configured in .env. Any old generated credential file was removed. Development restarts automatically; restart a production process.',
  );
}
