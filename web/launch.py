"""Start in the background, then open the local studio."""
import os, subprocess, sys, time, urllib.request, json
from pathlib import Path
root=Path(__file__).resolve().parent
port=int(os.environ.get('PORT','8765'))
url='http://localhost:'+str(port)
def running():
    try:
        with urllib.request.urlopen(url+'/api/health',timeout=2) as r:
            return json.load(r).get('local') is True
    except Exception: return False
if not running():
    with (root/'server.log').open('a') as log:
        process=subprocess.Popen([sys.executable,str(root/'server.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
        (root/'server.pid').write_text(str(process.pid))
    for _ in range(30):
        if running(): break
        time.sleep(.2)
    else: raise SystemExit('启动失败，请查看 '+str(root/'server.log'))
subprocess.run(['open',url],check=False)
print('Rhino Studio 已就绪：'+url)
