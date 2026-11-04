import {colors} from './engine.mjs';
import {t,locale} from './i18n.mjs';
const ns='http://www.w3.org/2000/svg';
const el=(tag,attrs={},text)=>{const node=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;};
let lastSvg=null,graphPage=null,graphAll=false,graphIdentity='';
export function renderHistoryChart(data){
 const old=document.getElementById('reasonChart');old?.remove();
 let wrap=document.getElementById('reasonChartWrap');if(!wrap){wrap=document.createElement('div');wrap.id='reasonChartWrap';wrap.tabIndex=0;document.getElementById('chart').before(wrap);}
 document.getElementById('chart').hidden=true;wrap.replaceChildren();
 const lastStep=Math.max(1,...data.players.map(p=>p.history.length-1));
 const changes=[0];for(let i=1;i<=lastStep;i++)if(data.players.some(p=>p.history[i]!==undefined&&p.history[i]!==p.history[i-1]))changes.push(i);
 if(changes.length===1)changes.push(lastStep);
 const identity=data.players.map(p=>p.name).join('|');if(identity!==graphIdentity){graphPage=null;graphIdentity=identity;}
 const count=16,pages=Math.ceil((changes.length-1)/count);if(graphPage===null)graphPage=pages-1;graphPage=Math.max(0,Math.min(graphPage,pages-1));
 const indices=graphAll?changes:changes.slice(graphPage*count,graphPage*count+count+1),positions=new Map(indices.map((v,i)=>[v,i]));
 const steps=Math.max(1,indices.length-1),width=Math.max(300,Math.min(760,wrap.clientWidth||340)),height=340;
 const max=Math.max(8,...data.players.flatMap(p=>indices.map(i=>p.history[i]||0))),x=i=>42+(positions.get(i)??0)/steps*(width-62),y=score=>270-score/max*205;
 const svg=el('svg',{id:'reasonChart',xmlns:ns,viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':t('Schluckverlauf mit Strafgründen')});
 svg.append(el('rect',{width,height,fill:'#191919'}));
 const tick=Math.max(4,Math.ceil(max/20)*4);for(let n=0;n<=max;n+=tick){svg.append(el('line',{x1:42,y1:y(n),x2:width-15,y2:y(n),stroke:'#484848'}),el('text',{x:3,y:y(n)+4,fill:'#cccccc','font-size':11},(n/16).toLocaleString(locale(),{maximumFractionDigits:2})));}
 svg.append(el('text',{x:3,y:22,fill:'#cccccc','font-size':12},t('Gläser')));
 indices.forEach((step,i)=>{if(i%Math.max(1,Math.ceil(steps/6))===0)svg.append(el('text',{x:x(step),y:295,fill:'#cccccc','font-size':11},changes.indexOf(step)));});
 svg.append(el('text',{x:42,y:322,fill:'#cccccc','font-size':12},t('Verlauf →')));
 const occupied=new Map();
 data.players.forEach((p,index)=>{
  const color=colors[p.slot]||colors[index%colors.length];svg.append(el('polyline',{points:indices.map(i=>`${x(i)},${y(p.history[i]||0)}`).join(' '),fill:'none',stroke:color,'stroke-width':2}));
  for(const mark of p.markers||[]){if(!positions.has(mark.step))continue;const px=x(mark.step),py=y(mark.score),key=`${mark.step}:${mark.score}`,offset=occupied.get(key)||0;occupied.set(key,offset+1);const labelY=Math.max(43,py-16-offset*18);
   const descriptions={'7':'Rechter Nachbar','8':'Selbst trinken','9':'Alle trinken','10':'Daumenkönig','Bube':'Fragekönig','Dame':'Kategorie verloren','4. K':'Vierter König','Ass':'Ass','?':'Grund nicht gespeichert'};
   const amount=mark.penalties.reduce((n,p)=>n+p.amount,0),reasons=mark.penalties.map(p=>`${t(descriptions[p.kind]||p.kind)}${p.kind==='Dame'&&mark.category?': '+mark.category:''} (+${p.amount})`).join(', ');
   const detail=`${p.name}: +${amount} ${t('Schlücke')} · ${reasons} · ${mark.score} ${t('Schlücke')} · ${new Date(mark.at).toLocaleString(locale())}`;
   const symbol=mark.symbol.replaceAll('👍','').replaceAll('❓','');
   const group=el('g',{tabindex:0,role:'button','aria-label':detail,'data-reason':symbol,style:'cursor:pointer'});
   group.append(el('title',{},detail),el('circle',{cx:px,cy:py,r:4,fill:color,stroke:'#191919','stroke-width':1}),el('line',{x1:px,y1:py-4,x2:px,y2:labelY+3,stroke:color,'stroke-width':1}));
   const boxWidth=Math.max(18,Array.from(symbol).length*7+8);group.append(el('rect',{x:px-boxWidth/2,y:labelY-12,width:boxWidth,height:17,rx:4,fill:'#292929',stroke:color}),el('text',{x:px,y:labelY,fill:color,'font-family':'Arial, sans-serif','font-size':11,'font-weight':'bold','text-anchor':'middle'},symbol));
   const show=()=>{document.getElementById('reasonDetail').textContent=detail;};group.addEventListener('click',show);group.addEventListener('focus',show);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});svg.append(group);
  }
 });
 wrap.append(svg);lastSvg=svg;
 let controls=document.getElementById('graphControls');if(!controls){controls=document.createElement('div');controls.id='graphControls';wrap.before(controls);}controls.replaceChildren();
 for(const [label,disabled,action]of [['←',graphAll||graphPage===0,()=>graphPage--],[graphAll?t('Ausschnitt'):t('Alles'),false,()=>graphAll=!graphAll],['→',graphAll||graphPage>=pages-1,()=>graphPage++]]){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-label',label==='←'?t('Vorheriger Abschnitt'):label==='→'?t('Nächster Abschnitt'):label);b.onclick=()=>{action();renderHistoryChart(data);};controls.append(b);}
 let hint=document.getElementById('reasonDetail');if(!hint){hint=document.createElement('p');hint.id='reasonDetail';hint.setAttribute('role','status');wrap.after(hint);}hint.textContent=t('Punkt antippen: Spieler, Strafgrund und Schluckzahl anzeigen.');
 let legend=document.getElementById('reasonLegend');if(!legend){legend=document.createElement('p');legend.id='reasonLegend';hint.after(legend);}legend.textContent=t('7 Nachbar · 8 selbst · 9 alle · 10 Daumenkönig · B Fragekönig · D Kategorie · 4K vierter König · A Ass');
}
export async function chartPng(){
 if(!lastSvg)return null;
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(lastSvg)],{type:'image/svg+xml;charset=utf-8'}));
 try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.getElementById('chart'),scale=2;canvas.width=lastSvg.width.baseVal.value*scale;canvas.height=lastSvg.height.baseVal.value*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}
}
