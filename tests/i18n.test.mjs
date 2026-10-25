import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setLanguage,t,gameText,cardRank} from '../i18n.mjs';
test('English interface, card names and game messages preserve player names',()=>{
 setLanguage('en');assert.equal(t('Hauptmenü'),'Main menu');assert.equal(t('Verteilte Karten / Strafen'),'Cards / penalties given');assert.equal(cardRank('Dame'),'Q');assert.equal(cardRank('Ass'),'A');
 assert.equal(gameText('Dame ist neuer Fragekönig.'),'Dame is the new question king.');assert.equal(gameText('Rechter Nachbar: König trinkt einen Schluck.'),'Right neighbour: König takes one sip.');
 assert.equal(gameText('Spiel 1, Karte 2: Anna zieht ♥ Bube'),'Game 1, card 2: Anna draws ♥ Jack');assert.equal(gameText('Kategorie: Filme – Ben verliert'),'Category: Filme – Ben loses');
 setLanguage('de');assert.equal(t('Hauptmenü'),'Hauptmenü');assert.equal(cardRank('Dame'),'Dame');
});
