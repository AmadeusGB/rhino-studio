import json, tempfile, threading, unittest, urllib.request, urllib.error
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

class ManagementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.url='http://localhost:'+str(cls.http.server_port)
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):cls.http.shutdown();cls.http.server_close()
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.data=Path(self.temp.name)
        self.jobs={}
        for i in [1,2,3]:
            jid=f'{i:032x}';folder=self.data/jid;folder.mkdir()
            self.jobs[jid]=dict(id=jid,title='作品'+str(i),status='complete',created=i,events=[])
            (folder/'model.3dm').write_bytes(b'original model '+str(i).encode())
            (folder/'job.json').write_text(json.dumps(self.jobs[jid]))
        for name,value in [('DATA',self.data),('JOBS',self.jobs)]:
            p=patch.object(server,name,value);p.start();self.addCleanup(p.stop)
        self.ids=list(self.jobs)
    def request(self,path,body=None,headers=None):
        data=None if body is None else json.dumps(body).encode()
        req=urllib.request.Request(self.url+path,data=data,headers=headers or {})
        try:
            with urllib.request.urlopen(req) as r:return r.status,r.read()
        except urllib.error.HTTPError as e:
            with e:return e.code,e.read()
    def manage(self,action,ids,**kw):return self.request('/api/manage',dict(action=action,ids=ids,**kw))
    def test_single_delete_hides_detail_and_download_restore_keeps_bytes(self):
        id=self.ids[0]
        self.assertEqual(self.manage('trash',[id])[0],200)
        self.assertEqual(len(json.loads(self.request('/api/jobs')[1])),2)
        self.assertEqual(len(json.loads(self.request('/api/trash')[1])),1)
        self.assertEqual(self.request('/api/jobs/'+id)[0],404)
        self.assertEqual(self.request('/files/'+id+'/model.3dm')[0],404)
        self.assertEqual(self.manage('restore',[id])[0],200)
        self.assertEqual(self.request('/files/'+id+'/model.3dm')[1],b'original model 1')
    def test_batch_delete_and_restore_survive_reload(self):
        self.assertEqual(self.manage('trash',self.ids[:2])[0],200)
        for j in self.jobs.values():j.pop('deleted_at',None)
        server.load_catalog()
        self.assertTrue(all(self.jobs[i].get('deleted_at') for i in self.ids[:2]))
        # A finishing worker may have persisted the tombstone to job.json.
        for i in self.ids[:2]:(self.data/i/'job.json').write_text(json.dumps(self.jobs[i]))
        self.assertEqual(self.manage('restore',self.ids[:2])[0],200)
        self.jobs[self.ids[0]]['deleted_at']=1
        # On a real restart job.json contains the original, undeleted records.
        self.jobs.clear();self.jobs.update({i:json.loads((self.data/i/'job.json').read_text()) for i in self.ids})
        server.load_catalog();self.assertFalse(any(j.get('deleted_at') for j in self.jobs.values()))
    def test_batch_active_rejected_without_partial_changes(self):
        self.jobs[self.ids[1]]['status']='modeling'
        self.assertEqual(self.manage('trash',self.ids)[0],400)
        self.assertFalse(any(j.get('deleted_at') for j in self.jobs.values()))
        self.assertFalse((self.data/'catalog.json').exists())
    def test_backfill_cannot_be_deleted(self):
        self.jobs[self.ids[0]]['views_status']='queued'
        self.assertEqual(self.manage('trash',[self.ids[0]])[0],400)
    def test_unknown_id_rejects_entire_batch(self):
        self.assertEqual(self.manage('trash',[self.ids[0],'f'*32])[0],400)
        self.assertFalse(self.jobs[self.ids[0]].get('deleted_at'))
    def test_rename_persists_and_survives_other_updates(self):
        self.assertEqual(self.manage('rename',[self.ids[0]],title='  新名字  ')[0],200)
        self.jobs[self.ids[0]]['views_status']='rendering'
        self.manage('trash',[self.ids[1]])
        self.jobs[self.ids[0]]['title']='old';server.load_catalog()
        self.assertEqual(self.jobs[self.ids[0]]['title'],'新名字')
    def test_disk_failure_rolls_back_memory(self):
        with patch('server.save_catalog',side_effect=OSError('disk full')):
            self.assertEqual(self.manage('trash',self.ids)[0],500)
        self.assertFalse(any(j.get('deleted_at') for j in self.jobs.values()))
    def test_validation_and_external_origin(self):
        for ids in [[],['../escape'],[self.ids[0]]*2,None]:self.assertEqual(self.manage('trash',ids)[0],400)
        self.assertEqual(self.manage('rename',[self.ids[0]],title=' '*5)[0],400)
        self.assertEqual(self.request('/api/manage',dict(action='trash',ids=self.ids),{'Origin':'https://external.invalid'})[0],403)

if __name__=='__main__':unittest.main()
