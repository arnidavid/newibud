"""Staðbundinn vefþjónn fyrir prófanir: eins og `python3 -m http.server`, en skilar index.html
fyrir síðuslóðir (/eign/…, /gata/…, /skorradalur o.s.frv.) eins og nginx á VPS gerir
(sjá verkfaeri/nginx_slodir.conf).

Keyrsla (úr rót geymslunnar):  python3 verkfaeri/thjonn.py [port]   (sjálfgefið 8000)
"""
import http.server
import re
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
SIDUR = re.compile(r'^/(?:(?:eign|gata)/.+|(?:yfirlit|hofud|akureyri|reykjanesbaer|selfoss|akranes|'
                   r'skorradalur|grimsnes|blaskogabyggd|markadshiti|verdmat)/?)$')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROT), **kw)

    def do_GET(self):
        if SIDUR.match(self.path.split('?', 1)[0]):
            self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
