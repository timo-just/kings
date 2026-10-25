import {newGame,draw,assign,selectMode,colors,ranks} from './engine.mjs';
const $=id=>document.getElementById(id), key='kings-browser-v1';
let state=null;
try { const saved=JSON.parse(localStorage.getItem(key)); if(saved?.version===1 && saved.players?.length && Array.isArray(saved.deck)) state=saved; } catch {}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(let i=0;i<6;i++) { const label=document.createElement('label'); label.style.setProperty('--player',colors[i]); label.innerHTML=`<span class="dot" aria-hidden="true"></span><input aria-label="Spieler ${i+1}" placeholder="Player ${i+1} Name" maxlength="40" autocomplete="off">`; $('fields').append(label); }
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
function openSetup(){ $('setup').hidden=false;$('game').hidden=true;$('results').hidden=true;$('edit').hidden=true;$('statsOpen').hidden=!state;$('resume').hidden=!state; $('fields').querySelectorAll('input').forEach((el,i)=>el.value=state?.players.find(p=>p.slot===i)?.name||''); }
$('names').onsubmit=e=>{e.preventDefault(); if(state && !confirm('Neue Spieler beginnen eine neue Partie. Bisherigen Spielstand ersetzen?'))return; try{state=newGame([...$('fields').querySelectorAll('input')].map(el=>el.value));$('error').textContent='';save();render();}catch(err){$('error').textContent=err.message;}};
$('resume').onclick=()=>render();$('edit').onclick=openSetup;
$('draw').onclick=()=>{draw(state);save();render();};
for(const [id,mode] of [['thumb','10'],['question','Bube']]) $(id).onclick=()=>{selectMode(state,mode);save();render();};
function render(){
  $('setup').hidden=true;$('statsOpen').hidden=false;$('edit').hidden=false;$('game').hidden=state.over;$('results').hidden=!state.over;
  if(state.over){results();return;}
  $('kings').textContent=`Kings: ${state.kings}/4`;$('remaining').textContent=`${32-state.deck.length}/32`;
  $('turn').textContent=state.players[state.turn].name;
  $('card').innerHTML=state.card?`<span class="corner">${state.card.rank==='Ass'?'A':state.card.rank}<br>${state.card.suit}</span><span class="card-suit">${state.card.suit}</span><span class="corner bottom">${state.card.rank==='Ass'?'A':state.card.rank}<br>${state.card.suit}</span>`:'<span class="card-suit">&#9819;</span>';$('card').classList.toggle('red',['♥','♦'].includes(state.card?.suit));
  $('message').textContent=state.message;$('draw').disabled=!!(state.pending||state.mode);
  $('thumbOwner').textContent=state.thumb===null?'keiner':`${state.players[state.thumb].name} (${state.thumbUses})`;
  $('questionOwner').textContent=state.question===null?'keiner':state.players[state.question].name;
  $('thumb').setAttribute('aria-pressed',state.mode==='10');$('question').setAttribute('aria-pressed',state.mode==='Bube');
  $('players').replaceChildren();state.players.forEach((p,i)=>{const b=document.createElement('button');b.style.setProperty('--player',colors[p.slot]);b.classList.toggle('current',i===state.turn);b.innerHTML=`${escape(p.name)}<small>${Math.floor(p.score/16)} Gläser · ${((16-p.score%16)*6.25).toLocaleString('de-DE')} %</small>`;b.setAttribute('aria-label',`${p.name}, ${p.score} Schlücke, Strafe zuweisen`);b.onclick=()=>{if(assign(state,i)){save();render();}};$('players').append(b);});
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
  ctx.fillText('Schlücke',10,30);ctx.fillText('Karten',855,515);
  for(let t=0;t<=steps;t+=Math.max(1,Math.ceil(steps/8))){ctx.fillText(String(t),65+t/steps*860,500);}
  state.players.forEach(p=>{ctx.strokeStyle=colors[p.slot];ctx.lineWidth=3;ctx.beginPath();p.history.forEach((v,i)=>{const x=65+i/steps*860,y=470-v/max*390;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});
}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
$('png').onclick=()=>download($('chart').toDataURL('image/png'),'kings_final.png');
$('log').onclick=()=>{const blob=new Blob([state.log.join('\n')+'\n\nEndstand:\n'+state.players.map(p=>`${p.name}: ${(p.score/16).toFixed(2)} Gläser`).join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);download(url,'kings_log.txt');setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('next').onclick=()=>{state=newGame([],state);save();render();};
const tabs=['graph','tables','log'];
function switchTab(name){for(const id of tabs){$('tab-'+id).setAttribute('aria-selected',id===name);$('tab-'+id).tabIndex=id===name?0:-1;$('panel-'+id).hidden=id!==name;}}
for(const [i,id] of tabs.entries()){
  $('tab-'+id).onclick=()=>switchTab(id);
  $('tab-'+id).onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();switchTab(tabs[n]);$('tab-'+tabs[n]).focus();}};
}
$('statsOpen').onclick=()=>{statistics();$('statistics').showModal();};
$('statsClose').onclick=()=>$('statistics').close();
$('panel-log').append($('log'));
state?render():openSetup();
