import {DurableObject} from 'cloudflare:workers';
import {newGame,draw,assign,selectMode} from '../engine.mjs';

const origin='https://timo-just.github.io';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Access-Control-Allow-Origin':origin,'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(`KINGS${status}:${message}`),{status});};
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
const clean=(v,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
function safeName(s){return s.normalize('NFKC').replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,45);}
function filename(date,players){const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(date));return `${d.replace(/[ :]/g,'_')}_${players.map(p=>safeName(p.name)).join('_')}`;}
export class KingsIndex extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT,created TEXT)');}
  register(id,name,created){this.sql.exec('INSERT OR IGNORE INTO rooms VALUES(?,?,?)',id,name,created);}
  list(before='9999',limit=50){return this.sql.exec('SELECT * FROM rooms WHERE created < ? ORDER BY created DESC LIMIT ?',before,limit).toArray();}
}
export class KingsRoom extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, round INTEGER, at TEXT, kind TEXT, data TEXT)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS event_round ON events(round,id)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rounds(id INTEGER PRIMARY KEY, name TEXT, started TEXT, ended TEXT, summary TEXT, initial TEXT)');
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }
  get(){const row=this.sql.exec('SELECT data FROM meta WHERE id=1').toArray()[0];if(!row)fail('Spielraum nicht gefunden.',404);return JSON.parse(row.data);}
  put(m){this.sql.exec('INSERT OR REPLACE INTO meta VALUES(1,?)',JSON.stringify(m));}
  role(m,digest,owner){if(owner)return {role:'owner',me:null};if(equal(m.hostHash,digest))return {role:'host',me:null};const me=m.playerHashes.findIndex(h=>equal(h,digest));if(me>=0)return {role:'player',me};fail('Dieser Einladungslink ist ungültig.',403);}
  initialize(id,names,credentials,device){
    if(this.sql.exec('SELECT id FROM meta').toArray().length)fail('Spielraum existiert bereits.',409);
    const state=newGame(names),created=new Date().toISOString();
    const m={id,created,name:filename(created,state.players),hostHash:credentials.hostHash,playerHashes:credentials.playerHashes,playerTokens:credentials.playerTokens,controller:device,revision:0,state,categories:state.players.map(()=>[])};
    this.ctx.storage.transactionSync(()=>{this.put(m);this.startRound(m);this.event(m,'start',[]);});return this.view(m,{role:'host',me:null});
  }
  startRound(m){const at=new Date().toISOString();this.sql.exec('INSERT INTO rounds(id,name,started,summary,initial) VALUES(?,?,?,?,?)',m.state.round,filename(at,m.state.players),at,JSON.stringify(m.state),JSON.stringify(m.state.players));}
  event(m,kind,lines){this.sql.exec('INSERT INTO events(round,at,kind,data) VALUES(?,?,?,?)',m.state.round,new Date().toISOString(),kind,JSON.stringify({lines,scores:m.state.players.map(p=>p.score),category:m.state.categoryResults?.at(-1)||null}));}
  view(m,actor){
    const state=structuredClone(m.state);state.deck=Array(state.deck.length).fill(null);state.log=[];state.categoryResults=[];
    const out={state,role:actor.role,me:actor.me,revision:m.revision,room:m.id,name:m.name,categories:m.categories};
    if(actor.role==='host'||actor.role==='owner'){out.invitations=m.playerTokens;out.controller=m.controller;}
    return out;
  }
  read(digest,owner){const m=this.get();return this.view(m,this.role(m,digest,owner));}
  action(digest,owner,input,device){
    const m=this.get(),actor=this.role(m,digest,owner),s=m.state;
    if(!input||typeof input!=='object')fail('Ungültige Aktion.');
    if(input.type==='categoryList'){
      if(actor.role!=='player')fail('Bitte den persönlichen Spielerlink verwenden.',403);
      if(!Array.isArray(input.categories)||input.categories.length>30)fail('Maximal 30 Kategorien.');
      m.categories[actor.me]=[...new Set(input.categories.map(v=>clean(v)).filter(Boolean))];
    }else{
      if(actor.role!=='host'&&actor.role!=='owner')fail('Nur die Spielleitung darf das Spiel steuern.',403);
      if(input.type==='takeover'){m.controller=device;}
      else{
        if(m.controller!==device)fail('Ein anderes Gerät leitet dieses Spiel. Übernimm zuerst ausdrücklich die Spielleitung.',409);
        if(input.revision!==m.revision)fail('Der Spielstand hat sich geändert. Bitte erneut versuchen.',409);
        let ok=true;
        if(input.type==='draw')ok=draw(s);
        else if(input.type==='assign'){if(!Number.isInteger(input.player)||!s.players[input.player])fail('Ungültiger Spieler.');ok=assign(s,input.player);}
        else if(input.type==='mode')ok=['10','Bube'].includes(input.mode)&&selectMode(s,input.mode);
        else if(input.type==='category'){if(s.pending!=='Dame')fail('Keine Kategorie offen.');s.category=clean(input.category);}
        else if(input.type==='next'){
          if(!s.over)fail('Die aktuelle Runde läuft noch.');
          m.state=newGame([],s);m.state.log=[];m.state.categoryResults=[];m.state.players.forEach(p=>p.history=[p.score]);
        }else fail('Unbekannte Aktion.');
        if(!ok)fail(s.message||'Aktion zurzeit nicht möglich.');
      }
    }
    m.revision++;
    this.ctx.storage.transactionSync(()=>{
      const lines=m.state.log.splice(0);this.event(m,input.type,lines);
      if(input.type==='next')this.startRound(m);
      this.sql.exec('UPDATE rounds SET summary=?, ended=? WHERE id=?',JSON.stringify(m.state),m.state.over?new Date().toISOString():null,m.state.round);
      // SQL events hold the complete time series; live state stays small over months.
      m.state.players.forEach(p=>p.history=[p.score]);m.state.categoryResults=[];this.put(m);
    });
    this.broadcast(m);return this.view(m,actor);
  }
  statistics(digest,owner,before=0,round=null){
    const m=this.get(),actor=this.role(m,digest,owner);if(round!==null&&actor.role!=='owner')fail('Die Spielhistorie ist nur für den Besitzer sichtbar.',403);
    const rows=round===null?this.sql.exec('SELECT * FROM events WHERE id>? ORDER BY id LIMIT 1000',before).toArray():this.sql.exec('SELECT * FROM events WHERE round=? AND id>? ORDER BY id LIMIT 1000',round,before).toArray();
    return {events:rows.map(r=>({...r,data:JSON.parse(r.data)})),cursor:rows.at(-1)?.id||before,more:rows.length===1000};
  }
  rounds(digest,owner){const m=this.get();this.role(m,digest,owner);if(!owner)fail('Nur für den Besitzer.',403);return this.sql.exec('SELECT id,name,started,ended FROM rounds ORDER BY id DESC').toArray();}
  archive(digest,owner,round){
    const m=this.get();this.role(m,digest,owner);if(!owner)fail('Nur für den Besitzer.',403);
    const row=this.sql.exec('SELECT * FROM rounds WHERE id=?',round).toArray()[0];if(!row)fail('Runde nicht gefunden.',404);
    const summary=JSON.parse(row.summary),initial=JSON.parse(row.initial);
    const roundStatistics=summary.players.map((p,i)=>{const result={name:p.name,slot:p.slot,schluecke:p.score-initial[i].score};for(const field of ['drawn','distributed','received']){result[field]=Object.fromEntries(Object.entries(p[field]||{}).map(([key,count])=>[key,count-(initial[i][field]?.[key]||0)]));}return result;});
    return {...row,initial,summary,roundStatistics,room:m.id};
  }
  openLive(digest,owner){const m=this.get(),actor=this.role(m,digest,owner);if(this.ctx.getWebSockets().length>=24)fail('Zu viele Geräte in diesem Spielraum.',429);const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment(actor);server.send(JSON.stringify(this.view(m,actor)));return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'kings'}});}
  fetch(request){return this.openLive(request.headers.get('X-Kings-Digest'),request.headers.get('X-Kings-Owner')==='yes');}
  broadcast(m){for(const ws of this.ctx.getWebSockets()){try{ws.send(JSON.stringify(this.view(m,ws.deserializeAttachment())));}catch{ws.close(1011,'Verbindung beendet');}}}
  webSocketMessage(ws){ws.close(1008,'Bitte HTTP API für Aktionen verwenden.');}
  webSocketError(ws){ws.close(1011,'Verbindungsfehler');}
}
export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Kings-Device','Access-Control-Max-Age':'86400','Vary':'Origin'}});
      if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)fail('Origin nicht erlaubt.',403);
      if(url.pathname==='/health')return json({ok:true,version:1});
      const protocols=request.headers.get('Sec-WebSocket-Protocol')?.split(',').map(s=>s.trim())||[];
      const bearer=request.headers.get('Authorization')?.replace(/^Bearer /,'')||protocols.find(p=>p.startsWith('auth.'))?.slice(5)||'';
      const digest=await hash(bearer),owner=equal(digest,env.OWNER_HASH);
      const device=clean(request.headers.get('X-Kings-Device'),80);
      if(request.method==='POST'){
        const allowed=await env.REQUEST_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!allowed.success)fail('Zu viele Aktionen. Bitte kurz warten.',429);
        const reader=request.body?.getReader();let text='',length=0;const decoder=new TextDecoder();
        if(reader){for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>10000){await reader.cancel();fail('Anfrage zu groß.',413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
        let body;try{body=JSON.parse(text);}catch{fail('Ungültige Anfrage.');}
        if(url.pathname==='/rooms'){
          if(!Array.isArray(body.names)||body.names.length>6||!device)fail('Spielernamen fehlen.');
          const names=body.names.map(n=>clean(n,40));if(!names.some(Boolean))fail('Mindestens ein Spieler ist nötig.');
          const id=crypto.randomUUID(),hostToken=token(),playerTokens=names.filter(Boolean).map(()=>token());
          const credentials={hostHash:await hash(hostToken),playerHashes:await Promise.all(playerTokens.map(hash)),playerTokens};
          const view=await env.ROOMS.getByName(id).initialize(id,names,credentials,device);
          await env.INDEX.getByName('catalogue').register(id,view.name,new Date().toISOString());
          return json({...view,hostToken},201);
        }
        const match=url.pathname.match(/^\/rooms\/([a-f0-9-]{36})\/action$/);if(match){if(!device)fail('Gerätekennung fehlt.');return json(await env.ROOMS.getByName(match[1]).action(digest,owner,body,device));}
      }
      if(request.method==='GET'){
        if(url.pathname==='/admin/rooms'){if(!owner)fail('Nur für den Besitzer.',403);return json(await env.INDEX.getByName('catalogue').list(url.searchParams.get('before')||'9999'));}
        const match=url.pathname.match(/^\/rooms\/([a-f0-9-]{36})(?:\/(stats|rounds|archive|live))?$/);
        if(match){
          const room=env.ROOMS.getByName(match[1]);
          if(match[2]==='live'){if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket'||!protocols.includes('kings'))fail('WebSocket erforderlich.',426);const headers=new Headers(request.headers);headers.set('X-Kings-Digest',digest);headers.set('X-Kings-Owner',owner?'yes':'no');return await room.fetch(new Request(request,{headers}));}
          if(match[2]==='stats'){const round=url.searchParams.has('round')?Number(url.searchParams.get('round')):null;return json(await room.statistics(digest,owner,Math.max(0,Number(url.searchParams.get('after'))||0),round));}
          if(match[2]==='rounds')return json(await room.rounds(digest,owner));
          if(match[2]==='archive')return json(await room.archive(digest,owner,Number(url.searchParams.get('round'))));
          return json(await room.read(digest,owner));
        }
      }
      return json({error:'Nicht gefunden.'},404);
    }catch(e){const tagged=e.message?.match(/KINGS(\d{3}):(.*)/s);const status=tagged?Number(tagged[1]):e.status||500;if(status===500)console.error(JSON.stringify({error:'request_failed',message:e.message}));return json({error:tagged?tagged[2]:status===500?'Serverfehler. Bitte erneut versuchen.':e.message},status);}
  }
};
