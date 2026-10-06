import { it,expect,vi } from "vitest";
import { normalizeProfile } from "../lib/profiles";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("../lib/supabase/client",()=>({getSupabaseClient:()=>({rpc})}));
import { discoverySnapshot } from "../lib/discovery-api";
it("a corrupt final profile cannot discard the rest of a paginated feed",async()=>{
  const row={id:"00000000-0000-4000-8000-000000000001",first_name:"Ananya",age:20,year:2,gender:"Woman",styles:[],available_nights:[],interests:[],looking_for:[]};
  const rows=Array.from({length:64},(_,index)=>({profile:{...row,id:`00000000-0000-4000-8000-${String(index+2).padStart(12,"0")}`},rank_key:index+1,score:50}));
  rows[63].profile=null as unknown as typeof row;
  rpc.mockResolvedValueOnce({data:rows,error:null}).mockResolvedValueOnce({data:[],error:null});
  const result=await discoverySnapshot(normalizeProfile({...row,branch:"CSE",partner_preference:"Everyone"})!,"regression-seed");
  expect(result).toHaveLength(63);expect(rpc.mock.calls[1][1]).toMatchObject({p_after_key:63,p_after_id:rows[62].profile.id,p_seed:"regression-seed"});
});
