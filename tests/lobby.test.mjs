import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createAccounts } from '../lobby/accounts.mjs';
import { createMatch, defaults } from '../doubles/simulation.js';

test('AI practice repeats opponent feeds to the human without changing the score', () => {
  const game = createMatch({...defaults}, () => .1, true);
  game.start();
  for (let feed = 0; feed < 3; feed++) {
    assert.equal(game.s.server,2);
    assert.equal(game.s.receiver,0);
    for(let i=0;i<430 && game.s.phase==='serve';i++) game.tick(1/120);
    assert.equal(game.s.lastShot.id,2);
    for(let i=0;i<1500 && game.s.phase!=='serve';i++) game.tick(1/120);
    assert.equal(game.s.phase,'serve');
    assert.deepEqual(game.s.score,[0,0]);
  }
});

test('account sessions survive reopening, record successful logins and invalidate on logout',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'astra-lobby-'));
  const file=path.join(dir,'accounts.sqlite');
  let accounts=createAccounts(file);
  const server=http.createServer((req,res)=>accounts.handle(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));accounts.close();
    await rm(dir,{recursive:true,force:true});
  });
  const root='http://127.0.0.1:'+server.address().port+'/api/account/';
  const credentials={name:'리시버',password:'test-password-123'};
  const send=(action,data,cookie='',headers={})=>fetch(root+action,data ? {method:'POST',headers:{'Content-Type':'application/json',cookie,...headers},body:JSON.stringify(data)}:{headers:{cookie}});
  const created=await send('register',credentials);
  assert.equal(created.status,201);
  assert.match(created.headers.get('set-cookie'),/HttpOnly/);
  const firstCookie=created.headers.get('set-cookie').split(';')[0];
  assert.equal((await created.json()).user.logins.length,1);
  assert.equal((await send('register',credentials)).status,409);
  assert.equal((await send('login',{...credentials,password:'wrong-password'})).status,401);
  assert.equal((await send('logout',{},firstCookie,{origin:'http://different.example'})).status,403);
  assert.equal((await send('logout',{},firstCookie)).status,200);
  assert.equal((await (await send('me',null,firstCookie)).json()).user,null);
  const login=await send('login',credentials);
  const nextCookie=login.headers.get('set-cookie').split(';')[0];
  assert.notEqual(firstCookie,nextCookie);
  assert.equal((await login.json()).user.logins.length,2);
  accounts.close();accounts=createAccounts(file);
  assert.equal((await (await send('me',null,nextCookie)).json()).user.name,credentials.name);
  const stored=new DatabaseSync(file,{readOnly:true});
  try {
    const row=stored.prepare('SELECT verifier,salt FROM accounts').get();
    assert.equal(row.verifier.length,64);assert.equal(row.salt.length,32);
    assert.equal(stored.prepare('SELECT count(*) AS n FROM logins').get().n,2);
    assert.notEqual(stored.prepare('SELECT token FROM sessions').get().token,nextCookie.split('=')[1]);
  } finally { stored.close(); }
});
