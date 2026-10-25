export const ranks = ['Ass','König','Dame','Bube','10','9','8','7'];
export const colors = ['#668cff','#69df80','#ff7777','#f3db66','#62d9e5','#e67de5'];
export function newGame(names, previous = null) {
  const players = previous ? structuredClone(previous.players) : names.map((name, slot) => ({name:name.trim(),slot,score:0,drawn:{},distributed:{},received:{},history:[0]})).filter(p=>p.name);
  if (!players.length || players.length > 6) throw Error('Bitte ein bis sechs Namen eingeben.');
  const deck = ['♥','♣','♠','♦'].flatMap(suit=>ranks.map(rank=>({suit,rank})));
  for (let i=deck.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  return {version:1,players,deck,turn:previous?.turn ?? 0,kings:0,question:null,thumb:null,thumbUses:0,pending:null,mode:null,card:null,over:false,round:(previous?.round ?? 0)+1,log:previous?.log.slice() ?? [],categoryResults:previous?.categoryResults?.slice() ?? [],category:'',message:'Bereit? Zieht die erste Karte.'};
}
function count(map,key) { map[key]=(map[key]||0)+1; }
function penalty(s,i,kind,amount,source=s.turn) { const p=s.players[i]; p.score+=amount; count(p.received,kind); const giver=s.players[source]; if(giver) { giver.distributed ||= {}; count(giver.distributed,kind); } s.log.push(`${p.name}: ${kind}, +${amount} Schluck${amount===1?'':'e'}`); }
function snapshot(s) { s.players.forEach(p=>p.history.push(p.score)); }
export function draw(s) {
  if(s.over || s.pending || s.mode) return false;
  if(s.card) s.turn=(s.turn+1)%s.players.length;
  const card=s.deck.pop(); if(!card) return false;
  s.card=card; const p=s.players[s.turn]; count(p.drawn,card.rank);
  s.log.push(`Spiel ${s.round}, Karte ${32-s.deck.length}: ${p.name} zieht ${card.suit} ${card.rank}`);
  switch(card.rank) {
    case 'Ass': s.pending='Ass'; s.message=`${p.name} bestimmt, wer ext. Wähle die Person.`; break;
    case 'Dame': s.pending='Dame'; s.message=`${p.name} bestimmt eine Kategorie. Wähle anschließend die Person, die verliert.`; break;
    case 'Bube': s.question=s.turn; s.message=`${p.name} ist neuer Fragekönig.`; break;
    case '10': s.thumb=s.turn; s.thumbUses=3; s.message=`${p.name} ist neuer Daumenkönig (3 Einsätze).`; break;
    case '9': s.players.forEach((_,i)=>penalty(s,i,'9',1)); s.message='Tutti! Alle trinken einen Schluck.'; break;
    case '8': penalty(s,s.turn,'8',1); s.message=`${p.name} trinkt einen Schluck.`; break;
    case '7': { const i=(s.turn-1+s.players.length)%s.players.length; penalty(s,i,'7',1); s.message=`Rechter Nachbar: ${s.players[i].name} trinkt einen Schluck.`; break; }
    case 'König':
      s.kings++; count(p.received,'König'); s.message=`${s.kings}. König`;
      if(s.kings===4) { penalty(s,s.turn,'4. K',16-p.score%16); s.over=true; s.message=`Game over: ${p.name} verliert das Spiel! 💀`; s.log.push(s.message); }
  }
  snapshot(s); return true;
}
export function selectMode(s,mode) {
  if(s.over) return false;
  if(s.mode===mode) { s.mode=null; return true; }
  if(mode==='Bube' && s.question===null) { s.message='Niemand ist zurzeit Fragekönig.'; return false; }
  if(mode==='10' && !s.thumbUses) { s.message='Niemand ist zurzeit Daumenkönig.'; return false; }
  s.mode=mode; s.message='Wähle die Person, die trinken muss. Erneut auf den König tippen bricht die Auswahl ab.'; return true;
}
export function assign(s,i) {
  if(s.over || !s.players[i]) return false;
  const kind=s.mode||s.pending; if(!kind) return false;
  if(kind==='Dame') {
    s.categoryResults ||= [];
    s.categoryResults.push({round:s.round,card:32-s.deck.length,category:s.category||'',loser:s.players[i].name,giver:s.players[s.turn].name});
    s.log.push(`Kategorie: ${s.category||'(ohne Namen)'} – ${s.players[i].name} verliert`);
    s.category='';
  }
  const source=s.mode==='Bube'?s.question:s.mode==='10'?s.thumb:s.turn;
  const p=s.players[i]; penalty(s,i,kind,kind==='10'?1:Math.min(8,16-p.score%16),source);
  if(s.mode==='Bube') s.question=null;
  if(s.mode==='10' && --s.thumbUses===0) s.thumb=null;
  if(s.mode) s.mode=null; else s.pending=null;
  s.players.forEach(p=>p.history[p.history.length-1]=p.score);
  s.message=`${p.name} trinkt (${kind}).${s.pending?' Die offene Karte muss noch vergeben werden.':''}`;
  return true;
}
