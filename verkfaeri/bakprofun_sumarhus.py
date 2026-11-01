#!/usr/bin/env python3
"""Bakprófun á verðmati sumarhúsa: núverandi aðferð á móti matssvæðum og eiginleikum úr gagnasafni HMS.

Les aðeins – breytir engu í gagnagrunninum. Hver sala er metin eingöngu úr sölum á undan henni.

    python3 verkfaeri/bakprofun_sumarhus.py <Gagnasafn sumarhúsamat.xlsx> [skyndiminni.json]
"""
import bisect, collections as C, datetime, json, math, os, re, statistics as st, sys
import urllib.parse, urllib.request, zipfile
import xml.etree.ElementTree as ET

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
SLOD = 'https://nzuwplawwnlnjnbdpmei.supabase.co/rest/v1/kaupskra?'
DALKAR = 'id,faerslunumer,fastnum,thinglystdags,kaupverd,fasteignamat_gildandi,einflm,postnr,svfn,gata,onothaefur_samningur'
EIGINLEIKAR = ['hitaveita', 'eignarlod', 'vid_vatn', 'husgogn']
GLUGGI = 730  # dagar, eins og get_verdmat


def lesa_xlsx(slod):
    z = zipfile.ZipFile(slod)
    ss = [''.join(t.text or '' for t in si.iter(M + 't'))
          for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(M + 'si')]
    hdr, rows = None, []
    for r in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).find(M + 'sheetData').findall(M + 'row'):
        d = {}
        for c in r.findall(M + 'c'):
            v = c.find(M + 'v')
            if v is not None:
                d[re.match(r'[A-Z]+', c.get('r')).group()] = ss[int(v.text)] if c.get('t') == 's' else v.text
        if hdr is None:
            hdr = d
        else:
            rows.append({hdr[k]: v for k, v in d.items() if k in hdr})
    return rows


def saekja_kaupskra(skyndi):
    if skyndi and os.path.exists(skyndi):
        return json.load(open(skyndi, encoding='utf8'))
    txt = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api.js'), encoding='utf8').read()
    key = re.search(r'eyJ[\w\-]+\.[\w\-]+\.[\w\-]+', txt).group()
    # Röðun rennur út á tíma og síður án röðunar skarast – því nokkrar umferðir þar til allt er komið
    db = {}
    for _ in range(12):
        off = 0
        while True:
            q = urllib.parse.urlencode([('select', DALKAR), ('tegund', 'eq.Sumarhús'), ('limit', 500), ('offset', off)])
            req = urllib.request.Request(SLOD + q, headers={'apikey': key, 'Authorization': 'Bearer ' + key})
            b = json.load(urllib.request.urlopen(req, timeout=60))
            for d in b:
                db[d['id']] = d
            off += len(b)
            if len(b) < 500:
                break
        if len(db) >= off:
            break
    db = list(db.values())
    if skyndi:
        json.dump(db, open(skyndi, 'w', encoding='utf8'))
    return db


def tala(x):
    return str(int(float(x))) if x not in (None, '') else None


def ordinal(s):
    return datetime.date.fromisoformat(s[:10]).toordinal()


def maeling(pairs):
    sk = [abs(m / k - 1) for m, k in pairs]
    return {'n': len(sk), 'midgildi': st.median(sk), 'innan20': sum(x <= .2 for x in sk) / len(sk),
            'innan30': sum(x <= .3 for x in sk) / len(sk),
            'halli': st.median(m / k - 1 for m, k in pairs)}


