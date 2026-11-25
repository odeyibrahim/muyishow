import sys,os,json
sys.path.insert(0,os.path.dirname(__file__))
from serve import start
from playwright.sync_api import sync_playwright
start(); B='http://127.0.0.1:8099'
STUB="""
window.__calls=[];
window.supabase={createClient:function(){
 var rows=[{key:'hero',value:Object.assign({},window.MSCO_DEFAULT.hero,{title:'Saved *earlier*'})}];
 var q=function(t){var o={select:function(){return o},eq:function(){return o},maybeSingle:function(){return Promise.resolve({data:{role:'admin',email:'a@b.c'}})},
  then:function(f){return Promise.resolve({data:t==='site_content'?rows:[]}).then(f)},
  upsert:function(v){window.__calls.push(v);return Promise.resolve({})}};return o};
 return {auth:{onAuthStateChange:function(){},getSession:function(){return Promise.resolve({data:{session:{user:{id:'11111111-1111-1111-1111-111111111111',email:'a@b.c'},access_token:'t'}}})},
  getUser:function(){return Promise.resolve({data:{user:{id:'x',email:'a@b.c'}}})},signOut:function(){return Promise.resolve()},signInWithPassword:function(){return Promise.resolve({data:{user:{id:'x'}}})}},
  from:q,storage:{from:function(){return {upload:function(){return Promise.resolve({})},getPublicUrl:function(){return {data:{publicUrl:'x'}}}}}}}}};
"""
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(vp=(1440,900),mob=False,cfg=False):
        ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]},is_mobile=mob,has_touch=mob); pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        def route(r):
            u=r.request.url
            if u.startswith(B):
                if cfg and u.endswith('/assets/js/config.js'): return r.fulfill(body="window.MSCO_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k'}",content_type='text/javascript')
                return r.continue_()
            if 'x.supabase.co/rest/v1/site_content' in u: return r.fulfill(body=json.dumps([{'key':'hero','value':dict(json.load(open('/tmp/hero.json')),title='Edited *live*')}]),content_type='application/json')
            if 'supabase.min.js' in u: return r.fulfill(body=STUB,content_type='text/javascript')
            r.abort()
        pg.route('**/*',route); return pg
    import subprocess
    open('/tmp/hero.json','wb').write(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('/home/claude/work/site/assets/js/content.default.js').hero))"]))
    # --- public site, desktop
    pg=page(); pg.goto(B+'/'); pg.wait_for_timeout(2600)
    print('hero words visible after load:',pg.evaluate("[...document.querySelectorAll('.hero .wd>i')].every(i=>getComputedStyle(i).transform==='none'||getComputedStyle(i).transform==='matrix(1, 0, 0, 1, 0, 0)')"))
    pg.click('.dn a[href="#counsel"]'); pg.wait_for_timeout(1500); print('scrolled to counsel:',pg.evaluate("Math.abs(document.getElementById('counsel').getBoundingClientRect().top-64)<30"),'hash',pg.evaluate('location.hash'))
    pg.click('.cr2 >> nth=4'); pg.wait_for_timeout(300); print('dialog open:',pg.evaluate("document.getElementById('dlg').open"),'text has Figbele',pg.evaluate("document.getElementById('dlg-c').textContent.includes('Figbele')"))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); print('dialog closed:',pg.evaluate("!document.getElementById('dlg').open"))
    pg.evaluate("location.hash='#privacy'"); pg.wait_for_timeout(300); print('privacy dialog:',pg.evaluate("document.getElementById('dlg').open"));pg.keyboard.press('Escape')
    pg.evaluate("document.getElementById('firm').scrollIntoView()"); pg.wait_for_timeout(300)
    pg.click('#firm [data-tab=abuja]'); print('tab abuja:',pg.evaluate("!document.querySelector('[data-pane=abuja]').hidden && document.querySelector('[data-pane=legacy]').hidden"))
    pg.click('a[data-open-tab=referral]'); pg.wait_for_timeout(1200); print('referral tab:',pg.evaluate("!document.querySelector('[data-pane=referral]').hidden"))
    pg.click('#contact [data-tab=enquiry]'); pg.click('#contact form[name=Enquiry] button'); print('validation msg:',pg.inner_text('#contact form[name=Enquiry] .fm')[:50])
    pg.fill('form[name=Enquiry] [name=Name]','T');pg.fill('form[name=Enquiry] [name=Email]','t@t.co');pg.fill('form[name=Enquiry] [name=Message]','hi'); pg.click('#contact form[name=Enquiry] button'); pg.wait_for_timeout(500); print('submit msg:',pg.inner_text('#contact form[name=Enquiry] .fm')[:60])
    # --- mobile menu
    pm=page((390,844),True); pm.goto(B+'/'); pm.wait_for_timeout(800)
    pm.click('#mb'); pm.wait_for_timeout(800); print('menu open:',pm.evaluate("document.getElementById('nv').classList.contains('open')"))
    pm.click('#nv a[href="#principal"]'); pm.wait_for_timeout(1200); print('menu closed + at principal:',pm.evaluate("!document.getElementById('nv').classList.contains('open')"),pm.evaluate("Math.abs(document.getElementById('principal').getBoundingClientRect().top-64)<40"))
    print('principal image sticky?',pm.evaluate("getComputedStyle(document.querySelector('.pf')).position"))
    # --- live content from supabase
    pl=page(cfg=True); pl.goto(B+'/'); pl.wait_for_timeout(2000); print('live swap h1:',pl.inner_text('h1'))
    # --- admin
    pa=page(cfg=True); pa.goto(B+'/admin'); pa.wait_for_timeout(2000)
    print('admin shown:',pa.evaluate("!document.getElementById('ed').hidden"),'who:',pa.inner_text('#who'))
    print('form title value:',pa.input_value('[data-p=title]'))
    pa.fill('[data-p=title]','Counsel with a *long* memory'); pa.wait_for_timeout(900)
    fr=pa.frame_locator('#pv'); print('preview h1:',fr.locator('h1').inner_text())
    print('state:',pa.inner_text('#state')); pa.click('#b-sv'); pa.wait_for_timeout(500)
    calls=pa.evaluate('window.__calls'); print('upsert:',calls[0]['key'],calls[0]['value']['title'])
    pa.select_option('#sel','what') if pa.is_visible('#sel') else pa.click('#nav button[data-k=what]')
    pa.wait_for_timeout(300); n=pa.locator('.it').count(); pa.click('[data-act=add]'); print('list add:',n,'->',pa.locator('.it').count())
    pa.click('#nav button[data-k=facts]') if pa.is_visible('#nav') else None; pa.wait_for_timeout(300); print('root list items:',pa.locator('.it').count())
    pa.close()
    print('errs',errs); b.close()
