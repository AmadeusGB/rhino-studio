"""Direct MCP diagnostic client for the installed Rhino router."""
import json, subprocess, selectors, time, sys
from pathlib import Path
ROUTER = Path.home() / 'Library/Application Support/McNeel/Rhinoceros/packages/8.0/Rhino-MCP-Platform/0.1.5/router/osx-arm64/rhino-mcp-router'
p = subprocess.Popen([str(ROUTER), '--default-version', '8'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
def request(i, method, params):
    p.stdin.write(json.dumps(dict(jsonrpc='2.0', id=i, method=method, params=params))+'\n'); p.stdin.flush()
    selector = selectors.DefaultSelector(); selector.register(p.stdout, selectors.EVENT_READ)
    deadline = time.monotonic()+90
    try:
        while time.monotonic()<deadline:
            if selector.select(1):
                line=p.stdout.readline()
                if not line: raise RuntimeError('Router exited')
                msg=json.loads(line)
                if msg.get('id')==i: return msg
        raise TimeoutError(method)
    finally: selector.close()
try:
    request(1,'initialize',dict(protocolVersion='2024-11-05',capabilities={},clientInfo=dict(name='rhino-setup-check',version='1')))
    p.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n'); p.stdin.flush()
    request(2, 'tools/call', dict(name='list_slots', arguments={}))
    print(json.dumps(request(3,'tools/call',dict(name=sys.argv[1] if len(sys.argv)>1 else 'list_slots',arguments=json.loads(sys.argv[2]) if len(sys.argv)>2 else {})),ensure_ascii=False,indent=2))
finally:
    p.terminate()
    try: p.wait(timeout=5)
    except subprocess.TimeoutExpired: p.kill(); p.wait()
