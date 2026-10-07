// Full browser -> OAuth provider fixture -> Supabase fixture -> SERVER callback.
// Real @supabase/ssr PKCE/cookies, Next middleware and PostgreSQL/RLS are used.
// Google/GoTrue transport is emulated, not a claim of hosted Google verification.
const { chromium, devices } = require('@playwright/test');
const { spawn, spawnSync } = require('child_process');
const https = require('https'), http = require('http'), fs = require('fs'), path = require('path');
const { createHash, createHmac, randomUUID } = require('crypto');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const proxyMode = process.env.GARBA_AUTH_PROXY === '1';
const base = process.env.GARBA_TEST_URL || (proxyMode ? 'https://localhost:55441' : 'http://127.0.0.1:3101');
const nextUrl = proxyMode ? process.env.GARBA_NEXT_TEST_URL || 'http://127.0.0.1:3101' : base;
const authUrl = process.env.GARBA_AUTH_FIXTURE_URL || 'https://localhost:55440';
const artifacts = process.env.GARBA_ARTIFACTS || '/tmp/omnirush/auth-flow';
const certificate = process.env.GARBA_AUTH_CERT || '/tmp/omnirush/auth-flow-fixture.pem';
const privateKey = process.env.GARBA_AUTH_KEY || '/tmp/omnirush/auth-flow-fixture.key';
const database = process.env.GARBA_TEST_DATABASE || 'garba_auth_tests';
assert(database.endsWith('_tests'), 'Only use a disposable _tests database');
assert(['localhost', '127.0.0.1'].includes(new URL(authUrl).hostname), 'Auth fixture must be local');
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Next test host must be local');
assert(['localhost', '127.0.0.1'].includes(new URL(nextUrl).hostname), 'Next upstream must be local');
const psql = process.env.GARBA_PSQL || 'psql';
const pgArgs = ['-h', process.env.GARBA_PGHOST || '/tmp/omnirush', '-p', process.env.GARBA_PGPORT || '55432', '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1'];
const quote = value => value == null ? 'null' : typeof value === 'number' || typeof value === 'boolean' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function sql(statement, actor) {
  const result = spawnSync(psql, [...pgArgs, '-c', (actor ? `set role authenticated;set request.jwt.claim.sub=${quote(actor)};` : '') + statement], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout.trim()) : null;
}
const rows = (query, actor) => sql(`select coalesce(json_agg(t),'[]') from (${query}) t;`, actor);
function initialize() {
  if (!sql("select to_json(to_regclass('public.profiles'))")) {
    for (const file of [path.join(root, 'tests/supabase-bootstrap.sql'), ...fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => /^\d+.*\.sql$/.test(f)).sort().map(f => path.join(root, 'supabase/migrations', f))]) {
      const result = spawnSync(psql, [...pgArgs, '-f', file], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    }
  }
  assert(sql("select to_json(to_regprocedure('public.send_chat_message(uuid,uuid,text,timestamptz)') is not null)"), 'Apply migrations 001–014 first');
}
function reset() {
  sql(`truncate auth.users cascade;insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(${quote(id(2))},'existing.cs24@bmsce.ac.in',now(),'{"first_name":"Existing Dancer"}'),(${quote(id(3))},'partner.cs24@bmsce.ac.in',now(),'{"first_name":"Partner Dancer"}');update profiles set age=24,onboarding_complete=true,has_seen_discover_tutorial=true,styles=array['Traditional Garba'],available_nights=array[1,2,3]::smallint[],interests=array['dance'],looking_for=array['Garba partner'];`);
}
const flows = new Map(), codes = new Map(), refreshTokens = new Map(), emails = new Map(), requests = [], results = [];
let latestEmailLink;
const faults = { profile: false, auth: false, expiredCode: false, tokenNetwork: false, scaffoldName: false, rootCallback: false };
const signingKey = 'local-test-HMAC-key-not-a-production-secret';
function account(actor) {
  const row = rows(`select id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data from auth.users where id=${quote(actor)}`)[0];
  return row ? { id: row.id, email: row.email, email_confirmed_at: row.email_confirmed_at, app_metadata: { provider: 'google', ...row.raw_app_meta_data }, user_metadata: row.raw_user_meta_data, aud: 'authenticated', created_at: '2026-10-07T12:00:00Z' } : null;
}
function session(actor, expiry = Math.floor(Date.now() / 1000) + 3600) {
  const unsigned = [{ alg: 'HS256', typ: 'JWT' }, { sub: actor, role: 'authenticated', aud: 'authenticated', exp: expiry }].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  const access_token = unsigned + '.' + createHmac('sha256', signingKey).update(unsigned).digest('base64url');
  const refresh_token = randomUUID(); refreshTokens.set(refresh_token, actor);
  return { access_token, refresh_token, expires_at: expiry, expires_in: 3600, token_type: 'bearer', user: account(actor) };
}
function actorFromToken(header) {
  try {
    const [head, body, signature] = (header || '').replace(/^Bearer /, '').split('.');
    if (signature !== createHmac('sha256', signingKey).update(`${head}.${body}`).digest('base64url')) return null;
    const claims = JSON.parse(Buffer.from(body, 'base64url'));
    return claims.exp > Date.now() / 1000 ? claims.sub : null;
  } catch { return null; }
}
const encodedSession = value => 'base64-' + Buffer.from(JSON.stringify(value)).toString('base64url');
function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': new URL(base).origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Retry-After': '0' });
  response.end(JSON.stringify(data));
}
function redirect(response, location) { response.writeHead(302, { Location: location }); response.end(); }
function html(response, markup) { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px">${markup}</body></html>`); }
const literal = value => Array.isArray(value) ? `array[${value.map(quote).join(',')}]::${value.every(v => typeof v === 'number') && value.length ? 'smallint' : 'text'}[]` : quote(value);
async function fixture(request, response) {
  const url = new URL(request.url, authUrl), method = request.method;
  if (method === 'OPTIONS') return send(response, 200, {});
  let body = ''; for await (const chunk of request) body += chunk;
  body = body ? JSON.parse(body) : null;
  const name = url.pathname.split('/').pop(), actor = actorFromToken(request.headers.authorization);
  requests.push({ path: url.pathname, grant: url.searchParams.get('grant_type'), actor, method });
  try {
    if (url.pathname === '/auth/v1/authorize') {
      assert.equal(url.searchParams.get('provider'), 'google');
      assert.equal(url.searchParams.get('redirect_to'), base + '/auth/callback');
      assert.equal(url.searchParams.get('code_challenge_method'), 's256');
      const state = randomUUID(); flows.set(state, { challenge: url.searchParams.get('code_challenge'), redirectTo: url.searchParams.get('redirect_to') });
      return redirect(response, `${authUrl}/fixture/google/accounts?state=${state}`);
    }
    if (url.pathname === '/fixture/google/accounts') return html(response, `<h1>Google account selection — test provider</h1><p>Not a live Google sign-in.</p><p><a href="/fixture/google/choose?state=${url.searchParams.get('state')}&actor=${id(1)}">New BMSCE account</a></p><p><a href="/fixture/google/choose?state=${url.searchParams.get('state')}&actor=${id(2)}">Existing BMSCE account</a></p>`);
    if (url.pathname === '/fixture/google/choose') {
      const flow = flows.get(url.searchParams.get('state')); assert(flow); flow.actor = url.searchParams.get('actor'); assert([id(1), id(2)].includes(flow.actor));
      return html(response, `<h1>Allow GarbaMate — test consent</h1><a href="/auth/v1/callback?state=${url.searchParams.get('state')}">Allow</a><p><a href="${base}/auth/callback?error=access_denied">Cancel</a></p>`);
    }
    if (url.pathname === '/auth/v1/callback') {
      const flow = flows.get(url.searchParams.get('state')); assert(flow?.actor);
      if (!account(flow.actor)) sql(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(${quote(flow.actor)},'new.cs24@bmsce.ac.in',now(),${quote(JSON.stringify({ first_name: faults.scaffoldName ? '1BM24CS001' : 'New Dancer' }))});`);
      const code = randomUUID(); codes.set(code, flow);
      return redirect(response, (faults.rootCallback ? base + '/' : flow.redirectTo) + '?code=' + code);
    }
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'pkce') {
        const flow = codes.get(body.auth_code); codes.delete(body.auth_code);
        if (faults.tokenNetwork) { faults.tokenNetwork = false; return send(response, 503, { code: 'unexpected_failure', message: 'Injected Auth network failure' }); }
        if (faults.expiredCode || !flow) { faults.expiredCode = false; return send(response, 400, { code: 'flow_state_expired', message: 'Authorization code expired' }); }
        assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), flow.challenge, 'Server verifier does not match browser PKCE challenge');
        return send(response, 200, session(flow.actor));
      }
      if (grant === 'refresh_token') { const owner = refreshTokens.get(body.refresh_token); assert(owner, 'Invalid refresh token'); return send(response, 200, session(owner)); }
      if (grant === 'password') {
        if (body.password !== 'fixture-valid-password') return send(response, 400, { message: 'Invalid login credentials' });
        return send(response, 200, session(id(2)));
      }
    }
    if (url.pathname === '/auth/v1/user') return send(response, faults.auth ? 503 : actor ? 200 : 401, faults.auth ? { message: 'Injected network failure' } : actor ? account(actor) : { message: 'No session' });
    if (url.pathname === '/auth/v1/logout') return send(response, 200, {});
    if (url.pathname === '/auth/v1/otp') {
      assert.equal(body.email, 'existing.cs24@bmsce.ac.in'); assert.equal(body.code_challenge_method, 's256');
      const token = randomUUID(); emails.set(token, { actor: id(2), challenge: body.code_challenge, redirectTo: url.searchParams.get('redirect_to') });
      latestEmailLink = `${authUrl}/auth/v1/verify?token=${token}&type=magiclink`;
      return send(response, 200, {});
    }
    if (url.pathname === '/auth/v1/verify') {
      const flow = emails.get(url.searchParams.get('token')); assert(flow); emails.delete(url.searchParams.get('token'));
      const code = randomUUID(); codes.set(code, flow); return redirect(response, flow.redirectTo + '?code=' + code);
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      if (!actor && name !== 'get_public_profile_names') return send(response, 401, { message: 'Authentication required' });
      if (name === 'profiles' && method === 'GET' && faults.profile) return send(response, 503, { message: 'Injected profile outage' });
      if (url.pathname.includes('/rpc/')) {
        if (name === 'discover_feed') return send(response, 200, rows(`select * from discover_feed(${quote(body.p_seed)},${quote(body.p_after_key)},${quote(body.p_after_id)}::uuid,${quote(body.p_limit)})`, actor));
        if (name === 'discovery_blocked_ids') return send(response, 200, sql("select coalesce(json_agg(i),'[]') from discovery_blocked_ids() i;", actor));
        if (name === 'mark_discover_tutorial_seen') { sql('select mark_discover_tutorial_seen();', actor); return send(response, 200, null); }
        if (['get_incoming_interests', 'get_public_profile_names', 'get_relationship_notifications', 'get_chat_unread_counts', 'discover_relationships'].includes(name)) return send(response, 200, rows(`select * from ${name}()`, actor));
        throw new Error(`Unsupported RPC ${name}`);
      }
      assert(['profiles', 'matches', 'likes', 'passes', 'blocks', 'admin_users', 'messages'].includes(name), `Unsupported table ${name}`);
      const fields = url.searchParams.get('select') || '*'; assert(/^[a-z_*,]+$/.test(fields));
      const clauses = [];
      for (const [field, value] of url.searchParams) {
        if (/^[a-z_]+$/.test(field) && value.startsWith('eq.')) clauses.push(`${field}=${quote(value.slice(3))}`);
        if (field === 'or') { const options = value.replace(/^\(|\)$/g, '').split(','); assert(options.every(v => /^(user_a|user_b)\.eq\.[0-9a-f-]+$/.test(v))); clauses.push('(' + options.map(v => { const [key, , val] = v.split('.'); return key + '=' + quote(val); }).join(' or ') + ')'); }
      }
      const where = clauses.length ? 'where ' + clauses.join(' and ') : '';
      let data;
      if (method === 'GET') data = rows(`select ${fields} from ${name} ${where}`, actor);
      else if (name === 'profiles' && method === 'POST') {
        const columns = Object.keys(body); assert(columns.every(v => /^[a-z_]+$/.test(v))); assert.equal(body.id, actor);
        const values = columns.map(key => key === 'available_nights' ? `array[${body[key].map(quote).join(',')}]::smallint[]` : literal(body[key]));
        data = sql(`with t as (insert into profiles(${columns.join(',')}) values(${values.join(',')}) on conflict(id) do update set ${columns.filter(key => key !== 'id').map(key => `${key}=excluded.${key}`).join(',')} returning ${fields}) select json_agg(t) from t;`, actor);
      } else throw new Error(`Unsupported ${method} ${name}`);
      return send(response, 200, request.headers.accept?.includes('vnd.pgrst.object') ? data[0] || null : data);
    }
    return send(response, 404, { message: 'Unknown fixture endpoint' });
  } catch (error) { console.error('[auth fixture]', error.message); send(response, 400, { message: error.message }); }
}

async function main() {
  fs.mkdirSync(artifacts, { recursive: true }); initialize();
  const authServer = https.createServer({ cert: fs.readFileSync(certificate), key: fs.readFileSync(privateKey) }, (req, res) => { void fixture(req, res); });
  await new Promise(resolve => authServer.listen(Number(new URL(authUrl).port), resolve));
  let proxy;
  if (proxyMode) {
    proxy = https.createServer({ cert: fs.readFileSync(certificate), key: fs.readFileSync(privateKey) }, (req, res) => {
      const headers = { ...req.headers, host: 'proxy-upstream.invalid:8080', 'x-forwarded-host': 'proxy-upstream.invalid:8080', 'x-forwarded-proto': 'http' };
      const upstream = http.request(new URL(req.url, nextUrl), { method: req.method, headers }, incoming => {
        // Deliberately do NOT repair Location: catch leaks of the internal origin.
        res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res);
      });
      upstream.on('error', error => { console.error('[test reverse proxy]', error.code); res.writeHead(502); res.end('Bad Gateway: local test upstream unavailable'); });
      req.pipe(upstream);
    });
    await new Promise(resolve => proxy.listen(Number(new URL(base).port), resolve));
  }
  const log = fs.openSync(path.join(artifacts, 'next.log'), 'w');
  const next = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start'], { cwd: root, detached: process.platform !== 'win32', env: { ...process.env, PORT: new URL(nextUrl).port, NODE_EXTRA_CA_CERTS: certificate, NEXT_PUBLIC_SUPABASE_URL: authUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'auth-public-fixture-key-not-a-secret' }, stdio: ['ignore', log, log] });
  const launch = { headless: true, executablePath: process.env.GARBA_CHROME_PATH, args: ['--no-sandbox'] };
  let browser;
  const contexts = [];
  let page;
  try {
    for (let i = 0; i < 100; i++) {
      if (next.exitCode !== null) throw new Error('Next server exited; inspect next.log');
      try { if ((await fetch(nextUrl + '/login')).ok) break; } catch { /* startup */ }
      if (i === 99) throw new Error('Next server did not start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch(launch);
    const errors = [], appResponses = [];
    function watch(page) {
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', response => {
        if (new URL(response.url()).origin === new URL(base).origin) appResponses.push({ status: response.status(), path: new URL(response.url()).pathname, location: response.headers().location || null });
      });
    }
    async function setup(width, state) {
      const context = await browser.newContext({ ...(width < 768 ? devices['Pixel 7'] : {}), viewport: { width, height: width < 768 ? 844 : 800 }, ignoreHTTPSErrors: true, storageState: state });
      contexts.push(context);
      await context.routeWebSocket('**/realtime/v1/**', socket => socket.close());
      const page = await context.newPage(); watch(page);
      return { context, page };
    }
    const continueSetup = page => page.getByRole('button', { name: /^Continue/ }).click();
    async function google(page, existing, entry = '/login') {
      await page.goto(base + entry);
      await page.getByRole('button', { name: existing ? /Continue with Google/ : /Sign up with Google/ }).click();
      await page.getByRole('link', { name: existing ? 'Existing BMSCE account' : 'New BMSCE account', exact: true }).click();
      await page.getByRole('link', { name: 'Allow', exact: true }).click();
    }
    reset();
    const anonymous = await setup(390); page = anonymous.page;
    assert.equal((await page.goto(base + '/')).status(), 200);
    assert.equal((await page.goto(base + '/discover')).status(), 200);
    await page.goto(base + '/onboarding'); await page.waitForURL(base + '/login'); await page.getByRole('button', { name: /Continue with Google/ }).waitFor();
    await page.goto(base + '/auth/callback'); await page.waitForURL(base + '/auth/error?reason=callback'); await page.getByRole('heading', { name: 'Unable to sign you in' }).waitFor();
    await anonymous.context.close();
    results.push({ check: 'Anonymous root/Discover respond; direct onboarding requires login; callback with no credentials safely reaches error UI without a gateway failure or loop', pass: true });
    for (const width of [360, 390, 1280]) {
      reset(); requests.length = 0; faults.scaffoldName = width === 360;
      const fresh = await setup(width); page = fresh.page;
      await google(page, false, '/signup'); await page.waitForURL(base + '/onboarding');
      await continueSetup(page);
      const nameInput = page.getByLabel('Your first name or nickname'); await nameInput.waitFor();
      if (width === 360) assert.equal(await nameInput.inputValue(), '', 'Identifier-like scaffold name blocked onboarding or leaked into the name input');
      await nameInput.fill('New Dancer'); await continueSetup(page);
      const input = page.getByLabel('Your age'); await input.waitFor(); assert.equal(await input.inputValue(), ''); assert.equal(await input.getAttribute('inputmode'), 'numeric');
      await page.screenshot({ path: path.join(artifacts, `${width}-age-empty.png`), fullPage: true });
      await input.pressSequentially('2'); assert.equal(await input.inputValue(), '2'); await input.pressSequentially('2'); assert.equal(await input.inputValue(), '22');
      await page.screenshot({ path: path.join(artifacts, `${width}-age-22.png`), fullPage: true });
      await input.press('ControlOrMeta+A'); await input.press('Backspace'); assert.equal(await input.inputValue(), '');
      await input.pressSequentially('e-1.5'); assert.equal(await input.inputValue(), '15'); await input.fill('');
      await continueSetup(page); await page.getByRole('alert').filter({ hasText: 'Please enter your age.' }).waitFor();
      await input.fill('17'); await continueSetup(page); await page.getByRole('alert').filter({ hasText: 'You must be 18 or older to use GarbaMate.' }).waitFor();
      await input.fill('22'); for (let step = 3; step < 10; step++) await continueSetup(page);
      await page.getByRole('button', { name: 'Start discovering →', exact: true }).click(); await page.waitForURL(base + '/discover');
      await page.getByRole('dialog', { name: /How GarbaMate works/ }).getByRole('button', { name: 'Skip tutorial', exact: true }).click();
      await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
      assert.equal(rows(`select age,onboarding_complete from profiles where id=${quote(id(1))}`)[0].age, 22);
      assert.equal(rows(`select onboarding_complete from profiles where id=${quote(id(1))}`)[0].onboarding_complete, true);
      assert.equal(requests.filter(r => r.grant === 'pkce').length, 1, 'Duplicate server/browser exchange');
      assert.equal(await page.getByText(/PKCE code verifier/).count(), 0);
      await page.screenshot({ path: path.join(artifacts, `${width}-new-discover.png`), fullPage: true });
      results.push({ check: `${width}px TEST A/C/D: fresh Google selection/consent, exact PKCE exchange, first-time onboarding, empty → 2 → 22 → empty, minimum age, real UUID profile age=22, Discover`, pass: true });
      await fresh.context.close();

      const existing = await setup(width); page = existing.page;
      const savedProfile = rows(`select * from profiles where id=${quote(id(2))}`)[0];
      await google(page, true); await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
      await page.reload(); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor(); assert.equal(page.url(), base + '/discover');
      for (const [name, destination] of [['Matches', '/matches'], ['Chats', '/chat'], ['Profile', '/profile/me'], ['Discover', '/discover']]) {
        await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name, exact: true }).click(); await page.waitForURL(base + destination); await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor();
      }
      await page.addInitScript(() => { window.__onboardingFlashed = false; new MutationObserver(() => { if (document.querySelector('#age') || [...document.querySelectorAll('h1')].some(n => n.textContent === 'A few quick questions')) window.__onboardingFlashed = true; }).observe(document, { childList: true, subtree: true }); });
      await page.goto(base + '/onboarding'); await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
      assert.equal(await page.evaluate(() => window.__onboardingFlashed), false, 'Existing user saw onboarding while loading');
      assert.deepEqual(rows(`select * from profiles where id=${quote(id(2))}`)[0], savedProfile, 'Existing profile data was changed by login');
      const priorExchanges = requests.filter(r => r.grant === 'pkce').length;
      await page.goto(base + '/auth/callback?code=already-used'); await page.waitForURL(base + '/discover');
      assert.equal(requests.filter(r => r.grant === 'pkce').length, priorExchanges, 'Replay performed a second exchange without a verifier');
      results.push({ check: `${width}px TEST B: existing profile → Discover, refresh, client navigation, no onboarding flash, callback replay recovery, unchanged profile`, pass: true });
      await existing.context.close();
    }

    const signedIn = await setup(390); page = signedIn.page;
    await google(page, true); await page.waitForURL(base + '/discover');
    faults.profile = true; await page.goto(base + '/auth/callback'); await page.waitForURL(base + '/auth/error?reason=profile');
    await page.getByRole('heading', { name: 'You’re signed in', exact: true }).waitFor();
    await page.screenshot({ path: path.join(artifacts, '390-profile-retry.png'), fullPage: true });
    faults.profile = false; await page.getByRole('link', { name: 'Retry profile lookup' }).click(); await page.waitForURL(base + '/discover');
    faults.profile = true; await page.goto(base + '/discover'); await page.getByRole('alert').filter({ hasText: 'couldn’t load your GarbaMate profile' }).waitFor();
    assert(!page.url().includes('/onboarding')); faults.profile = false; await page.getByRole('button', { name: 'Try Again', exact: true }).click(); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
    const expired = session(id(2), Math.floor(Date.now() / 1000) - 60);
    await signedIn.context.addCookies([{ name: 'sb-localhost-auth-token', value: encodedSession(expired), url: base }]);
    const response = await page.goto(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
    assert(requests.some(r => r.grant === 'refresh_token')); assert((await response.allHeaders())['set-cookie']?.includes('sb-localhost-auth-token'));
    results.push({ check: 'Profile outages preserve session with retry; app-load outage never means new user; real middleware refresh writes browser cookie', pass: true });
    await signedIn.context.close();

    const failed = await setup(390); page = failed.page;
    for (const [query, reason] of [['?code=missing-verifier', 'expired'], ['?error=access_denied', 'cancelled'], ['', 'callback']]) {
      await page.goto(base + '/auth/callback' + query); await page.waitForURL(base + '/auth/error?reason=' + reason);
      await page.getByRole('heading', { name: 'Unable to sign you in' }).waitFor(); assert.equal(await page.getByText(/PKCE code verifier not found/).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Try Again', exact: true }).locator('span').evaluate(node => getComputedStyle(node).color), 'rgb(16, 10, 44)');
      await page.screenshot({ path: path.join(artifacts, `390-error-${reason}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Try Again', exact: true }).click(); await page.waitForURL(base + '/login'); await page.getByRole('button', { name: /Continue with Google/ }).waitFor();
    }
    faults.expiredCode = true; await google(page, true); await page.waitForURL(base + '/auth/error?reason=expired');
    faults.tokenNetwork = true; await google(page, true); await page.waitForURL(base + '/auth/error?reason=network');
    results.push({ check: 'Genuine missing verifier, cancelled login, invalid callback, expired authorization code and network failure show branded retry UI', pass: true });
    await failed.context.close();

    const password = await setup(390); page = password.page;
    await page.goto(base + '/login'); await page.getByRole('button', { name: /Password$/, exact: false }).click();
    await page.locator('input[type=email]').fill('existing.cs24@bmsce.ac.in'); await page.locator('input[type=password]').fill('deliberately-wrong-password');
    await page.getByRole('button', { name: 'Sign In with Password', exact: true }).click(); await page.getByText('Invalid login credentials', { exact: true }).waitFor();
    await page.locator('input[type=password]').fill('fixture-valid-password'); await page.getByRole('button', { name: 'Sign In with Password', exact: true }).click();
    await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('garbamate_auth_session')), null); await password.context.close();
    const email = await setup(390); page = email.page;
    await page.goto(base + '/signup'); await page.locator('input[type=email]').fill('outsider@gmail.com');
    const otpBefore = requests.filter(r => r.path === '/auth/v1/otp').length;
    await page.getByRole('button', { name: 'Send Verification Link →', exact: true }).click(); await page.getByText('Please use your verified @bmsce.ac.in college email.', { exact: true }).waitFor();
    assert.equal(requests.filter(r => r.path === '/auth/v1/otp').length, otpBefore);
    await page.locator('input[type=email]').fill('existing.cs24@bmsce.ac.in'); await page.getByRole('button', { name: 'Send Verification Link →', exact: true }).click(); await page.getByText('Check Your Inbox', { exact: true }).waitFor();
    await page.goto(latestEmailLink); await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor(); await email.context.close();
    results.push({ check: 'Existing password provider rejects wrong credentials then restores/routes valid session; college email magic link retains real PKCE callback; outsider email sends no request', pass: true });

    const guest = await setup(390); page = guest.page;
    await page.goto(base + '/onboarding'); await page.waitForURL(base + '/login'); await page.getByRole('button', { name: /Continue with Google/ }).waitFor();
    await guest.context.addCookies([{ name: 'sb-localhost-auth-token', value: encodedSession(session(id(2))), url: base }]);
    await page.goto(base + '/?code=legacy-already-consumed'); await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
    await guest.context.close(); results.push({ check: 'Unauthenticated onboarding goes to login; legacy Site URL callback is forwarded server-side and recovers verified session on original host', pass: true });

    const rootFlow = await setup(390); page = rootFlow.page; faults.rootCallback = true;
    const exchangesBeforeRoot = requests.filter(r => r.grant === 'pkce').length;
    await google(page, true); await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor();
    assert.equal(requests.filter(r => r.grant === 'pkce').length, exchangesBeforeRoot + 1);
    faults.rootCallback = false; await rootFlow.context.close();
    results.push({ check: 'Valid OAuth code returned to legacy root is rewritten internally, exchanged once by the server callback and navigates on the browser origin', pass: true });

    // A real Chromium process restart using its persisted cookie database.
    const persistentDir = fs.mkdtempSync(path.join(artifacts, 'persistent-chrome-'));
    const persistentOptions = { ...launch, ...devices['Pixel 7'], ignoreHTTPSErrors: true };
    let persistent = await chromium.launchPersistentContext(persistentDir, persistentOptions);
    contexts.push(persistent);
    await persistent.routeWebSocket('**/realtime/v1/**', socket => socket.close());
    page = await persistent.newPage(); watch(page); await google(page, true); await page.waitForURL(base + '/discover');
    await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor(); await persistent.close();
    persistent = await chromium.launchPersistentContext(persistentDir, persistentOptions);
    contexts.push(persistent);
    await persistent.routeWebSocket('**/realtime/v1/**', socket => socket.close());
    page = await persistent.newPage(); watch(page); await page.goto(base + '/login'); await page.waitForURL(base + '/discover'); await page.getByRole('textbox', { name: 'Search by name, branch, or style' }).waitFor(); await persistent.close();
    results.push({ check: 'Mobile Chromium process closed/reopened: persistent Supabase cookie restores user and goes directly to Discover', pass: true });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    assert(appResponses.every(r => r.status < 500), 'Next/proxy returned a server or gateway error');
    for (const response of appResponses.filter(r => r.location)) {
      assert(response.location.startsWith('/') && !response.location.startsWith('//'), 'Callback leaked an absolute/internal origin');
      assert.equal(new URL(response.location, base).origin, new URL(base).origin);
    }
    results.push({ check: `${proxyMode ? 'HTTPS reverse proxy forwarding internal HTTP Host:8080' : 'Direct production server'}: all app responses below 500; redirect headers stay on browser origin; no runtime errors`, pass: true });
  } catch (error) { if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); throw error; }
  finally {
    faults.profile = faults.auth = faults.expiredCode = faults.tokenNetwork = faults.scaffoldName = faults.rootCallback = false;
    await Promise.all(contexts.filter(c => !c.pages().every(p => p.isClosed())).map(c => c.close()));
    await browser?.close();
    if (next.exitCode === null && next.signalCode === null) { if (process.platform === 'win32') next.kill(); else process.kill(-next.pid, 'SIGTERM'); }
    if (proxy) await new Promise(resolve => proxy.close(resolve));
    await new Promise(resolve => authServer.close(resolve)); fs.closeSync(log);
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(results, null, 2)); console.log(results);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
