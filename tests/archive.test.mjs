import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveView} from '../archive-model.mjs';
test('archive shows per-round amounts, history and category losses without mutating live totals',()=>{
 const summary={players:[{name:'A',slot:0,score:24,drawn:{Dame:3},distributed:{Dame:2},received:{Dame:2}}]};
 const a={summary,initial:[{score:16,drawn:{Dame:2},distributed:{Dame:1},received:{Dame:1}}],events:[{at:'2026-10-25T18:00:00Z',kind:'start',data:{scores:[16],lines:[]}},{at:'2026-10-25T18:01:00Z',kind:'assign',data:{scores:[24],lines:['Kategorie verloren'],category:{category:'Filme',loser:'A',giver:'B'}}}]};
 const view=archiveView(a);assert.equal(view.players[0].score,8);assert.deepEqual(view.players[0].history,[0,0,8]);assert.equal(view.players[0].received.Dame,1);assert.equal(view.categoryResults[0].category,'Filme');assert.ok(view.log[0].includes('Kategorie verloren'));assert.equal(summary.players[0].score,24);
});
