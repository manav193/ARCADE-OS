const GAME_IDS = ['snake','breakout','pong','blockdrop','voidinvaders','vectordrift'];

export function installArcadeExpansion(ArcadeOS) {
  if (!ArcadeOS || ArcadeOS.arcadeExpansionInstalled) return;
  const { registerApp, bus, storage, registry } = ArcadeOS;
  const audio = createSoundEngine(storage);

  registerApp({
    id:'blockdrop', icon:'▦', title:'BLOCK // DROP', name:'Block Drop',
    description:'Falling-block puzzle with local high scores',
    render:()=>gameShell('blockdrop','LINES','ARROWS · SPACE')
  });
  registerApp({
    id:'voidinvaders', icon:'⌁', title:'VOID INVADERS', name:'Void Invaders',
    description:'Defend the grid from a descending formation',
    render:()=>gameShell('voidinvaders','SCORE','ARROWS · SPACE')
  });
  registerApp({
    id:'vectordrift', icon:'△', title:'VECTOR DRIFT', name:'Vector Drift',
    description:'Survive an endless vector asteroid field',
    render:()=>gameShell('vectordrift','SCORE','ARROWS · SPACE')
  });
  registerApp({
    id:'stats', icon:'▥', title:'SYSTEM STATS', name:'Stats',
    description:'Application usage, game scores and runtime activity',
    render:()=>renderStats(storage, registry)
  });
  registerApp({
    id:'sound', icon:'♫', title:'SOUND ENGINE', name:'Sound Engine',
    description:'Audio preference, test tones and live sound status',
    render:()=>renderSoundPanel(storage, audio)
  });
  registerApp({
    id:'services', icon:'◇', title:'SERVICE ACCESS', name:'Service Access',
    description:'Developer-facing runtime service catalog',
    render:()=>renderServices(ArcadeOS, audio)
  });

  bus.addEventListener('app:opened', event => {
    const id = event.detail?.id;
    recordUsage(storage, id);
    if (GAME_IDS.includes(id)) audio.play('launch');
    setTimeout(() => {
      const win = document.querySelector(`.os-window[data-app="${id}"]`);
      if (!win) return;
      if (id === 'blockdrop') initBlockDrop(win, storage, audio, bus);
      if (id === 'voidinvaders') initVoidInvaders(win, storage, audio, bus);
      if (id === 'vectordrift') initVectorDrift(win, storage, audio, bus);
    }, 0);
  });

  bus.addEventListener('game:score', event => saveScore(storage, event.detail));
  document.addEventListener('click', event => handleExpansionClick(event, ArcadeOS, audio));
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-sound-enabled]')) return;
    storage.set('sound', event.target.checked);
    audio.setEnabled(event.target.checked);
    bus.dispatchEvent(new CustomEvent('settings:changed',{detail:{key:'sound',value:event.target.checked}}));
  });

  ArcadeOS.audio = audio;
  ArcadeOS.services = {
    registry,
    bus,
    storage,
    audio,
    getRuntimeSnapshot:()=>runtimeSnapshot(ArcadeOS),
    exportState:()=>exportState(storage)
  };
  ArcadeOS.arcadeExpansionInstalled = true;
}

function gameShell(id,label,controls){
  return `<div class="exp-game"><canvas width="480" height="480" data-exp-game="${id}"></canvas><div class="exp-game__meta"><span>${label} <b data-exp-score>0</b></span><span>${controls}</span><button class="primary" data-exp-restart="${id}">RESTART</button></div></div>`;
}

