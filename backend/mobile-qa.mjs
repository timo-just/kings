import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
let ws,room,device='mobile-qa';const api='https://kings-api.timo-just.workers.dev';
const call=async(path,body)=>{const r=await fetch(api+path,{method:body?'POST':'GET',headers:{...(room?{Authorization:'Bearer '+room.hostToken}:{}),'X-Kings-Device':device,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
try{
 room=await call('/rooms',{names:['Mobile QA A','Mobile QA B']});let v=await call(`/rooms/${room.room}/action`,{type:'hostPlayer',player:0});
 let category=false;
 for(let i=0;i<100&&!category;i++){
  if(v.state.over)v=await call(`/rooms/${room.room}/action`,{type:'next',revision:v.revision});
  v=await call(`/rooms/${room.room}/action`,{type:'draw',revision:v.revision});
  if(v.state.pending==='Dame'){v=await call(`/rooms/${room.room}/action`,{type:'category',category:'Mobile QA category',revision:v.revision});category=true;}
  if(v.state.pending)v=await call(`/rooms/${room.room}/action`,{type:'assign',player:0,revision:v.revision});
 }
 assert.ok(category);
 const info=await(await fetch('http://127.0.0.1:9234/json/version')).json();ws=new WebSocket(info.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data);if(pending.has(v.id)){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result);}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
 const page=async key=>{const c=await send('Target.createBrowserContext');const target=await send('Target.createTarget',{url:'https://timo-just.github.io/kings/?lang=de&update=ccced5381d'+(key?'#room='+room.room+'&key='+key:''),browserContextId:c.browserContextId});const s=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);return s;};
 const run=async(s,expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 const until=async(s,e)=>{for(let i=0;i<120;i++){if(await run(s,e))return;await new Promise(r=>setTimeout(r,150));}throw Error('Timeout: '+e);};
 const net="document.querySelector('script[type=module]').src.replace('/app.mjs','/network.mjs')";
 const host=await page(room.hostToken);await until(host,"!!document.getElementById('viewNav')&&document.querySelector('footer').textContent.includes('ccced5381d')");
 await until(host,`(async()=>!!(await import(${net})).roomView)()`);
 device=await run(host,`(async()=>{const n=await import(${net});await n.command({type:'takeover'});return n.deviceId;})()`);
 await until(host,"document.getElementById('hostPlayerDialog').open");await run(host,"document.querySelectorAll('#hostPlayerChoices button')[1].click()");await until(host,"!document.getElementById('hostPlayerDialog').open");
 assert.equal((await call('/rooms/'+room.room)).me,1);
 const click=label=>`[...document.querySelectorAll('#viewNav button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`;
 await run(host,click('Meine Kategorien'));await run(host,"document.getElementById('categoryInput').value='Leader idea';document.getElementById('categoryPreferences').requestSubmit()");await until(host,"document.getElementById('categoryQueue').textContent.includes('Leader idea')");assert.equal((await call('/rooms/'+room.room)).categories[1][0],'Leader idea');
 await run(host,click('Übersicht'));assert.equal(await run(host,"document.querySelectorAll('#leaderScores .leader-player').length"),2);
 await run(host,click('Spiel'));assert.equal(await run(host,"document.getElementById('leaderOverview').hidden&&document.getElementById('personal').hidden"),true);
 assert.equal(await run(host,"document.documentElement.scrollWidth<=innerWidth"),true);
 const screenshot=await send('Page.captureScreenshot',{format:'png'},host);await writeFile('mobile-game.png',Buffer.from(screenshot.data,'base64'));
 await run(host,"document.getElementById('statsOpen').click()");await until(host,"!!document.querySelector('#reasonChart [data-reason]')");assert.equal(await run(host,"document.getElementById('reasonChart').textContent.includes('Gläser')"),true);assert.equal(await run(host,"document.getElementById('reasonChartWrap').scrollWidth<=document.getElementById('reasonChartWrap').clientWidth"),true);assert.equal(await run(host,"/[👍❓]/u.test(document.getElementById('reasonChart').textContent)"),false);
 await run(host,"document.querySelector('#reasonChart [data-reason]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");assert.ok((await run(host,"document.getElementById('reasonDetail').textContent")).includes('Mobile QA'));
 assert.equal(await run(host,"(async()=>{const path=document.querySelector('script[type=module]').src.replace('/app.mjs','/history-chart.mjs');return (await(await import(path)).chartPng()).startsWith('data:image/png');})()"),true);
 await run(host,"document.getElementById('statsClose').click()");await run(host,click('Kategorienhistorie'));await until(host,"document.getElementById('categoryLibraryList').textContent.includes('Mobile QA category')");
 const guest=await page(room.invitations[0]);await until(guest,"!!document.getElementById('viewNav')&&!document.getElementById('personal').hidden");assert.equal(await run(guest,"document.getElementById('hostPlayerDialog').open"),false);await run(guest,click('Kategorienhistorie'));await until(guest,"document.getElementById('categoryLibraryList').textContent.includes('Mobile QA category')");
 const home=await page();await until(home,"!!document.getElementById('home')");assert.equal(await run(home,"document.querySelector('#home h1').textContent"),'Kings');assert.equal(await run(home,"getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"),'#8dd8ac');
 console.log('PASS: mobile host login, leader queue, screen navigation, shared category history for guest, glasses graph fits phone, reason symbols, PNG, green Kings home');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}finally{ws?.close();if(room?.room)await call('/rooms/'+room.room+'/abort',{confirm:'delete-room'});}