def main():
    hms = lesa_xlsx(sys.argv[1])
    db = saekja_kaupskra(sys.argv[2] if len(sys.argv) > 2 else None)
    print('kaupskrá sumarhús', len(db), '· gagnasafn', len(hms))

    f2h = {tala(r['fastnum']): int(r['hverfi']) for r in hms}
    g = C.defaultdict(C.Counter)
    for d in db:
        h = f2h.get(tala(d['fastnum']))
        if h and d['gata']:
            g[(d['postnr'], d['gata'])][h] += 1
    eftir_faerslu = {tala(r['faerslunumer']): r for r in hms}

    sala = []
    for d in db:
        if str(d['onothaefur_samningur']) == '1' or not d['thinglystdags']:
            continue
        kv, mat, m2 = d['kaupverd'], d['fasteignamat_gildandi'], d['einflm']
        if not (kv and mat and m2 and mat > 0 and m2 > 0 and 10 <= kv / m2 <= 2000):
            continue
        fn = tala(d['fastnum'])
        h = f2h.get(fn)
        if h is None and (d['postnr'], d['gata']) in g:
            h = g[(d['postnr'], d['gata'])].most_common(1)[0][0]
        rr = eftir_faerslu.get(tala(d['faerslunumer']))
        sala.append({'o': ordinal(d['thinglystdags']), 'dags': d['thinglystdags'][:10], 'kv': kv, 'mat': mat, 'm2': m2,
                     'postnr': d['postnr'], 'svfn': d['svfn'], 'h': h, 'r': kv / mat, 'hms': rr})
    sala.sort(key=lambda s: s['o'])
    ordin = [s['o'] for s in sala]

    def prof(fra, til):
        return [s for s in sala if s['hms'] and fra <= s['dags'] <= til
                and s['hms'].get('nybygging') == '0' and s['hms'].get('tegsolu') != '1'
                and s['hms'].get('milli_skyldra') == '0' and s['hms'].get('seldadhluta') == '0']

    def thjalfun(s):
        i = bisect.bisect_left(ordin, s['o'] - GLUGGI)
        j = bisect.bisect_left(ordin, s['o'])
        return [t for t in sala[i:j] if 0.5 <= t['r'] <= 2]

    def stig_mat(s, t, stig, lagmark):
        for lykill in stig:
            r = [x['r'] for x in t if x[lykill] == s[lykill] and s[lykill] is not None]
            if len(r) >= lagmark:
                return st.median(r), lykill
        return (st.median(x['r'] for x in t) if t else None), 'landid'

    def stuflar(t, stig):
        """Leiðrétting fyrir eiginleika, lærð úr fyrri sölum: miðgildi log(r) innan svæðis, með/án."""
        ut = {}
        tt = [x for x in t if x['hms']]
        for e in EIGINLEIKAR:
            hop = C.defaultdict(lambda: {0: [], 1: []})
            for x in tt:
                hop[x[stig]][1 if float(x['hms'].get(e, 0) or 0) > 0 else 0].append(math.log(x['r']))
            ds, w = [], []
            for v in hop.values():
                if len(v[0]) >= 2 and len(v[1]) >= 2:
                    ds.append(st.median(v[1]) - st.median(v[0]))
                    w.append(min(len(v[0]), len(v[1])))
            ut[e] = sum(a * b for a, b in zip(ds, w)) / sum(w) if sum(w) >= 30 else 0
        return ut

    for nafn, fra, til in [('Allur glugginn, 2024-03 → 2026-02', '2024-03-01', '2026-02-28'),
                           ('Síðustu 12 mán. gagnasafns', '2025-03-01', '2026-02-28')]:
        P = prof(fra, til)
        nid = C.defaultdict(list)
        notad = C.Counter()
        for s in P:
            t = thjalfun(s)
            if not t:
                continue
            a, _ = stig_mat(s, t, ['postnr', 'svfn'], 25)
            nid['A núverandi: póstnr ≥25 → sveitarfélag'].append((s['mat'] * a, s['kv']))
            b, lyk = stig_mat(s, t, ['h', 'postnr', 'svfn'], 15)
            notad[lyk] += 1
            nid['B matssvæði ≥15 → póstnr → sveitarfélag'].append((s['mat'] * b, s['kv']))
            b2, _ = stig_mat(s, t, ['h', 'postnr', 'svfn'], 8)
            nid['B2 matssvæði ≥8 → póstnr → sveitarfélag'].append((s['mat'] * b2, s['kv']))
            f = stuflar(t, 'h')
            lei = sum(f[e] * (float(s['hms'].get(e, 0) or 0) > 0) - f[e] * sum(
                float(x['hms'].get(e, 0) or 0) > 0 for x in t if x['hms']) / max(sum(1 for x in t if x['hms']), 1)
                for e in EIGINLEIKAR)
            nid['C B + leiðrétting fyrir eiginleika'].append((s['mat'] * b * math.exp(lei), s['kv']))
            nid['D fasteignamat eitt og sér (gildandi)'].append((s['mat'], s['kv']))
            fmat = float(s['hms'].get('fmat', 0) or 0)
            if fmat:
                nid['E mat 2027 í gagnasafni eitt og sér'].append((fmat, s['kv']))
        print('\n' + nafn, '· prófsölur', len(P), '· stig B', dict(notad))
        for k in sorted(nid):
            m = maeling(nid[k])
            print(f"  {k:<44} n={m['n']:<4} miðgildi {m['midgildi']:.1%}  innan±20 {m['innan20']:.0%}  innan±30 {m['innan30']:.0%}  halli {m['halli']:+.1%}")

    # Síðasta stuðlamat
    t = [x for x in sala if x['hms'] and x['dags'] >= '2024-03-01' and 0.5 <= x['r'] <= 2]
    print('\nStuðlar á fasteignamatið (það sem matið nær EKKI þegar):',
          {e: f'{math.exp(v) - 1:+.1%}' for e, v in stuflar(t, 'h').items()})


if __name__ == '__main__':
    main()
