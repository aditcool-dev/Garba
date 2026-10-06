// Local Node process only. No app module imports this file or the service key.
import { createClient, type User } from "@supabase/supabase-js";
import { SAMPLE_DATA } from "./sample-data";
const url=process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ignored .env.samples");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
function check<T>(result:{data:T;error:unknown}):T {if(result.error)throw result.error;return result.data;}
function errorDetails(error:unknown):string {
  if(error instanceof Error){
    const fields:Record<string,unknown>={};
    for(const name of Object.getOwnPropertyNames(error)) fields[name]=(error as unknown as Record<string,unknown>)[name];
    if(!fields.message) fields.message=error.message;
    return JSON.stringify(fields);
  }
  try{return JSON.stringify(error,Object.getOwnPropertyNames(Object(error)));}catch{return String(error);}
}
async function users() {
  const result:User[]=[];
  for(let page=1;;page++){const response=await client.auth.admin.listUsers({page,perPage:100});if(response.error)throw response.error;const data=response.data;result.push(...data.users);if(data.users.length<100)return result;}
}
async function removeOwnedFiles(id:string){
  const buckets=check(await client.storage.listBuckets()) || [];
  for(const bucket of buckets){
    const walk = async (prefix:string):Promise<void> => {
      for(;;){const rows=check(await client.storage.from(bucket.id).list(prefix,{limit:100,offset:0})) || [];
        for(const row of rows){const name=`${prefix}/${row.name}`;if(row.id)check(await client.storage.from(bucket.id).remove([name]));else await walk(name);}
        if(rows.length<100)break;
      }
    };
    await walk(id);
  }
}
async function main(){
  if(process.argv.includes("--remove-legacy-storage")){
    const rows=check(await client.from("legacy_demo_storage_cleanup").select("bucket_id,object_name"))||[];
    for(const row of rows){check(await client.storage.from(row.bucket_id).remove([row.object_name]));check(await client.from("legacy_demo_storage_cleanup").delete().eq("bucket_id",row.bucket_id).eq("object_name",row.object_name));}
    console.log(`Removed ${rows.length} queued legacy Storage objects via Storage API.`);return;
  }
  const all=await users();
  if(process.argv.includes("--audit")){
    const profiles=check(await client.from("profiles").select("*"))||[];
    console.log(JSON.stringify({profiles:profiles.length,is_demo:profiles.filter(p=>p.is_demo).length,prefixed:profiles.filter(p=>/^(demo-|bms-)/.test(p.id)).length,is_sample:profiles.filter(p=>p.is_sample).length,auth_demo:all.filter(u=>u.app_metadata?.is_demo||u.user_metadata?.is_demo||/^(demo-|bms-)/.test(u.user_metadata?.legacy_id||"")).length,usn_fields_present:profiles.some(p=>Object.keys(p).some(k=>/usn/i.test(k)))},null,2));return;
  }
  const owned=all.filter(u=>u.app_metadata?.is_sample===true && /^floor-\d{2}@samples\.garbamate\.invalid$/.test(u.email||""));
  if(process.argv.includes("--remove")){
    check(await client.from("app_settings").upsert({key:"SHOW_SAMPLE_PROFILES",value:false}));
    for(const user of owned){await removeOwnedFiles(user.id);const response=await client.auth.admin.deleteUser(user.id);if(response.error)throw response.error;}
    console.log(`Removed ${owned.length} sample Auth users and their cascading profiles/decisions.`);return;
  }
  for(const item of SAMPLE_DATA){
    const slot=String(item.slot).padStart(2,"0");
    if(!/^(0[1-9]|[12][0-9]|30)$/.test(slot)) throw new Error(`Invalid sample slot ${item.slot}; expected 01 through 30`);
    const email=`floor-${slot}@samples.garbamate.invalid`;
    let account=all.find(u=>u.email===email);
    if(account && account.app_metadata?.is_sample!==true)throw new Error(`Reserved address collision at slot ${slot}; refusing to modify account`);
    if(!account){
      const response=await client.auth.admin.createUser({email,email_confirm:true,ban_duration:"876000h",app_metadata:{is_sample:true},user_metadata:{first_name:item.first_name}});
      if(response.error)throw new Error(`Auth Admin createUser failed for ${email}: ${errorDetails(response.error)}`);
      account=response.data.user||undefined;
    }
    if(!account)throw new Error("Auth Admin API returned no user");
    const update=await client.auth.admin.updateUserById(account.id,{ban_duration:"876000h",app_metadata:{is_sample:true}});if(update.error)throw new Error(`Auth Admin updateUserById failed for ${email}: ${errorDetails(update.error)}`);
    const {slot:_slot,...profile}=item;
    check(await client.from("profiles").upsert({...profile,id:account.id,is_sample:true,is_verified:false,is_demo:false,onboarding_complete:true,is_hidden:false,is_suspended:false,is_banned:false,has_seen_discover_tutorial:true}));
  }
  check(await client.from("app_settings").upsert({key:"SHOW_SAMPLE_PROFILES",value:process.env.SHOW_SAMPLE_PROFILES!=="false"}));
  console.log("30 sample profiles ready (20 women, 10 men). No duplicates, photos or public credentials.");
}
main().catch(error=>{console.error("Sample operation failed:",errorDetails(error));process.exitCode=1;});
