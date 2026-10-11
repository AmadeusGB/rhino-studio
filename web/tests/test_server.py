import sys, unittest, threading, json, urllib.request, urllib.error, tempfile, base64
from unittest.mock import patch, MagicMock
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer, content_blocks, capture_views, backfill_views, clear_work_document

class ViewTests(unittest.TestCase):
    def test_retry_cleanup_verifies_deletions_and_empty_document(self):
        mcp=MagicMock()
        clear_work_document(mcp,'work-slot')
        script=mcp.call.call_args.kwargs['script']
        self.assertIn('if(!doc.Objects.Delete(id,true))',script)
        self.assertIn('if(remaining!=0)',script)
        self.assertEqual(mcp.call.call_args.kwargs['slot'],'work-slot')

    def test_backfill_keeps_last_listener_alive(self):
        mcp=MagicMock();mcp.p.poll.return_value=None
        mcp.call.side_effect=lambda name,**args: [{'slotId':'own-preview'}] if name=='list_slots' else {'slotId':'own-preview'}
        mcp.payload.side_effect=lambda result:result
        with patch('server.RHINO_CLIENT',mcp),patch('server.persist'),patch('server.capture_views'):
            backfill_views({'id':'saved-model'})
        self.assertFalse(any(c.args[0]=='close_slot' for c in mcp.call.call_args_list))

    def test_backfill_retries_transient_startup_failure(self):
        stale=MagicMock();stale.p.poll.return_value=None
        stale.call.side_effect=lambda name,**args: (_ for _ in ()).throw(RuntimeError('startup_timeout')) if name=='spawn_slot' else []
        stale.payload.side_effect=lambda result:result
        replacement=MagicMock();replacement.p.poll.return_value=None
        replacement.call.side_effect=lambda name,**args: [{'slotId':'own-preview'},{'slotId':'other'}] if name=='list_slots' else {'slotId':'own-preview'}
        replacement.payload.side_effect=lambda result:result
        with patch('server.RHINO_CLIENT',stale),patch('server.MCP',return_value=replacement),patch('server.recover_spawned_rhino_listener',return_value=False),patch('server.persist'),patch('server.capture_views') as capture:
            backfill_views({'id':'saved-model'})
            stale.close.assert_called_once()
            stale.call.assert_any_call('spawn_slot',version='8')
            replacement.call.assert_any_call('spawn_slot',version='8')
            capture.assert_called_once()
            replacement.call.assert_any_call('close_slot',slot='own-preview')

    def test_four_distinct_framed_views_preserve_model(self):
        class FakeMCP:
            def __init__(self): self.captures=[]
            def payload(self, value): return {'stdout':'-1,-2,-3,4,5,6\n'}
            def call(self, name, **args):
                if name=='get_viewport_image':
                    self.captures.append(args)
                    return {'content':[{'type':'image','data':base64.b64encode(args['view'].encode()).decode()}]}
                return {}
        with tempfile.TemporaryDirectory() as folder, patch('server.DATA',Path(folder)):
            job={'id':'test'}; target=Path(folder)/'test';target.mkdir()
            (target/'model.3dm').write_bytes(b'original model')
            mcp=FakeMCP();capture_views(mcp,'isolated',job)
            self.assertEqual([v['view'] for v in mcp.captures],['Perspective','Top','Front','Right'])
            self.assertTrue(all(v['boxMin']=={'x':-1,'y':-2,'z':-3} and v['boxMax']=={'x':4,'y':5,'z':6} for v in mcp.captures))
            self.assertEqual(job['views_status'],'complete')
            self.assertEqual([v['displayMode'] for v in mcp.captures],['Shaded','Wireframe','Wireframe','Wireframe'])
            self.assertEqual(job['views_version'],2)
            self.assertEqual(len(list(target.glob('view-*.jpg'))),4)
            self.assertEqual((target/'model.3dm').read_bytes(),b'original model')

class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.url='http://127.0.0.1:'+str(cls.server.server_port)
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls): cls.server.shutdown(); cls.server.server_close()
    def request(self,path,data=None,headers=None):
        req=urllib.request.Request(self.url+path,data=data,headers=headers or {})
        try:
            with urllib.request.urlopen(req) as r: return r.status,r.read()
        except urllib.error.HTTPError as e:
            with e: return e.code,e.read()
    def test_home(self):
        code,body=self.request('/');self.assertEqual(code,200);self.assertIn(b'Rhino Studio',body)
    def test_reject_external_origin(self):
        self.assertEqual(self.request('/api/jobs',b'{}',{'Origin':'https://evil.example'})[0],403)
    def test_reject_dns_rebinding(self):
        self.assertEqual(self.request('/api/health',headers={'Host':'evil.example'})[0],403)
    def test_reject_traversal(self):
        self.assertEqual(self.request('/%2e%2e/server.py')[0],404)
    def test_reject_non_image(self):
        self.assertEqual(self.request('/api/jobs',json.dumps({'image':'aGVsbG8='}).encode())[0],400)
    def test_reject_unsupported_mode(self):
        self.assertEqual(self.request('/api/jobs',json.dumps({'mode':'headless'}).encode())[0],400)
    def test_reject_non_object_payload(self):
        self.assertEqual(self.request('/api/jobs',b'[]')[0],400)
    def test_private_files_not_served(self):
        self.assertEqual(self.request('/files/'+'a'*32+'/agent.log')[0],404)
    def test_missing_job(self):
        self.assertEqual(self.request('/api/jobs/missing')[0],404)
    def test_plan_schema(self):
        schema=json.loads((Path(__file__).resolve().parents[1]/'plan.schema.json').read_text())
        self.assertEqual(set(schema['required']),{'title','assumptions','steps'})
    def test_nested_mcp_image(self):
        result={'content':[{'type':'text','text':json.dumps({'content':[{'type':'image','data':'test'}]})}]}
        self.assertEqual(list(content_blocks(result)),[{'type':'image','data':'test'}])

if __name__=='__main__':unittest.main()
