import {colors} from './engine.mjs';
import {t,locale} from './i18n.mjs';
const ns='http://www.w3.org/2000/svg';
const el=(tag,attrs={},text)=>{const node=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;};
let lastSvg=null;
export function renderHistoryChart(data){
 const old=document.getElementById('reasonChart');old?.remove();
 let wrap=document.getElementById('reasonChartWrap');if(!wrap){wrap=document.createElement('div');wrap.id='reasonChartWrap';wrap.tabIndex=0;document.getElementById('chart').before(wrap);}
 document.getElementById('chart').hidden=true;wrap.replaceChildren();
 const steps=Math.max(1,...data.players.map(p=>p.history.length-1)),width=Math.min(24000,Math.max(960,steps*44)),height=600;
 const max=Math.max(8,...data.players.flatMap(p=>p.history)),x=i=>70+i/steps*(width-105),y=score=>500-score/max*370;
 const svg=el('svg',{id:'reasonChart',xmlns:ns,viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':t('Schluckverlauf mit Strafgründen')});
 svg.append(el('rect',{width,height,fill:'#141218'}));
 const tick=Math.max(1,Math.ceil(max/8));for(let n=0;n<=max;n+=tick){svg.append(el('line',{x1:70,y1:y(n),x2:width-30,y2:y(n),stroke:'#49454f'}),el('text',{x:12,y:y(n)+6,fill:'#cac4d0','font-size':16},n));}
 svg.append(el('text',{x:12,y:30,fill:'#cac4d0','font-size':17},t('Schlücke')));
 for(let step=0;step<=steps;step+=Math.max(1,Math.ceil(steps/20)))svg.append(el('text',{x:x(step),y:535,fill:'#cac4d0','font-size':15},step));
 svg.append(el('text',{x:70,y:565,fill:'#cac4d0','font-size':16},t('Verlauf →')));
 const occupied=new Map();
 data.players.forEach((p,index)=>{
  const color=colors[p.slot]||colors[index%colors.length];svg.append(el('polyline',{points:p.history.map((n,i)=>`${x(i)},${y(n)}`).join(' '),fill:'none',stroke:color,'stroke-width':3}));
  for(const mark of p.markers||[]){const px=x(mark.step),py=y(mark.score),key=`${mark.step}:${mark.score}`,offset=occupied.get(key)||0;occupied.set(key,offset+1);const labelY=Math.max(45,py-24-offset*26);
   const descriptions={'7':'Rechter Nachbar','8':'Selbst trinken','9':'Alle trinken','10':'Daumenkönig','Bube':'Fragekönig','Dame':'Kategorie verloren','4. K':'Vierter König','Ass':'Ass','?':'Grund nicht gespeichert'};
   const amount=mark.penalties.reduce((n,p)=>n+p.amount,0),reasons=mark.penalties.map(p=>`${t(descriptions[p.kind]||p.kind)}${p.kind==='Dame'&&mark.category?': '+mark.category:''} (+${p.amount})`).join(', ');
   const detail=`${p.name}: +${amount} ${t('Schlücke')} · ${reasons} · ${mark.score} ${t('Schlücke')} · ${new Date(mark.at).toLocaleString(locale())}`;
   const group=el('g',{tabindex:0,role:'button','aria-label':detail,'data-reason':mark.symbol,style:'cursor:pointer'});
   group.append(el('title',{},detail),el('circle',{cx:px,cy:py,r:5,fill:color,stroke:'#141218','stroke-width':2}),el('line',{x1:px,y1:py-5,x2:px,y2:labelY+5,stroke:color,'stroke-width':1}));
   const boxWidth=Math.max(30,Array.from(mark.symbol).length*11+14);group.append(el('rect',{x:px-boxWidth/2,y:labelY-18,width:boxWidth,height:25,rx:6,fill:'#211d29',stroke:color}),el('text',{x:px,y:labelY,fill:color,'font-family':'Arial, sans-serif','font-size':16,'font-weight':'bold','text-anchor':'middle'},mark.symbol));
   const show=()=>{document.getElementById('reasonDetail').textContent=detail;};group.addEventListener('click',show);group.addEventListener('focus',show);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});svg.append(group);
  }
 });
 wrap.append(svg);lastSvg=svg;
 let hint=document.getElementById('reasonDetail');if(!hint){hint=document.createElement('p');hint.id='reasonDetail';hint.setAttribute('role','status');wrap.after(hint);}hint.textContent=t('Punkt antippen: Spieler, Strafgrund und Schluckzahl anzeigen.');
 let legend=document.getElementById('reasonLegend');if(!legend){legend=document.createElement('p');legend.id='reasonLegend';hint.after(legend);}legend.textContent=t('7 Nachbar · 8 selbst · 9 alle · 10/👍 Daumenkönig · B/❓ Fragekönig · D Kategorie · 4K vierter König · A Ass');
}
export async function chartPng(){
 if(!lastSvg)return null;
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(lastSvg)],{type:'image/svg+xml;charset=utf-8'}));
 try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.getElementById('chart'),scale=Math.min(1,8000/lastSvg.width.baseVal.value);canvas.width=lastSvg.width.baseVal.value*scale;canvas.height=600*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}
}
