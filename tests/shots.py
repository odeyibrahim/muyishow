import sys,os
sys.path.insert(0,os.path.dirname(__file__))
from serve import start
from playwright.sync_api import sync_playwright
srv=start()
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,vp,mob in [('m',{'width':390,'height':844},True),('d',{'width':1440,'height':900},False)]:
        ctx=b.new_context(viewport=vp,device_scale_factor=1,is_mobile=mob,has_touch=mob)
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' and 'Failed to load resource' not in m.text and 'ERR_' not in m.text else None)
        pg.route('**/*',lambda r: r.abort() if not r.request.url.startswith('http://127.0.0.1') else r.continue_())
        pg.goto('http://127.0.0.1:8099/'); pg.wait_for_timeout(1500)
        # scroll through so reveals fire
        h=pg.evaluate('document.documentElement.scrollHeight')
        y=0
        while y<h: pg.evaluate(f'scrollTo(0,{y})'); pg.wait_for_timeout(120); y+=500
        pg.evaluate('scrollTo(0,0)'); pg.wait_for_timeout(500)
        print(name,'height',h,'overflowX',pg.evaluate('document.documentElement.scrollWidth>innerWidth'),'hidden-left',pg.evaluate("document.querySelectorAll('.rv:not(.in),.rt:not(.in)').length"))
        print(name,'nav visible',pg.evaluate("getComputedStyle(document.querySelector('.dn')).display"),'menu btn',pg.evaluate("getComputedStyle(document.querySelector('.mb')).display"))
        print(name,'principal pos',pg.evaluate("getComputedStyle(document.querySelector('.pf')).position"))
        pg.screenshot(path=f'/tmp/{name}-full.png',full_page=True)
        print(errs)
        ctx.close()
    b.close()
