import { installGameControls } from './game-controls.js';
import { installNimoOverdrive } from './nimo-overdrive.js';
import { installCheatScoreGuard } from './cheat-score-guard.js';

const GAME_MUSIC={
  snake:{name:'Neon Circuit',bpm:132,wave:'square',bass:[45,45,52,45,57,52,48,43],lead:[69,72,76,72,69,67,64,67]},
  breakout:{name:'Brick Pulse',bpm:124,wave:'triangle',bass:[40,40,47,47,43,43,38,38],lead:[64,67,71,67,62,67,69,67]},
  pong:{name:'Digital Rally',bpm:142,wave:'square',bass:[38,45,38,45,41,48,41,48],lead:[74,71,69,71,76,71,69,67]},
  blockdrop:{name:'Stack Protocol',bpm:116,wave:'triangle',bass:[43,50,47,50,43,50,45,52],lead:[67,71,74,71,67,69,71,74]},
  voidinvaders:{name:'Void March',bpm:108,wave:'sawtooth',bass:[33,33,36,31,33,38,36,31],lead:[57,60,64,60,55,60,62,55]},
  vectordrift:{name:'Vector Horizon',bpm:150,wave:'triangle',bass:[36,43,48,43,38,45,50,45],lead:[72,76,79,76,74,77,81,77]}
};

export function installArcadeMusic(ArcadeOS){
  if(!ArcadeOS||ArcadeOS.music)return;
  const {bus,storage,registerApp}=ArcadeOS;
  const service=createMusicService(storage);
  ensureControlStyles();
  ensureOverdriveStyles();

  registerApp({id:'music',icon:'♪',title:'ARCADE MUSIC',name:'Music Mixer',description:'Per-game procedural soundtrack and volume controls',render:()=>renderMixer(service)});

  bus.addEventListener('app:opened',event=>{const id=event.detail?.id;if(GAME_MUSIC[id])service.play(id)});
  bus.addEventListener('app:closed',event=>{const id=event.detail?.id;if(GAME_MUSIC[id])service.stop(id)});
  bus.addEventListener('game:score',event=>{const id=event.detail?.id;if(GAME_MUSIC[id])service.stop(id,true)});

  document.addEventListener('click',event=>{
    const restart=event.target.closest('[data-restart-game],[data-exp-restart]');
    if(restart){const id=restart.dataset.restartGame||restart.dataset.expRestart;if(GAME_MUSIC[id])setTimeout(()=>service.play(id),0)}
    if(event.target.closest('[data-music-toggle]')){service.setEnabled(!service.enabled);refreshMixer(event.target.closest('.os-window'),service)}
    if(event.target.closest('[data-music-stop]')){service.stop();refreshMixer(event.target.closest('.os-window'),service)}
    const preview=event.target.closest('[data-music-preview]');if(preview)service.play(preview.dataset.musicPreview,true);
  });
  document.addEventListener('input',event=>{
    if(!event.target.matches('[data-music-volume]'))return;
    service.setVolume(Number(event.target.value)/100);
    const value=event.target.closest('.setting')?.querySelector('[data-music-volume-value]');if(value)value.textContent=`${event.target.value}%`;
  });
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-setting-sound]'))return;
    if(!event.target.checked)service.stop();else service.setEnabled(true);
  });

  ArcadeOS.music=service;
  if(ArcadeOS.services)ArcadeOS.services.music=service;
  installGameControls(ArcadeOS);
  installNimoOverdrive(ArcadeOS);
  installCheatScoreGuard(ArcadeOS);
}

