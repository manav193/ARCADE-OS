const GAME_IDS=['snake','breakout','pong','blockdrop','voidinvaders','vectordrift'];
const GAME_META={snake:{title:'NEON SNAKE',controls:'Swipe or use the D-pad'},breakout:{title:'NEON BREAKOUT',controls:'Move the paddle left and right'},pong:{title:'NEON PONG',controls:'Move your paddle up and down'},blockdrop:{title:'BLOCK // DROP',controls:'Move, rotate and hard-drop blocks'},voidinvaders:{title:'VOID INVADERS',controls:'Move and fire at the formation'},vectordrift:{title:'VECTOR DRIFT',controls:'Steer, thrust and fire'}};

export function installGameControls(ArcadeOS){
  if(!ArcadeOS||ArcadeOS.controls)return;
  const {bus,storage}=ArcadeOS;
  const sessions=new Map();
  const api={
    isGame:id=>GAME_IDS.includes(id),
    getSession:id=>sessions.get(id)||null,
    pause:id=>pauseGame(id),
    resume:id=>resumeGame(id),
    start:id=>startGame(id),
    emitKey:key=>emitKey(key)
  };

  bus.addEventListener('app:opened',event=>{
    const id=event.detail?.id;if(!GAME_IDS.includes(id))return;
    setTimeout(()=>prepareGame(id),20);
  });
  bus.addEventListener('app:closed',event=>{
    const id=event.detail?.id;if(!GAME_IDS.includes(id))return;
    sessions.delete(id);updateHud();
  });
  bus.addEventListener('game:score',event=>{
    const id=event.detail?.id;if(GAME_IDS.includes(id)){const session=sessions.get(id);if(session)session.state='ended';updateOverlay(id,'ended');}
  });

  document.addEventListener('click',event=>{
    const start=event.target.closest('[data-game-start]');if(start)startGame(start.dataset.gameStart);
    const pause=event.target.closest('[data-game-pause]');if(pause)pauseGame(pause.dataset.gamePause);
    const resume=event.target.closest('[data-game-resume]');if(resume)resumeGame(resume.dataset.gameResume);
    const restart=event.target.closest('[data-game-control-restart]');if(restart)restartGame(restart.dataset.gameControlRestart);
    const key=event.target.closest('[data-touch-key]');if(key)emitKey(key.dataset.touchKey);
    if(event.target.closest('[data-audio-hud-toggle]'))document.querySelector('[data-audio-hud]')?.classList.toggle('is-open');
    if(event.target.closest('[data-audio-master-toggle]'))toggleMasterAudio();
  });
  document.addEventListener('pointerdown',event=>{const key=event.target.closest('[data-touch-key]');if(key){event.preventDefault();emitKey(key.dataset.touchKey)}});
  document.addEventListener('input',event=>{
    if(!event.target.matches('[data-global-volume]'))return;
    const value=Number(event.target.value)/100;
    storage.set('musicVolume',value);
    ArcadeOS.music?.setVolume(value);
    const label=document.querySelector('[data-global-volume-value]');if(label)label.textContent=`${event.target.value}%`;
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      const active=[...sessions.values()].find(item=>item.state==='running');
      if(active)pauseGame(active.id);
    }
  });

  createAudioHud(ArcadeOS);
  ArcadeOS.controls=api;
  if(ArcadeOS.services)ArcadeOS.services.controls=api;

  function prepareGame(id){
    const win=document.querySelector(`.os-window[data-app="${id}"]`);if(!win)return;
    win._cleanup?.();
    const session={id,win,state:'ready'};sessions.set(id,session);
    injectControls(win,id);updateOverlay(id,'ready');updateHud();
  }
  function startGame(id){
    const session=sessions.get(id);if(!session)return;
    session.state='running';hideOverlay(session.win);triggerRestart(session.win,id);ArcadeOS.music?.play(id);updateHud();
  }
  function pauseGame(id){
    const session=sessions.get(id);if(!session||session.state!=='running')return;
    session.win._cleanup?.();session.state='paused';ArcadeOS.music?.stop(id,true);updateOverlay(id,'paused');updateHud();
  }
  function resumeGame(id){
    const session=sessions.get(id);if(!session)return;
    session.state='running';hideOverlay(session.win);triggerRestart(session.win,id);ArcadeOS.music?.play(id);updateHud();
  }
  function restartGame(id){
    const session=sessions.get(id);if(!session)return;
    session.win._cleanup?.();session.state='running';hideOverlay(session.win);triggerRestart(session.win,id);ArcadeOS.music?.play(id);updateHud();
  }
}

