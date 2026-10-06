// Runs the real seeding/removal program against emulated Auth Admin/Storage HTTP
// backed by real PostgreSQL. Never connect this driver to a production database.
const http=require('http'),{spawn,spawnSync}=require('child_process'),assert=require('assert/strict'),fs=require('fs');
const database=process.env.GARBA_TEST_DATABASE||'garba_validation_tests';if(!database.endsWith('_tests'))throw new Error('Disposable database required');
const args=['-h','/tmp/omnirush','-p','55432','-d',database,'-qAt','-v','ON_ERROR_STOP=1'];
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
function sql(statement){const result=spawnSync(process.env.GARBA_PSQL||'psql',[...args,'-c',statement],{encoding:'utf8'});if(result.status)throw new Error(result.stderr);return result.stdout.trim()?JSON.parse(result.stdout):null;}
const user=row=>({id:row.id,email:row.email,email_confirmed_at:row.email_confirmed_at,app_metadata:row.raw_app_meta_data,user_metadata:row.raw_user_meta_data,aud:'authenticated',created_at:new Date().toISOString()});
const results=[],removedFiles=[];
const server=http.createServer(async(req,res)=>{try{
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):null,url=new URL(req.url,'http://localhost');let data=[];
  if(url.pathname==='/auth/v1/admin/users'&&req.method==='GET')data={users:(sql('select json_agg(u) from auth.users u;')||[]).map(user)};
  else if(url.pathname==='/auth/v1/admin/users'&&req.method==='POST'){
    assert.equal(body.ban_duration,'876000h');assert(body.app_metadata.is_sample);
     // Model current GoTrue: INSERT first with provider metadata, then apply
     // the Admin app_metadata in the same transaction. Migration 011 must ban
     // the temporary unmarked reserved row and keep it banned after the mark.
     const inserted=sql(`with u as(insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at) values(gen_random_uuid(),${quote(body.email)},'{"provider":"email"}'::jsonb,${quote(JSON.stringify(body.user_metadata))}::jsonb,now()) returning *) select row_to_json(u) from u;`);
     const row=sql(`with u as(update auth.users set raw_app_meta_data=${quote(JSON.stringify(body.app_metadata))}::jsonb where id=${quote(inserted.id)} returning *) select row_to_json(u) from u;`);data=user(row);
  }else if(url.pathname.startsWith('/auth/v1/admin/users/')&&req.method==='DELETE'){sql(`delete from auth.users where id=${quote(url.pathname.split('/').pop())};`);data={};}
  else if(url.pathname.startsWith('/auth/v1/admin/users/')&&req.method==='PUT'){assert.equal(body.ban_duration,'876000h');assert.equal(body.app_metadata.is_sample,true);const row=sql(`with u as(update auth.users set raw_app_meta_data=${quote(JSON.stringify(body.app_metadata))}::jsonb where id=${quote(url.pathname.split('/').pop())} returning *) select row_to_json(u) from u;`);data=user(row);}
  else if(url.pathname==='/storage/v1/bucket')data=[];
  else if(url.pathname.startsWith('/storage/v1/object/')&&req.method==='DELETE'){removedFiles.push(...body.prefixes);for(const name of body.prefixes)sql(`delete from storage.objects where bucket_id=${quote(url.pathname.split('/').pop())} and name=${quote(name)};`);data=body.prefixes.map(name=>({name}));}
  else if(url.pathname==='/rest/v1/legacy_demo_storage_cleanup'){
    if(req.method==='GET')data=sql("select coalesce(json_agg(q),'[]') from legacy_demo_storage_cleanup q;");
    else{sql(`delete from legacy_demo_storage_cleanup where bucket_id=${quote(url.searchParams.get('bucket_id').slice(3))} and object_name=${quote(url.searchParams.get('object_name').slice(3))};`);data=null;}
  }
  else if(url.pathname==='/rest/v1/profiles'){
    if(req.method==='GET')data=sql('select coalesce(json_agg(p),\'[]\') from profiles p;');
    else{const fields=Object.keys(body);assert(fields.every(f=>/^[a-z_]+$/.test(f)));const val=v=>v===null?'null':Array.isArray(v)?`array[${v.map(quote).join(',')}]`:typeof v==='boolean'?String(v):quote(v);
      sql(`insert into profiles(${fields.join(',')}) values(${fields.map(f=>val(body[f])+(f==='available_nights'?'::smallint[]':'')).join(',')}) on conflict(id) do update set ${fields.filter(f=>f!=='id').map(f=>`${f}=excluded.${f}`).join(',')};`);data=null;}
  }else if(url.pathname==='/rest/v1/app_settings'){sql(`insert into app_settings(key,value) values(${quote(body.key)},${body.value}) on conflict(key) do update set value=excluded.value;`);data=null;}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));
}catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({message:error.message}));}});
const run=(url,extra=[])=>new Promise((resolve,reject)=>{const proc=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/seed-samples.ts',...extra],{env:{...process.env,SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:'health-service-fixture-not-a-real-secret'},stdio:['ignore','pipe','pipe']});let text='';proc.stdout.on('data',part=>text+=part);proc.stderr.on('data',part=>text+=part);proc.on('exit',code=>code?reject(new Error(text)):resolve(text));});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;try{
  const realBefore=sql('select count(*) from profiles where not is_sample;');
   await run(url);assert.equal(sql('select count(*) from profiles where is_sample;'),30);assert.equal(sql('select count(*) from auth.users where raw_app_meta_data->>\'is_sample\'=\'true\' and banned_until is not null;'),30);
  const ids=sql("select json_agg(id order by id) from profiles where is_sample;");
   await run(url);assert.deepEqual(sql("select json_agg(id order by id) from profiles where is_sample;"),ids);assert.equal(sql('select count(*) from auth.users where raw_app_meta_data->>\'is_sample\'=\'true\' and banned_until is not null;'),30);
  assert.equal(sql("select count(*) from profiles where is_sample and is_verified;"),0);
  results.push({check:'Admin API seeding twice: exactly 30, stable IDs, banned creation, no verified samples',pass:true});
  console.log(await run(url,['--audit']));
  await run(url,['--remove']);await run(url,['--remove']);assert.equal(sql('select count(*) from profiles where is_sample;'),0);assert.equal(sql('select count(*) from profiles where not is_sample;'),realBefore);
  results.push({check:'Admin API removal twice preserves all real fixtures',pass:true});
  if(sql("select to_json(to_regclass('public.legacy_demo_storage_cleanup') is not null);")){
    const before=sql("select coalesce(json_agg(object_name),'[]') from legacy_demo_storage_cleanup;");
    await run(url,['--remove-legacy-storage']);await run(url,['--remove-legacy-storage']);assert.deepEqual(removedFiles,before);assert.equal(sql('select count(*) from legacy_demo_storage_cleanup;'),0);
    const cleanup=spawnSync(process.env.GARBA_PSQL||'psql',[...args,'-f','supabase/cleanup-legacy-demo.sql'],{encoding:'utf8'});if(cleanup.status)throw new Error(cleanup.stderr);
    assert.equal(sql("select count(*) from profiles where is_demo;"),0);
    assert(sql("select to_json(exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000301'));"));
    results.push({check:'Storage API removes only queued demo-owned objects, twice safely',pass:true});
  }
}finally{server.close();fs.writeFileSync('/tmp/omnirush/sample-seeding-results.json',JSON.stringify(results,null,2));console.log(results);}})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
