const SESSION_KEY='workspace-session';
const GAME_IDS=new Set(['snake','breakout','pong','blockdrop','voidinvaders','vectordrift']);
const MAX_WINDOWS=10;
const SAVE_DELAY=180;

export function installWorkspaceSession(ArcadeOS){
  if(!ArcadeOS||ArcadeOS.workspaceSessionInstalled)return;
  const layer=document.querySelector('[data-window-layer]');
  if(!layer)return;

  let saveTimer=0;
  let restoring=false;
  let observer=null;

  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const isRestorable=id=>ArcadeOS.registry?.has(id)&&id!=='library';
  const snapshotWindow=win=>{
    const rect=win.getBoundingClientRect();
    return{
      id:win.dataset.app,
      minimized:win.classList.contains('is-min'),
      maximized:win.classList.contains('is-max'),
      left:Math.round(rect.left),
      top:Math.round(rect.top),
      width:Math.round(rect.width),
      height:Math.round(rect.height),
      z:Number.parseInt(win.style.zIndex||'0',10)||0
    };
  };

  function getSnapshot(){
    const windows=[...layer.querySelectorAll('.os-window[data-app]')]
      .filter(win=>isRestorable(win.dataset.app))
      .sort((a,b)=>(Number.parseInt(a.style.zIndex||'0',10)||0)-(Number.parseInt(b.style.zIndex||'0',10)||0))
      .slice(-MAX_WINDOWS)
      .map(snapshotWindow);
    return{version:1,savedAt:new Date().toISOString(),windows};
  }

  function persist(){
    if(restoring)return;
    clearTimeout(saveTimer);
    saveTimer=window.setTimeout(()=>ArcadeOS.storage.set(SESSION_KEY,getSnapshot()),SAVE_DELAY);
  }

  function applyGeometry(win,state){
    if(state.maximized){win.classList.add('is-max');return;}
    const maxLeft=Math.max(0,window.innerWidth-Math.min(state.width||win.offsetWidth,window.innerWidth));
    const maxTop=Math.max(0,window.innerHeight-Math.min(state.height||win.offsetHeight,window.innerHeight)-54);
    win.style.transform='none';
    win.style.left=`${clamp(state.left,0,maxLeft)}px`;
    win.style.top=`${clamp(state.top,0,maxTop)}px`;
  }

  async function restore(){
    const saved=ArcadeOS.storage.get(SESSION_KEY,null);
    if(!saved||saved.version!==1||!Array.isArray(saved.windows)||!saved.windows.length)return{restored:0,skipped:0};
    restoring=true;
    let restored=0,skipped=0;
    try{
      const states=saved.windows.slice(-MAX_WINDOWS);
      for(const state of states){
        if(!state?.id||!isRestorable(state.id)){skipped++;continue;}
        ArcadeOS.openApp(state.id);
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const win=layer.querySelector(`.os-window[data-app="${CSS.escape(state.id)}"]`);
        if(!win){skipped++;continue;}
        applyGeometry(win,state);
        win.classList.toggle('is-min',Boolean(state.minimized));
        restored++;
      }
    }finally{
      restoring=false;
      persist();
    }
    return{restored,skipped};
  }

  function clear(){
    ArcadeOS.storage.set(SESSION_KEY,{version:1,savedAt:new Date().toISOString(),windows:[]});
    document.dispatchEvent(new CustomEvent('workspace:cleared'));
  }

  function handleClick(event){
    if(event.target.closest('[data-clear-workspace]')){
      clear();
      document.querySelectorAll('.os-window[data-app]').forEach(win=>win.querySelector('[data-close]')?.click());
    }
  }

  observer=new MutationObserver(persist);
  observer.observe(layer,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-app']});
  window.addEventListener('resize',persist,{passive:true});
  window.addEventListener('pagehide',()=>{
    clearTimeout(saveTimer);
    if(!restoring)ArcadeOS.storage.set(SESSION_KEY,getSnapshot());
    observer?.disconnect();
  },{once:true});
  document.addEventListener('click',handleClick);

  const controls=document.createElement('div');
  controls.className='workspace-session-controls';
  controls.innerHTML='<button type="button" data-clear-workspace title="Close all windows and clear the saved workspace">RESET WORKSPACE</button>';
  document.querySelector('.topbar__status')?.prepend(controls);

  ArcadeOS.workspaceSession={restore,persist,clear,getSnapshot};
  ArcadeOS.services={...(ArcadeOS.services||{}),workspaceSession:ArcadeOS.workspaceSession};
  ArcadeOS.workspaceSessionInstalled=true;

  requestAnimationFrame(()=>restore().then(result=>{
    document.body.dataset.workspaceRestored=String(result.restored);
    ArcadeOS.bus?.dispatchEvent(new CustomEvent('workspace:restored',{detail:result}));
  }));
}
