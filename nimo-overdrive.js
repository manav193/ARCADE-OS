const GAME_MODIFIERS={snake:['INVINCIBLE WALLS','SPAWN FOOD','SCORE MULTIPLIER'],breakout:['MULTIBALL','WIDE PADDLE','INFINITE LIVES'],pong:['PADDLE BOOST','BALL SPEED','AI DIFFICULTY'],blockdrop:['NEXT PIECE DEBUG','GRAVITY SPEED','CLEAR BOARD'],voidinvaders:['INVINCIBLE','RAPID FIRE','SPREAD SHOT','NEXT WAVE'],vectordrift:['INVINCIBLE','TRIPLE SHOT','THRUST BOOST','ASTEROID SPAWN']};
const GAME_IDS=Object.keys(GAME_MODIFIERS);
const norm=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

export function installNimoOverdrive(ArcadeOS){
  if(!ArcadeOS||ArcadeOS.cheats)return;
  const {registerApp,bus,storage}=ArcadeOS;
  const state={authorized:false,discovered:storage.get('overdriveDiscovered',false),enabled:false,sessionCode:null,gameSpeed:1,activeGameId:null,isCheatSession:false,modifiers:new Map(),automation:new Map()};

  const api={
    get authorized(){return state.authorized},get discovered(){return state.discovered},get enabled(){return state.enabled},get sessionCode(){return state.sessionCode},get gameSpeed(){return state.gameSpeed},get activeGameId(){return state.activeGameId},get isCheatSession(){return state.isCheatSession},
    authorizeFromNimo,openServiceAccess:()=>ArcadeOS.openApp('overdrive'),enable,restoreStandardMode,setSpeed,toggleModifier,hasModifier,getSpeedScale:()=>state.enabled?state.gameSpeed:1,shouldBlockScore:()=>state.isCheatSession,getModifiers:id=>[...(state.modifiers.get(id)||[])],markCheatSession,processNimoQuery
  };

  registerApp({id:'nimo',icon:'N',title:'NIMO SYSTEM INTELLIGENCE',name:'NIMO',description:'Local ArcadeOS assistant and hidden service guide',render:renderNimo});
  registerApp({id:'overdrive',icon:'Ø',title:'CLASSIFIED SERVICE ACCESS',name:'Overdrive Core',description:'NIMO-authorized developer override',render:renderOverdrive});

  bus.addEventListener('app:opened',event=>{const id=event.detail?.id;if(GAME_IDS.includes(id)){state.activeGameId=id;state.isCheatSession=state.enabled&&(state.gameSpeed!==1||(state.modifiers.get(id)?.size||0)>0);syncIndicator();}});
  bus.addEventListener('app:closed',event=>{if(event.detail?.id===state.activeGameId){stopAutomation(state.activeGameId);state.activeGameId=null;syncIndicator();}});
  document.addEventListener('click',handleClick);
  document.addEventListener('keydown',event=>{if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==='n')ArcadeOS.openApp('nimo');});

  ArcadeOS.cheats=api;
  if(ArcadeOS.services)ArcadeOS.services.cheats=api;
  window.NIMO={processUserQuery:processNimoQuery};
  window.authorizeArcadeDeveloperMode=authorizeFromNimo;

  function renderNimo(){return `<div class="nimo-shell"><div class="nimo-head"><span>NIMO // LOCAL INTELLIGENCE</span><strong>Ask the machine.</strong><small>Try asking about Arcade secrets.</small></div><div class="nimo-log" data-nimo-log><div class="nimo-message">I am NIMO. I can explain ArcadeOS, launch apps, and sometimes reveal what the normal menus hide.</div></div><form class="nimo-input" data-nimo-form><input data-nimo-input autocomplete="off" placeholder="Ask NIMO something..."><button>TRANSMIT</button></form></div>`}

  function renderOverdrive(){
    if(!state.authorized)return `<div class="locked-core"><span>CLASSIFIED SERVICE</span><strong>AUTHORIZATION REQUIRED</strong><p>This service cannot be opened from normal Developer Mode. Ask NIMO about a deeper Arcade secret.</p><button data-open="nimo">OPEN NIMO</button></div>`;
    const game=state.activeGameId||'snake',mods=GAME_MODIFIERS[game]||[];
    return `<div class="overdrive-shell"><header><div><small>PROJECT // MA-X01</small><h2>DEVELOPER CORE</h2></div><span>NIMO AUTHORIZED</span></header><div class="overdrive-code">${state.sessionCode}</div><section class="overdrive-switch"><div><small>SESSION CONTROL</small><strong>OVERDRIVE: ${state.enabled?'ON':'OFF'}</strong></div><button data-overdrive-action="${state.enabled?'restore':'enable'}">${state.enabled?'RESTORE STANDARD MODE':'ENABLE OVERDRIVE'}</button></section><p class="overdrive-lore">Modified runs are isolated from fair-play records. Restore Standard Mode before attempting a clean high score.</p>${state.enabled?`<section class="overdrive-console"><div class="overdrive-title"><span>ACTIVE GAME</span><b>${game.toUpperCase()}</b></div><label>GAME SPEED<select data-overdrive-speed>${[.5,.75,1,1.25,1.5,2].map(v=>`<option value="${v}" ${v===state.gameSpeed?'selected':''}>${v}x</option>`).join('')}</select></label><div class="overdrive-grid">${mods.map(label=>{const id=norm(label);return `<button data-overdrive-modifier="${id}" class="${hasModifier(game,id)?'active':''}">${label}</button>`}).join('')}</div></section>`:''}</div>`;
  }

  function handleClick(event){
    const form=event.target.closest('[data-nimo-form]');
    if(form&&event.target.matches('button')){event.preventDefault();submitNimo(form);return}
    const action=event.target.closest('[data-overdrive-action]');if(action){action.dataset.overdriveAction==='enable'?enable():restoreStandardMode();refreshCore();}
    const mod=event.target.closest('[data-overdrive-modifier]');if(mod){toggleModifier(state.activeGameId||'snake',mod.dataset.overdriveModifier);refreshCore();}
  }
  document.addEventListener('submit',event=>{const form=event.target.closest('[data-nimo-form]');if(form){event.preventDefault();submitNimo(form)}});
  document.addEventListener('change',event=>{if(event.target.matches('[data-overdrive-speed]')){setSpeed(Number(event.target.value));refreshCore();}});

  function submitNimo(form){const input=form.querySelector('[data-nimo-input]'),log=form.closest('.nimo-shell').querySelector('[data-nimo-log]');const raw=input.value.trim();if(!raw)return;log.insertAdjacentHTML('beforeend',`<div class="nimo-message user">${escapeHtml(raw)}</div>`);const reply=processNimoQuery(raw);log.insertAdjacentHTML('beforeend',`<div class="nimo-message">${escapeHtml(reply.text)}</div>${reply.action?`<button class="nimo-action" data-open="${reply.action}">${reply.label}</button>`:''}`);input.value='';log.scrollTop=log.scrollHeight;}

  function processNimoQuery(raw){const text=String(raw).toLowerCase();if(/deeper arcade secret|show deeper|authorize service|override/.test(text)){const auth=authorizeFromNimo();return{text:`${auth.text} Session code: ${auth.code}. Developer Overdrive remains OFF until you enable it.`,action:'overdrive',label:'OPEN SERVICE ACCESS'}}if(/secret|easter egg|hidden|cabinet/.test(text))return{text:'The cabinet has a service layer that normal menus do not advertise. Ask me to show the deeper Arcade secret.'};if(/developer|cheat|overdrive/.test(text))return{text:state.authorized?'Service authorization is active for this session. Open the classified core when ready.':'Normal Developer Mode is public. The deeper override requires a specific NIMO authorization path.',action:state.authorized?'overdrive':null,label:'OPEN CORE'};if(/games|apps/.test(text))return{text:`ArcadeOS currently has ${ArcadeOS.registry.size} registered applications.`,action:'library',label:'OPEN LIBRARY'};return{text:'I can help with apps, games, settings, diagnostics, or secrets hidden inside ArcadeOS.'};}

  function authorizeFromNimo(){if(!state.sessionCode){const values=new Uint16Array(2);crypto.getRandomValues(values);state.sessionCode=`NIMO://OVERRIDE-${values[0].toString(36).toUpperCase()}${values[1].toString(36).toUpperCase()}`;}state.authorized=true;state.discovered=true;storage.set('overdriveDiscovered',true);document.body.classList.add('nimo-service-authorized');ArcadeOS.audio?.play('confirm');bus.dispatchEvent(new CustomEvent('nimo:override-authorized',{detail:{code:state.sessionCode}}));return{code:state.sessionCode,text:'Override accepted. The machine has more layers than it shows.'};}
  function enable(){if(!state.authorized)return false;state.enabled=true;document.body.classList.add('arcade-overdrive');markCheatSession();ArcadeOS.audio?.play('launch');bus.dispatchEvent(new CustomEvent('overdrive:enabled'));return true;}
  function restoreStandardMode(){state.enabled=false;state.gameSpeed=1;state.modifiers.clear();state.isCheatSession=false;state.automation.forEach((_,id)=>stopAutomation(id));document.body.classList.remove('arcade-overdrive');document.getElementById('arcade-cheat-indicator')?.remove();bus.dispatchEvent(new CustomEvent('overdrive:disabled'));}
  function setSpeed(value){state.gameSpeed=Math.max(.5,Math.min(2,Number(value)||1));if(state.gameSpeed!==1)markCheatSession();}
  function toggleModifier(gameId,modifier){if(!state.enabled||!gameId)return;if(!state.modifiers.has(gameId))state.modifiers.set(gameId,new Set());const set=state.modifiers.get(gameId);set.has(modifier)?set.delete(modifier):set.add(modifier);markCheatSession();applyModifier(gameId,modifier,set.has(modifier));}
  function hasModifier(gameId,modifier){return !!state.modifiers.get(gameId)?.has(modifier)}
  function markCheatSession(){state.isCheatSession=true;syncIndicator();}
  function applyModifier(gameId,modifier,active){
    if(['rapid_fire','triple_shot','spread_shot'].includes(modifier)){active?startAutoFire(gameId):stopAutomation(gameId);}
    if(modifier==='paddle_boost'&&active)repeatKey(gameId,'ArrowUp',5);
    if(modifier==='spawn_food'&&active)repeatKey(gameId,'ArrowRight',3);
    if(modifier==='clear_board'&&active)bus.dispatchEvent(new CustomEvent('cheat:command',{detail:{gameId,modifier}}));
    bus.dispatchEvent(new CustomEvent('cheat:modifier',{detail:{gameId,modifier,active}}));
  }
  function startAutoFire(gameId){stopAutomation(gameId);const timer=setInterval(()=>{if(state.activeGameId===gameId&&state.enabled)ArcadeOS.controls?.emitKey(' ')},120);state.automation.set(gameId,timer);}
  function stopAutomation(gameId){const timer=state.automation.get(gameId);if(timer)clearInterval(timer);state.automation.delete(gameId);}
  function repeatKey(gameId,key,count){if(state.activeGameId!==gameId)return;for(let i=0;i<count;i++)setTimeout(()=>ArcadeOS.controls?.emitKey(key),i*45);}
  function syncIndicator(){let node=document.getElementById('arcade-cheat-indicator');if(!state.enabled||!state.isCheatSession){node?.remove();return}if(!node){node=document.createElement('div');node.id='arcade-cheat-indicator';node.className='arcade-cheat-indicator';document.body.appendChild(node)}node.textContent='DEV MODIFIED // SCORE INVALID';}
  function refreshCore(){const win=document.querySelector('.os-window[data-app="overdrive"] .window-content');if(win)win.innerHTML=renderOverdrive();}
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
