// Lobby spotlight: cut-out player image(s) over the arena backdrop. With several images they rotate every 15 s.
const interval = 15000;
const figure = document.querySelector('#spotlight');
const frames = [...figure.querySelectorAll('.picture img')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const credits = await fetch('/lobby/photos/credits.json').then(r => r.json()).catch(() => null);
const players = credits?.players ?? [];
let index = 0, front = 0, timer = 0, token = 0;

const src = player => '/lobby/photos/' + player.file;
const fit = player => { figure.dataset.fit = player.fit || 'crop'; };   // 'full': whole body in the air, no bottom fade
function preload(n) { const img = new Image(); img.src = src(players[n % players.length]); }
async function showPhoto(n) {
  const mine = ++token, player = players[n];
  const back = frames[1 - front];
  back.classList.remove('leaving');
  back.src = src(player);
  try { await back.decode(); } catch { return; }
  if (mine !== token) return;
  frames[front].classList.replace('visible', 'leaving');
  back.classList.add('visible');
  front = 1 - front;
  index = n;
  fit(player);
  preload(n + 1);
}
function schedule() {
  clearInterval(timer);
  if (reduced || players.length < 2) return;
  timer = setInterval(() => showPhoto((index + 1) % players.length), interval);
}
if (players.length) {
  frames[0].src = src(players[0]);
  frames[0].classList.add('visible');
  fit(players[0]);
  if (players.length > 1) preload(1);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInterval(timer); else schedule(); });
  schedule();
} else figure.hidden = true;
