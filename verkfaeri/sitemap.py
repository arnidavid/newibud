"""Býr til sitemap.xml og robots.txt fyrir leitarvélar.

sitemap.xml: forsíða, flipar og ein síða á hverja götu með a.m.k. 3 sölur (/gata/<postnr>/<gata>).
Eignasíður (/eign/<fastanúmer>) eru ekki taldar upp: leitarvélar finna þær gegnum tenglana á götusíðunum.

Les kaupskrána með opinbera lyklinum (sama og vefurinn, úr api.js). Keyrsla úr rót geymslunnar:
    python3 verkfaeri/sitemap.py
Keyra aftur öðru hvoru (t.d. mánaðarlega) og commit-a breytingarnar.
"""
import json
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path
from xml.sax.saxutils import escape

ROT = Path(__file__).resolve().parent.parent
VEFUR = 'https://sumar.silfran.com'
api = (ROT / 'api.js').read_text(encoding='utf-8')
BASE = re.search(r"BASE_URL = '([^']+)'", api).group(1)
KEY = re.search(r"ANON_KEY = '([^']+)'", api).group(1)
FLIPAR = ['hofud', 'akureyri', 'reykjanesbaer', 'selfoss', 'akranes', 'skorradalur', 'grimsnes',
          'blaskogabyggd', 'markadshiti', 'verdmat']
TEGUNDIR = ['Fjölbýli', 'Sérbýli', 'Einbýli', 'Sumarhús']   # tegund=in.(…) virkar ekki → ein í einu
MIN_SOLUR = 3


def saekja(params):
    url = f"{BASE}/kaupskra?{urllib.parse.urlencode(params, safe='(),.')}"
    req = urllib.request.Request(url, headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    for tilraun in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:                       # tímamörk undir álagi → reyna aftur
            if tilraun == 3:
                raise
            print(f'  endurtilraun ({e})')
            time.sleep(2 + tilraun * 3)


gotur = Counter()
for teg in TEGUNDIR:
    sidasta = None                                   # id er uuid → síða eftir síðu raðað á id
    while True:
        params = {'select': 'id,postnr,gata,kaupverd,einflm,onothaefur_samningur', 'tegund': f'eq.{teg}',
                  'order': 'id', 'limit': 1000}
        if sidasta:
            params['id'] = f'gt.{sidasta}'
        rows = saekja(params)
        if not rows:
            break
        for r in rows:
            if (r['gata'] and r['postnr'] and r['onothaefur_samningur'] != '1'
                    and (r['kaupverd'] or 0) > 0 and (r['einflm'] or 0) > 0):
                gotur[(r['postnr'], r['gata'])] += 1
        sidasta = rows[-1]['id']
    print(f'{teg}: {sum(gotur.values())} sölur samtals, {len(gotur)} götur')

slodir = ['/'] + [f'/{f}' for f in FLIPAR]
slodir += [f"/gata/{p}/{urllib.parse.quote(g)}" for (p, g), n in sorted(gotur.items()) if n >= MIN_SOLUR]

xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
xml += [f'  <url><loc>{escape(VEFUR + s)}</loc></url>' for s in slodir]
xml.append('</urlset>')
(ROT / 'sitemap.xml').write_text('\n'.join(xml) + '\n', encoding='utf-8')
(ROT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {VEFUR}/sitemap.xml\n', encoding='utf-8')
print(f'sitemap.xml: {len(slodir)} slóðir ({len(slodir) - len(FLIPAR) - 1} götur með ≥{MIN_SOLUR} sölur)')
