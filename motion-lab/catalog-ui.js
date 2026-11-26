import {prepareTrack,learnedPose} from './learned-rig.js';
import {createStage} from './stage.js';
import {jointKeys} from './review/shared.js';

const $=s=>document.querySelector(s);
const format=n=>n.toLocaleString('ko-KR');
const batchSize=48, pageSize=4;
const storageKey='astra.motion.userSituations.v1';
function option(value,label){return new Option(label,value);}
function readLabels(){
  try{return JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{return {};}
}
function download(data,name){
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const requests=new Map();
async function resource(name){
  if(!requests.has(name)){
    const request=fetch('./catalog/'+name+'.json').then(r=>{
      if(!r.ok)throw new Error('원본 파일을 열 수 없습니다 ('+r.status+')');
      return r.json();
    }).catch(e=>{requests.delete(name);throw e;});
    requests.set(name,request);
    if(requests.size>16)requests.delete(requests.keys().next().value);
  }
  return requests.get(name);
}
let thumbnailStage,thumbnailHost;
function portrait(canvas,pose){
  if(!thumbnailHost){
    thumbnailHost=document.createElement('div');thumbnailHost.className='thumbnail-studio';
    document.body.append(thumbnailHost);
    thumbnailStage=createStage(thumbnailHost,()=>{},true);
  }
  thumbnailStage.frameClip([pose]);thumbnailStage.update(pose,{});thumbnailStage.render();
  canvas.width=144;canvas.height=108;
  canvas.getContext('2d').drawImage(thumbnailHost.querySelector('canvas'),0,0,144,108);
}
export function createCatalog({show,getSelection,pauseAtSource}){
  let manifest,patterns,group,rows=[],current=0,generation=0,currentTrack=null,active=true,groupRows=null;
  let labelKey='',allLabels=readLabels(),previousList=null;
  const memo=new Map();
  function prepare(row){
    if(row.missing)return {...row,learned:true,preview:0,phases:[{at:0,name:'관절 미검출'}],duration:0};
    if(!memo.has(row.id)){
      if(memo.size>=16)memo.delete(memo.keys().next().value);
      memo.set(row.id,prepareTrack(row));
    }
    return memo.get(row.id);
  }
  async function reviewed(row){
    const response=await fetch('./review/api/track?'+new URLSearchParams({track:row.id})).catch(()=>null);
    if(!response?.ok)return prepare(row);
    const edits=await response.json();
    if(!edits.length)return prepare(row);
    let changed=false;
    const frames=row.frames.map(f=>{
      const entry=edits.find(r=>r.member===f.member&&r.subject==='player');
      if(!entry)return f;
      const verified=entry.joints.map(j=>j.state==='confirmed'?j.xy:null);
      const input=verified.slice(0,12).map((p,i)=>p||f.input?.[i]);
      if(!input.every(Boolean)||!verified.some(Boolean))return f;
      changed=true;
      return {...f,input,method:'review',reviewPoints:Object.fromEntries(jointKeys.map((k,i)=>[k,verified[i]]))};
    });
    return changed?prepareTrack({...row,frames,missing:false,recovered:row.missing}):prepare(row);
  }
  function bindLabel(force=false){
    const {clip,frame}=getSelection();
    if(!clip?.code||clip.missing||clip.recovered)return;
    const scope=$('#label-target').value;
    const id=scope==='pattern'?'pattern:'+clip.pattern:clip.id+(scope==='frame'?'#'+frame.index:'');
    if(!force&&id===labelKey)return;
    labelKey=id;
    const entry=allLabels[id];
    $('#user-label').value=entry?.situation||'';
    const inherited=scope==='frame'?allLabels[clip.id]||allLabels['pattern:'+clip.pattern]:scope==='track'?allLabels['pattern:'+clip.pattern]:null;
    const applies=scope==='pattern'?' · '+format(patterns.groups.find(g=>g.id===clip.pattern)?.count||0)+'사례':'';
    $('#label-status').textContent=(entry?'저장됨':inherited?'상위 분류 · '+inherited.situation:'미분류')+applies;
    const names=Array.from(new Set(Object.values(allLabels).map(x=>x.situation))).sort();
    $('#prior-labels').replaceChildren(...names.map(n=>option(n,n)));
  }
  function activate(value){
    active=value;if(!value)generation++;
    $('#catalog-browser').hidden=!value;$('#annotation-panel').hidden=!value||!!currentTrack?.missing;
    $('#pattern-strip').hidden=!value||!patterns;
  }
  function report(e){$('#catalog-message').textContent=e.message;}
  function run(fn){return ()=>fn().catch(report);}
  function paging(){
    const start=Math.floor(current/pageSize)*pageSize;
    $('#case-count').textContent=rows.length?'사례 '+format(start+1)+'–'+format(Math.min(start+pageSize,rows.length))+' / '+format(rows.length):'사례 0개';
    $('#case-prev').disabled=start===0;
    $('#case-next').disabled=start+pageSize>=rows.length;
    $('#case-jump').max=rows.length;$('#case-jump').value=rows.length?current+1:'';
    $('#case-jump').disabled=!rows.length;
    $('#nearby').disabled=!previousList&&(!rows.length||rows[current]?.missing||currentTrack?.recovered);
    $('#nearby').textContent=previousList?'원래 묶음으로 돌아가기':'이 사례와 가장 비슷한 동작 보기';
  }
  async function display(index,revision=++generation){
    if(!rows.length||!active)return;
    current=Math.max(0,Math.min(rows.length-1,index));
    const start=Math.floor(current/pageSize)*pageSize,subset=rows.slice(start,start+pageSize);
    const loaded=await Promise.all(subset.map(async r=>{
      const batch=await resource(r.code+'-'+r.cam+'-'+Math.floor(r.index/batchSize));
      const c=await reviewed(batch[r.index%batchSize]);
      if(!c.missing&&!c.recovered&&!c.pattern)c.pattern=(await resource(r.code+'-'+r.cam+'-patterns'))[r.index];
      return c;
    }));
    if(revision!==generation||!active)return;
    const chosen=loaded[current-start];currentTrack=chosen;
    const mode=$('#group-mode').value;
    const title=mode==='manual'?$('#action-list').value:mode==='pattern'?group.name:null;
    show(chosen,rows[current].frame,title);
    $('#annotation-panel').hidden=chosen.missing||chosen.recovered;
    paging();bindLabel(true);
    const cards=loaded.map((c,j)=>{
      const b=document.createElement('button'),holder=document.createElement('span');
      b.className='case-card';b.dataset.case=c.id;b.setAttribute('aria-pressed',String(start+j===current));
      const title=document.createElement('strong');title.textContent=c.camera+' · '+(c.missing?'관절 미검출':c.frames.length===1?'단일 자세':c.frames.length+'프레임');
      const pos=document.createElement('small');pos.textContent=c.code+' · #'+c.frames[0].index;
      if(!c.missing){
        const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
        try{portrait(canvas,learnedPose(c,c.preview));holder.append(canvas);}catch(e){console.warn(e);}
      }
      if(!holder.childNodes.length){
        const img=document.createElement('img');img.src=c.frames[0].image;img.alt='원본 장면';holder.append(img);
      }
      b.append(holder,title,pos);b.onclick=run(()=>display(start+j));return b;
    });
    $('#case-grid').replaceChildren(...cards);
    $('#catalog-message').textContent='';
  }
  async function filter(prefer){
    previousList=null;
    const rev=++generation,cam=$('#camera-list').value,mode=$('#sample-filter').value;
    const matches=r=>mode==='all'||(mode==='missing'?r.missing:!r.missing&&(mode==='motion'?r.length>1:r.length===1));
    const cams=cam==='all'?Object.keys(group?.cameras||{}).sort():[cam];
    const lists=groupRows!==null?[groupRows.filter(r=>(cam==='all'||r.cam===cam)&&matches(r))]:await Promise.all(cams.map(async camera=>{
      const values=await resource(group.code+'-'+camera+'-index');
      return values.map(([id,length,first,last,missing],index)=>({id,length,first,last,missing,index,cam:camera,code:group.code})).filter(matches);
    }));
    if(rev!==generation||!active)return;
    rows=[];
    // Interleave actual cameras when showing all so the opening grid offers different views.
    for(let i=0;i<Math.max(...lists.map(a=>a.length));i++)for(const list of lists)if(list[i])rows.push(list[i]);
    if(prefer&&rows.length){
      const n=rows.findIndex(r=>r.id===prefer);
      if(n>0)rows.unshift(...rows.splice(n,1));
    }
    if(!rows.length){
      current=0;paging();$('#case-grid').replaceChildren();$('#catalog-message').textContent='이 조건에 해당하는 원본 사례가 없습니다.';
      currentTrack=null;show(null);$('#annotation-panel').hidden=true;return;
    }
    await display(0,rev);
  }
  async function action(){
    const rev=++generation,mode=$('#group-mode').value,key=$('#action-list').value;
    let next,items=null;
    if(mode==='pattern'){
      next=patterns.groups.find(g=>g.id===key);
      const refs=await resource(key+'-index');
      items=refs.map(([code,cam,index,length,first,last,id])=>({code,cam,index,length,first,last,id}));
    }else if(mode==='manual'){
      const saved=readLabels();const entries=Object.values(saved).filter(a=>a.situation===key);
      const list=new Map();
      for(const a of entries){
        if(a.scope==='pattern'){
          const existing=patterns.groups.find(g=>g.id===a.pattern);
          if(!existing||(a.membership&&existing.fingerprint!==a.membership))continue;
          for(const [code,cam,index,length,,,id] of await resource(a.pattern+'-index')){
            if(!saved[id]||saved[id].situation===key)list.set(id,{code,cam,index,length,id});
          }
        }else{
          const lookup=await resource(a.code+'-'+a.camera+'-index');
          const index=lookup[a.caseIndex]?.[0]===a.track?a.caseIndex:lookup.findIndex(r=>r[0]===a.track);
          if(index>=0)list.set(a.track+(a.frame||''),{code:a.code,cam:a.camera,index,length:a.frames.length,frame:a.frame,id:a.track});
        }
      }
      items=[...list.values()];
      next={cameras:Object.fromEntries(items.map(r=>[r.cam,true]))};
    }else next=manifest.groups.find(g=>g.code===key);
    if(rev!==generation||!active)return;
    group=next;groupRows=items;
    for(const b of $('#pattern-cards').children)b.setAttribute('aria-pressed',String(mode==='pattern'&&b.dataset.pattern===key));
    $('#camera-list').replaceChildren(option('all','모든 카메라'),...Object.keys(group.cameras).sort().map(c=>option(c,c+' · '+(mode==='code'?'원본 '+format(group.cameras[c].images)+'장':format(items.filter(r=>r.cam===c).length)+'사례'))));
    $('#sample-filter').value='all';
    await filter(group.representative?.id);
  }
  async function modeChanged(){
    const mode=$('#group-mode').value,list=$('#action-list');
    $('#group-caption').textContent={pattern:'동작 패턴',code:'원본 장면 코드',manual:'내 상황명'}[mode];
    if(mode==='pattern'){
      const ordered=patterns.groups.slice().sort((a,b)=>a.family.localeCompare(b.family)||b.count-a.count);
      list.replaceChildren(...ordered.map(g=>option(g.id,(g.family==='motion'?'연속':'단일')+' '+g.id.split('-')[1]+' · '+g.name+' ('+format(g.count)+')')));
      const lift=ordered.find(g=>g.family==='motion'&&g.name.startsWith('오른팔 올리기'));
      if(lift)list.value=lift.id;
    }else if(mode==='code'){
      list.replaceChildren(...manifest.groups.map(g=>option(g.code,g.name+' / '+g.code+' · '+format(g.images)+'장')));
      list.value='SMS-FSM';
    }else{
      const names=Array.from(new Set(Object.values(readLabels()).map(a=>a.situation))).sort();
      list.replaceChildren(...(names.length?names.map(n=>option(n,n)):[option('','저장한 분류 없음')]));
    }
    await action();
  }
  async function open(){
    activate(true);
    [manifest,patterns]=await Promise.all([resource('manifest'),resource('patterns')]);
    if(!active)return;
    const s=manifest.stats;
    $('#pattern-strip').hidden=false;
    if(!$('#pattern-cards').childElementCount)makePatternCards();
    $('#catalog-total').textContent='원본 '+format(s.images)+'장 · 카메라 '+s.cameras+'대 · 선수 자세 '+format(s.poses)+'개';
    $('#tab-data').textContent='원본 모션 · '+patterns.groups.length+'묶음';
    if(!group){
      await modeChanged();
    }else if(rows.length)await display(current);
    else await filter();
  }
  function makePatternCards(){
    const all=patterns.groups;
    const dynamic=all.filter(g=>g.family==='motion').length;
    $('#pattern-summary').textContent='연속 동작 '+dynamic+' · 단일 자세 '+(all.length-dynamic);
    const shown=new Set();
    const ordered=all.slice().sort((a,b)=>a.family.localeCompare(b.family)||b.count-a.count);
    const distinct=[],rest=[];
    for(const g of ordered){
      if(shown.has(g.name))rest.push(g);else{distinct.push(g);shown.add(g.name);}
    }
    const observer=new IntersectionObserver(entries=>{
      for(const e of entries)if(e.isIntersecting){
        observer.unobserve(e.target);const b=e.target,g=all.find(g=>g.id===b.dataset.pattern);
        if(g.previewFrames?.length){
          const c=prepareTrack({code:'preview',frames:g.previewFrames});
          const canvas=b.querySelector('canvas');
          portrait(canvas,learnedPose(c,c.preview));
          if(c.frames.length>1){
            let images,timer;
            function stop(){clearInterval(timer);timer=null;if(images)canvas.getContext('2d').drawImage(images[Math.floor(images.length/2)],0,0);}
            function play(){
              if(timer||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
              images??=c.frames.map(f=>{const img=document.createElement('canvas');portrait(img,learnedPose(c,f.at));return img;});
              let i=0;const next=()=>canvas.getContext('2d').drawImage(images[i++%images.length],0,0);
              next();timer=setInterval(next,330);
            }
            b.onpointerenter=b.onfocus=play;b.onpointerleave=b.onblur=stop;
          }
        }
      }
    },{rootMargin:'160px'});
    for(const g of [...distinct,...rest]){
      const b=document.createElement('button');b.className='pattern-card';b.dataset.pattern=g.id;
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
      const text=document.createElement('span'),title=document.createElement('strong'),metric=document.createElement('small');
      title.textContent=g.name;metric.textContent=(g.family==='motion'?'연속':'단일')+' '+g.id.split('-')[1]+' · '+format(g.count)+'사례';
      b.title='대표 자세의 무릎 '+g.kneeDegrees+'° · 발 간격 '+g.footSpanCm+' cm';
      text.append(title,metric);b.append(canvas,text);
      b.onclick=run(async()=>{
        if($('#group-mode').value!=='pattern'){
          $('#group-mode').value='pattern';await modeChanged();
        }
        $('#action-list').value=g.id;await action();
        if($('#pattern-strip').classList.contains('expanded'))$('#expand-patterns').click();
      });
      $('#pattern-cards').append(b);observer.observe(b);
    }
  }
  $('#expand-patterns').onclick=()=>{
    const expanded=$('#pattern-strip').classList.toggle('expanded');
    $('#expand-patterns').setAttribute('aria-expanded',String(expanded));
    $('#expand-patterns').textContent=expanded?'접기':'전체 펼치기';
  };
  $('#action-list').onchange=run(action);
  $('#group-mode').onchange=run(modeChanged);
  $('#camera-list').onchange=run(()=>filter());$('#sample-filter').onchange=run(()=>filter());
  $('#case-prev').onclick=run(()=>display(Math.max(0,(Math.floor(current/pageSize)-1)*pageSize)));
  $('#case-next').onclick=run(()=>display((Math.floor(current/pageSize)+1)*pageSize));
  $('#case-jump').onchange=run(()=>display((parseInt($('#case-jump').value,10)||1)-1));
  $('#nearby').onclick=run(async()=>{
    if(previousList){
      const original=previousList;previousList=null;rows=original.rows;await display(original.index);return;
    }
    if(!currentTrack||currentTrack.missing)return;
    const rev=++generation,focus=rows[current],pattern=currentTrack.pattern;
    const [rankings,refs]=await Promise.all([resource(focus.code+'-'+focus.cam+'-similar'),resource(pattern+'-index')]);
    if(rev!==generation||!active)return;
    previousList={rows,index:current};
    rows=[focus,...rankings[focus.index].map(i=>{
      const [code,cam,index,length,first,last,id]=refs[i];return {code,cam,index,length,first,last,id};
    })];
    await display(0,rev);
  });
  $('#label-target').onchange=()=>{pauseAtSource();bindLabel(true);};
  $('#user-label').onfocus=()=>{pauseAtSource();bindLabel();};
  $('#save-label').onclick=()=>{
    const {clip,frame}=getSelection();if(!clip?.code||clip.missing)return;
    const scope=$('#label-target').value,id=scope==='pattern'?'pattern:'+clip.pattern:clip.id+(scope==='frame'?'#'+frame.index:'');
    const situation=$('#user-label').value.trim(),latest=readLabels();
    if(situation&&scope==='pattern'){
      const group=patterns.groups.find(g=>g.id===clip.pattern);
      latest[id]={situation,scope,pattern:clip.pattern,trackCount:group.count,membership:group.fingerprint};
    }
    else if(situation)latest[id]={situation,scope,track:clip.id,pattern:clip.pattern,caseIndex:rows[current].index,code:clip.code,camera:clip.camera,source:clip.source,
      frames:clip.frames.map(f=>f.member),frame:scope==='frame'?frame.member:null};
    else delete latest[id];
    try{localStorage.setItem(storageKey,JSON.stringify(latest));allLabels=latest;bindLabel(true);}
    catch{$('#label-status').textContent='브라우저 저장 공간을 확인하세요.';}
  };
  $('#export-labels').onclick=()=>download({version:1,assignments:Object.values(readLabels())},'배드민턴-내-상황분류.json');
  return {open:run(open),activate,bindLabel};
}
