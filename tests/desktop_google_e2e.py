"""Desktop 'Continue with Google' loop, without Electron or Google:
- runs main.js under Node with a stand-in 'electron' module, calls the real 'google-signin' handler;
- opens the real sign-in page (docs/app/desktop-signin.html) the way Google/Supabase would return to it (session in the address);
- checks the session arrives at the handler, a wrong state is refused, and the app button uses the native bridge."""
import asyncio, json, os, re, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))

HARNESS = r"""
const Module=require('module');const path=require('path');
const handlers={};let opened=null;
const fake={app:{whenReady:()=>new Promise(()=>{}),on(){},getPath:()=>require('os').tmpdir(),getVersion:()=>'0',setAsDefaultProtocolClient(){},requestSingleInstanceLock:()=>true,focus(){},quit(){}},
 BrowserWindow:function(){},screen:{getAllDisplays:()=>[],on(){},removeListener(){}},Menu:{setApplicationMenu(){},buildFromTemplate:()=>({})},
 shell:{openExternal:(u)=>{opened=u;process.stdout.write(JSON.stringify({opened:u})+'\n')}},
 ipcMain:{handle:(n,f)=>{handlers[n]=f},on(){}},dialog:{},session:{defaultSession:{webRequest:{onHeadersReceived(){}},setPermissionRequestHandler(){}}}};
const orig=Module._load;Module._load=function(r,...a){if(r==='electron')return fake;return orig.call(this,r,...a)};
process.env.CUEY_SIGNIN_PAGE='file://__ROOT__/docs/app/desktop-signin.html';
try{require('__ROOT__/main.js')}catch(e){process.stdout.write(JSON.stringify({loadError:String(e)})+'\n')}
handlers['google-signin']({}, {lang:'he'}).then(r=>{process.stdout.write(JSON.stringify({result:r})+'\n');process.exit(0)});
"""

def start_handler():
    js = HARNESS.replace('__ROOT__', ROOT)
    p = subprocess.Popen(['node', '-e', js], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    first = json.loads(p.stdout.readline())
    return p, first

async def main():
    # 1) the handler opens the sign-in page with a port and a 48-hex state
    p, first = start_handler()
    url = first.get('opened', '')
    ok('main.js loads with the new handler', 'loadError' not in first, first)
    m = re.search(r'\?port=(\d+)&state=([0-9a-f]{48})&lang=he$', url)
    ok('opens the sign-in page with port + random state + language', bool(m), url)
    port, state = int(m.group(1)), m.group(2)
    # 2) a wrong state is refused
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{port}/done', data=b'state=' + b'0' * 48 + b'&access_token=x&refresh_token=y', method='POST')
        code = urllib.request.urlopen(req, timeout=5).status
    except urllib.error.HTTPError as e:
        code = e.code
    ok('a wrong state is refused (400)', code == 400, code)
    # 3) the sign-in page, coming back from Google with a session, hands it to the app
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--allow-file-access-from-files'])
        ctx = await b.new_context()
        await ctx.route(re.compile(r'^https://'), lambda r: r.abort())  # no Google / Supabase here
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url + '#access_token=AT123&refresh_token=RT456&expires_in=3600&token_type=bearer')
        await pg.wait_for_url(re.compile(r'127\.0\.0\.1'), timeout=8000)
        await pg.wait_for_timeout(800)
        txt = await pg.evaluate('document.body.innerText')
        ok('browser lands on the local page and shows "signed in"', 'Signed in' in txt and 'התחברתם' in txt, txt)
        ok('tokens are not left in the address bar', 'AT123' not in pg.url, pg.url)
        line = p.stdout.readline(); p.wait(timeout=10)
        r = json.loads(line).get('result', {})
        ok('handler receives the session', r.get('access_token') == 'AT123' and r.get('refresh_token') == 'RT456' and r.get('expires_in') == 3600, r)
        ok('sign-in page: no errors', not errs, errs)
        # 4) a bad link shows a clear message and goes nowhere
        await pg.goto('file://' + ROOT + '/docs/app/desktop-signin.html?port=1&state=zz&lang=en'); await pg.wait_for_timeout(500)
        ok('a broken link says so', 'isn’t valid' in await pg.evaluate("document.getElementById('msg').textContent"))
        # 5) the app: in the desktop app the Google button shows and uses the bridge
        app = await ctx.new_page(); aerr = []
        app.on('pageerror', lambda e: aerr.append(str(e)))
        await app.add_init_script("""window.cueyNative={platform:'darwin',onMenu(){},setLang(){},setRecent(){},watchDownloads(){},onDownloaded(){},
          googleSignIn:(l)=>{window.__gl=l;return new Promise(r=>setTimeout(()=>r({access_token:'AT9',refresh_token:'RT9',expires_in:3600}),400))},googleCancel(){}}""")
        await app.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=he'); await app.wait_for_timeout(900)
        await app.evaluate("openAcct()"); await app.wait_for_timeout(300)
        ok('desktop: "Continue with Google" is shown', await app.evaluate("!$('#acGoogle').hidden"))
        await app.evaluate("$('#acGoogle').click()"); await app.wait_for_timeout(150)
        ok('desktop: button says to finish in the browser', 'ממשיכים בדפדפן' in await app.evaluate("$('#acGoogle').textContent"))
        await app.wait_for_timeout(1200)
        ok('desktop: language passed to the bridge', await app.evaluate("window.__gl") == 'he')
        ok('desktop: session saved after sign-in', await app.evaluate("!!(sess&&sess.at==='AT9'&&sess.rt==='RT9')"))
        ok('desktop: button text restored', 'Google' in await app.evaluate("$('#acGoogle').textContent"))
        ok('app: no page errors', not aerr, aerr)
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')

asyncio.run(main())
