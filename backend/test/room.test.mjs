import {env} from 'cloudflare:workers';
import {runInDurableObject} from 'cloudflare:test';
import {expect,it} from 'vitest';
import worker from '../worker.mjs';
async function call(path,body,key='',device='host-device'){
  const req=new Request('https://api.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'X-Kings-Device':device,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const res=await worker.fetch(req,env);return {status:res.status,data:await res.json()};
}
async function room(names=['Anna','Ben']){const r=await call('/rooms',{names});expect(r.status).toBe(201);return r.data;}
it('only the title holder sees and uses their role, with exactly three or one uses',async()=>{
 const r=await room();const stub=env.ROOMS.getByName(r.room);
 await runInDurableObject(stub,instance=>{const m=instance.get();m.state.thumb=0;m.state.thumbUses=3;m.state.question=1;m.state.pending='Dame';m.state.category='Filme';instance.put(m);});
 const a=(await call('/rooms/'+r.room,null,r.invitations[0])).data.state,b=(await call('/rooms/'+r.room,null,r.invitations[1])).data.state;
 expect(a.thumb).toBe(0);expect(a.thumbUses).toBe(3);expect(a.question).toBe(null);expect(b.thumb).toBe(null);expect(b.thumbUses).toBe(0);expect(b.question).toBe(1);
 expect((await call(`/rooms/${r.room}/action`,{type:'useTitle',kind:'10',player:0},r.invitations[1])).status).toBe(403);
 for(let i=0;i<3;i++){const used=await call(`/rooms/${r.room}/action`,{type:'useTitle',kind:'10',player:1},r.invitations[0]);expect(used.status).toBe(200);expect(used.data.state.thumbUses).toBe(2-i);expect(used.data.state.pending).toBe('Dame');}
 expect((await call(`/rooms/${r.room}/action`,{type:'useTitle',kind:'10',player:1},r.invitations[0])).status).toBe(403);
 const used=await call(`/rooms/${r.room}/action`,{type:'useTitle',kind:'Bube',player:0},r.invitations[1]);expect(used.status).toBe(200);expect(used.data.state.question).toBe(null);expect(used.data.state.players[0].score).toBe(8);
 expect((await call(`/rooms/${r.room}/action`,{type:'useTitle',kind:'Bube',player:0},r.invitations[1])).status).toBe(403);
 const host=(await call('/rooms/'+r.room,null,r.hostToken)).data.state;expect(host.players[1].received['10']).toBe(3);expect(host.players[0].distributed['10']).toBe(3);expect(host.players[1].distributed.Bube).toBe(1);expect(host.category).toBe('Filme');
});
it('queues append, reorder, remove and consume the drawing players next category',async()=>{
 const r=await room();let revision=0;
 for(const category of ['Filme','Tiere','Städte']){const v=await call(`/rooms/${r.room}/action`,{type:'categoryQueue',operation:'add',category,revision},r.invitations[0]);expect(v.status).toBe(200);revision=v.data.revision;}
 let v=await call(`/rooms/${r.room}/action`,{type:'categoryQueue',operation:'move',index:2,to:0,revision,player:1},r.invitations[0]);expect(v.data.categories).toEqual([['Städte','Filme','Tiere'],[]]);revision=v.data.revision;
 expect((await call(`/rooms/${r.room}/action`,{type:'categoryQueue',operation:'remove',index:0,revision:0},r.invitations[0])).status).toBe(409);
 v=await call(`/rooms/${r.room}/action`,{type:'categoryQueue',operation:'remove',index:1,revision},r.invitations[0]);revision=v.data.revision;
 await runInDurableObject(env.ROOMS.getByName(r.room),instance=>{const m=instance.get();m.state.deck=[{suit:'♣',rank:'Dame'}];instance.put(m);});
 v=await call(`/rooms/${r.room}/action`,{type:'draw',revision},r.hostToken);expect(v.data.state.category).toBe('Städte');expect(v.data.categories).toEqual([['Tiere'],[]]);
});
it('only active host or owner can abort; deleted games lose links and archive records',async()=>{
 const r=await room(),other=await room();
 expect((await call(`/rooms/${r.room}/abort`,{confirm:'delete-room'},r.invitations[0])).status).toBe(403);
 expect((await call(`/rooms/${r.room}/abort`,{confirm:'delete-room'},r.hostToken,'other-device')).status).toBe(403);
 expect((await call(`/rooms/${r.room}/abort`,{},r.hostToken)).status).toBe(400);
 expect((await call(`/rooms/${r.room}/abort`,{confirm:'delete-room'},r.hostToken)).data.deleted).toBe(true);
 expect([404,410]).toContain((await call('/rooms/'+r.room,null,r.hostToken)).status);
 expect((await call('/admin/rooms',null,'test-owner-only')).data.some(x=>x.id===r.room)).toBe(false);
 expect((await call('/rooms/'+other.room,null,other.hostToken)).status).toBe(200);
});
it('isolates rooms and forbids participants from drawing or reading the archive',async()=>{
  const a=await room(),b=await room();
  const read=await call('/rooms/'+a.room,null,a.invitations[0]);expect(read.data.role).toBe('player');expect(read.data.me).toBe(0);expect(read.data.invitations).toBeUndefined();expect(read.data.hostToken).toBeUndefined();
  expect((await call('/rooms/'+a.room+'/action',{type:'draw',revision:0},a.invitations[0])).status).toBe(403);
  expect((await call('/rooms/'+b.room,null,a.invitations[0])).status).toBe(403);
  expect((await call('/rooms/'+a.room+'/rounds',null,a.hostToken)).status).toBe(403);
  expect((await call('/admin/rooms')).status).toBe(403);
  expect((await call('/admin/rooms',null,'test-owner-only')).status).toBe(200);
});
it('only one controller may act; a takeover revokes the old device',async()=>{
  const r=await room();
  expect((await call(`/rooms/${r.room}/action`,{type:'draw',revision:0},r.hostToken,'other-device')).status).toBe(409);
  const takeover=await call(`/rooms/${r.room}/action`,{type:'takeover'},r.hostToken,'other-device');expect(takeover.status).toBe(200);
  expect((await call(`/rooms/${r.room}/action`,{type:'draw',revision:1},r.hostToken)).status).toBe(409);
  expect((await call(`/rooms/${r.room}/action`,{type:'draw',revision:1},r.hostToken,'other-device')).status).toBe(200);
});
it('records optional category and loser; persists scores and complete round files',async()=>{
  const r=await room();const stub=env.ROOMS.getByName(r.room);
  await runInDurableObject(stub,instance=>{const m=instance.get();m.state.deck=[{suit:'♣',rank:'Dame'}];instance.put(m);});
  let action=await call(`/rooms/${r.room}/action`,{type:'draw',revision:0},r.hostToken);expect(action.status).toBe(200);
  action=await call(`/rooms/${r.room}/action`,{type:'category',category:'Länder in Europa',revision:1},r.hostToken);expect(action.status).toBe(200);
  action=await call(`/rooms/${r.room}/action`,{type:'assign',player:1,revision:2},r.hostToken);expect(action.status).toBe(200);expect(action.data.state.players[1].score).toBe(8);
  const loaded=await call('/rooms/'+r.room,null,r.invitations[1]);expect(loaded.data.state.players[1].score).toBe(8);
  const events=await call(`/rooms/${r.room}/stats`,null,r.hostToken);expect(events.data.events.at(-1).data.category).toMatchObject({category:'Länder in Europa',loser:'Ben'});
  const file=await call(`/rooms/${r.room}/archive?round=1`,null,'test-owner-only');expect(file.status).toBe(200);expect(file.data.name).toContain('Anna_Ben');expect(file.data.summary.players[1].score).toBe(8);
  expect(file.data.roundStatistics[1].schluecke).toBe(8);
  await runInDurableObject(stub,instance=>{const row=instance.sql.exec('SELECT data FROM meta WHERE id=1').one();expect(JSON.parse(row.data).state.players[1].score).toBe(8);});
  const page=await call(`/rooms/${r.room}/stats?after=${events.data.cursor}`,null,r.hostToken);expect(page.data.events).toEqual([]);
});
it('participants edit only their own category list',async()=>{
  const r=await room();
  const updated=await call(`/rooms/${r.room}/action`,{type:'categoryList',categories:['Filme','Filme','Tiere'],player:1},r.invitations[0]);expect(updated.status).toBe(200);expect(updated.data.categories).toEqual([['Filme','Tiere'],[]]);
});
it('persists old rounds when continuing the same room',async()=>{
  const r=await room();await runInDurableObject(env.ROOMS.getByName(r.room),instance=>{const m=instance.get();m.state.over=true;m.state.players[0].score=20;instance.put(m);});
  const next=await call(`/rooms/${r.room}/action`,{type:'next',revision:0},r.hostToken);expect(next.status).toBe(200);expect(next.data.state.round).toBe(2);expect(next.data.state.players[0].score).toBe(20);
  expect((await call(`/rooms/${r.room}/rounds`,null,'test-owner-only')).data.length).toBe(2);
});
it('pushes state to a participant over an authenticated WebSocket',async()=>{
  const r=await room();
  const res=await worker.fetch(new Request(`https://api.test/rooms/${r.room}/live`,{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'kings, auth.'+r.invitations[1]}}),env);
  expect(res.status).toBe(101);const ws=res.webSocket;const messages=[];ws.addEventListener('message',event=>messages.push(JSON.parse(event.data)));ws.accept();
  await call(`/rooms/${r.room}/action`,{type:'draw',revision:0},r.hostToken);
  await new Promise(resolve=>setTimeout(resolve,50));expect(messages.some(m=>m.revision===1&&m.me===1&&m.role==='player')).toBe(true);expect(messages.every(m=>!m.invitations)).toBe(true);ws.close();
});
