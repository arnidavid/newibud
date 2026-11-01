#!/usr/bin/env python3
"""Býr til gagnaskrá fyrir töfluna sumarhus_eiginleikar úr gagnasafni sumarhúsamats (xlsx).

    python3 verkfaeri/sumarhus_eiginleikar.py <Gagnasafn sumarhúsamat.xlsx> > migrations/..._gogn.sql
"""
import importlib.util, os, sys

sl = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bakprofun_sumarhus.py')
sp = importlib.util.spec_from_file_location('bakprofun_sumarhus', sl)
bp = importlib.util.module_from_spec(sp)
sp.loader.exec_module(bp)

nyjast = {}
for r in bp.lesa_xlsx(sys.argv[1]):
    if r['fastnum'] not in nyjast or float(r['utgdag']) > float(nyjast[r['fastnum']]['utgdag']):
        nyjast[r['fastnum']] = r

jn = lambda r, c: float(r.get(c, 0) or 0) > 0
radir = [(f, jn(r, 'eignarlod'), jn(r, 'hitaveita'), jn(r, 'vid_vatn'), int(r['kaup_ar']))
         for f, r in sorted(nyjast.items()) if jn(r, 'eignarlod') or jn(r, 'hitaveita') or jn(r, 'vid_vatn')]
b = lambda x: 't' if x else 'f'
print('insert into public.sumarhus_eiginleikar (fastnum, eignarlod, hitaveita, vid_vatn, sala_ar) values')
print(',\n'.join(f"('{bp.tala(f)}','{b(e)}','{b(h)}','{b(v)}',{a})" for f, e, h, v, a in radir))
print('on conflict (fastnum) do update set eignarlod = excluded.eignarlod, hitaveita = excluded.hitaveita,')
print('  vid_vatn = excluded.vid_vatn, sala_ar = excluded.sala_ar;')
