// Production UI + real disposable SQL/RLS; Supabase HTTP/Phoenix is emulated.
// Reuses the existing guarded _tests DB fixture transport, never live data.
const {chromium}=require('@playwright/test');
const {context,reset,sql,jsonRows,id,quote,emitMatch}=require('./verify-followups.cjs');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.GARBA_TEST_URL||'http://127.0.0.1:3101';
const out=process.env.GARBA_POLISH_ARTIFACTS||'/tmp/omnirush/mobile-polish';
const longName='Shreyas A Chowdary Venkata Subramaniam';
const results=[];
function setup(){
  reset();
  sql(`update profiles set first_name=${quote(longName)} where id in(${quote(id(2))},${quote(id(3))},${quote(id(30))},${quote(id(70))});
    insert into likes(from_user,to_user,kind) select ${quote(id(1))},id,'interested' from profiles where right(id::text,12)::integer between 30 and 69;
    insert into passes(from_user,to_user) select ${quote(id(1))},id from profiles where right(id::text,12)::integer between 70 and 109;
    insert into admin_users(user_id) values(${quote(id(1))});`);
  for(const target of [2,3,4]){
    sql(`select public.set_decision(${quote(id(target))},'interested');`,id(1));
    sql(`select public.set_decision(${quote(id(1))},'interested');`,id(target));
  }
  const match=jsonRows(`select * from matches where user_a=${quote(id(1))} and user_b=${quote(id(2))}`)[0];
  jsonRows(`insert into messages(match_id,sender_id,body,chat_started_at) values(${quote(match.id)},${quote(id(2))},'Dandiya first? See you on night 3.',${quote(match.chat_started_at)}) returning *`,id(2));
  sql(`select public.set_decision(${quote(id(1))},'interested');`,id(5));
  // A long-name interest notification, without altering the matched account.
  sql(`update profiles set first_name=${quote(longName)} where id=${quote(id(5))};`);
  const portrait='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260"><defs><linearGradient id="b"><stop stop-color="#752562"/><stop offset="1" stop-color="#ff9858"/></linearGradient></defs><path fill="url(#b)" d="M0 0h300v260H0z"/><circle cx="150" cy="112" r="53" fill="#f8cda9"/><path d="M95 90q5-70 60-48 55 0 45 67-25-10-32-44-20 35-73 25" fill="#291b43"/><path d="M70 260q0-100 80-93 90 0 90 93" fill="#30224f"/><path d="M130 126q20 20 40 0" stroke="#7a434d" fill="none" stroke-width="5"/></svg>').toString('base64');
  sql(`update profiles set photo_path=${quote(portrait)} where id in(${[2,3,4,5,30,70].map(n=>quote(id(n))).join(',')});`);
  return match;
}
async function audit(page,label){
  await page.waitForTimeout(180);
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(layout.scroll<=layout.width+1&&layout.body<=layout.width+1,`${label}: horizontal page overflow ${JSON.stringify(layout)}`);
  for(const tile of await page.locator('[data-profile-tile]').all()){
    const r=await tile.boundingBox();
    const actions=tile.locator('[data-tile-actions]');
    assert.equal(await actions.locator('button,a').count(),2,`${label}: tile has more than primary + menu`);
    for(const control of await actions.locator('button,a').all()){
      const c=await control.boundingBox();assert(c.width>=43.5&&c.height>=43.5,`${label}: small tap target`);
      assert(c.x>=r.x+10&&c.x+c.width<=r.x+r.width-10,`${label}: tile control clipped`);
    }
    assert(await tile.locator('.person-tile-name').evaluate(e=>e.clientWidth>70&&getComputedStyle(e).overflowWrap==='anywhere'),`${label}: squeezed name`);
  }
  const dialog=page.getByRole('dialog').last();
  if(await dialog.count())assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${label}: dialog overflow`);
  for(const row of await page.locator('[data-person-menu] button').all()){const r=await row.boundingBox();assert(r.height>=47.5,`${label}: menu row below 48px`);}
  await page.screenshot({path:path.join(out,`${label}.png`),fullPage:true});
}
async function bottomClear(page,control){
  await control.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,180));
  const nav=await page.locator('nav').boundingBox(),r=await control.boundingBox();
  if(page.viewportSize().width<768)assert(r.y+r.height<=nav.y, 'Empty-state action under bottom nav');
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.GARBA_CHROME_PATH,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:360,height:740},{width:390,height:844},{width:768,height:1024},{width:1280,height:800}]){
      const match=setup(),ctx=await context(browser,id(1),viewport.width),page=await ctx.newPage();await page.setViewportSize(viewport);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      const tag=`${viewport.width}x${viewport.height}`;
      await page.goto(`${base}/discover`);await page.locator('[data-top-card="true"]').waitFor();
      // Initial notifications may toast once; dismiss them to inspect page content.
      while(await page.getByRole('button',{name:'Dismiss notification'}).count())await page.getByRole('button',{name:'Dismiss notification'}).first().click();
      const header=await page.locator('[data-discover-header]').boundingBox();
      for(const button of await page.locator('[data-discover-header] button').all()){const r=await button.boundingBox();assert(r.y>=header.y&&r.y+r.height<=header.y+header.height+1,'Header wraps');}
      assert.equal(await page.getByRole('button',{name:/shuffle/i}).count(),0);
      const tabs=page.locator('[aria-label="Discover tabs"]');assert(await tabs.evaluate(e=>e.scrollWidth<=e.clientWidth));
      assert.equal(await tabs.locator('button').count(),4);
      assert(await page.getByRole('textbox',{name:'Search by name, branch, or style'}).evaluate(e=>{const c=document.createElement('canvas').getContext('2d');c.font=getComputedStyle(e).font;return c.measureText(e.placeholder).width<e.clientWidth-50;}),'Search placeholder clipped');
      await audit(page,`${tag}-explore`);
      for(const [label,slug]of [['Sent','sent'],['Matches','matched'],['Passed','passed']]){
        await tabs.getByRole('button',{name:new RegExp(`^${label}`)}).click();await page.locator('[data-profile-tile]').first().waitFor();await audit(page,`${tag}-${slug}`);
      }
      const first=page.locator('[data-profile-tile]').first();await first.getByRole('button',{name:/Actions for/}).click();await page.locator('[data-person-menu]').waitFor();await audit(page,`${tag}-actions`);
      await page.keyboard.press('Escape');
      await tabs.getByRole('button',{name:/^Explore/}).click();
      const search=page.getByRole('textbox',{name:'Search by name, branch, or style'});await search.fill('Shreyas');await page.locator('[data-profile-tile]').first().waitFor();await audit(page,`${tag}-search`);
      assert.equal(await page.locator('[data-profile-tile]').count(),5,'Search must cover all statuses');
      await search.fill(id(2));await page.waitForTimeout(180);assert.equal(await page.locator('[data-profile-tile]').count(),0,'UUID must not be searchable');
      await search.fill('mobile-test-2@bmsce.ac.in');await page.waitForTimeout(180);assert.equal(await page.locator('[data-profile-tile]').count(),0,'Email must not be searchable');
      await search.fill('Shreyas');await page.locator('[data-profile-tile]').first().waitFor();
      await page.getByRole('button',{name:/Notifications,/}).click();await page.locator('[data-notification-panel]').waitFor();await audit(page,`${tag}-notifications`);
      await page.keyboard.press('Escape');await search.fill('');
      // Mark every eligible new/incoming profile as passed to expose Explore empty.
      sql(`insert into passes(from_user,to_user) select ${quote(id(1))},id from profiles where id<>${quote(id(1))} on conflict(from_user,to_user) do nothing;`);
      await page.reload();await page.locator('[data-explore-empty]').waitFor();await bottomClear(page,page.getByRole('button',{name:'Refresh',exact:true}));await audit(page,`${tag}-explore-empty`);
      await page.getByRole('button',{name:/Review Passed/}).click();await page.locator('[data-profile-tile]').first().waitFor();
      await page.goto(`${base}/matches`);await page.locator('[data-profile-tile]').first().waitFor();await page.waitForTimeout(700);await audit(page,`${tag}-matches-page`);
      assert.equal(await page.locator('[data-profile-tile]').count(),3);
      assert.equal(await page.locator('[data-new-matches] a').count(),2,'New matches must exclude conversation with messages');
      assert.equal(await page.getByText('Your conversations',{exact:true}).count(),0);
      await page.goto(`${base}/chat`);await page.locator('[data-chat-row]').first().waitFor();await page.getByText('Dandiya first? See you on night 3.',{exact:true}).waitFor();await audit(page,`${tag}-chats`);
      assert.equal(await page.getByRole('button',{name:'Unmatch',exact:true}).count(),0);
      for(const [route,slug]of [[`/chat/${match.id}`,'chat-header'],[`/profile/${id(2)}`,'profile'],['/settings','settings'],['/admin','admin']]){await page.goto(base+route);await page.waitForTimeout(750);await audit(page,`${tag}-${slug}`);}
      await page.goto(`${base}/discover`);await page.getByRole('button',{name:'Filters',exact:true}).click();await audit(page,`${tag}-filters`);await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'How it works',exact:true}).click();await page.locator('[data-tutorial-step="1"]').waitFor();await audit(page,`${tag}-guide`);await page.getByRole('combobox',{name:'Tutorial step'}).selectOption('8');await audit(page,`${tag}-guide-last`);await page.keyboard.press('Escape');
      assert.deepEqual(errors,[],`Page exceptions at ${tag}`);results.push({check:`${tag}: all page/sheet screenshots, long names, 2-control tiles, no horizontal overflow, empty-state nav clearance`,pass:true});await ctx.close();
    }
    // Actual SQL actions through UI + live second-account Phoenix delivery.
    const match=setup(),ca=await context(browser,id(1)),cb=await context(browser,id(2)),a=await ca.newPage(),b=await cb.newPage();
    await b.goto(`${base}/chat/${match.id}`);await b.getByRole('textbox',{name:'Message',exact:true}).waitFor();
    await a.goto(`${base}/discover`);const tabs=a.locator('[aria-label="Discover tabs"]');await tabs.getByRole('button',{name:/^Passed/}).click();await a.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Shreyas');
    const tile=a.locator(`[data-profile-tile="${id(70)}"]`);await tile.getByRole('button',{name:/Actions for/}).click();await a.getByRole('button',{name:'Send Garba Vibe ⭐',exact:true}).click();
    await tabs.getByRole('button',{name:/^Sent/}).click();await a.locator(`[data-profile-tile="${id(70)}"]`).waitFor();assert.equal(jsonRows(`select kind from likes where from_user=${quote(id(1))} and to_user=${quote(id(70))}`)[0].kind,'garba_vibe');
    await a.locator(`[data-profile-tile="${id(70)}"]`).getByRole('button',{name:/Pass on/}).click();await tabs.getByRole('button',{name:/^Passed/}).click();await a.locator(`[data-profile-tile="${id(70)}"]`).waitFor();
    await a.locator(`[data-profile-tile="${id(70)}"]`).getByRole('button',{name:/Show interest/}).click();await tabs.getByRole('button',{name:/^Sent/}).click();await a.locator(`[data-profile-tile="${id(70)}"]`).waitFor();
    results.push({check:'Menu Vibe → Sent → Pass → Passed → Interested → Sent with real SQL statuses',pass:true});
    await tabs.getByRole('button',{name:/^Matches/}).click();const matched=a.locator(`[data-profile-tile="${id(2)}"]`);await matched.getByRole('button',{name:/Actions for/}).click();await a.getByRole('button',{name:'Report',exact:true}).click();await a.getByRole('combobox',{name:'Reason'}).selectOption('harassment');await a.getByRole('dialog').locator('textarea').fill('Mobile polish action verification');await audit(a,'360-report-form');await a.getByRole('button',{name:'Submit report',exact:true}).click();await a.getByRole('dialog').waitFor({state:'hidden'});
    assert(jsonRows(`select * from reports where description='Mobile polish action verification' and reason='harassment'`).length===1);
    await matched.getByRole('button',{name:/Actions for/}).click();await a.getByRole('button',{name:'Unmatch',exact:true}).click();const confirm=a.getByRole('dialog',{name:/^Unmatch /});await confirm.waitFor();assert.equal(jsonRows(`select status from matches where id=${quote(match.id)}`)[0].status,'active','Unmatch executed before confirmation');await confirm.getByRole('button',{name:'Unmatch',exact:true}).click();await b.getByText('This chat is no longer available',{exact:true}).waitFor();
    await matched.waitFor({state:'hidden'});
    await a.goto(`${base}/chat`);await a.locator('[data-chat-row]').first().waitFor();assert.equal(await a.locator('[data-chat-row]').count(),2);results.push({check:'Report from menu; confirmed Unmatch removes A tile/chat and closes B chat live',pass:true});
    const match3=jsonRows(`select * from matches where user_a=${quote(id(1))} and user_b=${quote(id(3))}`)[0],cc=await context(browser,id(3)),c=await cc.newPage();await c.goto(`${base}/chat/${match3.id}`);await c.getByRole('textbox',{name:'Message',exact:true}).waitFor();
    await a.goto(`${base}/matches`);const tile3=a.locator(`[data-profile-tile="${id(3)}"]`);await tile3.getByRole('button',{name:/Actions for/}).click();await a.getByRole('button',{name:'Block',exact:true}).click();const block=a.getByRole('dialog',{name:/^Block /});await block.waitFor();assert.equal(jsonRows(`select * from blocks where blocker_id=${quote(id(1))} and blocked_id=${quote(id(3))}`).length,0);await block.getByRole('button',{name:'Block',exact:true}).click();await c.getByText('This chat is no longer available',{exact:true}).waitFor();
    await a.goto(`${base}/discover`);await a.getByRole('textbox',{name:'Search by name, branch, or style'}).fill('Shreyas');await a.waitForTimeout(400);assert.equal(await a.locator(`[data-profile-tile="${id(3)}"]`).count(),0);
    const view=a.locator('[data-profile-tile]').first();const viewId=await view.getAttribute('data-profile-tile');await view.getByRole('button',{name:/Actions for/}).click();await a.getByRole('button',{name:'View profile',exact:true}).click();await a.waitForURL(`**/profile/${viewId}`);
    results.push({check:'Block confirmation → live partner chat closes → absent from search; View profile menu navigation',pass:true});
    await ca.close();await cb.close();await cc.close();
  }catch(error){console.error(error);for(const ctx of browser.contexts())for(const page of ctx.pages()){console.error('Failure page',page.url(),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}process.exitCode=1;}
  finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(results);}
})();
