// Production-browser verification backed by a disposable local PostgreSQL DB.
// Supabase HTTP/Phoenix transport is emulated; SQL/RPC/RLS are actually executed.
const { chromium }=require('@playwright/test');
const { spawnSync }=require('child_process');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.GARBA_TEST_URL||'http://127.0.0.1:3100';
const artifacts=process.env.GARBA_ARTIFACTS||'/tmp/omnirush';
const database=process.env.GARBA_TEST_DATABASE||'garba_tests';
if(!database.endsWith('_tests'))throw new Error('Use a disposable _tests database');
const psql=process.env.GARBA_PSQL||'psql';
const args=['-h',process.env.GARBA_PGHOST||'/tmp/omnirush','-p',process.env.GARBA_PGPORT||'55432','-d',database,'-qAt','-v','ON_ERROR_STOP=1'];
const quote=value=>value===null||value===undefined?'null':typeof value==='number'?String(value):typeof value==='boolean'?String(value):`'${String(value).replaceAll("'","''")}'`;
const sql=(statement,actor)=>{const prefix=actor?`set role authenticated;set request.jwt.claim.sub=${quote(actor)};`:'';const r=spawnSync(psql,[...args,'-c',prefix+statement],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);const text=r.stdout.trim();return text?JSON.parse(text):null;};
const jsonRows=(query,actor)=>sql(/^(insert|update|delete) /i.test(query)?`with t as (${query}) select coalesce(json_agg(t),'[]') from t;`:`select coalesce(json_agg(t),'[]') from (${query}) t;`,actor);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sockets=new Set(),requests=[],results=[];
let failUnmatch=false,delayMessage=false,injectBadProfiles=false,missingFeed=false;
function emitRow(table,row,type='INSERT'){for(const socket of sockets)for(const subscription of socket.subscriptions){const bindings=subscription.bindings.filter(binding=>binding.table===table&&(!binding.filter||(()=>{const [field,value]=binding.filter.split('=eq.');return row[field]===value;})()));if(!bindings.length)continue;socket.ws.send(JSON.stringify([subscription.join,null,subscription.topic,'postgres_changes',{ids:bindings.map(binding=>binding.id),data:{schema:'public',table,type,commit_timestamp:new Date().toISOString(),columns:Object.keys(row).map(name=>({name,type:'text'})),record:row,old_record:{id:row.id},errors:null}}]));}}
function emitMatch(match){emitRow('matches',match,'UPDATE');}
function reset(){
   sql(`truncate auth.users cascade;insert into auth.users(id,email,email_confirmed_at) select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'test'||i||'.cs24@bmsce.ac.in',now() from generate_series(1,180)i;update profiles set first_name=case right(id::text,12)::integer when 1 then 'Partner A' when 2 then 'Partner B' else 'Dancer'||right(id::text,12)::integer end,onboarding_complete=true,has_seen_discover_tutorial=true,age=20,styles=array['Traditional Garba','Dandiya'],interests=array['dance'],available_nights=array[1,2,4,7,9]::smallint[],looking_for=array['Garba partner'];update profiles set styles=array['Fast Garba'],available_nights=array[3,5]::smallint[] where right(id::text,12)::integer%3=0;update profiles set onboarding_complete=false,has_seen_discover_tutorial=false where id=${quote(id(180))};`);
}
async function context(browser,actor,width=390){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:width<768?2:1,hasTouch:true,isMobile:width<768});
  const account={id:actor,email:'test.cs24@bmsce.ac.in',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()};
  const token=[{alg:'HS256',typ:'JWT'},{sub:actor,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map((part)=>typeof part==='string'?part:Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
  const session={access_token:token,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:account};
  await context.addCookies([{name:'sb-health-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base}]);
  await context.addInitScript(actor=>{sessionStorage.setItem('garbamate_cleaned_demo_v1','true');localStorage.setItem('garbamate_auth_session',JSON.stringify({id:actor,email:'test.cs24@bmsce.ac.in'}));window.__swipeRenders=0;const seen=new Map();window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(r){this.renderers.set(1,r);return 1;},onCommitFiberRoot(_,root){const walk=f=>{if(!f)return;if(f.tag===11&&f.memoizedProps?.onDecide&&typeof f.memoizedProps?.depth==='number'){const key=f.memoizedProps.person.id;if(seen.get(key)!==f&&(f.flags&1))window.__swipeRenders++;seen.set(key,f);}walk(f.child);walk(f.sibling);};walk(root.current);},onCommitFiberUnmount(){}};},actor);
  await context.routeWebSocket('**/*.supabase.co/**',ws=>{
    const socket={ws,actor,subscriptions:[]};sockets.add(socket);
    ws.onClose(()=>sockets.delete(socket));
    ws.onMessage(raw=>{const [join,ref,topic,event,payload]=JSON.parse(String(raw));if(event==='phx_join'){
      const bindings=(payload.config?.postgres_changes||[]).map((binding,i)=>({...binding,id:i+1}));
      if(bindings.length)socket.subscriptions.push({join,topic,bindings});
      ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:bindings}}]));
    }else if(event==='heartbeat'||event==='phx_leave')ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{}}]));else if(event==='broadcast')ws.send(JSON.stringify([join,ref,topic,'phx_reply',{status:'ok',response:{}}]));});
  });
  await context.route('**/*.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method(),name=url.pathname.split('/').pop();
    const body=method==='POST'||method==='PATCH'?request.postDataJSON():null;
    requests.push({actor,name,method,body});
    try{
      let data=null;
      if(url.pathname.includes('/auth/v1/')){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(name==='user'?account:session)});return;}
      if(url.pathname.includes('/rpc/')){
         if(name==='set_decision') {data=sql(`select public.set_decision(${quote(body.p_target)},${quote(body.p_decision)});`,actor);if(data.status==='matched'&&data.match_id)emitMatch(jsonRows(`select * from matches where id=${quote(data.match_id)}`)[0]);}
         else if(name==='like_user') {data=sql(`select public.like_user(${quote(body.target)},${quote(body.kind||'interested')}::like_kind);`,actor);if(data.matched)emitMatch(jsonRows(`select * from matches where id=${quote(data.match_id)}`)[0]);}
        else if(name==='unmatch_user'){if(failUnmatch){failUnmatch=false;throw new Error('Injected unmatch failure');}data=sql(`select to_json(public.unmatch_user(${quote(body.p_match_id)}));`,actor);emitMatch(jsonRows(`select * from matches where id=${quote(data)}`)[0]);}
         else if(name==='discover_feed'){if(missingFeed)throw new Error('PGRST202: discover_feed function unavailable');data=jsonRows(`select * from public.discover_feed(${quote(body.p_seed)},${quote(body.p_after_key)},${quote(body.p_after_id)}::uuid,${quote(body.p_limit)})`,actor);if(injectBadProfiles){data=data.map((row,i)=>i===0?{...row,profile:{...row.profile,first_name:null}}:i===1?{...row,profile:{...row.profile,styles:null,interests:null,available_nights:null,photo_path:null}}:row);}}
          else if(['get_incoming_interests','get_public_profile_names','get_user_notifications','get_relationship_notifications','discover_relationships','get_admin_profiles'].includes(name)){data=jsonRows(`select * from public.${name}()`,actor);if(name==='get_admin_profiles')data=data.map(row=>row.get_admin_profiles);}
         else if(name==='mark_chat_read'){sql(`select public.mark_chat_read(${quote(body.p_match_id)});`,actor);data=null;}
         else if(name==='mark_relationship_notification'){sql(`select public.mark_relationship_notification(${body.p_id?quote(body.p_id):'null'}::uuid);`,actor);data=null;}
         else if(name==='mark_all_relationship_notifications'){sql('select public.mark_all_relationship_notifications();',actor);data=null;}
        else if(name==='discovery_blocked_ids')data=sql(`select coalesce(json_agg(i),'[]') from public.discovery_blocked_ids() i;`,actor);
        else if(name==='mark_discover_tutorial_seen'){sql('select public.mark_discover_tutorial_seen();',actor);data=null;}
      }else if(['profiles','matches','messages','likes','passes','blocks','reports','admin_users'].includes(name)){
        const clauses=[];
        for(const [key,value]of url.searchParams){if(!/^[a-z_]+$/.test(key))continue;if(value.startsWith('eq.'))clauses.push(`${key}=${quote(value.slice(3))}`);if(value.startsWith('gte.'))clauses.push(`${key}>=${quote(value.slice(4))}`);if(value.startsWith('in.('))clauses.push(`${key} in (${value.slice(4,-1).split(',').map(quote).join(',')})`);}
        const where=clauses.length?'where '+clauses.join(' and '):'';
         const fields=url.searchParams.get('select')||'*';if(!/^[a-z_*,]+$/.test(fields))throw new Error('Invalid selected columns');
         if(method==='GET')data=jsonRows(`select ${fields} from ${name} ${where} ${name==='messages'?'order by created_at':''}`,actor);
        else if(method==='DELETE'){sql(`delete from ${name} ${where};`,actor);data=[];}
        else if(name==='profiles'){
          const assignments=Object.entries(body).filter(([key])=>key!=='id').map(([key,value])=>`${key}=${Array.isArray(value)?`array[${value.map(quote).join(',')}]${key==='available_nights'?'::smallint[]':'::text[]'}`:quote(value)}`).join(',');
           data=jsonRows(`update profiles set ${assignments} where id=${quote(body.id)} returning ${fields}`,actor);
        }else{
          if(name==='messages'&&delayMessage){delayMessage=false;await new Promise(resolve=>setTimeout(resolve,600));}
          const columns=Object.keys(body).filter(key=>/^[a-z_]+$/.test(key));
          const conflict=name==='passes'||name==='likes'?'on conflict(from_user,to_user) do update set created_at=excluded.created_at':'';
           data=jsonRows(`insert into ${name}(${columns.join(',')}) values(${columns.map(key=>quote(body[key])).join(',')}) ${conflict} returning *`,actor);
           if(name==='messages'&&data[0])emitRow('messages',data[0]);
        }
        if(request.headers().accept?.includes('vnd.pgrst.object'))data=data[0]||null;
      }else data=[];
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    }catch(error){console.error('Fixture SQL error',name,error.message);await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:error.message})});}
  });
  return context;
}
async function top(page){return page.locator('[data-top-card="true"]').getAttribute('data-swipe-card');}
async function drag(page,session,direction){
  const card=page.locator('[data-top-card="true"]');await card.scrollIntoViewIfNeeded();const r=await card.boundingBox(),old=await top(page),renders=await page.evaluate(()=>window.__swipeRenders);
  const queued=await page.locator('[data-swipe-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.swipeCard));
  const start={x:r.x+r.width/2,y:Math.max(130,Math.min(440,r.y+r.height*.4))};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  for(let step=1;step<=12;step++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(direction==='pass'?-1:1)*160*step/12,y:start.y}]});await page.waitForTimeout(18);}
  assert.equal(await page.evaluate(()=>window.__swipeRenders),renders,'Card re-rendered during drag');
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(old=>document.querySelector('[data-top-card="true"]')?.dataset.swipeCard!==old,old);
  assert.deepEqual(await page.locator('[data-swipe-card]').evaluateAll(nodes=>nodes.slice(0,2).map(node=>node.dataset.swipeCard)),queued.slice(1),'Surviving feed order changed after a decision');
  return old;
}
async function confirmUnmatch(page){await page.getByRole('button',{name:'Unmatch',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:/^Unmatch /});await dialog.getByRole('button',{name:'Unmatch',exact:true}).evaluate(button=>{button.click();button.click();});await dialog.waitFor({state:'hidden'});}
async function freshMatch(a,b){
  await a.goto(`${base}/discover`);await a.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Partner B');await a.getByRole('button',{name:'Show interest in Partner B'}).waitFor();await a.getByRole('button',{name:'Show interest in Partner B'}).click();
  await b.goto(`${base}/discover`);await b.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Partner A');await b.getByRole('button',{name:'Show interest in Partner A'}).waitFor();await b.getByRole('button',{name:'Show interest in Partner A'}).click();await b.getByRole('dialog',{name:"It's a Garba Match!"}).waitFor();
  const match=jsonRows(`select * from matches where user_a=${quote(id(1))} and user_b=${quote(id(2))}`)[0];assert.equal(match.status,'active');return match;
}
(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});reset();
  const browser=await chromium.launch({headless:true,executablePath:process.env.GARBA_CHROME_PATH,args:['--no-sandbox']});
  const contexts=[];
  try{
    const ca=await context(browser,id(1)),cb=await context(browser,id(2));contexts.push(ca,cb);const a=await ca.newPage(),b=await cb.newPage();
    const pageErrors=[];a.on('pageerror',error=>pageErrors.push(error.message));b.on('pageerror',error=>pageErrors.push(error.message));
    const orders=[];
    for(let i=0;i<10;i++){const start=requests.length;await a.goto(`${base}/discover`);await a.locator('[data-top-card="true"]').waitFor();await a.waitForTimeout(100);const seeds=requests.slice(start).filter(r=>r.name==='discover_feed'&&!r.body.p_after_key).map(r=>r.body.p_seed);const seed=seeds[0];assert(seed);const rows=jsonRows(`select profile->>'id' id,rank_key from discover_feed(${quote(seed)})`,id(1));orders.push(rows.map(r=>r.id).join(','));const pages=requests.slice(start).filter(r=>r.name==='discover_feed');assert(pages.some(r=>r.body.p_after_key!==null),'No paginated request');for(const r of pages)assert.equal(r.body.p_seed,seed);}
    assert.equal(new Set(orders).size,10);
    await b.goto(`${base}/discover`);await b.locator('[data-top-card="true"]').waitFor();assert.notDeepEqual(await a.locator('[data-swipe-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.swipeCard)),await b.locator('[data-swipe-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.swipeCard)));
     const shuffleRequests=requests.length;const old=await top(a);await a.getByRole('button',{name:'Shuffle feed'}).click();for(let wait=0;wait<100&&!requests.slice(shuffleRequests).some(r=>r.name==='discover_feed');wait++)await new Promise(resolve=>setTimeout(resolve,30));assert(requests.slice(shuffleRequests).some(r=>r.name==='discover_feed'),'Shuffle did not request a new feed');await a.waitForTimeout(300);
    results.push({check:'10 refresh seeds/orders, paginated seed continuity, two accounts, Shuffle',pass:true});
    const match=await freshMatch(a,b);await a.goto(`${base}/chat/${match.id}`);await a.getByRole('textbox',{name:'Message',exact:true}).waitFor();await b.goto(`${base}/chat/${match.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).fill('OLD UI CHAT');await b.getByRole('button',{name:'Send message'}).click();await b.getByText('OLD UI CHAT',{exact:true}).waitFor();await a.getByText('OLD UI CHAT',{exact:true}).waitFor();
    await a.goto(`${base}/matches`);await a.getByRole('button',{name:'Unmatch',exact:true}).first().waitFor();
     await b.getByRole('textbox',{name:'Message',exact:true}).fill('UNREAD COUNT CHECK');await b.getByRole('button',{name:'Send message'}).click();await a.getByRole('button',{name:/Notifications, \d+ unread/}).waitFor();await a.goto(`${base}/chat/${match.id}`);await a.getByText('UNREAD COUNT CHECK',{exact:true}).waitFor();await a.waitForTimeout(300);assert.equal(jsonRows(`select * from get_user_notifications()`,id(1)).length,0);await a.goto(`${base}/matches`);await a.getByRole('button',{name:'Unmatch',exact:true}).first().waitFor();
    failUnmatch=true;await a.getByRole('button',{name:'Unmatch',exact:true}).first().click();await a.getByRole('dialog').getByRole('button',{name:'Unmatch',exact:true}).click();await a.getByText('Couldn’t unmatch. Please try again.').waitFor();assert.equal(jsonRows(`select status from matches where id=${quote(match.id)}`)[0].status,'active');await a.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    delayMessage=true;await b.getByRole('textbox',{name:'Message',exact:true}).fill('LATE IN-FLIGHT SEND');await b.getByRole('button',{name:'Send message'}).click();await confirmUnmatch(a);await b.getByText('This chat is no longer available',{exact:true}).waitFor();assert.equal(await b.getByText('OLD UI CHAT',{exact:true}).count(),0);
    await a.goto(`${base}/discover`);await a.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Partner B');await a.getByRole('button',{name:'Show interest in Partner B'}).waitFor();assert.equal(await a.getByText('Matched',{exact:true}).count(),0);
    await b.goto(`${base}/discover`);await b.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Partner A');await b.getByRole('button',{name:'Show interest in Partner A'}).waitFor();assert.equal(await b.getByText('Matched',{exact:true}).count(),0);
    const again=await freshMatch(a,b);assert.equal(again.id,match.id);assert(again.chat_started_at>match.chat_started_at);
    await b.goto(`${base}/chat/${again.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();assert.equal(await b.getByText('OLD UI CHAT',{exact:true}).count(),0);
    await a.goto(`${base}/chat/${again.id}`);await a.getByRole('button',{name:'Actions for Partner B'}).click();await confirmUnmatch(a);await b.getByText('This chat is no longer available',{exact:true}).waitFor();
    await freshMatch(a,b);await b.goto(`${base}/chat/${again.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();await a.goto(`${base}/profile/${id(2)}`);await a.getByRole('button',{name:'Unmatch',exact:true}).waitFor();await confirmUnmatch(a);await b.getByText('This chat is no longer available',{exact:true}).waitFor();
     await freshMatch(a,b);await b.goto(`${base}/chat/${again.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();await a.goto(`${base}/discover`);await a.getByRole('button',{name:/^Matches/}).click();await a.getByText('Matched',{exact:true}).first().waitFor();await confirmUnmatch(a);await b.getByText('This chat is no longer available',{exact:true}).waitFor();assert.equal(await a.getByText('Matched',{exact:true}).count(),0);
    results.push({check:'Real SQL A/B chat → Unmatch from Matches, chat header, profile, Discover → live B closes → rediscovery → fresh same-row rematch',pass:true});
    const cc=await context(browser,id(180),360);contexts.push(cc);const c=await cc.newPage();await c.goto(`${base}/onboarding`);await c.getByRole('button',{name:/^Continue/}).waitFor();for(let i=0;i<9;i++)await c.getByRole('button',{name:/^Continue/}).click();await c.getByRole('button',{name:/^Start discovering/}).click();await c.locator('[data-tutorial-step="1"]').waitFor();
    const before=sql(`select json_build_object('likes',(select count(*) from likes),'passes',(select count(*) from passes),'matches',(select count(*) from matches));`);const writesStart=requests.length;
    await c.keyboard.press('ArrowRight');await c.locator('[data-tutorial-step="2"]').waitFor();await c.getByRole('button',{name:'Try it',exact:true}).click();const demoBefore=await c.locator('[data-tutorial-step] [data-top-card="true"]').getAttribute('data-swipe-card');await c.getByRole('dialog').getByRole('button',{name:'Interested',exact:true}).click();await c.waitForFunction(old=>document.querySelector('[data-tutorial-step] [data-top-card="true"]')?.dataset.swipeCard!==old,demoBefore);
    for(const width of [360,390,768,1280]){await c.setViewportSize({width,height:844});assert(await c.getByRole('dialog').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));for(let i=0;i<30;i++){await c.keyboard.press('Tab');assert(await c.getByRole('dialog').evaluate(e=>e.contains(document.activeElement)),'Tutorial focus escaped');}await c.screenshot({path:path.join(artifacts,`tutorial-${width}.png`)});}
    await c.keyboard.press('Escape');await c.getByRole('dialog').waitFor({state:'hidden'});await c.waitForTimeout(200);assert(sql(`select to_json(has_seen_discover_tutorial) from profiles where id=${quote(id(180))}`));assert.deepEqual(sql(`select json_build_object('likes',(select count(*) from likes),'passes',(select count(*) from passes),'matches',(select count(*) from matches));`),before);assert(!requests.slice(writesStart).some(r=>r.method==='POST'&&['like_user','likes','passes','matches'].includes(r.name)));
    await c.reload();await c.locator('.discover-floor').waitFor();await c.waitForTimeout(300);assert.equal(await c.getByRole('dialog').count(),0);await c.getByRole('button',{name:'How it works'}).click();await c.locator('[data-tutorial-step="1"]').waitFor();await c.emulateMedia({reducedMotion:'reduce'});for(let i=0;i<8;i++)await c.getByRole('dialog').getByRole('button',{name:'Next',exact:true}).click();await c.getByRole('dialog').getByRole('button',{name:'Start discovering',exact:true}).click();await c.getByRole('dialog').waitFor({state:'hidden'});
    const newDevice=await context(browser,id(180));contexts.push(newDevice);const nd=await newDevice.newPage();await nd.goto(`${base}/discover`);await nd.locator('[data-top-card="true"]').waitFor();assert.equal(await nd.getByRole('dialog').count(),0);
    results.push({check:'Onboarding tutorial, practice isolation, four widths, focus trap, Esc, finish, DB persistence across contexts, replay/reduced motion',pass:true});
    sql(`update profiles set photo_path='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&q=80&fixture='||(right(id::text,12)::integer%4) where right(id::text,12)::integer between 2 and 179;`);
    await a.goto(`${base}/discover?debug=fps`);await a.locator('[data-top-card="true"]').waitFor();await a.locator('[data-top-card="true"] img').evaluate(image=>image.decode());const optimized=await a.locator('[data-top-card="true"] img').evaluate(image=>({src:image.currentSrc,width:image.naturalWidth}));assert(optimized.src.includes('/_next/image?'));assert(optimized.width<=800);
    const session=await ca.newCDPSession(a);await session.send('Emulation.setCPUThrottlingRate',{rate:4});await session.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing',transferMode:'ReturnAsStream'});
    const swiped=[];for(let i=0;i<32;i++)swiped.push(await drag(a,session,i%2?'like':'pass'));assert.equal(new Set(swiped).size,32,'Repeated profile across feed pages');await a.waitForTimeout(550);const meter=await a.locator('[data-fps-meter]').evaluate(e=>({fps:e.dataset.fps,dragFps:e.dataset.dragFps,dropped:e.dataset.dropped}));
    const done=new Promise(resolve=>session.once('Tracing.tracingComplete',resolve));await session.send('Tracing.end');const {stream}=await done;let trace='';for(;;){const chunk=await session.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}fs.writeFileSync(path.join(artifacts,'followup-swipe-4x-trace.json'),trace);
    results.push({check:'Production 32 touch swipes at 4× CPU, stable surviving order, no card re-renders, debug meter',...meter,pass:true});
    await session.send('Emulation.setCPUThrottlingRate',{rate:1});
    injectBadProfiles=true;await a.goto(`${base}/discover`);await a.locator('[data-top-card="true"]').waitFor();assert.equal(await a.getByText('Something went wrong',{exact:true}).count(),0);injectBadProfiles=false;
    missingFeed=true;await a.goto(`${base}/discover`);await a.getByText('Couldn’t load your floor. Please retry.').waitFor();missingFeed=false;await a.getByRole('button',{name:'Retry',exact:true}).click();await a.locator('[data-top-card="true"]').waitFor();
    results.push({check:'Malformed/null profile response cannot crash Discover; independent realtime subscribers stay healthy',pass:true});
    sql(`insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values(${quote(id(181))},'floor-01@samples.garbamate.invalid',now(),'{"is_sample":true}');update profiles set first_name='Ananya',age=20,onboarding_complete=true,photo_path='🌸',available_nights=array[1,2,4]::smallint[],styles=array['Dandiya'] where id=${quote(id(181))};update app_settings set value=true where key='SHOW_SAMPLE_PROFILES';`);
     await a.goto(`${base}/discover`);await a.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Ananya');await a.locator('[data-profile-tile]').first().waitFor();assert.equal(await a.locator('[data-profile-tile] img').count(),0);assert.equal(await a.locator('[data-profile-tile]').getByText('BMSCE verified').count(),0);
    const snapshot=sql(`select json_build_object('matches',(select count(*) from matches),'messages',(select count(*) from messages),'notifications',(select count(*) from get_user_notifications()));`,id(1));
    await a.getByRole('button',{name:'Show interest in Ananya'}).click();await a.waitForFunction(()=>!document.querySelector('[data-top-card="true"]'));await a.waitForTimeout(300);assert.equal(await a.getByRole('dialog').count(),0);assert.deepEqual(sql(`select json_build_object('matches',(select count(*) from matches),'messages',(select count(*) from messages),'notifications',(select count(*) from get_user_notifications()));`,id(1)),snapshot);
    results.push({check:'Sample emoji avatar/no badge; like creates no match, chat or notification',pass:true});
    for(const width of [360,390,768,1280]){await a.setViewportSize({width,height:844});await a.goto(`${base}/discover`);await a.locator('[data-top-card="true"]').waitFor();assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth),width);const text=await a.locator('body').innerText();assert(!/demo-|bms-|\bID:|floor opens soon|\d+d \d+h|countdown/i.test(text));await a.screenshot({path:path.join(artifacts,`health-discover-${width}.png`)});}
    const realAgain=await freshMatch(a,b);await b.goto(`${base}/chat/${realAgain.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();await a.goto(`${base}/profile/${id(2)}`);await a.getByRole('button',{name:'Actions for Partner B'}).click();await a.getByRole('button',{name:'Block',exact:true}).click();await b.getByText('This chat is no longer available',{exact:true}).waitFor();await a.goto(`${base}/discover`);await a.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Partner B');assert.equal(await a.locator('[data-top-card="true"]').count(),0);
    await b.goto(`${base}/profile/${id(1)}`);await b.getByRole('button',{name:'Actions for Partner A'}).click();await b.getByRole('button',{name:'Report',exact:true}).click();await b.getByRole('dialog').locator('textarea').fill('Browser health report');await b.getByRole('button',{name:'Submit report',exact:true}).click();await b.getByRole('dialog').waitFor({state:'hidden'});
    sql(`insert into admin_users(user_id) values(${quote(id(1))}) on conflict do nothing;`);await a.goto(`${base}/admin`);await a.getByText('Browser health report',{exact:true}).waitFor();assert.equal(await a.getByText('Ananya',{exact:true}).count(),0);
    assert.deepEqual(pageErrors,[]);results.push({check:'Four Discover layouts, no IDs/demo markers/countdown; block removes chat/feed; report in admin; no samples in admin',pass:true});
  }catch(error){for(const context of contexts)for(const page of context.pages()){console.log('Failure page:',page.url(),await page.locator('body').innerText());await page.screenshot({path:path.join(artifacts,'followup-failure.png')});}console.log('Recent requests:',requests.slice(-12));throw error;}
  finally{for(const context of contexts)await context.close();await browser.close();fs.writeFileSync(path.join(artifacts,'followup-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
