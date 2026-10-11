const $=id=>document.getElementById(id);
let imageData=null, current=null, debugging=false, lastSignature='', jobs=[], replay=null, playback=null;
let layout='grid', viewIndex=0, gallerySignature='', fileVersion=0, submitting=false;
const states={queued:'等待前面的任务完成',analyzing:'智能体正在分析图片',modeling:'Rhino 正在建模',exporting:'正在检查并导出',complete:'生成完成',failed:'生成未完成'};
function error(message){$('error').textContent=message;$('error').hidden=!message;}
async function loadFile(file){
 if(!file)return;
 clearImage();const version=fileVersion;
 error('');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){error('请选择 10 MB 以内的 PNG、JPG 或 WebP 图片。');return;}
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{try{if(version!==fileVersion)return;const scale=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);imageData=c.toDataURL('image/png');$('reference').src=imageData;$('reference').hidden=false;$('replace').hidden=false;$('dropcopy').hidden=true;$('fileinfo').hidden=false;$('filename').textContent=file.name+' · '+(file.size/1024/1024).toFixed(2)+' MB';$('generate').disabled=submitting;}catch(e){error('无法读取图片。');}finally{URL.revokeObjectURL(url);}};
 img.onerror=()=>{URL.revokeObjectURL(url);if(version===fileVersion)error('图片损坏或格式不支持。');};img.src=url;
}
function clearImage(){fileVersion++;imageData=null;$('file').value='';$('reference').hidden=true;$('reference').removeAttribute('src');$('replace').hidden=true;$('dropcopy').hidden=false;$('fileinfo').hidden=true;$('generate').disabled=true;}
$('removeimage').onclick=()=>{clearImage();error('');};
document.addEventListener('paste',e=>{const item=[...e.clipboardData.items].find(i=>i.type.startsWith('image/'));if(item){e.preventDefault();loadFile(item.getAsFile());}});
for(const type of ['dragover','drop'])document.addEventListener(type,e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
$('file').onchange=e=>loadFile(e.target.files[0]);
$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
for(const type of ['dragover','dragleave','drop'])$('drop').addEventListener(type,e=>{e.preventDefault();$('drop').classList.toggle('drag',type==='dragover');if(type==='drop')loadFile(e.dataTransfer.files[0]);});
$('form').onsubmit=async e=>{e.preventDefault();if(!imageData||submitting)return;error('');submitting=true;$('generate').disabled=true;const runMode=document.querySelector('input[name="runmode"]:checked').value;try{const r=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageData,description:$('description').value,size:$('size').value,scope:$('scope').value,thickness:$('thickness').value,tolerance:$('tolerance').value,mode:runMode})});const job=await r.json();if(!r.ok)throw Error(job.error);jobs=[job,...jobs.filter(j=>j.id!==job.id)];select(job.id);mode(runMode==='debug');await poll();$('viewport').scrollIntoView({behavior:'smooth',block:'center'});}catch(e){error(e.message);}finally{submitting=false;$('generate').disabled=!imageData;}};
$('reuse').onclick=async()=>{const job=jobs.find(j=>j.id===current);if(!job)return;$('reuse').disabled=true;try{const r=await fetch('/files/'+job.id+'/input.png');if(!r.ok)throw Error('参考图片读取失败');await loadFile(new File([await r.blob()],job.title+'.png',{type:'image/png'}));$('description').value=job.description||'';$('size').value=job.size||'';$('scope').value=job.manufacturing?.scope||'body';$('thickness').value=job.manufacturing?.thickness_mm??'';$('tolerance').value=String(job.manufacturing?.tolerance??0.01);document.querySelector('input[name="runmode"][value="'+(job.mode==='debug'?'debug':'standard')+'"]').checked=true;$('form').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){error(e.message);}finally{$('reuse').disabled=false;}};
function stopPlayback(){clearInterval(playback);playback=null;$('play').textContent='▶ 播放建模过程';}
function select(id){stopPlayback();current=id;lastSignature='';replay=null;viewIndex=0;gallerySignature='';}
function mode(debug){stopPlayback();debugging=debug;replay=null;$('debug').classList.toggle('active',debug);$('normal').classList.toggle('active',!debug);$('timeline').hidden=!debug;if(current)render(jobs.find(j=>j.id===current));}
$('normal').onclick=()=>mode(false);$('debug').onclick=()=>mode(true);
$('play').onclick=()=>{if(playback){stopPlayback();return;}const frames=jobs.find(j=>j.id===current)?.events.filter(e=>e.image)||[];if(!frames.length)return;let i=0;const next=()=>{replay=frames[i++].image;$('render').src=replay;if(i===frames.length)stopPlayback();};$('play').textContent='Ⅱ 暂停回放';playback=setInterval(next,1600);next();};
function render(job){
 if(!job){
  stopPlayback();current=null;lastSignature='';gallerySignature='';
  for(const id of ['render','viewgrid','viewtools','viewtabs','prevview','nextview','working','downloads','reuse','viewexplain','viewnotice','assumptions','validation','timeline','viewlabel'])$(id).hidden=true;
  $('render').removeAttribute('src');$('events').replaceChildren();$('empty').hidden=false;$('title').textContent='等待任务';$('status').textContent='上传图片，把建模任务交给智能体。';$('jobmeta').textContent='';return;
 }
 $('timeline').hidden=!debugging;
 $('play').disabled=!job.events.some(e=>e.image);
 $('reuse').hidden=false;$('reuse').textContent=job.status==='failed'?'调整后重新生成':'用这张图片再创作';
 $('jobmeta').textContent=(job.mode==='standard'?'智能体自主建模 · 未记录分步截图':'智能体过程演示 · 可查看执行记录')+' · '+new Date(job.created*1000).toLocaleString();
 $('title').textContent=job.title;$('status').textContent=states[job.status]+(job.status==='failed'?'。可重新生成，或在过程调试中查看具体原因。':'');
 const active=!['complete','failed'].includes(job.status);$('working').hidden=!active;$('worktext').textContent=job.events.at(-1)?.text||states[job.status];
 renderGallery(job);
 $('assumptions').hidden=!job.assumptions;$('assumptions').textContent=job.assumptions||'';
 $('downloads').hidden=!job.downloads;if(job.downloads){$('download3dm').href=job.downloads['3dm'];$('downloadstl').href=job.downloads.stl;}
 $('validation').hidden=!job.validation;if(job.validation){const v=job.validation;$('validation').textContent=`✓ 有效闭合网格 · ${v.objects} 个对象 · ${v.dimensions.map(x=>x.toFixed(1)).join(' × ')} mm。${v.note}`;if(v.connection_status){const labels={single_volume:'布尔检查：一个闭合体积',multiple_volumes:'布尔检查：'+v.connected_volumes+' 个独立体积',unverified:'整体连接尚未确认'};$('validation').textContent+=' '+labels[v.connection_status]+(v.body_dimensions?'；主体 '+v.body_dimensions.map(x=>x.toFixed(3)).join(' × ')+' mm':'')+(v.triangles?'；'+v.triangles.toLocaleString()+' 个三角面':'')+'；STL '+(v.stl_bytes/1024/1024).toFixed(1)+' MB；曲面网格参数 '+v.mesh_tolerance_mm+' mm。'+(v.warnings||[]).join(' ');}}
 const sig=job.id+':'+job.events.length;if(sig!==lastSignature){lastSignature=sig;$('events').replaceChildren();for(const ev of job.events){const el=document.createElement('div');el.className='event';const time=document.createElement('time');time.textContent=new Date(ev.time*1000).toLocaleTimeString();el.append(time,document.createTextNode(ev.text));if(ev.image){const b=document.createElement('button'),im=document.createElement('img');im.src=ev.image;im.alt=ev.text;b.append(im);b.onclick=()=>{replay=ev.image;$('render').src=ev.image;};el.append(b);}$('events').append(el);}}
}
let polling=false;
async function poll(){if(polling)return;polling=true;try{const responses=await Promise.all([fetch('/api/jobs'),fetch('/api/trash')]);if(responses.some(r=>!r.ok))throw Error('服务不可用');[jobs,trashJobs]=await Promise.all(responses.map(r=>r.json()));if($('health').textContent==='本地服务连接中断'){$('health').textContent='本地服务已连接';$('health').classList.add('ok');}render(jobs.find(j=>j.id===current));renderLibrary();}catch(e){$('health').textContent='本地服务连接中断';$('health').classList.remove('ok');}finally{polling=false;}}
fetch('/api/health').then(r=>r.json()).then(h=>{$('health').textContent=h.router&&h.agent?'本机引擎已配置':'请检查 Rhino / Codex 安装';$('health').classList.toggle('ok',h.router&&h.agent);}).catch(()=>{$('health').textContent='服务未连接';});
function showView(index){const job=jobs.find(j=>j.id===current);if(!job?.views?.length)return;stopPlayback();replay=null;viewIndex=(index+job.views.length)%job.views.length;layout='single';renderGallery(job);}
function setLayout(value){layout=value;replay=null;renderGallery(jobs.find(j=>j.id===current));}
$('gridmode').onclick=()=>setLayout('grid');$('singlemode').onclick=()=>setLayout('single');
$('prevview').onclick=()=>showView(viewIndex-1);$('nextview').onclick=()=>showView(viewIndex+1);
$('viewport').addEventListener('keydown',e=>{if(!debugging&&layout==='single'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();showView(viewIndex+(e.key==='ArrowRight'?1:-1));}});
let touchX=null;
$('viewport').addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;},{passive:true});
$('viewport').addEventListener('touchend',e=>{if(touchX!==null&&!debugging&&layout==='single'){const delta=e.changedTouches[0].clientX-touchX;if(Math.abs(delta)>50)showView(viewIndex+(delta<0?1:-1));}touchX=null;},{passive:true});
$('retryviews').onclick=async()=>{const id=current;$('retryviews').disabled=true;try{const r=await fetch('/api/jobs/'+id+'/views',{method:'POST'});if(!r.ok)throw Error((await r.json()).error);await poll();}catch(e){$('viewmessage').textContent=e.message;}finally{$('retryviews').disabled=false;}};
function renderGallery(job){
 if(!job)return;
 const views=job.views||[], available=views.length===4, grid=available&&!debugging&&layout==='grid';
 $('viewexplain').hidden=!available||debugging;
 $('viewtools').hidden=!available||debugging;$('viewgrid').hidden=!grid;$('viewtabs').hidden=!available||debugging;
 $('prevview').hidden=$('nextview').hidden=!available||debugging||grid;
 $('gridmode').classList.toggle('active',layout==='grid');$('singlemode').classList.toggle('active',layout==='single');
 $('gridmode').setAttribute('aria-pressed',String(layout==='grid'));$('singlemode').setAttribute('aria-pressed',String(layout==='single'));
 $('viewhint').textContent=grid?'点击任一视图放大':'左右翻页 · 支持方向键与滑动';
 const selected=views[viewIndex]||views[0];
 const preview=debugging?(replay||job.preview):(selected?.image||job.preview);
 $('empty').hidden=!!preview;$('render').hidden=grid||!preview;
 if(preview&&$('render').getAttribute('src')!==preview)$('render').src=preview;
 $('render').alt=debugging?'Rhino 实际建模步骤':(selected?.label||'透视')+' · '+job.title;
 $('viewlabel').hidden=grid;$('viewlabel').textContent=debugging?'RHINO 8 · 建模过程':available?'RHINO 8 · '+selected.label+' · '+(viewIndex+1)+' / 4':'RHINO 8 · 透视';
 const sig=job.id+JSON.stringify(views);
 if(sig!==gallerySignature){gallerySignature=sig;$('viewgrid').replaceChildren();$('viewtabs').replaceChildren();
  for(const key of ['top','perspective','front','right']){const index=views.findIndex(v=>v.key===key);if(index<0)continue;const v=views[index],b=document.createElement('button'),im=document.createElement('img'),label=document.createElement('span');b.type='button';b.className='viewcell';b.setAttribute('aria-label','放大'+v.label);im.src=v.image;im.alt=job.title+' · '+v.label;label.textContent=v.label+' / '+(v.display==='Wireframe'?'线框':'着色');b.append(im,label);b.onclick=()=>showView(index);$('viewgrid').append(b);}
  views.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.textContent=v.label;b.onclick=()=>showView(i);$('viewtabs').append(b);});
 }
 [...$('viewtabs').children].forEach((b,i)=>{b.classList.toggle('active',!grid&&i===viewIndex);b.setAttribute('aria-pressed',String(!grid&&i===viewIndex));});
 const pending=['queued','rendering'].includes(job.views_status);
 $('viewnotice').hidden=debugging||job.status!=='complete'||(available&&!pending&&job.views_status!=='failed');
 $('viewmessage').textContent=pending?'正在从已有模型更新四视图，无需重新建模。':job.views_status==='failed'?'视图更新未完成，模型文件仍可下载，可点击重试。':'这个作品暂时只有透视图，可以补齐其他视角。';
 $('retryviews').hidden=pending;
}
initLibrary();poll();setInterval(poll,2500);
