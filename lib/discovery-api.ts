import { db, getSupabaseClient } from "./supabase/client";
import { databaseId } from "./relationship-events";
import { eligibleCandidate, mixExploration, profileScore, weightedShuffle } from "./feed";
import type { Profile } from "./supabase/types";

export async function discoverySnapshot(me: Profile, seed: string): Promise<Profile[]> {
  if (!databaseId(me.id)) {
    const [profiles,liked,passed,matches,blocked] = await Promise.all([db.getProfiles(),db.getOutgoingLikedUserIds(me.id),db.getOutgoingPassedUserIds(me.id),db.getMatches(me.id),db.getBlockedUserIds(me.id)]);
    const matched=new Set(matches.map((match)=>match.user_a===me.id?match.user_b:match.user_a));
    const eligible=profiles.filter((profile)=>eligibleCandidate(me,profile,{liked,passed,matched,blocked}));
    return mixExploration(weightedShuffle(eligible,`${seed}:${me.id}`,(profile)=>profileScore(me,profile)),seed,(profile)=>profileScore(me,profile));
  }
  const client=getSupabaseClient();
  if(!client) throw new Error("Connection unavailable");
  const result: Profile[]=[];
  const seen=new Set<string>();
  let afterKey:number|null=null,afterId:string|null=null;
  // Freeze the candidate ordering in memory. Page requests use a seed + keyset
  // cursor, so a concurrent pass/unmatch never shifts later pages' positions.
  for(;;) {
    const {data,error}=await client.rpc("discover_feed",{p_seed:seed,p_after_key:afterKey,p_after_id:afterId,p_limit:64});
    if(error)throw error;
    const rows=(data||[]) as Array<{profile:Profile;rank_key:number;score:number}>;
    for(const row of rows)if(!seen.has(row.profile.id)){seen.add(row.profile.id);result.push(row.profile);}
    if(rows.length<64)break;
    const last=rows[rows.length-1];
    if(last.rank_key===afterKey&&last.profile.id===afterId)throw new Error("Invalid discovery cursor");
    afterKey=last.rank_key;afterId=last.profile.id;
  }
  return mixExploration(result,seed,(profile)=>profileScore(me,profile));
}
