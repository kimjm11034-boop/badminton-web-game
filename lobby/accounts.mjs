import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { standing, tiers, winsToPromote } from '../doubles/ranks.js';

const derive = promisify(scrypt);
const cookieName = 'astra_session';
const week = 7 * 24 * 3600;
const digest = value => createHash('sha256').update(value).digest('hex');
const deny = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function createAccounts(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, salt TEXT NOT NULL, verifier BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, account INTEGER NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logins (
      id INTEGER PRIMARY KEY, account INTEGER NOT NULL REFERENCES accounts(id), at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS login_owner ON logins(account,id);
    CREATE TABLE IF NOT EXISTS ranked_wins (
      account INTEGER NOT NULL REFERENCES accounts(id), match TEXT NOT NULL, rank INTEGER NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY(account,match)
    );
  `);
  const attempts = new Map();
  function throttle(ip) {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const usage = attempts.get(ip) ?? { count: 0, until: now + 600000 };
    attempts.set(ip, usage);
    if (++usage.count > 25) deny(429, '잠시 후 다시 시도해 주세요.');
  }
  function career(account) {
    const wins = tiers.map(() => 0);
    for (const row of db.prepare('SELECT rank, count(*) AS n FROM ranked_wins WHERE account=? GROUP BY rank').all(account))
      if (tiers[row.rank]) wins[row.rank] = row.n;
    return standing(wins);
  }
  function profile(account) {
    const user = db.prepare('SELECT name FROM accounts WHERE id=?').get(account);
    user.logins = db.prepare('SELECT at FROM logins WHERE account=? ORDER BY id DESC LIMIT 5').all(account).map(row => row.at);
    user.standing = career(account);
    return user;
  }
  async function readJson(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2048) deny(413, '입력 내용이 너무 깁니다.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { deny(400, '입력을 확인해 주세요.'); }
  }
  async function handle(req, res, url) {
    const reply = (code, value) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    try {
      const action = url.pathname.slice('/api/account/'.length);
      const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName+'='))?.slice(cookieName.length+1) || '';
      const tokenHash = digest(token);
      const now = Date.now();
      const session = db.prepare('SELECT account FROM sessions WHERE token=? AND expires>?').get(tokenHash, now);
      if (req.method === 'GET' && action === 'me') return reply(200, { user: session ? profile(session.account) : null });
      if (!['register', 'login', 'logout', 'result'].includes(action)) deny(404, '지원하지 않는 요청입니다.');
      if (req.method !== 'POST') deny(405, '지원하지 않는 요청 방식입니다.');
      if ((req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') deny(403, '이 주소에서 요청할 수 없습니다.');
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') deny(415, 'JSON 요청이 필요합니다.');
      const cookie = (value, age) => res.setHeader('Set-Cookie', cookieName+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(req.socket.encrypted?'; Secure':''));
      if (action === 'logout') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash);
        cookie('', 0);
        return reply(200, { user: null });
      }
      if (action === 'result') {
        // A ranked single-player win counts once per match, only at the account's current tier.
        if (!session) deny(401, '로그인 후 계정에 등급이 저장됩니다.');
        const result = await readJson(req);
        if (typeof result?.match !== 'string' || !/^\d{1,10}(?:-\d{1,10}){3}$/.test(result.match) || !Number.isInteger(result.rank) || !tiers[result.rank] || typeof result.won !== 'boolean')
          deny(400, '경기 결과를 확인해 주세요.');
        const current = career(session.account);
        if (result.won && result.rank === current.rank && current.wins < winsToPromote)
          db.prepare('INSERT OR IGNORE INTO ranked_wins VALUES(?,?,?,?)').run(session.account, result.match, result.rank, now);
        return reply(200, { user: profile(session.account) });
      }
      throttle(req.socket.remoteAddress);
      const data = await readJson(req);
      const name = typeof data?.name === 'string' ? data.name.trim().normalize('NFC') : '';
      const password = data?.password;
      if (!/^[가-힣a-zA-Z0-9_]{2,20}$/u.test(name) || typeof password !== 'string' || password.length < 8 || password.length > 128)
        deny(400, '아이디는 한글·영문·숫자·밑줄 2~20자, 비밀번호는 8~128자로 입력하세요.');
      let account = db.prepare('SELECT * FROM accounts WHERE name=?').get(name);
      const registering = action === 'register';
      const salt = registering ? randomBytes(16).toString('hex') : account?.salt ?? '00000000000000000000000000000000';
      const verifier = await derive(password, salt, 64);
      if (!registering && (!account || !timingSafeEqual(verifier,account.verifier))) deny(401, '아이디 또는 비밀번호를 확인하세요.');
      const fresh = randomBytes(32).toString('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (registering) {
          const insert = db.prepare('INSERT INTO accounts(name,salt,verifier) VALUES(?,?,?) ON CONFLICT(name) DO NOTHING').run(name,salt,verifier);
          if (!insert.changes) deny(409, '이미 사용 중인 아이디입니다.');
          account = { id: insert.lastInsertRowid };
        }
        db.prepare('DELETE FROM sessions WHERE expires<=? OR token=?').run(now, tokenHash);
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(fresh), account.id, now+week*1000);
        db.prepare('INSERT INTO logins(account,at) VALUES(?,?)').run(account.id, now);
        db.prepare('DELETE FROM logins WHERE account=? AND id NOT IN (SELECT id FROM logins WHERE account=? ORDER BY id DESC LIMIT 20)').run(account.id, account.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      cookie(fresh, week);
      reply(registering ? 201 : 200, { user: profile(account.id) });
    } catch (error) {
      if (!error.status) console.error('Account service:', error.message);
      reply(error.status || 500, { error: error.status ? error.message : '계정 요청을 처리하지 못했습니다.' });
    }
  }
  return { handle, close: () => db.close() };
}