function createMusicService(storage){
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  let context=null,master=null,timer=null,activeGame=null,step=0;
  let enabled=storage.get('musicEnabled',true);
  let volume=Math.max(0,Math.min(1,storage.get('musicVolume',.16)));
  function ensure(){if(!AudioContextClass)return null;if(!context){context=new AudioContextClass();master=context.createGain();master.gain.value=volume;master.connect(context.destination)}if(context.state==='suspended')context.resume().catch(()=>{});return context}
  function note(midi,start,duration,type,gain){const ctx=ensure();if(!ctx||!master)return;const osc=ctx.createOscillator(),env=ctx.createGain();osc.type=type;osc.frequency.value=440*Math.pow(2,(midi-69)/12);env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(gain,start+.015);env.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(env).connect(master);osc.start(start);osc.stop(start+duration+.03)}
  function schedule(){if(!enabled||!activeGame||!GAME_MUSIC[activeGame])return;const ctx=ensure();if(!ctx)return;const track=GAME_MUSIC[activeGame],speed=window.ArcadeOS?.cheats?.getSpeedScale?.()||1,beat=(60/track.bpm)/speed,now=ctx.currentTime+.025,index=step%track.bass.length;note(track.bass[index],now,beat*.78,'triangle',.18);note(track.lead[index],now+beat*.5,beat*.34,track.wave,.075);if(index%2===0)note(track.bass[index]+12,now,beat*.12,'square',.025);step++}
  function play(gameId,preview=false){if(!GAME_MUSIC[gameId])return;activeGame=gameId;step=0;clearInterval(timer);if(!enabled||!storage.get('sound',true))return;schedule();const speed=window.ArcadeOS?.cheats?.getSpeedScale?.()||1;timer=setInterval(schedule,((60/GAME_MUSIC[gameId].bpm)*1000)/speed);if(preview)setTimeout(()=>{if(activeGame===gameId)stop(gameId)},8000);storage.set('lastMusicTrack',gameId)}
  function stop(gameId=null,fade=false){if(gameId&&activeGame!==gameId)return;clearInterval(timer);timer=null;if(fade&&master&&context){const now=context.currentTime;master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(Math.max(master.gain.value,.0001),now);master.gain.exponentialRampToValueAtTime(.0001,now+.35);setTimeout(()=>{if(master)master.gain.value=volume},400)}activeGame=null}
  function setEnabled(value){enabled=Boolean(value);storage.set('musicEnabled',enabled);if(!enabled)stop()}
  function setVolume(value){volume=Math.max(0,Math.min(1,value));storage.set('musicVolume',volume);if(master&&context)master.gain.setTargetAtTime(volume,context.currentTime,.03)}
  return{supported:Boolean(AudioContextClass),get enabled(){return enabled},get volume(){return volume},get activeGame(){return activeGame},tracks:GAME_MUSIC,play,stop,setEnabled,setVolume};
}

function renderMixer(service){return `<div class="music-shell"><div class="system-panel__hero"><span>PROCEDURAL AUDIO</span><strong>Arcade Music Mixer</strong><small>Original synthesized loops generated locally with Web Audio.</small></div><div class="settings-list"><div class="setting"><div><strong>Background music</strong><small>${service.supported?'Play a unique loop for every game':'Web Audio is unavailable'}</small></div><button data-music-toggle>${service.enabled?'DISABLE':'ENABLE'}</button></div><div class="setting"><div><strong>Music volume</strong><small data-music-volume-value>${Math.round(service.volume*100)}%</small></div><input type="range" min="0" max="40" value="${Math.round(service.volume*100)}" data-music-volume></div><div class="setting"><div><strong>Now playing</strong><small>${service.activeGame?GAME_MUSIC[service.activeGame].name:'No active game soundtrack'}</small></div><button data-music-stop>STOP</button></div></div><div class="music-track-grid">${Object.entries(GAME_MUSIC).map(([id,track])=>`<article><span>${track.bpm} BPM</span><strong>${track.name}</strong><small>${label(id)}</small><button data-music-preview="${id}">PREVIEW</button></article>`).join('')}</div></div>`}
function refreshMixer(win,service){const host=win?.querySelector('.window-content');if(host)host.innerHTML=renderMixer(service)}
function ensureControlStyles(){if(document.querySelector('link[data-game-controls-css]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./game-controls.css';link.dataset.gameControlsCss='';document.head.appendChild(link)}
function ensureOverdriveStyles(){if(document.querySelector('link[data-nimo-overdrive-css]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./nimo-overdrive.css';link.dataset.nimoOverdriveCss='';document.head.appendChild(link)}
function label(id){return id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^(.)/,value=>value.toUpperCase())}
