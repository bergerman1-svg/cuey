"""Every button, every outcome (Ron's standard 8): what a customer gets when they click, not only that nothing crashes.
Runs the real landing pages offline (external requests blocked) as several computers / phones, in English and Hebrew."""
import asyncio, os, re
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DOCS = 'file://' + ROOT + '/docs/'
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))

UA = {
 'win': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
 'mac-safari': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
 'linux': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
 'iphone': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
}
# Safari has no navigator.userAgentData; Chromium does — remove it to imitate Safari
NO_UAD = "Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>undefined,configurable:true})"

async def page(b, ua, path, phone=False, safari=False):
    ctx = await b.new_context(user_agent=UA[ua], viewport={'width': 390, 'height': 844} if phone else {'width': 1440, 'height': 900}, is_mobile=phone, has_touch=phone)
    await ctx.route(re.compile(r'^https?://'), lambda r: r.abort())
    if safari: await ctx.add_init_script(NO_UAD)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(DOCS + path); await pg.wait_for_timeout(900)
    return ctx, pg, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        for lang, path in (('en', 'index.html'), ('he', 'he/index.html')):
            L = f'[{lang}] '
            # downloads: the right file for each computer
            for ua, want, safari in (('win', 'Cuey-windows.exe', False), ('mac-safari', 'Cuey-mac-universal.dmg', True), ('linux', 'app/?lang=' + lang, False)):
                ctx, pg, errs = await page(b, ua, path, safari=safari)
                h = await pg.evaluate("document.getElementById('dlMain').getAttribute('href')")
                ok(L + f'main download on {ua} → {want}', h.endswith(want), h)
                if ua == 'linux':
                    ok(L + 'Linux: button says it opens in the browser, no download', not await pg.evaluate("document.getElementById('dlMain').hasAttribute('download')"))
                ok(L + f'{ua}: no page errors', not errs, errs); await ctx.close()
            # every hidden element is really hidden; the Hebrew page never sends people to the English site
            ctx, pg, errs = await page(b, 'win', path)
            leak = await pg.evaluate("[...document.querySelectorAll('[hidden]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id||e.className)")
            ok(L + 'every [hidden] element is hidden', not leak, leak)
            if lang == 'he':
                en = await pg.evaluate("[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/^https:\\/\\/cuey\\.live\\/(?!he\\/)/.test(h)&&!/\\/(he\\/)?(privacy|terms)/.test(h))")
                ok(L + 'no links to the English site', not en, en)
            plans = await pg.evaluate("[...document.querySelectorAll('.plan a.btn')].map(a=>a.getAttribute('href'))")
            ok(L + 'Try Studio / Try Pro tell the app which plan', any('plan=studio' in h for h in plans) and any('plan=pro' in h for h in plans), plans)
            await ctx.close()
            # phone: no installer downloads offered; "email me the link" sends from Cuey (form), not the visitor's mail app
            ctx, pg, errs = await page(b, 'iphone', path, phone=True, safari=True)
            vis = await pg.evaluate("[...document.querySelectorAll('a[download],a[href$=\".dmg\"],a[href$=\".exe\"]')].filter(a=>{const r=a.getBoundingClientRect();return getComputedStyle(a).display!=='none'&&a.offsetParent&&r.width>0}).map(a=>a.textContent.trim())")
            ok(L + 'phone: no installer download links visible', not vis, vis)
            mail = pg.locator('[data-mail]').first
            await mail.scroll_into_view_if_needed(); url0 = pg.url
            await mail.click(); await pg.wait_for_timeout(400)
            ok(L + 'phone: "email me the link" opens Cuey\'s own form', await pg.evaluate("!!document.querySelector('form.mf input[type=email]')") and pg.url == url0)
            wide = await pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            ok(L + 'phone: no sideways scroll', wide <= 1, wide)
            over = await pg.evaluate("[...document.querySelectorAll('.btn')].filter(b=>b.offsetParent&&b.scrollWidth>b.clientWidth+2).map(b=>b.textContent.trim().slice(0,30))")
            ok(L + 'phone: no button text runs out of its button', not over, over)
            ok(L + 'phone: no page errors', not errs, errs); await ctx.close()
        # desktop sign-in page: one Google button at most
        ctx = await b.new_context(); await ctx.route(re.compile(r'^https?://'), lambda r: r.abort()); pg = await ctx.new_page()
        await pg.goto(DOCS + 'app/desktop-signin.html?port=5000&state=' + 'a' * 48 + '&lang=he'); await pg.wait_for_timeout(1500)
        n = await pg.evaluate("[...document.querySelectorAll('#alt,#gsi > *')].filter(e=>getComputedStyle(e).display!=='none'&&e.offsetParent).length")
        ok('desktop sign-in: at most one Google button', n <= 1, n)
        await pg.goto(DOCS + 'app/desktop-signin.html?port=1&state=x&lang=en'); await pg.wait_for_timeout(600)
        ok('desktop sign-in, broken link: no button to press', await pg.evaluate("getComputedStyle(document.getElementById('alt')).display==='none'"))
        await ctx.close(); await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
