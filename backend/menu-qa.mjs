import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4173/';const live=process.argv.includes('--live');
let ws;
try{
 const info=await(await fetch('http://127.0.0.1:9228/json/version')).json();ws=new WebSocket(info.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data);if(pending.has(v.id)){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result);}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
 const page=async url=>{const context=await send('Target.createBrowserContext');const target=await send('Target.createTarget',{url,browserContextId:context.browserContextId});return(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;};
 const run=async(s,expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 const until=async(s,e)=>{for(let i=0;i<100;i++){if(await run(s,e))return;await new Promise(r=>setTimeout(r,150));}throw Error('Timeout: '+e);};
 const host=await page(base);await until(host,"!!document.getElementById('home')&&!document.getElementById('home').hidden");assert.equal(await run(host,"document.getElementById('setup').hidden"),true);
 const change=async lang=>run(host,`document.getElementById('languageSelect').value='${lang}';document.getElementById('languageSelect').dispatchEvent(new Event('change'))`);
 await change('en');assert.equal(await run(host,"document.getElementById('menuNew').textContent"),'New game');assert.equal(await run(host,"document.documentElement.lang"),'en');
 await change('de');assert.equal(await run(host,"document.getElementById('menuNew').textContent"),'Neues Spiel');
 await change('en');await send('Page.reload',{},host);await until(host,"!!document.getElementById('menuNew')&&document.getElementById('menuNew').textContent==='New game'");
 await run(host,"document.getElementById('menuNew').click()");assert.equal(await run(host,"document.querySelector('#setup h1').textContent"),'Who is playing?');assert.equal(await run(host,"document.getElementById('onlineSetup').checked"),true);
 if(live){
  await run(host,"document.querySelectorAll('#fields input')[0].value='Menu-QA';document.querySelectorAll('#fields input')[1].value='Guest-QA';document.getElementById('names').requestSubmit()");
  await until(host,"document.getElementById('roomDialog').open");const links=await run(host,"[...document.querySelectorAll('#invitationList input')].map(i=>i.value)");assert.equal(links.length,3);assert.equal(new Set(links).size,3);assert.ok(links.every(l=>l.includes('lang=en')&&l.includes('#room=')&&l.includes('&key=')));
  const guest=await page(links[1]);await until(guest,"!!document.getElementById('personal')&&!document.getElementById('personal').hidden");assert.equal(await run(guest,"document.documentElement.lang"),'en');assert.equal(await run(guest,"document.getElementById('personalName').textContent"),'Menu-QA');assert.equal(await run(guest,"document.querySelector('#categoryPreferences button').textContent"),'Add to queue');
  await run(host,"document.getElementById('roomClose').click();document.getElementById('draw').click()");await until(guest,"document.getElementById('remaining').textContent==='1/32'");
  await run(guest,"document.getElementById('statsOpen').click()");await until(guest,"document.getElementById('statistics').open");assert.equal(await run(guest,"document.getElementById('tab-log').textContent"),'Game log');assert.ok((await run(guest,"document.getElementById('eventLog').textContent")).includes('draws'));
  await run(host,"if(document.getElementById('categoryDialog').open)document.getElementById('categorySkip').click();window.confirm=()=>true;document.getElementById('roomOpen').click();document.getElementById('abortGame').click()");await until(host,"!document.getElementById('home').hidden");
 }
 console.log('PASS: main menu, German/English toggle, persistence, game setup'+(live?', unique language-aware invitation links, English guest view, English log and live updates':''));
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}finally{ws?.close();}
