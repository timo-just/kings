export const API='https://kings-api.timo-just.workers.dev';
const saved=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const remember=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
let device=saved('kings-device');if(!device){device=crypto.randomUUID();remember('kings-device',device);}
export const deviceId=device;
export let online=null;
export let roomView=null;
let socket=null,reconnect=null,stopped=false;
export function contextFromLink(){const p=new URLSearchParams(location.hash.slice(1));if(p.has('owner')){const key=p.get('owner');remember('kings-owner',key);history.replaceState(null,'',location.pathname+'?owner');return {owner:key};}if(p.has('room')&&p.has('key')){const ctx={room:p.get('room'),key:p.get('key')};remember('kings-room',ctx);history.replaceState(null,'',location.pathname+'?room='+encodeURIComponent(ctx.room));return ctx;}const q=new URLSearchParams(location.search);if(q.has('owner'))return {owner:saved('kings-owner')};if(q.has('room')){const ctx=saved('kings-room');return ctx?.room===q.get('room')?ctx:{missing:true};}return null;}
export async function request(path,body,credential=online?.key){const res=await fetch(API+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(credential?{Authorization:'Bearer '+credential}:{}),'X-Kings-Device':device},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'Verbindung fehlgeschlagen.'),{status:res.status});return data;}
export async function createRoom(names){const data=await request('/rooms',{names});online={room:data.room,key:data.hostToken};remember('kings-room',online);history.replaceState(null,'',location.pathname+'?room='+data.room);roomView=data;return data;}
export async function attach(ctx,onchange,onstatus){online=ctx;stopped=false;const data=await request('/rooms/'+ctx.room);roomView=data;onchange(data);connect(onchange,onstatus);return data;}
function connect(onchange,onstatus){clearTimeout(reconnect);if(stopped||document.hidden)return;socket?.close();socket=new WebSocket(API.replace('https:','wss:')+'/rooms/'+online.room+'/live',['kings','auth.'+online.key]);onstatus('Verbinde …');socket.onopen=()=>onstatus('Live verbunden');socket.onmessage=e=>{if(e.data==='pong')return;try{roomView=JSON.parse(e.data);onchange(roomView);}catch{onstatus('Aktualisierung fehlgeschlagen');}};socket.onerror=()=>onstatus('Verbindung unterbrochen');socket.onclose=()=>{onstatus('Verbindung unterbrochen · erneuter Versuch …');if(!stopped&&!document.hidden)reconnect=setTimeout(()=>connect(onchange,onstatus),5000);};}
let visibilityHandler;
export function watchVisibility(onchange,onstatus){if(visibilityHandler)document.removeEventListener('visibilitychange',visibilityHandler);visibilityHandler=()=>{if(document.hidden){clearTimeout(reconnect);socket?.close();}else connect(onchange,onstatus);};document.addEventListener('visibilitychange',visibilityHandler);}
export function leave(){stopped=true;clearTimeout(reconnect);socket?.close();online=null;roomView=null;history.replaceState(null,'',location.pathname);}
export async function command(action){const data=await request('/rooms/'+online.room+'/action',{...action,revision:roomView.revision});roomView=data;return data;}
let eventCache={room:null,cursor:0,events:[]};
export async function eventPages(round=null){if(eventCache.room!==online.room)eventCache={room:online.room,cursor:0,events:[]};let cursor=round===null?eventCache.cursor:0,events=round===null?eventCache.events.slice():[];for(;;){const p=await request(`/rooms/${online.room}/stats?after=${cursor}`+(round===null?'':'&round='+round));events.push(...p.events);cursor=p.cursor;if(!p.more)break;}if(round===null)eventCache={room:online.room,cursor,events};return events;}
export function participantLink(index){return location.origin+location.pathname+'#room='+online.room+'&key='+roomView.invitations[index];}
export function hostLink(){return location.origin+location.pathname+'#room='+online.room+'&key='+online.key;}
export function lastRoom(){return saved('kings-room');}
export function rememberedOwner(){return saved('kings-owner');}
