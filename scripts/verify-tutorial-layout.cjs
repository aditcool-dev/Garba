// Production Chromium + disposable SQL; Supabase Auth/HTTP/Phoenix emulated.
const {chromium}=require('@playwright/test');
const {context,reset,sql,requests}=require('./verify-followups.cjs');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const sharp=require('sharp');
const base=process.env.GARBA_TEST_URL||'http://127.0.0.1:3101';
const out=process.env.GARBA_TUTORIAL_ARTIFACTS||'/tmp/omnirush/tutorial-layout';
const results=[];
const snapshot=()=>sql(`select json_build_object('likes',(select count(*) from likes),'passes',(select count(*) from passes),'matches',(select count(*) from matches));`);
async function audit(page,label,fullCard=true){
  const dialog=page.getByRole('dialog'),header=dialog.locator('[data-sheet-header]'),body=dialog.locator('[data-sheet-content]'),footer=dialog.locator('[data-sheet-footer]');
  const [d,h,b,f]=await Promise.all([dialog.boundingBox(),header.boundingBox(),body.boundingBox(),footer.boundingBox()]);
  const view=page.viewportSize();
  assert(d.y>=-1&&d.y+d.height<=view.height+1,`${label}: sheet outside viewport`);
  assert(h.y+h.height<=b.y+1&&b.y+b.height<=f.y+1,`${label}: instruction/demo/navigation overlap`);
  assert(await header.evaluate(e=>getComputedStyle(e).position!=='sticky'),`${label}: sticky instruction`);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: page horizontal overflow`);
  assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${label}: sheet horizontal overflow`);
  assert(await body.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${label}: demo horizontal overflow`);
  for(const control of await footer.locator('button,select').all()){
    const r=await control.boundingBox();assert(r.y>=f.y&&r.y+r.height<=view.height-7,`${label}: navigation outside viewport`);assert(r.width>=44&&r.height>=44,`${label}: small navigation target`);
  }
  assert.equal(await footer.locator('[aria-hidden="true"] span').count(),9);
  const card=dialog.locator('.tutorial-profile').first();
  if(await card.count()){
    // Center the unchanged card in the demo viewport, never the entire dialog.
    await card.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
    const c=await card.boundingBox(),r=await body.boundingBox();
    if(fullCard)assert(c.y>=r.y-1&&c.y+c.height<=r.y+r.height+1,`${label}: complete card does not fit demo viewport ${JSON.stringify({card:c,body:r})}`);
    assert(c.x>=r.x-1&&c.x+c.width<=r.x+r.width+1,`${label}: card horizontally clipped`);
    for(const content of await card.locator('h2,p,[role="list"]').all()){
      const rect=await content.boundingBox();assert(rect.x>=c.x-1&&rect.x+rect.width<=c.x+c.width+1&&rect.y>=c.y-1&&rect.y+rect.height<=c.y+c.height+1,`${label}: profile information clipped`);
    }
    assert.equal(await card.locator('[role="listitem"]').count(),9);
  }
  if(fullCard)for(const control of await body.locator('button').all()){
    if(!await control.isVisible()||await control.evaluate(e=>!!e.closest('.sr-only')))continue;
    const r=await control.boundingBox(),bounds=await body.boundingBox();
    assert(r.y>=bounds.y-1&&r.y+r.height<=bounds.y+bounds.height+1,`${label}: demo button clipped`);
  }
  await page.screenshot({path:path.join(out,`${label}.png`)});
  await dialog.screenshot({path:path.join(out,`${label}-dialog.png`)});
}
async function contact(tag){
  const images=[];
  for(let i=0;i<9;i++){
    const buffer=await sharp(path.join(out,`${tag}-step-${i+1}-dialog.png`)).resize({width:220,height:460,fit:'inside'}).png().toBuffer();
    images.push({input:buffer,left:8+(i%3)*228,top:28+Math.floor(i/3)*488});
    images.push({input:Buffer.from(`<svg width="220" height="24"><text x="4" y="17" font-size="14" fill="#ffd166">Step ${i+1}</text></svg>`),left:8+(i%3)*228,top:4+Math.floor(i/3)*488});
  }
  await sharp({create:{width:692,height:1472,channels:4,background:'#0a0820'}}).composite(images).png().toFile(path.join(out,`${tag}-all-steps.png`));
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});reset();
  const browser=await chromium.launch({headless:true,executablePath:process.env.GARBA_CHROME_PATH,args:['--no-sandbox']});
  try{
    const before=snapshot(),start=requests.length;
    for(const viewport of [{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:768,height:1024},{width:1280,height:800}]){
      const ctx=await context(browser,'00000000-0000-4000-8000-000000000001',viewport.width),page=await ctx.newPage();await page.setViewportSize(viewport);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/discover');await page.getByRole('button',{name:'How it works',exact:true}).click();
      for(let step=0;step<9;step++){
        await page.getByRole('combobox',{name:'Tutorial step'}).selectOption(String(step));await page.locator(`[data-tutorial-step="${step+1}"]`).waitFor();
        await page.waitForTimeout(400);await audit(page,`${viewport.width}x${viewport.height}-step-${step+1}`);
      }
      // Check motion extrema of the three animated explanations, then actual
      // local practice controls and the expanded details state.
      for(let step=1;step<=3;step++){
        await page.getByRole('combobox',{name:'Tutorial step'}).selectOption(String(step));
        for(let i=0;i<5;i++){await page.waitForTimeout(300);const h=await page.locator('[data-sheet-header]').boundingBox(),c=await page.locator('.tutorial-profile').boundingBox();assert(c.y>h.y+h.height,'Animated card crossed the instruction');}
        await page.getByRole('button',{name:'Try it',exact:true}).click();await page.locator('[data-tutorial-step] [data-top-card="true"]').waitFor();await audit(page,`${viewport.width}x${viewport.height}-practice-${step+1}`);
        const old=await page.locator('[data-tutorial-step] [data-top-card="true"]').getAttribute('data-swipe-card');await page.getByRole('dialog').getByRole('button',{name:step===1?'Interested':step===2?'Pass':'Garba Vibe',exact:true}).click();await page.waitForFunction(old=>document.querySelector('[data-tutorial-step] [data-top-card="true"]')?.dataset.swipeCard!==old,old);
      }
      await page.getByRole('combobox',{name:'Tutorial step'}).selectOption('4');await page.locator('.tutorial-profile').click();await page.locator('[data-tutorial-details]').waitFor();await audit(page,`${viewport.width}x${viewport.height}-details`);
      await page.getByRole('combobox',{name:'Tutorial step'}).selectOption('6');for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert(await page.getByRole('dialog').evaluate(e=>e.contains(document.activeElement)),'Focus escaped tutorial');}
      await page.getByRole('combobox',{name:'Tutorial step'}).focus();await page.keyboard.press('ArrowDown');assert.equal(await page.locator('[data-tutorial-step="9"]').count(),0,'Step picker arrow advanced the whole tutorial');
      await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
      await contact(`${viewport.width}x${viewport.height}`);
      results.push({check:`${viewport.width}x${viewport.height}: all 9 steps, animated/practice/details states, full card, progress/nav, focus, no overlap/clipping/overflow`,pass:true});await ctx.close();
    }
    const ctx=await context(browser,'00000000-0000-4000-8000-000000000001',360),page=await ctx.newPage();await page.setViewportSize({width:360,height:640});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/discover');await page.getByRole('button',{name:'How it works',exact:true}).click();
    for(let step=0;step<9;step++){await page.getByRole('combobox',{name:'Tutorial step'}).selectOption(String(step));await audit(page,`360x640-step-${step+1}`,false);}
    await page.getByRole('combobox',{name:'Tutorial step'}).selectOption('8');await page.getByRole('button',{name:'Start discovering',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.deepEqual(snapshot(),before,'Tutorial changed real relationships');assert(!requests.slice(start).some(r=>r.method==='POST'&&['set_decision','like_user','likes','passes','matches','send_chat_message'].includes(r.name)),'Practice made real mutations');
    results.push({check:'360x640 all 9 steps: readable scroll fallback/reduced motion, visible navigation, Finish; no real relationship writes',pass:true});await ctx.close();
  }catch(error){console.error(error);for(const ctx of browser.contexts())for(const page of ctx.pages()){console.error(page.url(),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png')});}process.exitCode=1;}
  finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(results);}
})();
