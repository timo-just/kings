export function reasonSymbol(kind,via='card'){
 const symbol={'Ass':'A','Bube':'B','Dame':'D','4. K':'4K','König':'K'}[kind]||kind;
 return via==='title'?(kind==='10'?'10👍':kind==='Bube'?'B❓':symbol):symbol;
}
export function timeline(players,events,initial=players.map(()=>({score:0}))){
 return players.map((p,index)=>{
  const base=initial[index]?.score||0,history=[0],markers=[];
  events.forEach((event,step)=>{
   const previous=history.at(-1),score=Math.max(0,(event.data.scores[index]??base)-base);history.push(score);
   let penalties;
   if(Array.isArray(event.data.penalties))penalties=event.data.penalties.filter(v=>v.player===index);
   else{
    const prefix=p.name+': ';let remaining=score-previous;penalties=[];
    for(const line of event.data.lines||[]){if(!line.startsWith(prefix))continue;const match=line.slice(prefix.length).match(/^(.+), \+(\d+) Schl[uü]cke?$/);if(!match||remaining<=0)continue;const amount=Math.min(remaining,Number(match[2]));remaining-=amount;penalties.push({player:index,kind:match[1],amount,via:['10','Bube'].includes(match[1])?'title':'card'});}
   }
   if(score>previous){if(!penalties.length)penalties=[{kind:'?',amount:score-previous}];markers.push({step:step+1,at:event.at,score,penalties,category:event.data.category?.category||'',symbol:penalties.map(v=>reasonSymbol(v.kind,v.via)).join('+')});}
  });
  return {...p,history,markers};
 });
}
