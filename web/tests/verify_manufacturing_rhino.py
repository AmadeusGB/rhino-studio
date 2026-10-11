"""Opt-in real Rhino export checks in disposable headless documents; no user document edits."""
import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import MCP, ROOT

client = MCP()
try:
    slots = client.payload(client.call('list_slots'))
    slot = slots[0]['slotId'] if slots else client.payload(client.call('spawn_slot', version='8'))['slotId']
    reports = {}
    for name, distance, tolerance in [('joined', 5, 0.01), ('separate', 25, 0.01), ('fine', 5, 0.005), ('coarse', 5, 0.02), ('faceted', 5, 0.01)]:
        with tempfile.TemporaryDirectory(prefix='rhino-export-check-') as folder:
            script = (ROOT/'export.cs').read_text().replace('var doc = __rhino_doc__;', '''using var doc = Rhino.RhinoDoc.CreateHeadless(null);
doc.ModelUnitSystem = Rhino.UnitSystem.Millimeters;
doc.ModelAbsoluteTolerance = 0.001;
doc.Objects.AddBrep(new Rhino.Geometry.Sphere(Rhino.Geometry.Point3d.Origin, 10).ToBrep());
doc.Objects.AddBrep(new Rhino.Geometry.Sphere(new Rhino.Geometry.Point3d(DISTANCE,0,0), 10).ToBrep());
doc.Objects.AddBrep(new Rhino.Geometry.Sphere(new Rhino.Geometry.Point3d(100,0,0), 2).ToBrep(), new Rhino.DocObjects.ObjectAttributes { Name = "REFERENCE_stone" });
'''.replace('DISTANCE', str(distance))).replace('__OUTPUT_DIR__', json.dumps(folder)).replace('__MESH_TOLERANCE__', str(tolerance))
            if name == 'faceted':
                script = script.replace('double meshTolerance', 'doc.Objects.AddMesh(Rhino.Geometry.Mesh.CreateFromBox(new Rhino.Geometry.BoundingBox(-1,-1,-1,1,1,1),1,1,1));\ndouble meshTolerance')
            result = client.call('run_csharp', slot=slot, script=script)
            target = Path(folder)/'validation.json'
            if not target.exists(): raise RuntimeError(str(result))
            report = json.loads(target.read_text())
            assert report['connected_volumes'] == (2 if name == 'separate' else 1), report
            assert report['reference_objects'] == 1 and report['dimensions'][0] < 50, report
            if name == 'faceted': assert report['converted_faceted_meshes'] == 1 and report['native_meshes'] == 0, report
            reports[name] = report
    assert reports['fine']['stl_bytes'] > reports['coarse']['stl_bytes'], reports
    print(json.dumps(reports, ensure_ascii=False, indent=2))
finally:
    client.close()
