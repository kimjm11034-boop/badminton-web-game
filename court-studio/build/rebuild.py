import gzip,json
from pathlib import Path
from subprocess import run
import sys
home=Path(__file__).resolve().parents[1];root=home.parent;cache=root/'.cache/court-studio'
cache.mkdir(parents=True,exist_ok=True)
with gzip.open(home/'build/source-motion.json.gz','rt',encoding='utf8') as f:inputs=json.load(f)
for key,value in inputs.items():
 (cache/(key+'.json')).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
for command in [[sys.executable,'-X','utf8','court-studio/build/proportions.py'],['node','court-studio/build/bake.mjs'],[sys.executable,'-X','utf8','court-studio/build/character.py'],[sys.executable,'-X','utf8','court-studio/build/verify.py']]:
 run(command,cwd=root,check=True)
