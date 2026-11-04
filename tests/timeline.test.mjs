import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timeline,reasonSymbol} from '../timeline.mjs';
test('timeline annotates structured penalties and distinguishes role uses',()=>{
 const players=[{name:'A',score:3},{name:'B',score:8}];
 const events=[{at:'2026-11-04T18:00:00Z',data:{scores:[0,0],penalties:[]}},{at:'2026-11-04T18:01:00Z',data:{scores:[1,0],penalties:[{player:0,kind:'7',amount:1}]}},{at:'2026-11-04T18:02:00Z',data:{scores:[2,0],penalties:[{player:0,kind:'10',amount:1,via:'title'}]}},{at:'2026-11-04T18:03:00Z',data:{scores:[2,8],penalties:[{player:1,kind:'Bube',amount:8,via:'title'}]}}];
 const result=timeline(players,events);assert.deepEqual(result[0].markers.map(m=>m.symbol),['7','10👍']);assert.equal(result[1].markers[0].symbol,'B❓');assert.equal(result[1].markers[0].penalties[0].amount,8);assert.equal(reasonSymbol('4. K'),'4K');assert.equal(reasonSymbol('Ass'),'A');
});
test('legacy logs recover card reasons, preserve round baselines and flag missing reasons',()=>{
 const result=timeline([{name:'A',score:24}],[{at:'2026-11-04',data:{scores:[16],lines:[]}},{at:'2026-11-04',data:{scores:[24],lines:['A: Dame, +8 Schlucke']}}],[{score:16}]);assert.deepEqual(result[0].history,[0,0,8]);assert.equal(result[0].markers[0].symbol,'D');
 assert.equal(timeline([{name:'A'}],[{at:'2026-11-04',data:{scores:[1],lines:[]}}])[0].markers[0].symbol,'?');
});
