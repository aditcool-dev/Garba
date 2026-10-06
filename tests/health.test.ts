import { describe,it,expect,vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownedChannel } from "../lib/realtime";
import { normalizeProfile,normalizeProfiles } from "../lib/profiles";
import { SAMPLE_DATA } from "../scripts/sample-data";
import { isAllowedEmail } from "../lib/domain";
import { errorReference } from "../lib/error-reference";

const profile={id:"00000000-0000-4000-8000-000000000001",first_name:"Ananya",age:20,year:2,gender:"Woman",styles:null,available_nights:null,photo_path:null};
describe("Discover production regressions",()=>{
  it("gives independent subscribers distinct topics before registering callbacks",()=>{
    const subscribed=new Set<string>();
    const client={channel:vi.fn((topic:string)=>({on(){if(subscribed.has(topic))throw new Error("callbacks after subscribe");return this;},subscribe(){subscribed.add(topic);}}))};
    const first=ownedChannel(client as unknown as SupabaseClient,"active-matches:user");first.on("postgres_changes",{event:"*",schema:"public",table:"matches"},()=>{}).subscribe();
    const second=ownedChannel(client as unknown as SupabaseClient,"active-matches:user");expect(()=>second.on("postgres_changes",{event:"*",schema:"public",table:"matches"},()=>{}).subscribe()).not.toThrow();
    expect(client.channel.mock.calls[0][0]).not.toBe(client.channel.mock.calls[1][0]);
  });
  it("normalizes null optional collections and drops invalid rows independently",()=>{
    expect(normalizeProfiles([null,profile,{...profile,age:17},{...profile,first_name:"Demo User"}])).toHaveLength(1);
    const normalized=normalizeProfile({...profile,usn:"1BM23CS001",is_sample:true,is_verified:true});
    expect(normalized).toMatchObject({styles:[],available_nights:[],photo_path:null,is_verified:false});
    expect(normalized).not.toHaveProperty("usn");expect(normalized).not.toHaveProperty("is_sample");
  });
  it("makes deterministic user-facing references without stacks",()=>{expect(errorReference({message:"broken"})).toMatch(/^GM-[0-9a-f]{8}$/);});
});
it("allows only the exact college domain including former exceptions",()=>{expect(isAllowedEmail("student@bmsce.ac.in")).toBe(true);for(const email of ["x@gmail.com","aditrastogi12@gmail.com","x@evilbmsce.ac.in","x@bmsce.ac.in.evil.com"])expect(isAllowedEmail(email)).toBe(false);});
it("defines exactly 30 diverse photo-free samples without identifiers",()=>{
  expect(SAMPLE_DATA.filter(p=>p.gender==="Woman")).toHaveLength(20);expect(SAMPLE_DATA.filter(p=>p.gender==="Man")).toHaveLength(10);
  expect(new Set(SAMPLE_DATA.map(p=>p.photo_path)).size).toBe(30);
  for(const row of SAMPLE_DATA){expect(row.age).toBeGreaterThanOrEqual(18);expect(row.age).toBeLessThanOrEqual(22);expect(JSON.stringify(row)).not.toMatch(/https?:|demo-|bms-|usn|@/i);}
});
