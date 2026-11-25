import http.server,socketserver,os,re,threading,sys
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','site')
toml=open(os.path.join(ROOT,'..','netlify.toml')).read()
CSP=re.search(r'Content-Security-Policy = "([^"]+)"',toml).group(1)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def translate_path(s,p):
        p=p.split('?')[0]
        if p=='/admin': p='/admin/index.html'
        return super().translate_path(p)
    def end_headers(s): s.send_header('Content-Security-Policy',CSP); s.send_header('Cache-Control','no-store'); super().end_headers()
    def do_POST(s): s.send_response(200); s.end_headers(); s.wfile.write(b'ok')
    def log_message(s,*a): pass
def start(port=8099):
    socketserver.TCPServer.allow_reuse_address=True
    srv=socketserver.ThreadingTCPServer(('127.0.0.1',port),H); threading.Thread(target=srv.serve_forever,daemon=True).start(); return srv