function handleExpansionClick(event, ArcadeOS, audio){
  const restart = event.target.closest('[data-exp-restart]');
  if (restart) {
    const win = restart.closest('.os-window');
    win?._cleanup?.();
    const id = restart.dataset.expRestart;
    if(id==='blockdrop') initBlockDrop(win,ArcadeOS.storage,audio,ArcadeOS.bus);
    if(id==='voidinvaders') initVoidInvaders(win,ArcadeOS.storage,audio,ArcadeOS.bus);
    if(id==='vectordrift') initVectorDrift(win,ArcadeOS.storage,audio,ArcadeOS.bus);
  }
  if(event.target.closest('[data-sound-test]')) audio.play('confirm');
  if(event.target.closest('[data-sound-mute]')) {
    ArcadeOS.storage.set('sound',false); audio.setEnabled(false);
    const toggle=event.target.closest('.os-window')?.querySelector('[data-sound-enabled]'); if(toggle) toggle.checked=false;
  }
  if(event.target.closest('[data-service-copy]')) {
    const value=event.target.closest('[data-service-copy]').dataset.serviceCopy;
    navigator.clipboard?.writeText(value); notify('SERVICE NAME COPIED');
  }
  if(event.target.closest('[data-refresh-stats]')) {
    const host=event.target.closest('.window-content'); if(host) host.innerHTML=renderStats(ArcadeOS.storage,ArcadeOS.registry);
  }
  if(event.target.closest('[data-export-state]')) downloadJSON('arcadeos-state.json', exportState(ArcadeOS.storage));
}

function renderStats(storage, registry){
  const usage=storage.get('usage',{}), scores=storage.get('scores',{}), sessions=storage.get('sessions',1);
  const totalOpens=Object.values(usage).reduce((sum,n)=>sum+Number(n||0),0);
  const topApps=Object.entries(usage).sort((a,b)=>b[1]-a[1]).slice(0,8);
  return `<div class="stats-shell"><div class="metric-grid"><article><span>INSTALLED APPS</span><strong>${registry.size}</strong></article><article><span>APP LAUNCHES</span><strong>${totalOpens}</strong></article><article><span>SESSIONS</span><strong>${sessions}</strong></article><article><span>HIGH SCORES</span><strong>${Object.keys(scores).length}</strong></article></div><div class="stats-columns"><section><div class="panel-heading"><strong>APP ACTIVITY</strong><button data-refresh-stats>REFRESH</button></div>${topApps.length?topApps.map(([id,count])=>`<div class="stat-row"><span>${escapeHtml(id)}</span><i style="--value:${Math.min(100,count*12)}%"></i><b>${count}</b></div>`).join(''):'<p>No activity recorded yet.</p>'}</section><section><div class="panel-heading"><strong>GAME RECORDS</strong></div>${GAME_IDS.map(id=>`<div class="score-row"><span>${id.toUpperCase()}</span><b>${scores[id]||0}</b></div>`).join('')}</section></div></div>`;
}

function renderSoundPanel(storage,audio){
  return `<div class="sound-panel"><div class="system-panel__hero"><span>WEB AUDIO SERVICE</span><strong>Sound Engine</strong><small>Procedural tones only. No external audio assets.</small></div><div class="settings-list"><div class="setting"><div><strong>Sound effects</strong><small>Enable ArcadeOS interface and game tones</small></div><label class="switch"><input type="checkbox" data-sound-enabled ${storage.get('sound',false)?'checked':''}><span></span></label></div><div class="setting"><div><strong>Audio context</strong><small>${audio.supported?'Web Audio API supported':'Audio unavailable in this browser'}</small></div><span class="service-state">${audio.supported?'READY':'UNAVAILABLE'}</span></div><div class="setting"><div><strong>Test output</strong><small>Play a short confirmation sequence</small></div><div class="setting-actions"><button data-sound-test>TEST</button><button data-sound-mute>MUTE</button></div></div></div></div>`;
}

function renderServices(ArcadeOS,audio){
  const services=[
    ['ArcadeOS.registry','Application registration and discovery',ArcadeOS.registry.size+' apps'],
    ['ArcadeOS.bus','System-wide CustomEvent transport','ACTIVE'],
    ['ArcadeOS.storage','Namespaced local persistence',storageAvailable()?'READY':'BLOCKED'],
    ['ArcadeOS.audio','Procedural Web Audio service',audio.supported?'READY':'UNAVAILABLE'],
    ['ArcadeOS.system','Preferences and diagnostics facade','ACTIVE'],
    ['ArcadeOS.services','Runtime integration and export facade','ACTIVE']
  ];
  return `<div class="services-shell"><div class="system-panel__hero"><span>DEVELOPER INTERFACE</span><strong>Service Access</strong><small>Stable public services exposed by the standalone runtime.</small></div><div class="service-grid">${services.map(([name,desc,state])=>`<article><span>${state}</span><strong>${name}</strong><small>${desc}</small><button data-service-copy="${name}">COPY NAME</button></article>`).join('')}</div><div class="developer-actions"><button data-export-state>EXPORT STATE</button><button data-open="developer">OPEN DEV MODE</button><button data-open="diagnostics">RUN DIAGNOSTICS</button></div><pre class="runtime-block">${escapeHtml(JSON.stringify(runtimeSnapshot(ArcadeOS),null,2))}</pre></div>`;
}

