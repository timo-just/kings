import {newGame,draw,assign,selectMode,colors,ranks} from './engine.mjs';
import {addMultiplayerUI} from './multiplayer-ui.mjs';
import {online,roomView,deviceId,contextFromLink,createRoom,attach,watchVisibility,command,eventPages,participantLink,hostLink,lastRoom,rememberedOwner,request,leave} from './network.mjs';
addMultiplayerUI();
const $=id=>document.getElementById(id), key='kings-browser-v1';
let state=null;
try { const saved=JSON.parse(localStorage.getItem(key)); if(saved?.version===1 && saved.players?.length && Array.isArray(saved.deck)) state=saved; } catch {}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(let i=0;i<6;i++) { const label=document.createElement('label'); label.style.setProperty('--player',colors[i]); label.innerHTML=`<span class="dot" aria-hidden="true"></span><input aria-label="Spieler ${i+1}" placeholder="Player ${i+1} Name" maxlength="40" autocomplete="off">`; $('fields').append(label); }
function save(){if(online)return;try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
function openSetup(){ $('setup').hidden=false;$('game').hidden=true;$('results').hidden=true;$('edit').hidden=true;$('statsOpen').hidden=!state;$('resume').hidden=!state; $('fields').querySelectorAll('input').forEach((el,i)=>el.value=state?.players.find(p=>p.slot===i)?.name||''); }
$('names').onsubmit=async e=>{e.preventDefault(); if(state && !confirm('Neue Spieler beginnen eine neue Partie. Bisherigen Spielstand ersetzen?'))return; try{const names=[...$('fields').querySelectorAll('input')].map(el=>el.value);newGame(names);if($('onlineSetup').checked){const view=await createRoom(names);await joinOnline({room:view.room,key:view.hostToken});}else{leave();state=newGame(names);save();render();}$('error').textContent='';}catch(err){$('error').textContent=err.message;}};
$('resume').onclick=()=>render();$('edit').onclick=openSetup;
$('draw').onclick=()=>act({type:'draw'});
for(const [id,mode] of [['thumb','10'],['question','Bube']]) $(id).onclick=()=>act({type:'mode',mode});
function render(){
  renderOnline();
  $('setup').hidden=true;$('statsOpen').hidden=false;$('edit').hidden=!!online;$('game').hidden=state.over;$('results').hidden=!state.over;
  if(state.over){results();$('next').hidden=!!online&&roomView.role==='player';return;}
  $('kings').textContent=`Kings: ${state.kings}/4`;$('remaining').textContent=`${32-state.deck.length}/32`;
  $('turn').textContent=state.players[state.turn].name;
  const rank=state.card?.rank==='Ass'?'A':state.card?.rank;
  $('card').innerHTML=state.card?`<span class="corner">${escape(rank)}<br>${escape(state.card.suit)}</span><span class="card-suit">${escape(state.card.suit)}</span><span class="corner bottom">${escape(rank)}<br>${escape(state.card.suit)}</span>`:'<span class="card-suit">&#9819;</span>';$('card').classList.toggle('red',['♥','♦'].includes(state.card?.suit));
  $('message').textContent=state.message;$('draw').disabled=!!(state.pending||state.mode);
  $('thumbOwner').textContent=state.thumb===null?'keiner':`${state.players[state.thumb].name} (${state.thumbUses})`;
  $('questionOwner').textContent=state.question===null?'keiner':state.players[state.question].name;
  $('thumb').setAttribute('aria-pressed',state.mode==='10');$('question').setAttribute('aria-pressed',state.mode==='Bube');
  $('players').replaceChildren();state.players.forEach((p,i)=>{const b=document.createElement('button');b.style.setProperty('--player',colors[p.slot]);b.classList.toggle('current',i===state.turn);b.innerHTML=`${escape(p.name)}<small>${Math.floor(p.score/16)} Gläser · ${((16-p.score%16)*6.25).toLocaleString('de-DE')} %</small>`;b.setAttribute('aria-label',`${p.name}, ${p.score} Schlücke, Strafe zuweisen`);b.disabled=!!online&&roomView.role==='player';b.onclick=()=>act({type:'assign',player:i});$('players').append(b);});
  $('categoryEntry').hidden=state.pending!=='Dame'||!!online&&roomView.role==='player';
  if(document.activeElement!==$('categoryName'))$('categoryName').value=state.category||'';
}
function table(title,keys,field){return `<h2>${title}</h2><div class="table-wrap"><table><thead><tr><th>Karte</th>${state.players.map(p=>`<th>${escape(p.name)}</th>`).join('')}</tr></thead><tbody>${keys.map(k=>`<tr><th>${k==='4. K'?'4. König':k}</th>${state.players.map(p=>`<td>${p[field]?.[k]||0}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function results(){
  $('outcome').textContent=state.message;$('totals').innerHTML=state.players.map(p=>`<p style="--player:${colors[p.slot]}">${escape(p.name)}: ${(p.score/16).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} Gläser</p>`).join('');
}
function statistics(){
  const keys=['7','8','9','10','Bube','Dame','4. K','Ass'];
  $('tables').innerHTML=table('Verteilte Karten / Strafen',keys,'distributed')+table('Erhaltene Karten / Strafen',keys,'received');
  $('legacy').textContent=state.players.some(p=>!p.distributed)?'Verteilte Strafen aus älteren Spielständen wurden noch nicht erfasst. Die Zählung beginnt mit diesem Update.':'';
  $('legend').innerHTML=state.players.map(p=>`<span style="--player:${colors[p.slot]}"><i></i>${escape(p.name)} · ${p.score} Schlücke</span>`).join('');
  $('eventLog').textContent=state.log.length?state.log.map((line,i)=>`${String(i+1).padStart(3,'0')}  ${line}`).join('\n'):'Noch keine Karten gezogen.';
  const c=$('chart'),ctx=c.getContext('2d');ctx.fillStyle='#141218';ctx.fillRect(0,0,c.width,c.height);
  const max=Math.max(8,...state.players.map(p=>p.score)),steps=Math.max(1,...state.players.map(p=>p.history.length-1));
  ctx.font='18px Arial';ctx.lineWidth=1;
  const tick=Math.max(1,Math.ceil(max/8));
  for(let score=0;score<=max;score+=tick){const y=470-score/max*390;ctx.strokeStyle='#49454f';ctx.beginPath();ctx.moveTo(65,y);ctx.lineTo(930,y);ctx.stroke();ctx.fillStyle='#cac4d0';ctx.fillText(`${score}`,12,y+6);}
  ctx.fillText('Schlücke',10,30);ctx.fillText('Verlauf →',815,515);
  for(let t=0;t<=steps;t+=Math.max(1,Math.ceil(steps/8))){ctx.fillText(String(t),65+t/steps*860,500);}
  state.players.forEach(p=>{ctx.strokeStyle=colors[p.slot];ctx.lineWidth=3;ctx.beginPath();p.history.forEach((v,i)=>{const x=65+i/steps*860,y=470-v/max*390;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});
}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
$('png').onclick=()=>download($('chart').toDataURL('image/png'),'kings_final.png');
$('log').onclick=()=>{const blob=new Blob([state.log.join('\n')+'\n\nEndstand:\n'+state.players.map(p=>`${p.name}: ${(p.score/16).toFixed(2)} Gläser`).join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);download(url,'kings_log.txt');setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('next').onclick=()=>act({type:'next'});
const tabs=['graph','tables','log'];
function switchTab(name){for(const id of tabs){$('tab-'+id).setAttribute('aria-selected',id===name);$('tab-'+id).tabIndex=id===name?0:-1;$('panel-'+id).hidden=id!==name;}}
for(const [i,id] of tabs.entries()){
  $('tab-'+id).onclick=()=>switchTab(id);
  $('tab-'+id).onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();switchTab(tabs[n]);$('tab-'+tabs[n]).focus();}};
}
$('statsOpen').onclick=async()=>{try{await loadStatistics();statistics();$('statistics').showModal();}catch(e){notice(e.message);}};
$('statsClose').onclick=()=>$('statistics').close();
$('panel-log').append($('log'));
let busy=false,lastCategoryPrompt='',ownerCredential=rememberedOwner(),archiveBefore=null;
function notice(message){$('connection').hidden=false;$('connection').textContent=message;}
async function act(input){
  if(busy)return;busy=true;
  try{
    if(input.type==='assign'&&state.pending==='Dame'&&!state.mode){
      const category=$('categoryName').value.trim();
      if(online)await command({type:'category',category});else state.category=category;
    }
    if(online){applyOnline(await command(input));}
    else{if(input.type==='draw')draw(state);if(input.type==='assign')assign(state,input.player);if(input.type==='mode')selectMode(state,input.mode);if(input.type==='next')state=newGame([],state);save();render();}
    promptCategory();
  }catch(e){notice(e.message);if(online&&e.status===409)try{applyOnline(await request('/rooms/'+online.room));}catch{}}
  finally{busy=false;}
}
function renderOnline(){
  const player=!!online&&roomView.role==='player';
  $('roomOpen').hidden=!state;$('personal').hidden=!player;$('connection').hidden=!online;$('edit').hidden=!!online;
  for(const id of ['draw','thumb','question'])$(id).hidden=player;
  $('lastRoom').hidden=!lastRoom();
  if(player){const p=state.players[roomView.me];$('personalName').textContent=p.name;$('personalScore').textContent=`${p.score} Schlücke · ${(p.score/16).toLocaleString('de-DE',{maximumFractionDigits:2})} Gläser`;
    $('comparison').innerHTML=state.players.map(q=>`<p style="--player:${colors[q.slot]}"><span class="dot"></span>${escape(q.name)} <strong>${q.score} Schlücke</strong></p>`).join('');
    if(document.activeElement!==$('categoryList'))$('categoryList').value=(roomView.categories[roomView.me]||[]).join('\n');
  }
  if(online){$('categorySuggestions').replaceChildren();roomView.categories.flat().forEach(name=>{const o=document.createElement('option');o.value=name;$('categorySuggestions').append(o);});}
}
function applyOnline(view){state=view.state;render();$('edit').hidden=true;if($('statistics').open)refreshStats();}
async function joinOnline(ctx){await attach(ctx,applyOnline,notice);watchVisibility(applyOnline,notice);}
function promptCategory(){if(state?.pending!=='Dame'||state.mode||online&&roomView.role==='player')return;const id=(online?.room||'local')+':'+state.round+':'+state.deck.length;if(id===lastCategoryPrompt)return;lastCategoryPrompt=id;$('categoryDialogInput').value=state.category||'';$('categoryDialog').showModal();}
async function setCategory(value){$('categoryDialog').close();$('categoryName').value=value;if(online){try{applyOnline(await command({type:'category',category:value}));}catch(e){notice(e.message);}}else{state.category=value;save();}}
$('categoryConfirm').onclick=()=>setCategory($('categoryDialogInput').value.trim());$('categorySkip').onclick=()=>setCategory('');
$('categoryPreferences').onsubmit=async e=>{e.preventDefault();try{applyOnline(await command({type:'categoryList',categories:$('categoryList').value.split('\n')}));notice('Kategorien gespeichert');}catch(e){notice(e.message);}};
async function loadStatistics(){if(!online)return;const events=await eventPages();state.log=events.flatMap(e=>e.data.lines.map(line=>`${new Date(e.at).toLocaleString('de-DE')} · ${line}`));state.players.forEach((p,i)=>p.history=events.map(e=>e.data.scores[i]??0));state.categoryResults=events.filter(e=>e.kind==='assign'&&e.data.category).map(e=>e.data.category);}
let statsLoading=false;async function refreshStats(){if(statsLoading)return;statsLoading=true;try{await loadStatistics();statistics();}catch(e){notice(e.message);}finally{statsLoading=false;}}
function copyLink(link){navigator.clipboard.writeText(link).then(()=>notice('Link kopiert')).catch(()=>{prompt('Link kopieren:',link);});}
$('roomOpen').onclick=()=>{
  $('roomName').textContent=online?roomView.name:'Dieses Spiel läuft bisher nur auf diesem Gerät.';
  $('createOnline').hidden=!!online;$('exitRoom').hidden=!online;$('takeover').hidden=!online||roomView.role==='player'||roomView.controller===deviceId;
  $('invitationList').replaceChildren();
  if(online&&roomView.invitations){state.players.forEach((p,i)=>{const b=document.createElement('button');b.textContent=`Link für ${p.name} kopieren`;b.onclick=()=>copyLink(participantLink(i));$('invitationList').append(b);});const b=document.createElement('button');b.textContent='Eigenen Spielleiterlink kopieren';b.onclick=()=>copyLink(hostLink());$('invitationList').append(b);}
  $('roomDialog').showModal();
};
$('roomClose').onclick=()=>$('roomDialog').close();
$('createOnline').onclick=async()=>{if(!confirm('Neuen Online-Spielraum mit diesen Namen starten? Der lokale Spielstand bleibt separat gespeichert.'))return;try{const names=Array(6).fill('');state.players.forEach(p=>names[p.slot]=p.name);const view=await createRoom(names);await joinOnline({room:view.room,key:view.hostToken});$('roomDialog').close();$('roomOpen').click();}catch(e){notice(e.message);}};
$('takeover').onclick=async()=>{if(!confirm('Die bisherige Spielleitung verliert auf ihrem Gerät die Steuerung. Hier übernehmen?'))return;try{applyOnline(await command({type:'takeover'}));$('roomDialog').close();}catch(e){notice(e.message);}};
$('exitRoom').onclick=()=>{leave();$('roomDialog').close();$('personal').hidden=true;$('connection').hidden=true;try{state=JSON.parse(localStorage.getItem(key));}catch{state=null;}openSetup();};
$('lastRoom').onclick=async()=>{try{await joinOnline(lastRoom());}catch(e){notice(e.message);}};
async function showArchive(append=false){
  $('ownerLogin').hidden=!!ownerCredential;if(!ownerCredential){$('archiveStatus').textContent='Nur der Besitzer kann die gespeicherten Spiele und Statistikdateien öffnen.';return;}
  try{const rooms=await request('/admin/rooms'+(append&&archiveBefore?'?before='+encodeURIComponent(archiveBefore):''),null,ownerCredential);if(!append)$('archiveList').replaceChildren();$('archiveStatus').textContent=rooms.length?'Spielraum auswählen, um die gespeicherten Runden zu öffnen.':'Noch keine weiteren Spiele gespeichert.';
    for(const room of rooms){const wrap=document.createElement('details'),summary=document.createElement('summary');summary.textContent=room.name;wrap.append(summary);let loaded=false;wrap.addEventListener('toggle',async()=>{if(!wrap.open||loaded)return;loaded=true;try{const rounds=await request('/rooms/'+room.id+'/rounds',null,ownerCredential);for(const round of rounds){const b=document.createElement('button');b.textContent=`Runde ${round.id} · ${round.name} · Statistikdatei speichern`;b.onclick=async()=>{try{const archive=await request(`/rooms/${room.id}/archive?round=${round.id}`,null,ownerCredential);let after=0,events=[];for(;;){const page=await request(`/rooms/${room.id}/stats?round=${round.id}&after=${after}`,null,ownerCredential);events.push(...page.events);after=page.cursor;if(!page.more)break;}const blob=new Blob([JSON.stringify({...archive,events},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);download(url,round.name+'_R'+round.id+'.json');setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('archiveStatus').textContent=e.message;}};wrap.append(b);}}catch(e){$('archiveStatus').textContent=e.message;loaded=false;}});$('archiveList').append(wrap);}
    archiveBefore=rooms.at(-1)?.created;$('archiveMore').hidden=rooms.length<50;
  }catch(e){$('archiveStatus').textContent=e.message;$('ownerLogin').hidden=false;}
}
$('archiveOpen').onclick=()=>{$('archiveDialog').showModal();showArchive();};$('archiveClose').onclick=()=>$('archiveDialog').close();$('archiveMore').onclick=()=>showArchive(true);
$('ownerLogin').onsubmit=e=>{e.preventDefault();ownerCredential=$('ownerKey').value.trim();try{localStorage.setItem('kings-owner',JSON.stringify(ownerCredential));}catch{}$('ownerKey').value='';showArchive();};
const initial=contextFromLink();
if(initial?.owner){ownerCredential=initial.owner;state?render():openSetup();$('archiveOpen').click();}
else if(initial?.room)joinOnline(initial).catch(e=>{openSetup();notice(e.message);});
else if(initial?.missing){openSetup();notice('Bitte den vollständigen persönlichen Einladungslink öffnen.');}
else{state?render():openSetup();$('lastRoom').hidden=!lastRoom();}
