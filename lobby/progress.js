const storageKey = 'astra-court-achievements';
export const achievements = [
  ['firstServe', '첫 서비스', '싱글 플레이에서 직접 첫 서브 넣기'],
  ['firstReturn', '첫 리턴', '상대 타구를 코트 안에서 한 번 받아치기'],
  ['sixRally', '이어지는 랠리', '싱글 플레이 또는 AI 연습에서 6타 랠리 달성'],
];

export function readProgress() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
  catch { return {}; }
}

export function recordShot(shot, rally) {
  const keys = [];
  if (shot.id === 0) {
    keys.push(['short', 'long'].includes(shot.type) ? 'firstServe' : 'firstReturn');
  }
  if (rally >= 6) keys.push('sixRally');
  const progress = readProgress();
  if (!keys.some(key => !progress[key])) return;
  for (const key of keys) progress[key] ||= Date.now();
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch {}
}

