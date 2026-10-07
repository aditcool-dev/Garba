// Production browser + real local SQL/RLS; Supabase Auth/HTTP/Phoenix emulated.
const {chromium}=require('@playwright/test');
const {context,reset,sql,jsonRows,id,quote,requests,failNextSend}=require('./verify-followups.cjs');
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const base=process.env.GARBA_TEST_URL||'http://127.0.0.1:3101';
const out=process.env.GARBA_RECEIPT_ARTIFACTS||'/tmp/omnirush/search-receipts';
const results=[];
const row=(page,messageId)=>page.locator(`[data-message-id="${messageId}"]`);
const stored=body=>jsonRows(`select * from messages where body=${quote(body)}`)[0];
async function send(page,body){await page.getByRole('textbox',{name:'Message',exact:true}).fill(body);await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByText(body,{exact:true}).waitFor();}
async function tick(page,msg,state){await row(page,msg.id).getByRole('img',{name:state,exact:true}).waitFor({timeout:8000});}
async function shot(page,name){await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});}
(async()=>{
  fs.mkdirSync(out,{recursive:true});reset();
  sql(`select set_decision(${quote(id(2))},'interested');`,id(1));
  sql(`select set_decision(${quote(id(1))},'interested');`,id(2));
  const match=jsonRows(`select * from matches where user_a=${quote(id(1))} and user_b=${quote(id(2))}`)[0];
  const browser=await chromium.launch({headless:true,executablePath:process.env.GARBA_CHROME_PATH,args:['--no-sandbox']});
  try{
    const ca=await context(browser,id(1),390,{disableMessagePolling:true}),a=await ca.newPage();await a.goto(`${base}/chat/${match.id}`);await a.getByRole('textbox',{name:'Message',exact:true}).waitFor();
    const errors=[];a.on('pageerror',error=>errors.push(error.message));
    await send(a,'A offline recipient');await a.getByRole('img',{name:'Sent',exact:true}).waitFor();let msg=stored('A offline recipient');assert(msg&&!msg.delivered_at&&!msg.read_at);await shot(a,'sent');
    const cb=await context(browser,id(2),390,{disableMessagePolling:true}),b=await cb.newPage();b.on('pageerror',error=>errors.push(error.message));
    await b.goto(`${base}/discover`);await b.locator('[data-top-card="true"]').waitFor();await tick(a,msg,'Delivered');assert(!stored(msg.body).read_at);await shot(a,'delivered');
    await b.goto(`${base}/chat/${match.id}`);await b.getByText(msg.body,{exact:true}).waitFor();await tick(a,msg,'Read');assert(stored(msg.body).read_at);await shot(a,'read');
    const matchRequests=requests.filter(r=>r.name==='mark_chat_read'&&r.actor===id(2));assert(matchRequests.some(r=>Array.isArray(r.body.p_message_ids)&&r.body.p_message_ids.includes(msg.id)),'Read did not use visible message IDs');
    await a.reload();await tick(a,msg,'Read');await a.goto(`${base}/chat`);await a.locator('[data-chat-row]').filter({hasText:msg.body}).getByRole('img',{name:'Read',exact:true}).waitFor();await shot(a,'chat-list-read');
    results.push({check:'A sends while B closed → one grey; B opens app → two grey; B opens visible chat → two cyan live; stored first-load/list ticks',pass:true});

    // A is not reading: B's message is delivered by A's app, then read by A.
    await send(b,'B message before opt-out');await b.getByRole('img',{name:'Delivered',exact:true}).waitFor();const bmsg=stored('B message before opt-out');await a.goto(`${base}/chat/${match.id}`);await tick(b,bmsg,'Read');
    await b.goto(`${base}/settings`);const toggle=b.getByRole('switch',{name:'Read receipts',exact:true});assert.equal(await toggle.getAttribute('aria-checked'),'true');await toggle.click();await b.getByText(/Read receipts off/).waitFor();assert.equal(jsonRows(`select read_receipts_enabled from profiles where id=${quote(id(2))}`)[0].read_receipts_enabled,false);await shot(b,'settings-off');
    await b.goto(`${base}/chat/${match.id}`);await tick(b,bmsg,'Delivered');assert.equal(await row(b,bmsg.id).getByRole('img',{name:'Read',exact:true}).count(),0);
    await send(a,'A with B receipts disabled');msg=stored('A with B receipts disabled');await tick(a,msg,'Delivered');await b.getByText(msg.body,{exact:true}).waitFor();await b.waitForTimeout(350);assert.equal(stored(msg.body).read_at,null);assert(stored(msg.body).delivered_at);
    assert.equal(jsonRows(`select * from get_chat_unread_counts()`,id(2)).find(r=>r.match_id===match.id).unread_count,0);
    await b.goto(`${base}/chat`);assert.equal(await b.locator('[data-chat-row]').getByLabel(/unread messages/).count(),0);await shot(a,'read-receipts-off');
    results.push({check:'B opts out through Settings: no new read_at/blue for A; B sees no own blue; private seen clears B unread badge',pass:true});

    // Visibility and viewport gates: loaded-but-offscreen messages stay unread.
    await b.goto(`${base}/settings`);await b.getByRole('switch',{name:'Read receipts'}).click();await b.getByText(/Read receipts on/).waitFor();
    await b.goto(`${base}/chat/${match.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();
    await b.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}));
    await send(a,'Hidden recipient tab');let hidden=stored('Hidden recipient tab');await tick(a,hidden,'Delivered');await b.getByText(hidden.body,{exact:true}).waitFor();await b.waitForTimeout(350);assert.equal(stored(hidden.body).read_at,null);
    await b.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});await tick(a,hidden,'Read');
    for(let i=0;i<12;i++)sql(`select row_to_json(send_chat_message(${quote(match.id)},gen_random_uuid(),${quote('Viewport padding message '+i)},${quote(match.chat_started_at)}));`,id(1));
    await b.reload();await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();await b.waitForTimeout(400);
    await b.evaluate(()=>{window.__originalScrollIntoView=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(){};const viewport=document.querySelector('[aria-live="polite"][class*="overflow-y-auto"]');viewport.scrollTop=0;window.scrollTo({top:0,behavior:'instant'});});
    await send(a,'Recipient message below viewport');let offscreen=stored('Recipient message below viewport');await tick(a,offscreen,'Delivered');
    await b.getByText(offscreen.body,{exact:true}).waitFor();await b.waitForTimeout(350);assert.equal(stored(offscreen.body).read_at,null,'Offscreen message incorrectly read');
    await b.evaluate(()=>{Element.prototype.scrollIntoView=window.__originalScrollIntoView;});await b.getByText(offscreen.body,{exact:true}).evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await tick(a,offscreen,'Read');
    results.push({check:'Hidden tab never marks read; visibility return acknowledges only viewport-visible incoming messages',pass:true});

    await b.goto(`${base}/discover`);
    failNextSend('before');await send(a,'Retry failed before save');await a.getByRole('img',{name:'Sending',exact:true}).waitFor();await a.getByRole('button',{name:'Failed to send. Tap to retry'}).waitFor();assert.equal(jsonRows(`select * from messages where body='Retry failed before save'`).length,0);await shot(a,'failed-retry');await a.getByRole('button',{name:'Failed to send. Tap to retry'}).click();await a.locator('[data-message-id]').filter({hasText:'Retry failed before save'}).getByRole('img',{name:/^(Sent|Delivered|Read)$/}).waitFor();assert.equal(jsonRows(`select * from messages where body='Retry failed before save'`).length,1);
    failNextSend('after');await send(a,'Retry after lost acknowledgement');await a.getByRole('button',{name:'Failed to send. Tap to retry'}).waitFor();assert.equal(jsonRows(`select * from messages where body='Retry after lost acknowledgement'`).length,1);await a.getByRole('button',{name:'Failed to send. Tap to retry'}).click();await a.locator('[data-message-id]').filter({hasText:'Retry after lost acknowledgement'}).getByRole('img',{name:/^(Sent|Delivered|Read)$/}).waitFor();assert.equal(jsonRows(`select * from messages where body='Retry after lost acknowledgement'`).length,1);
    results.push({check:'Clock during send; red retry after failure; retry succeeds once, including committed INSERT with lost acknowledgement',pass:true});

    // Search has mixed statuses but no status grouping; 30 then Load more.
    sql(`update profiles set styles=array['Dandiya'],bio='' where id<>${quote(id(1))};`);
    const names=['Radit','Anirudha Aditya','Aditya Dev','Aditi','Aditya','Bio dancer','ÁDÍT'];
    names.forEach((name,i)=>sql(`update profiles set first_name=${quote(name)},styles=array['Dandiya'],available_nights=array[1,2,4,7,9]::smallint[],bio=${quote(i===5?'I enjoy adit music':'')} where id=${quote(id(10+i))};`));
    for(let i=0;i<32;i++)sql(`update profiles set first_name=${quote('Aditya Z '+String(i).padStart(2,'0'))},styles=array['Dandiya'],available_nights=array[1,2,4,7,9]::smallint[] where id=${quote(id(30+i))};`);
    sql(`select set_decision(${quote(id(13))},'pass');`,id(1));sql(`select set_decision(${quote(id(16))},'interested');`,id(1));
    await a.goto(`${base}/discover`);const search=a.getByRole('textbox',{name:'Search by name, branch, or style'});await search.fill('  aDít  ');await a.locator('[data-profile-tile]').first().waitFor();assert.equal(await a.locator('[data-profile-tile]').count(),30);
    const expected=[id(16),id(13),id(14),id(12)];assert.deepEqual((await a.locator('[data-profile-tile]').evaluateAll(nodes=>nodes.map(e=>e.dataset.profileTile))).slice(0,4),expected);
    await shot(a,'search-best-30');await a.getByRole('button',{name:/Load more profiles/}).click();assert.equal(await a.locator('[data-profile-tile]').count(),39);assert.deepEqual((await a.locator('[data-profile-tile]').evaluateAll(nodes=>nodes.map(e=>e.dataset.profileTile))).slice(-3),[id(11),id(10),id(15)]);
    await a.locator('[aria-label="Discover tabs"]').getByRole('button',{name:/^Passed/}).click();await a.locator('[data-profile-tile]').first().waitFor();assert.deepEqual((await a.locator('[data-profile-tile]').evaluateAll(nodes=>nodes.map(e=>e.dataset.profileTile))).slice(0,4),expected);
    await search.fill('Adit');await search.fill('xyz-no-one');await a.getByText("No one found for 'xyz-no-one'. Try a name, branch or style.",{exact:true}).waitFor();assert.equal(await a.locator('[data-profile-tile]').count(),0);await a.waitForTimeout(400);assert.equal(await a.locator('[data-profile-tile]').count(),0);
    await search.fill('xyz-no-one');await search.fill('ÁDIT');await a.locator('[data-profile-tile]').first().waitFor();assert.deepEqual((await a.locator('[data-profile-tile]').evaluateAll(nodes=>nodes.map(e=>e.dataset.profileTile))).slice(0,4),expected);
    results.push({check:'Normalized Adit relevance across statuses, stable order, best 30 pagination, rapid typing cancels stale results and exact empty copy',pass:true});
    assert.deepEqual(errors,[]);await ca.close();await cb.close();
  }catch(error){console.error(error);for(const ctx of browser.contexts())for(const page of ctx.pages()){console.error(page.url(),await page.locator('body').innerText());await shot(page,'failure');}process.exitCode=1;}
  finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(results);}
})();
