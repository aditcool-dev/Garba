const { chromium } = require('@playwright/test');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');
const artifacts = process.env.GARBA_ARTIFACTS || '/tmp/omnirush';
fs.mkdirSync(artifacts, {recursive:true});
const base = process.env.GARBA_TEST_URL || 'http://127.0.0.1:3100';
const results = [];
const profile = (id, name) => ({ id, first_name: name, age: 20, gender: 'Woman', branch: 'CSE', year: 2, bio: 'Ready for nine nights on the floor.', experience: 'Beginner', styles: ['Traditional Garba', 'Dandiya'], looking_for: ['Garba partner'], available_nights: [1,2,3,4,5,6,7,8,9], interests: ['dance'], partner_preference: 'Everyone', photo_path: '🌸', is_hidden: false, is_suspended: false, is_banned: false, onboarding_complete: true, is_demo: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
const me = profile('00000000-0000-4000-8000-000000000001', 'Viewer');
const profiles = [me, ...Array.from({length: 70}, (_, i) => profile(`00000000-0000-4000-8000-${String(i+2).padStart(12,'0')}`, `Dancer${i}`))];

async function fixture(context, { reciprocal = false, failSnapshot = false } = {}) {
  const likes = [];
  const passes = [];
  await context.routeWebSocket('**/*.supabase.co/**', socket => socket.close());
  await context.addInitScript(({me, profiles}) => {
    sessionStorage.setItem('garbamate_cleaned_demo_v1', 'true');
    localStorage.setItem('garbamate_auth_session', JSON.stringify({id:me.id,email:'viewer.cs24@bmsce.ac.in'}));
    localStorage.setItem('garbamate_profiles', JSON.stringify(profiles));
    window.__swipeRenders = 0;
    const lastCardFiber = new Map();
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, renderers: new Map(), inject(renderer) { this.renderers.set(1,renderer); return 1; },
      onCommitFiberRoot(id, root) {
        const walk = f => {
          if (!f) return;
          // ForwardRef tag 11 is the actual SwipeCard function. React can reuse a
          // bailed-out fiber with old flags: do not recount that same instance.
          if (f.tag === 11 && typeof f.memoizedProps?.depth === 'number' && f.memoizedProps?.onDecide) {
            const key=f.memoizedProps.person.id;
            if(lastCardFiber.get(key)!==f && (f.flags & 1)) window.__swipeRenders++;
            lastCardFiber.set(key,f);
          }
          walk(f.child); walk(f.sibling);
        }; walk(root.current);
      }, onCommitFiberUnmount() {},
    };
  }, {me, profiles});
  await context.route('**/*.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const table = url.pathname.split('/').pop();
    const eq = key => (url.searchParams.get(key) || '').replace(/^eq\./,'');
    const match = row => ['from_user','to_user'].every(k => !eq(k) || row[k] === eq(k));
    let body = [];
    let status = 200;
    if (table === 'profiles') body = eq('id') ? profiles.find(p => p.id === eq('id')) : profiles;
    else if (table === 'get_public_profile_names') body = profiles.map(({id,first_name})=>({id,first_name}));
    else if (table === 'like_user') body = {matched:reciprocal,match_id:reciprocal?'test-match':undefined};
    else if (table === 'likes' || table === 'passes') {
      const rows = table === 'likes' ? likes : passes;
      if (method === 'DELETE') { for(let i=rows.length-1;i>=0;i--) if(match(rows[i])) rows.splice(i,1); body=[]; }
      else if (method === 'POST') { const data=request.postDataJSON(); for(const row of (Array.isArray(data)?data:[data])) { if(!row.to_user.startsWith('00000000-')) {status=400;body={message:'invalid UUID'};break;} const i=rows.findIndex(r=>r.from_user===row.from_user&&r.to_user===row.to_user); if(i>=0) rows[i]=row; else rows.push(row); } }
      else { body=rows.filter(match); if (failSnapshot && table === 'likes' && url.searchParams.has('or')) { status=500; body={message:'Injected snapshot failure'}; } }
    } else if(table === 'matches') body = method==='POST'?{id:'test-match'}:[];
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  return {likes, passes};
}

async function topId(page) { return page.locator('[data-top-card="true"]').getAttribute('data-swipe-card'); }
async function waitNext(page,id) { await page.waitForFunction(id => document.querySelector('[data-top-card="true"]')?.getAttribute('data-swipe-card') !== id, id); }
async function touchDrag(page, cdp, direction, commit=true, measure=false) {
  const card = page.locator('[data-top-card="true"]');
  await card.scrollIntoViewIfNeeded();
  const rect=await card.boundingBox();
  const start = {x:rect.x+rect.width/2,y:Math.max(140,Math.min(450,rect.y+rect.height*.45))};
  if(direction==='vibe') start.y=rect.y+20;
  const id=await topId(page);
  const initial = await page.evaluate(()=>window.__swipeRenders);
  const distance=commit?165:measure?110:35;
  const steps=measure?60:12;
  if(measure) await page.evaluate(()=>{window.__frames=[];window.__recordFrames=true;let last=performance.now();const frame=now=>{if(!window.__recordFrames)return;window.__frames.push(now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame);});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  for(let i=1;i<=steps;i++) {
    const p = {x:start.x+(direction==='like'?1:direction==='pass'?-1:0)*distance*i/steps,y:start.y-(direction==='vibe'?distance*i/steps:0)};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
    await page.waitForTimeout(18);
  }
  if(measure) await page.evaluate(()=>{window.__recordFrames=false;});
  assert.equal(await page.evaluate(()=>window.__swipeRenders),initial,'SwipeCard re-rendered during drag');
  await page.waitForTimeout(commit?15:200);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  if(commit) {
    await page.waitForTimeout(90);
    const current=page.locator(`[data-swipe-card="${id}"]`);
    if(await current.count()) {
      const after=await current.boundingBox();
      if(direction==='pass') assert(after.x<rect.x-130,`Pass went right (${after.x})`);
      if(direction==='like') assert(after.x>rect.x+130,`Like went left (${after.x})`);
      if(direction==='vibe') assert(after.y<rect.y,'Vibe did not move up');
    }
    await waitNext(page,id);
  } else { await page.waitForTimeout(500); assert.equal(await topId(page),id); }
  assert((await page.locator('[data-swipe-card]').count())<=3);
  return id;
}

(async()=>{
  const browser=await chromium.launch({headless:true, executablePath:process.env.GARBA_CHROME_PATH, args:['--no-sandbox']});
  try {
    const landing=await browser.newContext();
    await landing.route('**/*.supabase.co/**',r=>r.fulfill({contentType:'application/json',body:'[]'}));
    const page=await landing.newPage();
    const cdp=await landing.newCDPSession(page);
    for(const size of process.env.GARBA_SKIP_REPEATS ? [] : [16,20]) {
      await cdp.send('Page.setFontSizes',{fontSizes:{standard:size}});
      for(const width of [320,360,390,412,430,768,1280]) {
        await page.setViewportSize({width,height:900}); await page.goto(base); await page.locator('.hero-sample-card').first().waitFor();
        const geometry=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.hero-sample-card')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),headline:document.querySelector('h1').getBoundingClientRect().toJSON(),stack:document.querySelector('.hero-stack').getBoundingClientRect().toJSON(),font:getComputedStyle(document.documentElement).fontSize}));
        assert.equal(geometry.scroll,width,`horizontal scroll ${width}/${size}`);
        for(const r of geometry.cards) { assert(r.left>=15.9,`clipped left ${width}/${size}: ${r.left}`); assert(r.right<=width-15.9,`clipped right ${width}/${size}: ${r.right}`); assert(r.top>=geometry.stack.top && r.bottom<=geometry.stack.bottom,'card outside reserved stack height'); }
        if(width<1024) assert(geometry.headline.top>Math.max(...geometry.cards.map(r=>r.bottom)),'headline overlaps fan');
        results.push({check:'hero',width,font:geometry.font,pass:true});
        if(width===390) await page.screenshot({path:path.join(artifacts,`hero-${size}.png`),fullPage:true});
      }
    }
    await landing.close();
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const store=await fixture(context);
    const discover=await context.newPage();
    await discover.goto(`${base}/discover`);
    await discover.locator('[data-top-card="true"]').waitFor();
    assert((await discover.evaluate(()=>window.__swipeRenders))>0,'React render hook did not observe the mounted cards');
    const session=await context.newCDPSession(discover);
    await touchDrag(discover,session,'pass',false);
    for(let i=0;i<(process.env.GARBA_SKIP_REPEATS?0:20);i++) {
      const id=await touchDrag(discover,session,'pass');
      await discover.waitForFunction(id=>JSON.parse(localStorage.getItem('garbamate_passes')||'[]').some(r=>r.to_user===id),id);
      if(id.startsWith('00000000-')) assert(store.passes.some(r=>r.to_user===id));
    }
    for(let i=0;i<(process.env.GARBA_SKIP_REPEATS?0:20);i++) {
      const id=await touchDrag(discover,session,'like');
      await discover.waitForFunction(id=>JSON.parse(localStorage.getItem('garbamate_likes')||'[]').some(r=>r.to_user===id),id);
      assert(store.likes.some(r=>r.to_user===id));
    }
    if(!process.env.GARBA_SKIP_REPEATS) results.push({check:'20 touch passes + 20 touch likes, direction and mutation, no drag renders',pass:true});
    const passedId=await topId(discover);
    const priorLike={id:'prior-like',from_user:me.id,to_user:passedId,kind:'interested',created_at:'2026-01-01T00:00:00Z'};
    store.likes.push(priorLike);
    await discover.evaluate(row=>localStorage.setItem('garbamate_likes',JSON.stringify([...JSON.parse(localStorage.getItem('garbamate_likes')||'[]'),row])),priorLike);
    await discover.getByRole('button',{name:/^Pass on /}).last().evaluate(button=>{button.click();button.click();button.click();});
    await waitNext(discover,passedId);
    await discover.getByRole('button',{name:'Undo',exact:true}).click();
    await discover.waitForFunction(id=>document.querySelector('[data-top-card="true"]')?.dataset.swipeCard===id,passedId);
    await discover.waitForTimeout(350);
    assert(!store.passes.some(r=>r.to_user===passedId));
    if(passedId.startsWith('00000000-')) assert(store.likes.some(r=>r.to_user===passedId&&r.id==='prior-like'),'Undo did not restore pre-pass outgoing like');
    const likedId=await topId(discover);
    await discover.getByRole('button',{name:/^Show interest in /}).click();
    await waitNext(discover,likedId);
    const vibeId=await touchDrag(discover,session,'vibe');
    await discover.waitForFunction(id=>JSON.parse(localStorage.getItem('garbamate_likes')||'[]').some(r=>r.to_user===id&&r.kind==='garba_vibe'),vibeId);
    for(let i=0;i<2;i++){const id=await topId(discover);await discover.getByRole('button',{name:/^Send Garba Vibe/}).click({force:true});await waitNext(discover,id);await discover.waitForFunction(id=>JSON.parse(localStorage.getItem('garbamate_likes')||'[]').some(r=>r.to_user===id&&r.kind==='garba_vibe'),id);await discover.waitForTimeout(80);}
    const quotaId=await topId(discover);
    await discover.getByRole('button',{name:/^Send Garba Vibe/}).click({force:true});
    await discover.getByText('Your 3 Garba Vibes for today are used up ✨').waitFor();
    assert.equal(await topId(discover),quotaId);
    // Force an unrelated parent timer update during the next drag, not just an idle parent.
    await discover.waitForTimeout(2400);
    await touchDrag(discover,session,'pass',false);
    results.push({check:'buttons, rapid taps, undo mutation reversal, swipe up + Vibe quota',pass:true});
    // Vertical touch remains native scrolling away from the dedicated Vibe grip.
    await discover.evaluate(()=>scrollTo(0,0));
    const r=await discover.locator('[data-top-card="true"]').boundingBox();
    const p={x:r.x+r.width/2,y:r.y+240};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-i*12}]});await discover.waitForTimeout(20);}
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await discover.waitForTimeout(300);
    assert(await discover.evaluate(()=>scrollY)>40,'vertical card scroll blocked');
    const buttons=await discover.getByRole('button',{name:/^Show interest in /}).boundingBox();
    const nav=await discover.getByRole('navigation',{name:'Primary navigation'}).boundingBox();
    assert(buttons.y+buttons.height<=nav.y,'actions under nav');
    const night=await discover.locator('[data-top-card="true"] [role="list"]').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,count:e.children.length}));
    assert.equal(night.count,9);assert.equal(night.scroll,night.width);
    await discover.screenshot({path:path.join(artifacts,'discover-mobile.png'),fullPage:true});
    results.push({check:'vertical scroll, mobile action/nav clearance, 9-night non-scrolling row',pass:true});
    // Record a trace at 4x CPU; frame intervals and render hook are measured during an uncommitted drag.
    await session.send('Emulation.setCPUThrottlingRate',{rate:4});
    await session.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
    await touchDrag(discover,session,'pass',false,true);
    const frames=await discover.evaluate(()=>window.__frames.slice(2));
    const finished=new Promise(resolve=>session.once('Tracing.tracingComplete',resolve));
    await session.send('Tracing.end');const {stream}=await finished;
    let trace='';while(true){const part=await session.send('IO.read',{handle:stream});trace+=part.data;if(part.eof)break;}await session.send('IO.close',{handle:stream});
    fs.writeFileSync(path.join(artifacts,'swipe-4x-trace.json'),trace);
    results.push({check:'4x CPU trace + React render hook',fps:Math.round(1000/(frames.reduce((a,b)=>a+b,0)/frames.length)),p95FrameMs:[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)],frames:frames.length,pass:true});
    await context.close();
    const desktop=await browser.newContext({viewport:{width:1280,height:900}});await fixture(desktop,{reciprocal:true});const desktopPage=await desktop.newPage();await desktopPage.goto(`${base}/discover`);await desktopPage.locator('[data-top-card="true"]').waitFor();
    const sidebar=desktopPage.getByText('Your nights',{exact:true}).locator('..').locator('[role="list"]');
    assert.equal(await sidebar.locator('[role="listitem"]').count(),9);assert(await sidebar.evaluate(e=>e.scrollWidth===e.clientWidth));
    await desktopPage.screenshot({path:path.join(artifacts,'discover-desktop.png'),fullPage:true});
    await desktopPage.getByRole('button',{name:/^Show interest in /}).click();await desktopPage.getByRole('dialog',{name:"It's a Garba Match!"}).waitFor();assert(await desktopPage.getByRole('link').filter({hasText:'Say hello'}).getAttribute('href')==='/chat/test-match');
    results.push({check:'desktop all 9 nights + reciprocal match/chat target',pass:true});await desktop.close();
    const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await fixture(reduced);const rp=await reduced.newPage();await rp.goto(`${base}/discover`);await rp.locator('[data-top-card="true"]').waitFor();const passed=await topId(rp);await rp.getByRole('button',{name:/^Pass on /}).last().click();await waitNext(rp,passed);await rp.waitForFunction(id=>JSON.parse(localStorage.getItem('garbamate_passes')||'[]').some(row=>row.to_user===id),passed);const rid=await topId(rp);await rp.evaluate(()=>localStorage.setItem('garbamate_likes','{}'));await rp.getByRole('button',{name:/^Show interest in /}).click();await rp.getByText('Couldn’t save that decision. Please try again.').waitFor();assert.equal(await topId(rp),rid);results.push({check:'reduced-motion fade + failed mutation rollback',pass:true});await reduced.close();
  } finally {fs.writeFileSync(path.join(artifacts,'verification-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
