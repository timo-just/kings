import {locale} from './i18n.mjs';
export function archiveView(archive){
  const initial=archive.initial||archive.summary.players.map(p=>({...p,score:0,drawn:{},distributed:{},received:{}}));
  const events=archive.events||[];
  const players=archive.summary.players.map((p,i)=>{
    const base=initial[i]||{score:0};const result={...p,score:p.score-base.score,history:[0,...events.map(e=>Math.max(0,(e.data.scores[i]??base.score)-base.score))]};
    if(result.history.length===1)result.history.push(result.score);
    for(const field of ['drawn','distributed','received'])result[field]=Object.fromEntries(Object.entries(p[field]||{}).map(([k,n])=>[k,n-(base[field]?.[k]||0)]));
    return result;
  });
  return {players,log:events.flatMap(e=>(e.data.lines||[]).map(line=>`${new Date(e.at).toLocaleString(locale())} · ${line}`)),categoryResults:events.filter(e=>e.kind==='assign'&&e.data.category).map(e=>e.data.category)};
}
