import { achievements, readProgress } from './progress.js';
import { defaults } from '../doubles/simulation.js';
import {career,tiers,winsToPromote} from '../doubles/ranks.js';
import './spotlight.js';
import { rewards, shop } from './catalog.js';

const panel = document.querySelector('#panel');
const body = document.querySelector('#panel-body');
const title = document.querySelector('#panel-title');
const accountLabel = document.querySelector('#account span');
let user = null;
let authAvailable = true;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(label, handler, className = 'link') {
  const node = element('button', label, className);
  node.type = 'button';
  node.onclick = handler;
  return node;
}
function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '/vendor/lucide/lobby.svg#' + name);
  svg.append(use); return svg;
}
function lockChip(text = '잠금') {
  const chip = element('span', undefined, 'lock-chip');
  chip.append(icon('lock'), text); return chip;
}
function contactLinks() {
  for (const link of document.querySelectorAll('.credit a')) {
    body.append(link.cloneNode(true), element('br'));
  }
}
async function accountRequest(action, values) {
  const response = await fetch('/api/account/' + action, values ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values)
  } : {cache:'no-store'});
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw Error('로그인은 로컬 게임 서버에서 이용할 수 있습니다.');
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '계정 정보를 불러오지 못했습니다.');
  user = data.user;
  showAccount();
}
// "아이디 B조" — the tier earned in single play follows the signed-in name.
function tierBadge(standing) {
  const badge = element('em', tiers[standing.rank].name, 'tier');
  badge.dataset.rank = standing.rank;
  return badge;
}
function showAccount() {
  if (!user) { accountLabel.textContent = '로그인'; return; }
  accountLabel.replaceChildren(user.name, ' ', tierBadge(user.standing));
}
const ready = accountRequest('me').catch(() => { authAvailable = false; });
const names = { login:'로그인', register:'계정 만들기', friends:'친구 추가', alerts:'알림', settings:'게임 설정',
  multi:'멀티 플레이', shop:'상점', profile:'프로필', achievements:'도전과제', privacy:'개인정보 처리방침', terms:'이용약관', contact:'문의하기' };