function createSoundEngine(storage){
  let context=null, enabled=storage.get('sound',false);
  const supported=Boolean(window.AudioContext||window.webkitAudioContext);
  function ensure(){if(!supported)return null;if(!context)context=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume();return context}
  function tone(freq=440,duration=.08,type='sine',gain=.035,delay=0){if(!enabled)return;const ctx=ensure();if(!ctx)return;const osc=ctx.createOscillator(),amp=ctx.createGain();osc.type=type;osc.frequency.value=freq;amp.gain.setValueAtTime(0,ctx.currentTime+delay);amp.gain.linearRampToValueAtTime(gain,ctx.currentTime+delay+.01);amp.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+duration);osc.connect(amp).connect(ctx.destination);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+duration+.02)}
  return {supported,get enabled(){return enabled},setEnabled(value){enabled=Boolean(value)},play(name){const map={launch:[[220,.06,'square'],[440,.08,'sine',.03,.05]],confirm:[[440,.07,'sine'],[660,.1,'sine',.03,.07]],score:[[740,.06,'square']],hit:[[130,.045,'sawtooth']],gameover:[[300,.1,'sine'],[180,.18,'sawtooth',.025,.1]]};(map[name]||map.confirm).forEach(args=>tone(...args))}};
}

function initBlockDrop(win,storage,audio,bus){
  const canvas=win.querySelector('[data-exp-game="blockdrop"]');if(!canvas)return;const ctx=canvas.getContext('2d'),cols=10,rows=20,size=24,ox=120,board=Array.from({length:rows},()=>Array(cols).fill(0));const shapes=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];let piece=create(),lines=0,running=true,last=0,raf;
  function create(){return{shape:shapes[Math.floor(Math.random()*shapes.length)],x:3,y:0}}
  function collide(dx=0,dy=0,shape=piece.shape){return shape.some((row,y)=>row.some((v,x)=>v&&(piece.x+x+dx<0||piece.x+x+dx>=cols||piece.y+y+dy>=rows||board[piece.y+y+dy]?.[piece.x+x+dx]))) }
  function merge(){piece.shape.forEach((row,y)=>row.forEach((v,x)=>{if(v&&piece.y+y>=0)board[piece.y+y][piece.x+x]=1}));for(let y=rows-1;y>=0;y--){if(board[y].every(Boolean)){board.splice(y,1);board.unshift(Array(cols).fill(0));lines++;y++;audio.play('score')}}win.querySelector('[data-exp-score]').textContent=lines;piece=create();if(collide()){running=false;finish('blockdrop',lines)}}
  function move(dx){if(!collide(dx,0))piece.x+=dx}function drop(){if(!collide(0,1))piece.y++;else merge()}function rotate(){const r=piece.shape[0].map((_,i)=>piece.shape.map(row=>row[i]).reverse());if(!collide(0,0,r))piece.shape=r}
  const key=e=>{if(!running)return;if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);if(e.key==='ArrowDown')drop();if(e.key==='ArrowUp')rotate();if(e.key===' '){while(!collide(0,1))piece.y++;drop()}};window.addEventListener('keydown',key);
  function frame(t){if(!running)return;if(t-last>520){drop();last=t}draw();raf=requestAnimationFrame(frame)}
  function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,480,480);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)cell(x,y,board[y][x]?'#67e8f9':'rgba(103,232,249,.035)');piece.shape.forEach((row,y)=>row.forEach((v,x)=>v&&cell(piece.x+x,piece.y+y,'#a78bfa')))}function cell(x,y,color){ctx.fillStyle=color;ctx.fillRect(ox+x*size+1,y*size+1,size-2,size-2)}
  function finish(id,score){audio.play('gameover');bus.dispatchEvent(new CustomEvent('game:score',{detail:{id,score}}));notify(`GAME OVER // LINES ${score}`)}draw();raf=requestAnimationFrame(frame);win._cleanup=()=>{running=false;cancelAnimationFrame(raf);window.removeEventListener('keydown',key)};
}

