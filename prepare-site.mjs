import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const files=['index.html','app.mjs','engine.mjs','style.css','network.mjs','multiplayer-ui.mjs'];
const sources=await Promise.all(files.map(file=>readFile(new URL(file,import.meta.url),'utf8')));
const version=createHash('sha256').update(sources.join('\n')).digest('hex').slice(0,10);
const output=new URL('_site/',import.meta.url);
await mkdir(output,{recursive:true});
for(let i=0;i<files.length;i++){
  let source=sources[i];
  if(files[i]==='index.html'){
    source=source.replace('href="style.css"',`href="style.css?v=${version}"`).replace('src="app.mjs"',`src="app.mjs?v=${version}"`);
    source=source.replace('</footer>',`<div class="build-version">Version ${version}</div></footer>`);
  }
  if(files[i].endsWith('.mjs')) source=source.replace(/'\.\/([^'?]+\.mjs)'/g,(_,file)=>`'./${file}?v=${version}'`);
  await writeFile(new URL(files[i],output),source);
}
await copyFile(new URL('icon.png',import.meta.url),new URL('icon.png',output));
console.log(`Prepared Kings version ${version}`);
