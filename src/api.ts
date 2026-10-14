export let csrf = '';
export const setCsrf = (v: string) => {
  csrf = v;
};
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-cortex-request': '1',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error + (data.issues ? `: ${data.issues.join('; ')}` : ''));
  return data;
}
export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
export function tone() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
  gain.gain.setValueAtTime(0.035, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  osc.frequency.value = 620;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
  osc.onended = () => void ctx.close();
}