const info = {
  friends:'친구 추가와 초대 기능은 추후에 업데이트할 예정입니다.',
  alerts:'새 알림이 없습니다. 친구 초대 알림은 멀티 플레이 업데이트 후 제공됩니다.',
  multi:'멀티 플레이는 추후에 업데이트할 예정입니다. 지금은 싱글 플레이와 AI 연습을 이용할 수 있습니다.',
  privacy:'계정을 만들면 이 게임 서버의 데이터베이스에 아이디, 비밀번호 검증값, 최근 로그인 성공 시각 20건을 저장합니다. 비밀번호는 계정별 솔트를 사용해 해시로 저장합니다. 로그인 유지 쿠키는 7일간 유효하며 로그아웃하면 해당 세션이 해제됩니다. 설정과 도전과제는 이 브라우저에 저장됩니다. 계정 정보에 대한 문의는 아래 연락처로 보내 주세요.',
  terms:'로컬 플레이테스트 버전입니다. 싱글 플레이와 AI 연습은 게스트로도 이용할 수 있습니다. 다른 사람의 계정을 이용하거나 타인의 플레이를 방해하는 행위는 삼가 주세요.',
  contact:'플레이 중 겪은 문제나 개선 의견을 보내 주세요.'
};
function showAuth(registering) {
  if (!authAvailable) { body.append(element('p','현재 계정 서버에 연결할 수 없습니다. 게스트 플레이는 이용 가능합니다.')); return; }
  const form = element('form');
  const fields = {};
  for (const [key, label, type] of [['name','아이디','text'],['password','비밀번호','password']]) {
    const wrap = element('label', label, 'field');
    const input = element('input');
    input.name = key; input.type = type; input.required = true;
    input.minLength = key === 'name' ? 2 : 8; input.maxLength = key === 'name' ? 20 : 128;
    input.autocomplete = key === 'name' ? 'username' : registering ? 'new-password' : 'current-password';
    wrap.append(input); form.append(wrap); fields[key]=input;
  }
  if (registering) form.append(element('p','아이디는 한글·영문·숫자·밑줄 2~20자, 비밀번호는 8자 이상입니다.'));
  const error = element('p','','error'); error.setAttribute('role','alert');
  const submit = element('button',registering ? '계정 만들고 로그인' : '로그인','submit');
  form.append(error, submit);
  form.onsubmit = async event => {
    event.preventDefault(); submit.disabled = true; error.textContent = '';
    try {
      await accountRequest(registering ? 'register' : 'login', { name:fields.name.value, password:fields.password.value });
      if (panel.open && form.isConnected) show('profile', 'replace');
    } catch (err) { error.textContent = err.message; } finally { submit.disabled = false; }
  };
  body.append(form,button(registering ? '기존 계정으로 로그인' : '새 계정 만들기',()=>show(registering ? 'login' : 'register', 'push')));
  fields.name.focus();
}
function rankCard(standing) {
  const card = element('div', undefined, 'rank-card');
  const top = standing.rank === tiers.length - 1;
  const meter = element('div', undefined, 'meter');
  meter.style.setProperty('--fill', top ? 1 : standing.wins / winsToPromote);
  card.append(
    element('small', '싱글 플레이 등급'),
    element('strong', tiers[standing.rank].name),
    meter,
    element('span', top ? '최고 등급 · 국가대표' : standing.wins + ' / ' + winsToPromote + '승 · 다음 등급 ' + tiers[standing.rank + 1].name)
  );
  return card;
}
function showProfile() {
  if (!user) {
    let local = { rank: 0, wins: 0 };
    try { local = career(localStorage); } catch {}
    body.append(element('p','게스트로 플레이 중입니다. 등급은 이 브라우저에만 저장됩니다.'), rankCard(local), button('로그인하고 계정에 등급 저장',()=>show('login', 'push')), rewardList(local));
    return;
  }
  const heading = element('h3', user.name + ' ', 'profile-name');
  heading.append(tierBadge(user.standing));
  body.append(heading, rankCard(user.standing), element('p','최근 로그인 기록'));
  const list = element('ul',undefined,'rows');
  for (const time of user.logins) list.append(element('li',new Date(time).toLocaleString('ko-KR')));
  const status = element('p','','error');
  const logout = button('로그아웃',async()=>{
    logout.disabled = true;
    try { await accountRequest('logout',{}); if (logout.isConnected) show('profile', 'replace'); }
    catch (err) { status.textContent = err.message; logout.disabled = false; }
  });
  body.append(list,logout,status,rewardList(user.standing));
}
// Profile cosmetics per tier: shown as a roadmap, all locked until the progression update.
function rewardList(standing) {
  const box = element('section', undefined, 'rewards');
  box.append(element('h3', '등급 보상 · 프로필 꾸미기'),
    element('p', '승급할 때마다 프로필을 꾸밀 수 있는 보상을 얻습니다. 아직 모든 보상이 잠겨 있으며 추후 업데이트할 예정입니다.'));
  const list = element('ol', undefined, 'reward-list');
  for (const reward of rewards) {
    const item = element('li', undefined, standing.rank >= reward.tier ? 'reached' : '');
    const tile = element('span', undefined, 'reward-icon'); tile.append(icon(reward.icon));
    const copy = element('span', undefined, 'reward-copy');
    copy.append(element('strong', reward.name), element('small', tiers[reward.tier].name + ' 승급 시 획득 · ' + reward.detail));
    item.append(tile, copy, lockChip('추후 업데이트'));
    list.append(item);
  }
  box.append(list); return box;
}
// Shop preview: coins from wins buy equipment. Everything except the starter kit is locked for now.
function showShop() {
  const wallet = element('div', undefined, 'wallet');
  const coins = element('span', undefined, 'coins'); coins.append(icon('coins'), element('b', '0'), ' 코인');
  wallet.append(coins, element('small', '경기에서 이길수록 코인을 얻어 장비를 살 수 있습니다. 코인과 구매 기능은 추후 업데이트할 예정입니다.'), lockChip());
  const tabs = element('div', undefined, 'shop-tabs'); tabs.setAttribute('role', 'tablist');
  const shelf = element('ul', undefined, 'shelf');
  function open(category) {
    for (const tab of tabs.children) tab.setAttribute('aria-selected', String(tab.dataset.id === category.id));
    shelf.replaceChildren();
    for (const item of category.items) {
      const row = element('li', undefined, item.owned ? 'owned' : 'locked');
      const preview = element('span', undefined, 'preview'); preview.append(icon(category.icon));
      const copy = element('span', undefined, 'item-copy');
      const specs = element('span', undefined, 'specs');
      for (const [k, v] of item.specs) specs.append(element('span', k + ' ' + v));
      copy.append(element('strong', item.name), specs, element('small', item.effect));
      const side = element('span', undefined, 'price');
      if (item.owned) side.append(element('em', '장착 중'));
      else { const cost = element('b'); cost.append(icon('coins'), item.price.toLocaleString('ko-KR')); side.append(cost, lockChip()); }
      row.append(preview, copy, side); shelf.append(row);
    }
  }
  for (const category of shop) {
    const tab = element('button', undefined, 'shop-tab'); tab.type = 'button'; tab.dataset.id = category.id;
    tab.setAttribute('role', 'tab'); tab.append(icon(category.icon), category.name);
    tab.onclick = () => open(category); tabs.append(tab);
  }
  body.append(wallet, tabs, shelf, element('p', '모든 장비는 미리 보기입니다. 능력치 효과와 구매는 업데이트 후 적용됩니다.', 'note'));
  open(shop[0]);
}
function showSettings() {
  const key = 'astra-doubles-settings';
  function read() { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
  for (const [name, label, min, max] of [['sensitivity','마우스 감도',.25,2.5],['swingLook','스윙 중 시점 감도',.05,.8],['volume','타구 음량',0,1]]) {
    const wrap = element('label',label,'field'), input = element('input'), value = element('output');
    input.type='range'; input.min=min; input.max=max; input.step=.05; input.value=read()[name] ?? defaults[name]; input.setAttribute('aria-label',label);
    const display=()=>{value.textContent=name==='sensitivity'?Number(input.value).toFixed(2)+'×':Math.round(input.value*100)+'%';};
    input.oninput=()=>{display();try { localStorage.setItem(key,JSON.stringify({...read(),[name]:Number(input.value)})); } catch {}};
    display();wrap.append(value,input);body.append(wrap);
  }
}
// Back button: panels opened from inside a panel (login -> register, profile -> login) go back one step;
// otherwise back returns to the lobby.
let trail = [];
function show(name, mode = 'reset') {
  if (!panel.open || mode === 'reset') trail = [name];
  else if (mode === 'push') trail.push(name);
  else trail[trail.length - 1] = name;
  render(name);
}
function render(name) {
  title.textContent = names[name]; body.replaceChildren(); panel.dataset.panel = name;
  if (!panel.open) panel.showModal();
  if (name==='shop') return showShop();
  if (name==='login' || name==='register') return showAuth(name==='register');
  if (name==='profile') return showProfile();
  if (name==='settings') return showSettings();
  if (name==='achievements') {
    const progress=readProgress(),list=element('ul',undefined,'rows');
    body.append(element('p','이 브라우저에서 달성한 기록입니다.'));
    for (const [key, label, goal] of achievements) {
      const item=element('li',label+' · '+(progress[key]?'달성':'미달성'),progress[key]?'done':'');
      item.append(element('small',goal));list.append(item);
    }
    body.append(list);return;
  }
  body.append(element('p',info[name]));
  if (name==='privacy' || name==='contact') contactLinks();
}
document.querySelectorAll('[data-panel]').forEach(node=>node.onclick=async()=>{
  if(node.dataset.panel==='profile') await ready;
  show(node.dataset.panel);
});
document.querySelector('#account').onclick=async()=>{await ready;show(user?'profile':'login');};
document.querySelector('#close').onclick=()=>panel.close();
document.querySelector('#back').onclick=()=>{ trail.pop(); if (trail.length) render(trail.at(-1)); else panel.close(); };
panel.addEventListener('click',event=>{
  if(event.target!==panel)return;
  const r=panel.getBoundingClientRect();
  if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)panel.close();
});
