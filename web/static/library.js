let trashJobs=[], libraryTab='active', managing=false, selection=new Set(), librarySignature='', pendingManage=null, managingRequest=false;
const canManage=j=>['complete','failed'].includes(j.status)&&!['queued','rendering'].includes(j.views_status);
function libraryItems(){
 const query=$('librarysearch').value.trim().toLocaleLowerCase(),filter=$('libraryfilter').value;
 return (libraryTab==='trash'?trashJobs:jobs).filter(j=>(!query||(j.title+' '+(j.description||'')).toLocaleLowerCase().includes(query))&&(filter==='all'||(filter==='active'?!['complete','failed'].includes(j.status):j.status===filter)));
}
function button(text,action,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.onclick=action;return b;}
function updateSelection(){
 const eligible=libraryItems().filter(canManage);
 for(const id of selection)if(!eligible.some(j=>j.id===id))selection.delete(id);
 $('selectedcount').textContent='已选 '+selection.size+' 件';$('bulkapply').disabled=!selection.size;
 $('selectall').checked=!!eligible.length&&eligible.every(j=>selection.has(j.id));
 $('selectall').indeterminate=!!selection.size&&!$('selectall').checked;$('selectall').disabled=!eligible.length;
 document.querySelectorAll('.work-select input').forEach(c=>{c.checked=selection.has(c.dataset.id);c.closest('.work-card').classList.toggle('selected',c.checked);});
}
function renderLibrary(){
 const items=libraryItems(),isTrash=libraryTab==='trash';
 $('librarycount').textContent=(isTrash?'回收站':'作品库')+' · '+items.length+' 件';
 $('trashnote').hidden=!isTrash;$('bulkbar').hidden=!managing;$('managemode').textContent=managing?'完成管理':'批量管理';$('managemode').setAttribute('aria-pressed',String(managing));
 $('bulkapply').textContent=isTrash?'恢复所选':'删除所选';$('bulkapply').classList.toggle('danger-text',!isTrash);
 for(const [id,active] of [['libraryactive',!isTrash],['librarytrash',isTrash]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}
 const sig=JSON.stringify([libraryTab,managing,items.map(j=>[j.id,j.title,j.status,j.views_status,j.preview,j.deleted_at])]);
 if(sig!==librarySignature){
  librarySignature=sig;$('history').replaceChildren();
  if(!items.length){const p=document.createElement('p');p.className='library-empty';p.textContent=$('librarysearch').value||$('libraryfilter').value!=='all'?'没有符合条件的作品，试试其他关键词或状态。':isTrash?'回收站是空的。':'还没有作品，上传图片开始创作。';$('history').append(p);}
  for(const job of items){
   const card=document.createElement('article');card.className='work-card';card.dataset.id=job.id;
   if(managing){const label=document.createElement('label'),check=document.createElement('input');label.className='work-select';check.type='checkbox';check.dataset.id=job.id;check.setAttribute('aria-label','选择 '+job.title);check.disabled=!canManage(job);check.onchange=()=>{check.checked?selection.add(job.id):selection.delete(job.id);updateSelection();};label.append(check,document.createTextNode('选择'));card.append(label);}
   const cover=button('',()=>{select(job.id);mode(false);render(job);$('viewport').scrollIntoView({behavior:'smooth',block:'center'});},'work-cover');
   cover.disabled=isTrash;cover.setAttribute('aria-label','查看 '+job.title);
   if(isTrash){const placeholder=document.createElement('span');placeholder.className='trash-placeholder';placeholder.textContent='已移入回收站';cover.append(placeholder);}
   else{const img=document.createElement('img');img.src=job.preview||'/files/'+job.id+'/input.png';img.alt=job.title;img.loading='lazy';cover.append(img);}
   const info=document.createElement('div');info.className='work-info';const title=document.createElement('h3'),meta=document.createElement('p');title.textContent=job.title;meta.textContent=(isTrash?'删除于 ':states[job.status]+' · ')+new Date((job.deleted_at||job.created)*1000).toLocaleDateString();info.append(title,meta);
   const actions=document.createElement('div');actions.className='work-actions';
   if(isTrash)actions.append(button('恢复作品',()=>openManage('restore',[job.id])));
   else{const rename=button('重命名',()=>openManage('rename',[job.id])),remove=button('删除',()=>openManage('trash',[job.id]),'danger-text');rename.disabled=remove.disabled=!canManage(job);if(!canManage(job)){rename.title=remove.title='请等待生成或补拍完成';}actions.append(rename,remove);}
   card.append(cover,info,actions);$('history').append(card);
  }
 }
 updateSelection();
}
function openManage(action,ids){
 const selected=[...jobs,...trashJobs].filter(j=>ids.includes(j.id));
 if(!selected.length)return;
 pendingManage={action,ids:[...ids]};$('dialogerror').hidden=true;
 const rename=action==='rename',restore=action==='restore';
 $('dialogtitle').textContent=rename?'重命名作品':restore?'恢复 '+ids.length+' 件作品？':'删除 '+ids.length+' 件作品？';
 $('dialogcopy').textContent=rename?'修改作品库中的名称，模型文件保持原样。':restore?'恢复后，作品会重新出现在作品库中，可以查看和下载。':'作品及其模型文件将移入回收站，可随时恢复。不会关闭你正在使用的 Rhino 文档。';
 $('dialogitems').replaceChildren();for(const j of selected.slice(0,8)){const li=document.createElement('li');li.textContent=j.title;$('dialogitems').append(li);}if(selected.length>8){const li=document.createElement('li');li.textContent='以及另外 '+(selected.length-8)+' 件作品';$('dialogitems').append(li);}
 $('dialogitems').hidden=rename;$('renamelabel').hidden=!rename;$('renametitle').required=rename;$('renametitle').value=selected[0].title;
 $('confirmmanage').textContent=rename?'保存名称':restore?'恢复作品':'移入回收站';$('confirmmanage').classList.toggle('danger',action==='trash');
 $('managedialog').showModal();(rename?$('renametitle'):$('cancelmanage')).focus();if(rename)$('renametitle').select();
}
function initLibrary(){
 for(const [id,tab] of [['libraryactive','active'],['librarytrash','trash']])$(id).onclick=()=>{libraryTab=tab;selection.clear();renderLibrary();};
 $('librarysearch').oninput=$('libraryfilter').onchange=()=>{selection.clear();renderLibrary();};
 $('managemode').onclick=()=>{managing=!managing;selection.clear();renderLibrary();};
 $('selectall').onchange=()=>{selection=$('selectall').checked?new Set(libraryItems().filter(canManage).map(j=>j.id)):new Set();updateSelection();};
 $('bulkapply').onclick=()=>openManage(libraryTab==='trash'?'restore':'trash',[...selection]);
 $('cancelmanage').onclick=()=>{$('managedialog').close();};
 $('managedialog').addEventListener('cancel',e=>{if(managingRequest)e.preventDefault();});
 $('manageform').onsubmit=async e=>{
  e.preventDefault();if(!pendingManage||managingRequest)return;
  managingRequest=true;$('confirmmanage').disabled=$('cancelmanage').disabled=true;$('dialogerror').hidden=true;
  try{
   const payload={...pendingManage,title:$('renametitle').value.trim()};
   const r=await fetch('/api/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||'操作失败');
   selection.clear();$('managedialog').close();$('librarymessage').hidden=false;$('librarymessage').textContent=payload.action==='trash'?'已移入回收站，可切换到回收站恢复。':payload.action==='restore'?'作品已恢复。':'作品名称已更新。';pendingManage=null;await poll();$('managemode').focus();
  }catch(err){$('dialogerror').hidden=false;$('dialogerror').textContent=err.message;}
  finally{managingRequest=false;$('confirmmanage').disabled=$('cancelmanage').disabled=false;}
 };
}