function initVoidInvaders(win,storage,audio,bus){
  const canvas=win.querySelector('[data-exp-game="voidinvaders"]');if(!canvas)return;const ctx=canvas.getContext('2d');let player=220,shots=[],enemyShots=[],score=0,running=true,dir=1,lastShot=0,raf;let enemies=Array.from({length:30},(_,i)=>({x:55+(i%6)*68,y:55+Math.floor(i/6)*38,alive:true}));
  const key=e=>{if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')player=Math.max(8,player-24);if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')player=Math.min(432,player+24);if(e.key===' '&&performance.now()-lastShot>180){e.preventDefault();shots.push({x:player+18,y:420});lastShot=performance.now();audio.play('hit')}};window.addEventListener('keydown',key);
  function frame(){if(!running)return;let edge=false;enemies.filter(e=>e.alive).forEach(e=>{e.x+=dir*.45;if(e.x<12||e.x>442)edge=true});if(edge){dir*=-1;enemies.forEach(e=>e.y+=12)}shots.forEach(s=>s.y-=6);enemyShots.forEach(s=>s.y+=3.6);if(Math.random()<.025){const live=enemies.filter(e=>e.alive);const e=live[Math.floor(Math.random()*live.length)];if(e)enemyShots.push({x:e.x+12,y:e.y+12})}for(const s of shots)for(const e of enemies){if(e.alive&&Math.abs(s.x-e.x)<24&&Math.abs(s.y-e.y)<18){e.alive=false;s.y=-20;score+=10;audio.play('score')}}shots=shots.filter(s=>s.y>-10);enemyShots=enemyShots.filter(s=>s.y<490);if(enemyShots.some(s=>s.y>414&&Math.abs(s.x-(player+18))<22)||enemies.some(e=>e.alive&&e.y>390)){running=false;end()}if(enemies.every(e=>!e.alive)){running=false;end(true)}win.querySelector('[data-exp-score]').textContent=score;draw();raf=requestAnimationFrame(frame)}
  function end(winState=false){audio.play(winState?'confirm':'gameover');bus.dispatchEvent(new CustomEvent('game:score',{detail:{id:'voidinvaders',score}}));notify(`${winState?'SECTOR CLEARED':'GAME OVER'} // SCORE ${score}`)}function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,480,480);ctx.fillStyle='#67e8f9';ctx.fillRect(player,438,42,9);ctx.beginPath();ctx.moveTo(player+21,420);ctx.lineTo(player+6,438);ctx.lineTo(player+36,438);ctx.fill();enemies.forEach(e=>{if(!e.alive)return;ctx.fillStyle='#a78bfa';ctx.fillRect(e.x,e.y,28,16);ctx.fillStyle='#fff';ctx.fillRect(e.x+5,e.y+5,4,4);ctx.fillRect(e.x+19,e.y+5,4,4)});ctx.fillStyle='#facc15';shots.forEach(s=>ctx.fillRect(s.x,s.y,3,11));ctx.fillStyle='#fb7185';enemyShots.forEach(s=>ctx.fillRect(s.x,s.y,3,9))}draw();raf=requestAnimationFrame(frame);win._cleanup=()=>{running=false;cancelAnimationFrame(raf);window.removeEventListener('keydown',key)};
}