function injectControls(win,id){
  const host=win.querySelector('.window-content');if(!host||host.querySelector('[data-game-control-layer]'))return;
  const layer=document.createElement('div');layer.className='game-control-layer';layer.dataset.gameControlLayer=id;
  layer.innerHTML=`<button class="game-pause-button" data-game-pause="${id}" aria-label="Pause game">Ⅱ</button><div class="game-start-overlay" data-game-overlay="${id}"></div><div class="mobile-controls" aria-label="Touch controls"><div class="touch-dpad"><button data-touch-key="ArrowUp">▲</button><button data-touch-key="ArrowLeft">◀</button><button data-touch-key="ArrowDown">▼</button><button data-touch-key="ArrowRight">▶</button></div><button class="touch-action" data-touch-key=" ">ACTION</button></div>`;
  host.appendChild(layer);
}
function updateOverlay(id,state){
  const win=document.querySelector(`.os-window[data-app="${id}"]`);const overlay=win?.querySelector(`[data-game-overlay="${id}"]`);if(!overlay)return;
  const meta=GAME_META[id];overlay.classList.add('is-visible');
  if(state==='ready')overlay.innerHTML=`<span>ARCADEOS GAME SESSION</span><strong>${meta.title}</strong><small>${meta.controls}</small><button class="primary" data-game-start="${id}">START GAME</button>`;
  if(state==='paused')overlay.innerHTML=`<span>SESSION HALTED</span><strong>PAUSED</strong><small>The simulation has stopped safely.</small><div><button class="primary" data-game-resume="${id}">RESUME ROUND</button><button data-game-control-restart="${id}">RESTART</button></div>`;
  if(state==='ended')overlay.innerHTML=`<span>SESSION COMPLETE</span><strong>GAME OVER</strong><small>Run the game again and beat your record.</small><button class="primary" data-game-control-restart="${id}">PLAY AGAIN</button>`;
}
function hideOverlay(win){win.querySelector('[data-game-overlay]')?.classList.remove('is-visible')}
function triggerRestart(win,id){
  const selector=`[data-restart-game="${id}"],[data-exp-restart="${id}"]`;
  const button=win.querySelector(selector);if(button)button.click();
}
function emitKey(key){
  const target=window;target.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  setTimeout(()=>target.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true,cancelable:true})),40);
}
function createAudioHud(ArcadeOS){
  if(document.querySelector('[data-audio-hud]'))return;
  const volume=Math.round((ArcadeOS.storage.get('musicVolume',.16))*100);
  const hud=document.createElement('aside');hud.className='audio-hud';hud.dataset.audioHud='';
  hud.innerHTML=`<button class="audio-hud__trigger" data-audio-hud-toggle aria-label="Open audio controls">♫</button><div class="audio-hud__panel"><div><strong>GLOBAL AUDIO</strong><span data-global-volume-value>${volume}%</span></div><input type="range" min="0" max="40" value="${volume}" data-global-volume><button data-audio-master-toggle>${ArcadeOS.storage.get('sound',true)?'MUTE ALL':'ENABLE AUDIO'}</button><small data-game-session-status>NO ACTIVE GAME</small></div>`;
  document.body.appendChild(hud);
}
function toggleMasterAudio(){
  const os=window.ArcadeOS;if(!os)return;const next=!os.storage.get('sound',true);os.storage.set('sound',next);os.audio?.setEnabled(next);os.music?.setEnabled(next);if(!next)os.music?.stop();
  const button=document.querySelector('[data-audio-master-toggle]');if(button)button.textContent=next?'MUTE ALL':'ENABLE AUDIO';
}
function updateHud(){
  const os=window.ArcadeOS;const label=document.querySelector('[data-game-session-status]');if(!os||!label)return;
  const windows=[...document.querySelectorAll('.os-window')].filter(win=>GAME_IDS.includes(win.dataset.app));
  label.textContent=windows.length?`${windows.length} GAME SESSION${windows.length>1?'S':''} OPEN`:'NO ACTIVE GAME';
}
