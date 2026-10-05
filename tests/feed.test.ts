import { describe,expect,it } from "vitest";
import { eligibleCandidate,mixExploration,seededUniform,weightedShuffle } from "../lib/feed";
import { TUTORIAL_PROFILE } from "../config/discover-tutorial";
import { databaseId } from "../lib/relationship-events";

const items=Array.from({length:100},(_,id)=>({id:String(id),score:id}));
describe("session-seeded discovery",()=>{
  it("uses the authoritative backend for UUID accounts and local mode only for local IDs",()=>{
    expect(databaseId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(databaseId("demo-ananya-1")).toBe(false);
  });
  it("is reproducible by seed and independent of incoming database order",()=>{
    expect(weightedShuffle(items,"session",(item)=>item.score)).toEqual(weightedShuffle([...items].reverse(),"session",(item)=>item.score));
    expect(weightedShuffle(items,"other-session",(item)=>item.score)).not.toEqual(weightedShuffle(items,"session",(item)=>item.score));
    for(const item of items){expect(seededUniform("session",item.id)).toBeGreaterThan(0);expect(seededUniform("session",item.id)).toBeLessThan(1);}
  });
  it("favours higher compatibility over 1000 sessions without making low scores invisible",()=>{
    let high=0,low=0;
    const candidates=[{id:"high",score:100},{id:"low",score:0}];
    for(let i=0;i<1000;i++){const order=weightedShuffle(candidates,`run-${i}`,(item)=>item.score);high+=order.findIndex((item)=>item.id==="high");low+=order.findIndex((item)=>item.id==="low");}
    expect(high/1000).toBeLessThan(.35);expect(low/1000).toBeGreaterThan(.65);expect(high).toBeGreaterThan(100);
  });
  it("mixes one lower-third candidate per eight slots without duplicates across pages",()=>{
    const mixed=mixExploration(weightedShuffle([...items,items[0]],"seed",(item)=>item.score),"seed",(item)=>item.score);
    for(let position=7;position<mixed.length-4;position+=8)expect(mixed[position].score).toBeLessThan(34);
    const pages=Array.from({length:Math.ceil(mixed.length/13)},(_,page)=>mixed.slice(page*13,page*13+13));
    expect(pages.flat()).toEqual(mixed);expect(new Set(pages.flat().map((item)=>item.id)).size).toBe(100);
  });
  it("keeps all exclusions and mutual preferences; unmatched itself is not an exclusion",()=>{
    const me={...TUTORIAL_PROFILE,id:"me",gender:"Man" as const};
    const other={...TUTORIAL_PROFILE,id:"other"};
    const exclusions={liked:new Set<string>(),passed:new Set<string>(),matched:new Set<string>(),blocked:new Set<string>()};
    expect(eligibleCandidate(me,other,exclusions)).toBe(true);
    for(const flag of ["is_hidden","is_suspended","is_banned"])expect(eligibleCandidate(me,{...other,[flag]:true},exclusions)).toBe(false);
    for(const field of ["liked","passed","matched","blocked"] as const)expect(eligibleCandidate(me,other,{...exclusions,[field]:new Set([other.id])})).toBe(false);
    expect(eligibleCandidate(me,{...other,partner_preference:"Women"},exclusions)).toBe(false);
    expect(eligibleCandidate(me,{...other,id:me.id},exclusions)).toBe(false);
  });
});
