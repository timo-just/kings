import assert from 'node:assert/strict';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for private deployment-check input (hidden).');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',async chunk=>{
 input+=chunk;if(!/[\r\n]/.test(input))return;process.stdin.pause();
 try{
  const {owner,room,key,player}=JSON.parse(input.trim());const base='https://kings-api.timo-just.workers.dev';
  const call=async(path,credential='',body=null,device='deployment-check')=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+credential,'X-Kings-Device':device,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  assert.equal((await call('/health')).status,200);
  assert.equal((await call('/rooms/'+room,player)).data.role,'player');
  assert.equal((await call('/rooms/'+room+'/action',player,{type:'draw',revision:0})).status,403);
  assert.equal((await call('/rooms/'+room+'/rounds',player)).status,403);
  assert.equal((await call('/admin/rooms')).status,403);
  assert.equal((await call('/admin/rooms',owner)).status,200);
  let snapshot=(await call('/rooms/'+room,key)).data;
  const ws=new WebSocket(base.replace('https:','wss:')+'/rooms/'+room+'/live',['kings','auth.'+player]);
  const updates=[];ws.onmessage=e=>updates.push(JSON.parse(e.data));await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;setTimeout(()=>reject(Error('WebSocket timeout')),10000).unref();});
  const changed=await call('/rooms/'+room+'/action',key,{type:'draw',revision:snapshot.revision});assert.equal(changed.status,200);
  await new Promise(r=>setTimeout(r,300));assert.ok(updates.some(v=>v.revision===changed.data.revision));assert.ok(updates.every(v=>!v.invitations));
  const cat=await call('/rooms/'+room+'/action',player,{type:'categoryList',categories:['Filme','Tiere']});assert.equal(cat.status,200);
  assert.equal((await call('/rooms/'+room,key)).data.categories[0][0],'Filme');
  const archive=await call('/rooms/'+room+'/archive?round=1',owner);assert.equal(archive.status,200);assert.ok(archive.data.roundStatistics);
  ws.close();
  console.log('PASS: live API, participant restrictions, owner archive, WebSocket updates, category preferences');
 }catch(e){console.error('FAIL:',e.message);process.exitCode=1;}
 process.exit(process.exitCode||0);
});
