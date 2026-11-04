import {newGame,draw,assign,selectMode,colors,ranks} from './engine.mjs';
import {addMultiplayerUI} from './multiplayer-ui.mjs';
import {online,roomView,deviceId,contextFromLink,createRoom,attach,watchVisibility,command,eventPages,participantLink,hostLink,lastRoom,rememberedOwner,request,leave,acceptView} from './network.mjs';
import {archiveView} from './archive-model.mjs';
import {language,setLanguage,locale,t,gameText,cardRank,localize} from './i18n.mjs';
import {timeline} from './timeline.mjs';
import {renderHistoryChart,chartPng} from './history-chart.mjs';
addMultiplayerUI();
document.getElementById('game').insertAdjacentHTML('beforebegin','<section id="leaderOverview" hidden><div class="leader-heading"><h2>Deine Spielübersicht</h2><button id="leaderStats">Statistik öffnen</button></div><p id="leaderSummary"></p><div id="leaderScores"></div></section>');
const $=id=>document.getElementById(id), key='kings-browser-v1';
let state=null;
try { const saved=JSON.parse(localStorage.getItem(key)); if(saved?.version===1 && saved.players?.length && Array.isArray(saved.deck)) state=saved; } catch {}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(let i=0;i<6;i++) { const label=document.createElement('label'); label.style.setProperty('--player',colors[i]); label.innerHTML=`<span class="dot" aria-hidden="true"></span><input aria-label="Spieler ${i+1}" placeholder="Player ${i+1} Name" maxlength="40" autocomplete="off">`; $('fields').append(label); }
function save(){if(online)return;try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
function openSetup(){ $('home').hidden=true; $('setup').hidden=false;$('game').hidden=true;$('results').hidden=true;$('edit').hidden=true;$('roomOpen').hidden=!state;$('statsOpen').hidden=!state;$('resume').hidden=!state;$('lastRoom').hidden=!lastRoom(); $('fields').querySelectorAll('input').forEach((el,i)=>el.value=state?.players.find(p=>p.slot===i)?.name||''); }
$('names').onsubmit=async e=>{e.preventDefault(); try{const names=[...$('fields').querySelectorAll('input')].map(el=>el.value);newGame(names);if($('onlineSetup').checked){const view=await createRoom(names);await joinOnline({room:view.room,key:view.hostToken});$('roomOpen').click();}else{leave();state=newGame(names);save();render();}$('error').textContent='';}catch(err){$('error').textContent=gameText(err.message);}};
$('resume').onclick=()=>render();$('edit').onclick=openSetup;
function showHome(){leave();state=null;for(const d of document.querySelectorAll('dialog[open]'))d.close();$('home').hidden=false;for(const id of ['setup','game','results','personal','leaderOverview','connection','statsOpen','roomOpen','edit','viewNav','categoryLibrary','rulesPanel'])$(id).hidden=true;$('menuContinue').hidden=!lastRoom();$('languageSelect').value=language;localize();}
$('homeOpen').onclick=showHome;
$('menuNew').onclick=()=>{leave();state=null;openSetup();localize();};
$('menuContinue').onclick=()=>joinOnline(lastRoom()).catch(e=>notice(e.message));
$('menuHistory').onclick=()=>$('archiveOpen').click();
$('languageSelect').value=language;
$('languageSelect').onchange=e=>{setLanguage(e.target.value);if(!$('home').hidden)localize();else if(state)render();else localize();};
$('draw').onclick=()=>act({type:'draw'});
const roleReveal={thumb:false,question:false},roleTap={},roleTimers={};
$('thumb').firstChild.nodeValue='Daumenkönig';
for(const [id,mode] of [['thumb','10'],['question','Bube']]) $(id).onclick=()=>{
  if(roleTap[id]){clearTimeout(roleTap[id]);roleTap[id]=null;roleReveal[id]=true;clearTimeout(roleTimers[id]);render();roleTimers[id]=setTimeout(()=>{roleReveal[id]=false;if(state&&!$('game').hidden)render();},2000);}
  else roleTap[id]=setTimeout(()=>{roleTap[id]=null;act({type:'mode',mode});},320);
};
function render(){
  $('home').hidden=true;
  renderOnline();
  $('setup').hidden=true;$('statsOpen').hidden=false;$('edit').hidden=!!online;$('game').hidden=state.over;$('results').hidden=!state.over;
  if(state.over){results();$('next').hidden=!!online&&roomView.role==='player';renderNavigation();localize();return;}
  $('kings').textContent=`Kings: ${state.kings}/4`;$('remaining').textContent=`${32-state.deck.length}/32`;
  $('turn').textContent=state.players[state.turn].name;
  const rank=cardRank(state.card?.rank);
  $('card').innerHTML=state.card?`<span class="corner">${escape(rank)}<br>${escape(state.card.suit)}</span><span class="card-suit">${escape(state.card.suit)}</span><span class="corner bottom">${escape(rank)}<br>${escape(state.card.suit)}</span>`:'<span class="card-suit">&#9819;</span>';$('card').classList.toggle('red',['♥','♦'].includes(state.card?.suit));
  $('message').textContent=gameText(/ist neuer (Fragekönig|Daumenkönig)/.test(state.message)?'Neue geheime Rolle vergeben.':state.message);$('draw').disabled=!!(state.pending||state.mode);
  $('thumbOwner').textContent=state.thumb===null?t('keiner'):`${state.players[state.thumb].name} (${state.thumbUses})`;
  $('questionOwner').textContent=state.question===null?t('keiner'):state.players[state.question].name;
  $('thumbOwner').hidden=!roleReveal.thumb;$('questionOwner').hidden=!roleReveal.question;
  $('thumb').setAttribute('aria-pressed',state.mode==='10');$('question').setAttribute('aria-pressed',state.mode==='Bube');
  $('players').replaceChildren();state.players.forEach((p,i)=>{const b=document.createElement('button');b.style.setProperty('--player',colors[p.slot]);b.classList.toggle('current',i===state.turn);b.innerHTML=`${escape(p.name)}<small>${Math.floor(p.score/16)} ${t('Gläser')} · ${((16-p.score%16)*6.25).toLocaleString(locale())} %</small>`;b.setAttribute('aria-label',`${p.name}, ${p.score} ${t('Schlücke')}`);b.disabled=!!online&&roomView.role==='player';b.onclick=()=>act({type:'assign',player:i});$('players').append(b);});
  $('categoryEntry').hidden=state.pending!=='Dame'||!!online&&roomView.role==='player';
  if(document.activeElement!==$('categoryName'))$('categoryName').value=state.category||'';
  renderNavigation();localize();
}
function table(title,keys,field,data=state){return `<h2>${t(title)}</h2><div class="table-wrap"><table><thead><tr><th>${t('Karte')}</th>${data.players.map(p=>`<th>${escape(p.name)}</th>`).join('')}</tr></thead><tbody>${keys.map(k=>`<tr><th>${t(k==='4. K'?'4. König':k)}</th>${data.players.map(p=>`<td>${p[field]?.[k]||0}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function results(){
  $('outcome').textContent=gameText(state.message);$('totals').innerHTML=state.players.map(p=>`<p style="--player:${colors[p.slot]}">${escape(p.name)}: ${(p.score/16).toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:2})} ${t('Gläser')}</p>`).join('');
}
function translateLogLine(line){const split=line.indexOf(' · ');return split<0?gameText(line):line.slice(0,split+3)+gameText(line.slice(split+3));}
function statistics(data=state){
  shownStatistics=data;
  const keys=['7','8','9','10','Bube','Dame','4. K','Ass'];
  $('tables').innerHTML=table('Verteilte Karten / Strafen',keys,'distributed',data)+table('Erhaltene Karten / Strafen',keys,'received',data);
  if(data.categoryResults?.length)$('tables').insertAdjacentHTML('beforeend',`<h2>${t('Kategorien und Verlierer')}</h2><div class="table-wrap"><table><thead><tr><th>${t('Kategorie')}</th><th>${t('Bestimmt von')}</th><th>${t('Verloren von')}</th></tr></thead><tbody>${data.categoryResults.map(c=>`<tr><th>${c.category?escape(c.category):t('(ohne Namen)')}</th><td>${escape(c.giver)}</td><td>${escape(c.loser)}</td></tr>`).join('')}</tbody></table></div>`);
  $('legacy').textContent=data.players.some(p=>!p.distributed)?'Verteilte Strafen aus älteren Spielständen wurden noch nicht erfasst. Die Zählung beginnt mit diesem Update.':'';
  $('legend').innerHTML=data.players.map(p=>`<span style="--player:${colors[p.slot]}"><i></i>${escape(p.name)} · ${(p.score/16).toLocaleString(locale(),{maximumFractionDigits:2})} ${t('Gläser')}</span>`).join('');
  $('eventLog').textContent=data.log.length?data.log.map((line,i)=>`${String(i+1).padStart(3,'0')}  ${translateLogLine(line)}`).join('\n'):t('Noch keine Karten gezogen.');
  renderHistoryChart(data);
  localize();
}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
$('png').onclick=async()=>{try{const url=await chartPng();if(url)download(url,'kings_final.png');}catch(e){notice(e.message);}};
$('log').onclick=()=>{const blob=new Blob([(shownStatistics||state).log.map(translateLogLine).join('\n')+'\n\n'+t('Endstand:')+'\n'+(shownStatistics||state).players.map(p=>`${p.name}: ${(p.score/16).toFixed(2)} ${t('Gläser')}`).join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);download(url,'kings_log.txt');setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('next').onclick=()=>act({type:'next'});
const tabs=['graph','tables','log'];
function switchTab(name){for(const id of tabs){$('tab-'+id).setAttribute('aria-selected',id===name);$('tab-'+id).tabIndex=id===name?0:-1;$('panel-'+id).hidden=id!==name;}}
for(const [i,id] of tabs.entries()){
  $('tab-'+id).onclick=()=>switchTab(id);
  $('tab-'+id).onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();switchTab(tabs[n]);$('tab-'+tabs[n]).focus();}};
}
$('statsOpen').onclick=async()=>{try{await loadStatistics();archivedStatistics=false;$('statsTitle').textContent=t('Statistik');statistics();$('statistics').showModal();}catch(e){notice(e.message);}};
$('statsClose').onclick=()=>$('statistics').close();
$('leaderStats').onclick=()=>$('statsOpen').click();
$('panel-log').append($('log'));
let busy=false,lastCategoryPrompt='',ownerCredential=rememberedOwner(),archiveBefore=null,shownStatistics=null,archivedStatistics=false,queueBusy=false;
function notice(message){$('connection').hidden=false;$('connection').textContent=gameText(message);}
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
  $('leaderOverview').hidden=!online||player;
  if(online&&!player){
    const total=state.players.reduce((n,p)=>n+p.score,0);
    $('leaderSummary').textContent=`${t('Runde')} ${state.round} · ${32-state.deck.length}/32 ${t('Karten')} · ${total} ${t('Schlücke insgesamt')}`;
    $('leaderScores').replaceChildren();
    state.players.forEach((p,index)=>{const row=document.createElement('div');row.className='leader-player';row.style.setProperty('--player',colors[p.slot]);row.innerHTML=`<span>${escape(p.name)}${index===state.turn&&!state.over?' · '+t('am Zug'):''}</span><strong>${p.score} ${t('Schlücke')}</strong><small>${(p.score/16).toLocaleString(locale(),{maximumFractionDigits:2})} ${t('Gläser')}</small>`;$('leaderScores').append(row);});
  }
  $('roomOpen').hidden=!state;$('personal').hidden=roomView?.me==null;$('connection').hidden=!online;$('edit').hidden=!!online;
  for(const id of ['draw','thumb','question'])$(id).hidden=player;
  $('lastRoom').hidden=!lastRoom();
  if(online&&roomView.me!=null){const p=state.players[roomView.me];$('personalName').textContent=p.name;$('personalScore').textContent=`${(p.score/16).toLocaleString(locale(),{maximumFractionDigits:2})} ${t('Gläser')}`;
    renderPersonalRoles();
    $('comparison').innerHTML=state.players.map(q=>`<p style="--player:${colors[q.slot]}"><span class="dot"></span>${escape(q.name)} <strong>${q.score} ${t('Schlücke')}</strong></p>`).join('');
    renderQueue();
  }
  if(online){$('categorySuggestions').replaceChildren();roomView.categories.flat().forEach(name=>{const o=document.createElement('option');o.value=name;$('categorySuggestions').append(o);});}
}
function renderPersonalRoles(){
  if(!$('personalRoles'))$('personalScore').insertAdjacentHTML('afterend','<div id="personalRoles" aria-live="polite"></div>');
  $('personalRoles').replaceChildren();
  for(const [kind,active,remaining,label]of [['10',state.thumb===roomView.me,state.thumbUses,'Du bist Daumenkönig'],['Bube',state.question===roomView.me,1,'Du bist Fragekönig']]){
    if(!active||state.over)continue;const box=document.createElement('section');box.className='personal-role';
    const h=document.createElement('h2');h.textContent=t(label);const count=document.createElement('p');count.textContent=`${remaining} ${t(remaining===1?'Nutzung übrig':'Nutzungen übrig')}`;const prompt=document.createElement('p');prompt.textContent=t('Wen hat es erwischt?');box.append(h,count,prompt);
    state.players.forEach((p,index)=>{const b=document.createElement('button');b.textContent=p.name;b.onclick=async()=>{if(busy)return;busy=true;box.querySelectorAll('button').forEach(el=>el.disabled=true);try{applyOnline(await command({type:'useTitle',kind,player:index}));notice(t('Strafe vergeben'));}catch(e){notice(e.message);try{applyOnline(await request('/rooms/'+online.room));}catch{}}finally{busy=false;if(online)renderPersonalRoles();}};box.append(b);});
    $('personalRoles').append(box);
  }
}
function applyOnline(view){if(!online||view.room!==online.room)return;view=acceptView(view);state=view.state;render();$('edit').hidden=true;if($('statistics').open&&!archivedStatistics)refreshStats();}
async function joinOnline(ctx){await attach(ctx,applyOnline,notice);watchVisibility(applyOnline,notice);}
function promptCategory(){if(state?.pending!=='Dame'||state.mode||online&&roomView.role==='player')return;const id=(online?.room||'local')+':'+state.round+':'+state.deck.length;if(id===lastCategoryPrompt)return;lastCategoryPrompt=id;$('categoryDialogInput').value=state.category||'';localize();$('categoryDialog').showModal();}
async function setCategory(value){$('categoryDialog').close();$('categoryName').value=value;if(online){try{applyOnline(await command({type:'category',category:value}));}catch(e){notice(e.message);}}else{state.category=value;save();}}
$('categoryConfirm').onclick=()=>setCategory($('categoryDialogInput').value.trim());$('categorySkip').onclick=()=>setCategory('');
$('categoryPreferences').onsubmit=async e=>{e.preventDefault();const name=$('categoryInput').value.trim();if(name&&await queueAction({operation:'add',category:name}))$('categoryInput').value='';};
async function queueAction(action){if(queueBusy)return false;queueBusy=true;try{applyOnline(await command({type:'categoryQueue',...action}));notice('Warteschlange gespeichert');return true;}catch(e){notice(e.message);if(e.status===409)try{applyOnline(await request('/rooms/'+online.room));}catch{}return false;}finally{queueBusy=false;}}
function renderQueue(){const queue=roomView.categories[roomView.me]||[];$('queueEmpty').hidden=queue.length>0;$('categoryQueue').replaceChildren();queue.forEach((name,index)=>{const li=document.createElement('li'),text=document.createElement('span');text.textContent=name;li.append(text);for(const [label,operation,to]of [['↑','move',index-1],['↓','move',index+1],['Löschen','remove',index]]){const b=document.createElement('button');b.type='button';b.textContent=t(label);b.setAttribute('aria-label',`${name}: ${label==='↑'?'nach oben':label==='↓'?'nach unten':'löschen'}`);b.disabled=operation==='move'&&(to<0||to>=queue.length);b.onclick=()=>queueAction({operation,index,to});li.append(b);}$('categoryQueue').append(li);});}
async function loadStatistics(){if(!online)return;const events=await eventPages();state.log=events.flatMap(e=>e.data.lines.map(line=>`${new Date(e.at).toLocaleString(locale())} · ${line}`));state.players=timeline(state.players,events);state.categoryResults=events.filter(e=>e.kind==='assign'&&e.data.category).map(e=>e.data.category);}
let statsLoading=false;async function refreshStats(){if(statsLoading)return;statsLoading=true;try{await loadStatistics();if(!archivedStatistics)statistics();}catch(e){notice(e.message);}finally{statsLoading=false;}}
function copyLink(link){navigator.clipboard.writeText(link).then(()=>notice('Link kopiert')).catch(()=>{prompt('Link kopieren:',link);});}
$('roomOpen').onclick=()=>{
  if($('hostPlayerDialog')?.open)return;
  $('roomName').textContent=online?roomView.name:'Dieses Spiel läuft bisher nur auf diesem Gerät.';
  $('createOnline').hidden=!!online;$('exitRoom').hidden=!online;$('takeover').hidden=!online||roomView.role==='player'||roomView.controller===deviceId;
  $('abortGame').hidden=!!online&&!(roomView.role==='owner'||roomView.role==='host'&&roomView.controller===deviceId);
  $('invitationList').replaceChildren();
  if(online&&roomView.invitations){
    const addLink=(label,url)=>{const row=document.createElement('div'),name=document.createElement('label'),field=document.createElement('input'),copy=document.createElement('button');row.className='invitation-row';name.textContent=label;field.readOnly=true;field.value=url;field.setAttribute('aria-label',label);field.onclick=()=>field.select();copy.textContent=t('Link kopieren');copy.onclick=()=>copyLink(url);name.append(field);row.append(name,copy);$('invitationList').append(row);};
    addLink(t('Dein Spielleiterlink'),hostLink());
    state.players.forEach((p,i)=>addLink(gameText(`Link für ${p.name} kopieren`),participantLink(i)));
  }
  localize();$('roomDialog').showModal();
};
$('roomClose').onclick=()=>$('roomDialog').close();
$('createOnline').onclick=async()=>{if(!confirm(t('Neuen Online-Spielraum mit diesen Namen starten? Der lokale Spielstand bleibt separat gespeichert.')))return;try{const names=Array(6).fill('');state.players.forEach(p=>names[p.slot]=p.name);const view=await createRoom(names);await joinOnline({room:view.room,key:view.hostToken});$('roomDialog').close();$('roomOpen').click();}catch(e){notice(e.message);}};
$('takeover').onclick=async()=>{if(!confirm(t('Die bisherige Spielleitung verliert auf ihrem Gerät die Steuerung. Hier übernehmen?')))return;try{applyOnline(await command({type:'takeover'}));$('roomDialog').close();}catch(e){notice(e.message);}};
$('exitRoom').onclick=showHome;
$('abortGame').onclick=async()=>{if(!confirm(t('Diesen Spielraum mit ALLEN Runden, Statistiken, Protokollen und Kategorien dauerhaft löschen? Die Einladungslinks funktionieren danach nicht mehr.')))return;try{if(online)await request('/rooms/'+online.room+'/abort',{confirm:'delete-room'});else localStorage.removeItem(key);resetDeletedGame();}catch(e){notice(e.message);}};
function resetDeletedGame(){leave(true);state=null;shownStatistics=null;showHome();notice('Das Spiel wurde abgebrochen und gelöscht.');}
window.addEventListener('kings-room-deleted',resetDeletedGame);
$('lastRoom').onclick=async()=>{try{await joinOnline(lastRoom());}catch(e){notice(e.message);}};
async function showArchive(append=false){
  $('ownerLogin').hidden=!!ownerCredential;if(!ownerCredential){$('archiveStatus').textContent='Nur der Besitzer kann die gespeicherten Spiele und Statistikdateien öffnen.';return;}
  try{const rooms=await request('/admin/rooms'+(append&&archiveBefore?'?before='+encodeURIComponent(archiveBefore):''),null,ownerCredential);if(!append)$('archiveList').replaceChildren();$('archiveStatus').textContent=rooms.length?'Spielraum auswählen, um die gespeicherten Runden zu öffnen.':'Noch keine weiteren Spiele gespeichert.';
    for(const room of rooms){
      const wrap=document.createElement('details'),summary=document.createElement('summary');summary.textContent=room.name;wrap.append(summary);let loaded=false;
      wrap.addEventListener('toggle',async()=>{
        if(!wrap.open||loaded)return;loaded=true;
        try{
          const rounds=await request('/rooms/'+room.id+'/rounds',null,ownerCredential);
          for(const round of rounds){
            const row=document.createElement('div'),name=document.createElement('p');row.className='archive-round';name.textContent=gameText(`Runde ${round.id} · ${round.name}`);row.append(name);
            for(const [label,visualize]of [['Ansehen',true],['JSON speichern',false]]){
              const b=document.createElement('button');b.textContent=label;
              b.onclick=async()=>{b.disabled=true;try{const archive=await readArchive(room.id,round.id);if(visualize)openArchive(archive);else{const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json'}));download(url,round.name+'_R'+round.id+'.json');setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch(e){$('archiveStatus').textContent=gameText(e.message);}finally{b.disabled=false;}};
              row.append(b);
            }
            wrap.append(row);
          }
        }catch(e){$('archiveStatus').textContent=e.message;loaded=false;}
      });$('archiveList').append(wrap);
    }
    archiveBefore=rooms.at(-1)?.created;$('archiveMore').hidden=rooms.length<50;
  }catch(e){$('archiveStatus').textContent=e.message;$('ownerLogin').hidden=false;}
}
async function readArchive(room,round){const archive=await request(`/rooms/${room}/archive?round=${round}`,null,ownerCredential);let after=0;archive.events=[];for(;;){const page=await request(`/rooms/${room}/stats?round=${round}&after=${after}`,null,ownerCredential);archive.events.push(...page.events);after=page.cursor;if(!page.more)break;}return archive;}
function openArchive(archive){if(!Array.isArray(archive.summary?.players)||!Array.isArray(archive.events))throw Error(t('Keine gültige Kings-Statistikdatei.'));archivedStatistics=true;$('statsTitle').textContent=gameText(`Runde ${archive.id||''} · ${archive.name||t('Historie')}`);switchTab('graph');statistics(archiveView(archive));$('statistics').showModal();}
$('archiveStatus').insertAdjacentHTML('afterend','<label class="import-archive">Gespeicherte JSON-Datei ansehen<input id="archiveImport" type="file" accept=".json,application/json"></label>');
$('archiveImport').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024)throw Error('Die Datei ist zu groß (maximal 10 MB).');openArchive(JSON.parse(await file.text()));}catch(err){$('archiveStatus').textContent=err.message;}finally{e.target.value='';}};
$('archiveOpen').onclick=()=>{$('archiveDialog').showModal();showArchive();localize();};$('archiveClose').onclick=()=>$('archiveDialog').close();$('archiveMore').onclick=()=>showArchive(true);
$('ownerLogin').onsubmit=e=>{e.preventDefault();ownerCredential=$('ownerKey').value.trim();try{localStorage.setItem('kings-owner',JSON.stringify(ownerCredential));}catch{}$('ownerKey').value='';showArchive();};
// Compact screens replace the long stacked mobile layout.
let activeScreen='play',hostLoggedRoom=null;
const rules=document.querySelector('main>details');rules.id='rulesPanel';
$('game').before(Object.assign(document.createElement('nav'),{id:'viewNav'}));
$('personalScore').insertAdjacentHTML('afterend','<div id="personalRoles" aria-live="polite"></div>');
const categories=document.createElement('section');categories.id='myCategories';
$('categoryPreferences').before(categories);
for(const node of [$('categoryPreferences'),$('categoryPreferences').nextElementSibling,$('categoryQueue'),$('queueEmpty')])if(node&&node!==categories)categories.append(node);
document.querySelector('main').append(Object.assign(document.createElement('section'),{id:'categoryLibrary',hidden:true}));
$('categoryLibrary').innerHTML='<h1>Kategorienhistorie</h1><p>Gespielte Kategorien aus allen Spielen, nach Namen gruppiert. Gleiche Namen gehören zur selben Liste.</p><div id="categoryLibraryList"></div><button id="moreCategories">Weitere laden</button>';
let libraryCursor=0,libraryRows=[],libraryLoading=false;
async function loadCategoryLibrary(reset=false){if(libraryLoading||!online)return;libraryLoading=true;try{if(reset){libraryCursor=0;libraryRows=[];}let migration=true;for(let n=0;n<20&&migration;n++){const page=await request(`/rooms/${online.room}/categories?after=${libraryCursor}`);libraryRows.push(...page.rows);libraryCursor=page.cursor;migration=page.migrating;$('moreCategories').hidden=!page.more&&!page.migrating;if(page.more)break;}
 const groups=new Map();for(const r of libraryRows){if(!groups.has(r.name))groups.set(r.name,[]);groups.get(r.name).push(r);}$('categoryLibraryList').replaceChildren();for(const [name,rows]of [...groups].sort(([a],[b])=>a.localeCompare(b,locale()))){const box=document.createElement('details');box.open=true;const title=document.createElement('summary');title.textContent=name;box.append(title);const list=document.createElement('ul');for(const r of rows.sort((a,b)=>b.at.localeCompare(a.at))){const li=document.createElement('li');li.textContent=`${r.category} · ${new Date(r.at).toLocaleDateString(locale())} · ${t('Verloren von')}: ${r.loser}`;list.append(li);}box.append(list);$('categoryLibraryList').append(box);}if(!groups.size)$('categoryLibraryList').textContent=t('Noch keine Kategorien gespielt.');
}catch(e){notice(e.message);}finally{libraryLoading=false;localize();}}
$('moreCategories').onclick=()=>loadCategoryLibrary();
document.body.insertAdjacentHTML('beforeend','<dialog id="hostPlayerDialog"><h1>Wer bist du?</h1><p>Wähle deinen Spielernamen für die Spielleitung.</p><div id="hostPlayerChoices"></div></dialog>');
$('hostPlayerDialog').addEventListener('cancel',e=>e.preventDefault());
function renderNavigation(){
 if(!state||!online)return;
 const host=roomView.role!=='player',identified=roomView.me!=null;
 if(!host&&activeScreen==='play')activeScreen='personal';
 if(roomView.role==='host'&&hostLoggedRoom!==online.room&&roomView.controller===deviceId){$('hostPlayerChoices').replaceChildren();state.players.forEach((p,i)=>{const b=document.createElement('button');b.textContent=p.name;b.onclick=async()=>{try{const view=await command({type:'hostPlayer',player:i});hostLoggedRoom=online.room;applyOnline(view);$('hostPlayerDialog').close();if(state.deck.length===32)$('roomOpen').click();}catch(e){notice(e.message);}};$('hostPlayerChoices').append(b);});if(!$('hostPlayerDialog').open)$('hostPlayerDialog').showModal();}
 $('viewNav').hidden=false;$('viewNav').replaceChildren();
 const screens=[...(host?[['play','Spiel'],['overview','Übersicht']]:[]),...(identified?[['personal','Mein Spiel'],['categories','Meine Kategorien']]:[]),['library','Kategorienhistorie'],['rules','Spielregeln']];
 for(const [id,label]of screens){const b=document.createElement('button');b.textContent=t(label);b.setAttribute('aria-pressed',activeScreen===id);b.onclick=()=>{activeScreen=id;renderNavigation();if(id==='library')loadCategoryLibrary(true);};$('viewNav').append(b);}
 $('leaderOverview').hidden=activeScreen!=='overview';$('game').hidden=activeScreen!=='play'||state.over;$('results').hidden=activeScreen!=='play'||!state.over;
 $('personal').hidden=!['personal','categories'].includes(activeScreen)||!identified;
 for(const id of ['personalScore','personalRoles','comparison'])$(id).hidden=activeScreen!=='personal';
 $('myCategories').hidden=activeScreen!=='categories';
 $('categoryLibrary').hidden=activeScreen!=='library';rules.hidden=activeScreen!=='rules';rules.open=activeScreen==='rules';
 localize();
}
const initial=contextFromLink();
if(initial?.owner){ownerCredential=initial.owner;showHome();$('archiveOpen').click();}
else if(initial?.room)joinOnline(initial).catch(e=>{openSetup();notice(e.message);});
else if(initial?.missing){openSetup();notice('Bitte den vollständigen persönlichen Einladungslink öffnen.');}
else showHome();
localize();
