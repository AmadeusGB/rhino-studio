// Native RhinoCommon export; no CPython/Python.NET initialization.
var doc = __rhino_doc__;
var folder = __OUTPUT_DIR__;
double meshTolerance = __MESH_TOLERANCE__;
if (doc.ModelUnitSystem != Rhino.UnitSystem.Millimeters) throw new System.Exception("工作文档必须使用毫米，请转换单位后重试");
var objects = new System.Collections.Generic.List<Rhino.DocObjects.RhinoObject>(doc.Objects);
if (objects.Count == 0) throw new System.Exception("模型为空");
var solids = new System.Collections.Generic.List<Rhino.Geometry.Brep>();
var warnings = new System.Collections.Generic.List<string>();
int nativeMeshes = 0, convertedMeshes = 0, references = 0;
var bodyBounds = Rhino.Geometry.BoundingBox.Empty;
var parameters = new Rhino.Geometry.MeshingParameters();
parameters.Tolerance = meshTolerance;
parameters.RelativeTolerance = 0;
parameters.MinimumEdgeLength = 0;
parameters.RefineGrid = true;
parameters.JaggedSeams = false;
using var mesh = new Rhino.Geometry.Mesh();
foreach (var obj in objects)
{
    if ((obj.Attributes.Name ?? "").StartsWith("REFERENCE_")) { references++; continue; }
    if ((obj.Attributes.Name ?? "").StartsWith("BODY_")) bodyBounds.Union(obj.Geometry.GetBoundingBox(true));
    var geo = obj.Geometry;
    if (!geo.IsValid) throw new System.Exception("存在无效几何，请修复");
    if (geo is Rhino.Geometry.Mesh sourceMesh)
    {
        if (!sourceMesh.IsClosed) throw new System.Exception("存在未闭合网格");
        // Exact planar conversion, not remeshing: enables solid connectivity
        // checks for small faceted jewelry parts without exploding dense meshes.
        var converted = sourceMesh.Faces.Count <= 2000 ? Rhino.Geometry.Brep.CreateFromMesh(sourceMesh, true) : null;
        if (converted != null && converted.IsValid && converted.IsSolid)
        {
            if (converted.SolidOrientation == Rhino.Geometry.BrepSolidOrientation.Inward) converted.Flip();
            solids.Add(converted); convertedMeshes++;
        }
        else
        {
            converted?.Dispose(); mesh.Append(sourceMesh); nativeMeshes++;
        }
    }
    else
    {
        var solid = Rhino.Geometry.Brep.TryConvertBrep(geo);
        if (solid == null || !solid.IsSolid || !solid.IsValid)
            throw new System.Exception("最终文档包含未闭合几何或辅助曲线");
        solids.Add(solid.DuplicateBrep());
    }
}
int connectedVolumes = -1;
string connectionStatus = "unverified";
// Union copies only: never modify the editable source document or separate moving parts.
if (nativeMeshes == 0 && solids.Count > 0)
{
    Rhino.Geometry.Brep[] united = null;
    try { united = Rhino.Geometry.Brep.CreateBooleanUnion(solids, doc.ModelAbsoluteTolerance); }
    catch (System.Exception ex) { warnings.Add("布尔检查异常：" + ex.Message); }
    if (united != null && united.Length > 0 && System.Array.TrueForAll(united, b => b.IsValid && b.IsSolid))
    {
        foreach (var b in solids) b.Dispose();
        solids = new System.Collections.Generic.List<Rhino.Geometry.Brep>(united);
        connectedVolumes = united.Length;
        connectionStatus = connectedVolumes == 1 ? "single_volume" : "multiple_volumes";
        if (connectedVolumes > 1) warnings.Add("检测到多个独立体积：请核对是否为活动组件，或存在悬空装饰、间隙及仅相切连接。");
    }
    else warnings.Add("布尔连接检查未完成，保留原几何；重叠与连接需在 Rhino 中检查。");
}
else warnings.Add("包含原生网格，未执行实体布尔连接检查；原网格精度保留，所选精度仅作用于曲面。");
foreach (var solid in solids)
{
    var pieces = Rhino.Geometry.Mesh.CreateFromBrep(solid, parameters);
    if (pieces == null || pieces.Length == 0) throw new System.Exception("实体网格化失败");
    foreach (var part in pieces) { mesh.Append(part); part.Dispose(); }
    solid.Dispose();
}
if (mesh.Faces.Count == 0) throw new System.Exception("加工范围内没有金属几何");
mesh.Vertices.CombineIdentical(true, true);
mesh.Faces.ConvertQuadsToTriangles();
mesh.Vertices.UseDoublePrecisionVertices = false;
mesh.Vertices.CombineIdentical(true, true);
mesh.Faces.CullDegenerateFaces();
double seamRepairTolerance = 0;
if (!mesh.IsClosed)
{
    seamRepairTolerance = meshTolerance;
    mesh.HealNakedEdges(seamRepairTolerance);
    mesh.Faces.ConvertQuadsToTriangles();
    mesh.Vertices.UseDoublePrecisionVertices = false;
    mesh.Vertices.CombineIdentical(true, true);
    mesh.Faces.CullDegenerateFaces();
}
mesh.Normals.ComputeNormals();
mesh.Compact();
if (!mesh.IsValid || !mesh.IsClosed) { string reason; mesh.IsValidWithLog(out reason); throw new System.Exception("生成的网格未闭合或无效：" + reason); }
if (mesh.SolidOrientation() < 0) mesh.Flip(true, true, true);
using (var file = new Rhino.FileIO.File3dm())
{
    file.Settings.ModelUnitSystem = Rhino.UnitSystem.Millimeters;
    foreach (var obj in objects) file.Objects.Add(obj.Geometry, obj.Attributes);
    if (!file.Write(System.IO.Path.Combine(folder, "model.3dm"), 8)) throw new System.Exception("3DM 保存失败");
}
// Write an explicit binary triangulation; verify the serialized file below.
using (var writer = new System.IO.BinaryWriter(System.IO.File.Create(System.IO.Path.Combine(folder, "model.stl"))))
{
    writer.Write(new byte[80]);
    writer.Write((uint)mesh.Faces.Count);
    foreach (var face in mesh.Faces)
    {
        if (!face.IsTriangle) throw new System.Exception("STL 必须完全三角化");
        var a = mesh.Vertices[face.A]; var b = mesh.Vertices[face.B]; var c = mesh.Vertices[face.C];
        var normal = Rhino.Geometry.Vector3d.CrossProduct(new Rhino.Geometry.Vector3d(b.X-a.X,b.Y-a.Y,b.Z-a.Z), new Rhino.Geometry.Vector3d(c.X-a.X,c.Y-a.Y,c.Z-a.Z));
        normal.Unitize();
        writer.Write((float)normal.X); writer.Write((float)normal.Y); writer.Write((float)normal.Z);
        writer.Write(a.X); writer.Write(a.Y); writer.Write(a.Z);
        writer.Write(b.X); writer.Write(b.Y); writer.Write(b.Z);
        writer.Write(c.X); writer.Write(c.Y); writer.Write(c.Z);
        writer.Write((ushort)0);
    }
}
using (var reread = Rhino.RhinoDoc.CreateHeadless(null))
{
    reread.ModelUnitSystem = Rhino.UnitSystem.Millimeters;
    if (!Rhino.FileIO.FileStl.Read(System.IO.Path.Combine(folder, "model.stl"), reread, new Rhino.FileIO.FileStlReadOptions { Weld = true }))
        throw new System.Exception("STL 回读失败");
    foreach (var obj in reread.Objects)
    {
        var check = obj.Geometry as Rhino.Geometry.Mesh;
        if (check == null) throw new System.Exception("STL 回读类型错误");
        check.Vertices.CombineIdentical(true, true);
        if (!check.IsValid || !check.IsClosed) throw new System.Exception("STL 回读未通过有效性和闭合检查：写出面数 " + mesh.Faces.Count + "，回读面数 " + check.Faces.Count);
    }
}
var box = mesh.GetBoundingBox(true);
if (!bodyBounds.IsValid) warnings.Add("缺少主体标记，无法单独核对主体尺寸和厚度；下列尺寸为全部加工几何范围。");
var report = new { valid = mesh.IsValid, closed = mesh.IsClosed, objects = objects.Count,
    body_dimensions = bodyBounds.IsValid ? new[] { bodyBounds.Max.X-bodyBounds.Min.X, bodyBounds.Max.Y-bodyBounds.Min.Y, bodyBounds.Max.Z-bodyBounds.Min.Z } : null,
    connection_status = connectionStatus, connected_volumes = connectedVolumes, native_meshes = nativeMeshes, reference_objects = references,
    converted_faceted_meshes = convertedMeshes,
    seam_repair_tolerance_mm = seamRepairTolerance,
    stl_roundtrip_verified = true,
    mesh_tolerance_mm = meshTolerance, warnings = warnings,
    stl_bytes = new System.IO.FileInfo(System.IO.Path.Combine(folder, "model.stl")).Length,
    faces = mesh.Faces.Count, units = "mm", dimensions = new[] { box.Max.X-box.Min.X, box.Max.Y-box.Min.Y, box.Max.Z-box.Min.Z },
    note = "已检查有效性和闭合性；未保证无自交、最小壁厚或实体之间无重叠。" };
var json = System.Text.Json.JsonSerializer.Serialize(report);
System.IO.File.WriteAllText(System.IO.Path.Combine(folder, "validation.json"), json);
System.Console.WriteLine(json);