function initVectorDrift(win,storage,audio,bus){
  const canvas=win.querySelector('[data-exp-game="vectordrift"]');if(!canvas)return;const ctx=canvas.getContext('2d');let ship={x:240,y:240,a:-Math.PI/2,vx:0,vy:0},keys={},shots=[],rocks=[],score=0,running=true,lastRock=0,raf;
  const down=e=>{keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault()},up=e=>keys[e.key.toLowerCase()]=false;window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  function frame(t){if(!running)return;if(keys.arrowleft||keys.a)ship.a-=.065;if(keys.arrowright||keys.d)ship.a+=.065;if(keys.arrowup||keys.w){ship.vx+=Math.cos(ship.a)*.12;ship.vy+=Math.sin(ship.a)*.12}if((keys[' ']||keys.space)&&(!ship.lastShot||t-ship.lastShot>190)){shots.push({x:ship.x,y:ship.y,vx:Math.cos(ship.a)*6,vy:Math.sin(ship.a)*6});ship.lastShot=t;audio.play('hit')}ship.x=(ship.x+ship.vx+480)%480;ship.y=(ship.y+ship.vy+480)%480;ship.vx*=.992;ship.vy*=.992;if(t-lastRock>700){const edge=Math.floor(Math.random()*4),r={x:edge===0?0:edge===1?480:Math.random()*480,y:edge===2?0:edge===3?480:Math.random()*480,vx:(Math.random()-.5)*2.8,vy:(Math.random()-.5)*2.8,r:12+Math.random()*18};rocks.push(r);lastRock=t}shots.forEach(s=>{s.x+=s.vx;s.y+=s.vy});rocks.forEach(r=>{r.x=(r.x+r.vx+480)%480;r.y=(r.y+r.vy+480)%480});for(const s of shots)for(const r of rocks){if(Math.hypot(s.x-r.x,s.y-r.y)<r.r){r.dead=true;s.dead=true;score+=5;audio.play('score')}}rocks=rocks.filter(r=>!r.dead);shots=shots.filter(s=>!s.dead&&s.x>=0&&s.x<=480&&s.y>=0&&s.y<=480);if(rocks.some(r=>Math.hypot(ship.x-r.x,ship.y-r.y)<r.r+9)){running=false;audio.play('gameover');bus.dispatchEvent(new CustomEvent('game:score',{detail:{id:'vectordrift',score}}));notify(`DRIFT TERMINATED // SCORE ${score}`)}win.querySelector('[data-exp-score]').textContent=score;draw();raf=requestAnimationFrame(frame)}
  function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,480,480);ctx.strokeStyle='rgba(103,232,249,.12)';for(let i=0;i<16;i++){ctx.beginPath();ctx.arc(240,240,i*32,0,Math.PI*2);ctx.stroke()}ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.a);ctx.strokeStyle='#67e8f9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-10,-9);ctx.lineTo(-5,0);ctx.lineTo(-10,9);ctx.closePath();ctx.stroke();ctx.restore();ctx.fillStyle='#facc15';shots.forEach(s=>ctx.fillRect(s.x-2,s.y-2,4,4));ctx.strokeStyle='#a78bfa';rocks.forEach(r=>{ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.stroke()})}draw();raf=requestAnimationFrame(frame);win._cleanup=()=>{running=false;cancelAnimationFrame(raf);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};
}

function recordUsage(storage,id){if(!id)return;const usage=storage.get('usage',{});usage[id]=(usage[id]||0)+1;storage.set('usage',usage)}
function saveScore(storage,detail){if(!detail?.id)return;const scores=storage.get('scores',{});scores[detail.id]=Math.max(Number(scores[detail.id]||0),Number(detail.score||0));storage.set('scores',scores)}
function runtimeSnapshot(ArcadeOS){return{version:'2.2',apps:ArcadeOS.registry.size,openWindows:document.querySelectorAll('.os-window').length,online:navigator.onLine,viewport:[innerWidth,innerHeight],audio:ArcadeOS.audio?.supported||false,storage:storageAvailable(),timestamp:new Date().toISOString()}}
function exportState(storage){const data={};Object.keys(localStorage).filter(k=>k.startsWith('arcadeos:')).forEach(k=>data[k]=localStorage.getItem(k));return{format:'arcadeos-state',version:1,exportedAt:new Date().toISOString(),data}}
function downloadJSON(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
function storageAvailable(){try{const k='__arcade_test__';localStorage.setItem(k,'1');localStorage.removeItem(k);return true}catch{return false}}
function notify(text){let node=document.querySelector('.exp-toast');if(!node){node=document.createElement('div');node.className='exp-toast';document.body.appendChild(node)}node.textContent=text;clearTimeout(node._timer);node._timer=setTimeout(()=>node.remove(),2600)}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
