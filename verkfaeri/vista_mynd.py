"""Lítill vefþjónn til að endurgera deilimynd.png úr verkfaeri/deilimynd.html.

Keyra úr rót geymslunnar:  python3 verkfaeri/vista_mynd.py   (hlustar á localhost:8002)
Opna svo í vafra:          http://localhost:8002/verkfaeri/deilimynd.html?vista=/vista
Síðan teiknar myndina á canvas og sendir PNG með POST á /vista, sem vistar hana sem deilimynd.png.
Þjónar aðeins localhost og skrifar aðeins þessa einu skrá.
"""
import http.server
import pathlib

ROT = pathlib.Path(__file__).resolve().parent.parent
MARK = ROT / 'deilimynd.png'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROT), **kw)

    def do_POST(self):
        if self.path != '/vista':
            self.send_error(404)
            return
        gogn = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if not gogn.startswith(b'\x89PNG'):
            self.send_error(400, 'Ekki PNG')
            return
        MARK.write_bytes(gogn)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f'Vistað: {MARK.name}, {len(gogn)} bæti'.encode())


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', 8002), Handler).serve_forever()
