const AppRegistry = new Map();
const SystemBus = new EventTarget();
const Storage = {
  get(key, fallback = null) {
    try { const value = localStorage.getItem(`arcadeos:${key}`); return value == null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(`arcadeos:${key}`, JSON.stringify(value)); } catch {} },
  clear() { Object.keys(localStorage).filter(key => key.startsWith('arcadeos:')).forEach(key => localStorage.removeItem(key)); }
};

function registerApp(app) {
  if (!app?.id || !app?.title || typeof app.render !== 'function') throw new Error('Invalid ArcadeOS app');
  AppRegistry.set(app.id, app);
}

const appCard = app => `<button class="app-card" data-open="${app.id}"><b>${app.icon || '◈'}</b><strong>${app.name || app.title}</strong><span>${app.description || ''}</span></button>`;

registerApp({
  id:'library', icon:'▦', title:'APP LIBRARY', name:'App Library', description:'Installed ArcadeOS applications',
  render:()=>`<div class="app-grid">${[...AppRegistry.values()].filter(app=>app.id!=='library').map(appCard).join('')}</div>`
});
registerApp({id:'terminal',icon:'>_',title:'TERMINAL',name:'Terminal',description:'Command-line system console',render:()=>`<div class="terminal" data-terminal-output>ArcadeOS shell v2.0\nType <strong>help</strong> to see commands.\n\n<span>guest@arcade:~$</span> <input class="terminal-input" data-terminal-input autofocus></div>`});
registerApp({id:'notes',icon:'✦',title:'NOTES',name:'Notes',description:'Persistent local scratchpad',render:()=>`<textarea class="notes" data-notes placeholder="Write something...">${escapeHtml(Storage.get('notes',''))}</textarea>`});
registerApp({id:'settings',icon:'⚙',title:'SYSTEM CONFIG',name:'System Config',description:'Theme, motion and local data controls',render:()=>`<div class="settings-list"><div class="setting"><div><strong>Visual theme</strong><small>Cycle system accent palette</small></div><button data-cycle-theme>CYCLE</button></div><div class="setting"><div><strong>Local data</strong><small>Clear ArcadeOS preferences and notes</small></div><button data-clear-storage>CLEAR</button></div><div class="setting"><div><strong>Motion</strong><small>Toggle interface animation</small></div><button data-toggle-motion>TOGGLE</button></div></div>`});
registerApp({id:'about',icon:'A',title:'ABOUT ARCADEOS',name:'About ArcadeOS',description:'Architecture and migration status',render:()=>`<div class="about"><p class="eyebrow">SYSTEM BUILD 2.0</p><h2>A browser becomes an arcade operating system.</h2><p>ArcadeOS is an independent browser desktop by <strong>Manav Agarwal</strong>. The standalone runtime now includes an app registry, event bus, local-first storage, window management and multiple playable games.</p><p>Architecture: <code>registry · events · native modules · local persistence</code></p></div>`});
registerApp({id:'snake',icon:'◉',title:'NEON SNAKE',name:'Neon Snake',description:'Grid-based keyboard arcade game',render:()=>gameShell('snake','SCORE','ARROWS / WASD')});
registerApp({id:'breakout',icon:'▤',title:'NEON BREAKOUT',name:'Neon Breakout',description:'Paddle-and-brick arcade game',render:()=>gameShell('breakout','SCORE','LEFT / RIGHT')});
registerApp({id:'pong',icon:'↔',title:'NEON PONG',name:'Neon Pong',description:'Play against the system AI',render:()=>gameShell('pong','PLAYER','UP / DOWN')});

function gameShell(id,label,controls){return `<div class="snake-wrap"><canvas class="snake-board" width="420" height="420" data-game="${id}"></canvas><div class="snake-meta"><span>${label} <b data-score>0</b></span><span>${controls}</span><button class="primary" data-restart-game="${id}">RESTART</button></div></div>`}

const layer=document.querySelector('[data-window-layer]');
const template=document.querySelector('#window-template');
let topZ=40, windowOffset=0;

window.addEventListener('DOMContentLoaded',()=>{
  const bootTimeout=setTimeout(()=>document.querySelector('[data-boot]')?.classList.add('is-done'),900);
  window.addEventListener('pagehide',()=>clearTimeout(bootTimeout),{once:true});
  updateClock(); setInterval(updateClock,1000);
  document.addEventListener('click',handleClick);
  SystemBus.dispatchEvent(new CustomEvent('system:ready'));
});

function handleClick(event){
  const opener=event.target.closest('[data-open]');
  if(opener){openApp(opener.dataset.open);return}
  const win=event.target.closest('.os-window'); if(!win)return;
  if(event.target.closest('[data-close]')){destroyWindow(win);return}
  if(event.target.closest('[data-minimize]'))win.classList.add('is-min');
  if(event.target.closest('[data-maximize]'))win.classList.toggle('is-max');
  if(event.target.closest('[data-cycle-theme]'))cycleTheme();
  if(event.target.closest('[data-clear-storage]')){Storage.clear();toast('LOCAL DATA CLEARED')}
  if(event.target.closest('[data-toggle-motion]')){document.body.classList.toggle('reduce-motion');Storage.set('reduceMotion',document.body.classList.contains('reduce-motion'));toast('MOTION MODE UPDATED')}
  const restart=event.target.closest('[data-restart-game]'); if(restart)startGame(win,restart.dataset.restartGame,true);
}

function openApp(id){
  const app=AppRegistry.get(id); if(!app)return;
  const existing=layer.querySelector(`[data-app="${id}"]`);
  if(existing){existing.classList.remove('is-min');focusWindow(existing);return}
  const node=template.content.firstElementChild.cloneNode(true);
  node.dataset.app=id; node.querySelector('.window-title').textContent=app.title; node.querySelector('.window-content').innerHTML=app.render();
  windowOffset=(windowOffset+24)%120; node.style.left=`calc(50% + ${windowOffset}px)`; node.style.top=`calc(48% + ${windowOffset/3}px)`;
  layer.appendChild(node); focusWindow(node); enableDrag(node); bindApp(node,id);
  SystemBus.dispatchEvent(new CustomEvent('app:opened',{detail:{id}}));
}

function bindApp(win,id){
  if(id==='notes'){const notes=win.querySelector('[data-notes]');notes?.addEventListener('input',()=>Storage.set('notes',notes.value));}
  if(id==='terminal')initTerminal(win);
  if(['snake','breakout','pong'].includes(id))startGame(win,id);
}
function destroyWindow(win){win._cleanup?.();win.remove();SystemBus.dispatchEvent(new CustomEvent('app:closed',{detail:{id:win.dataset.app}}));}
function focusWindow(win){win.style.zIndex=String(++topZ)}

function enableDrag(win){
  const handle=win.querySelector('[data-drag-handle]'); let active=false,startX=0,startY=0,startLeft=0,startTop=0,pointerId=null;
  handle.addEventListener('pointerdown',event=>{if(event.target.closest('button')||win.classList.contains('is-max'))return;active=true;pointerId=event.pointerId;focusWindow(win);try{handle.setPointerCapture(pointerId)}catch{}const rect=win.getBoundingClientRect();startX=event.clientX;startY=event.clientY;startLeft=rect.left;startTop=rect.top;win.style.transform='none';win.style.left=`${rect.left}px`;win.style.top=`${rect.top}px`;});
  handle.addEventListener('pointermove',event=>{if(!active)return;const maxX=Math.max(0,innerWidth-win.offsetWidth),maxY=Math.max(54,innerHeight-win.offsetHeight);win.style.left=`${Math.max(0,Math.min(maxX,startLeft+event.clientX-startX))}px`;win.style.top=`${Math.max(0,Math.min(maxY-54,startTop+event.clientY-startY))}px`;});
  const stop=()=>{active=false;if(pointerId!=null){try{handle.releasePointerCapture(pointerId)}catch{}pointerId=null}};
  handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);handle.addEventListener('lostpointercapture',()=>active=false);win.addEventListener('pointerdown',()=>focusWindow(win));
}

function initTerminal(win){
  const input=win.querySelector('[data-terminal-input]'),output=win.querySelector('[data-terminal-output]');input?.focus();
  input?.addEventListener('keydown',event=>{if(event.key!=='Enter')return;const raw=input.value.trim(),line=document.createElement('div');line.innerHTML=`<span>guest@arcade:~$</span> ${escapeHtml(raw)}<br>${runCommand(raw.toLowerCase())}`;output.insertBefore(line,input);input.value='';output.scrollTop=output.scrollHeight;});
}
function runCommand(command){
  if(command==='help')return 'Commands: help, apps, about, clear, date, theme, open &lt;app&gt;';
  if(command==='apps')return [...AppRegistry.keys()].join(' · ');
  if(command==='about')return 'ArcadeOS v2 by Manav Agarwal — standalone browser operating system.';
  if(command==='date')return new Date().toString();
  if(command==='theme'){cycleTheme();return 'Theme cycled.'}
  if(command.startsWith('open ')){const id=command.slice(5).replace(/\s+/g,'');const aliases={neonsnake:'snake',neonbreakout:'breakout',neonpong:'pong'};const target=aliases[id]||id;if(AppRegistry.has(target)){openApp(target);return `Launching ${AppRegistry.get(target).name}...`}return `Unknown app: ${escapeHtml(id)}`}
  if(command==='clear'){setTimeout(()=>{const term=document.querySelector('[data-terminal-output]');if(term)term.innerHTML='<span>guest@arcade:~$</span> <input class="terminal-input" data-terminal-input autofocus>'},0);return ''}
  return command?`Command not found: ${escapeHtml(command)}`:'';
}

function startGame(win,id){win._cleanup?.();if(id==='snake')initSnake(win);if(id==='breakout')initBreakout(win);if(id==='pong')initPong(win)}
function keyboardController(map,onMove){const handler=e=>{const move=map[e.key.toLowerCase()]||map[e.key];if(move){e.preventDefault();onMove(move)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)}

function initSnake(win){
  const canvas=win.querySelector('[data-game="snake"]');if(!canvas)return;const ctx=canvas.getContext('2d'),cell=21;let snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}],dir={x:1,y:0},next={...dir},food=spawn(),score=0,alive=true;
  const off=keyboardController({arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]},move=>{if(move[0]!==-dir.x||move[1]!==-dir.y)next={x:move[0],y:move[1]}});
  const timer=setInterval(()=>{if(!alive)return;dir=next;const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(head.x<0||head.y<0||head.x>=20||head.y>=20||snake.some(p=>p.x===head.x&&p.y===head.y)){alive=false;clearInterval(timer);toast(`GAME OVER // SCORE ${score}`);return}snake.unshift(head);if(head.x===food.x&&head.y===food.y){score++;food=spawn();win.querySelector('[data-score]').textContent=score}else snake.pop();draw()},115);
  function spawn(){return{x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}
  function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,420,420);grid(ctx);ctx.fillStyle='#fb7185';ctx.fillRect(food.x*cell+4,food.y*cell+4,cell-8,cell-8);snake.forEach((p,i)=>{ctx.fillStyle=i===0?'#67e8f9':'#22d3ee';ctx.fillRect(p.x*cell+2,p.y*cell+2,cell-4,cell-4)})}draw();win._cleanup=()=>{clearInterval(timer);off()};
}

function initBreakout(win){
  const canvas=win.querySelector('[data-game="breakout"]');if(!canvas)return;const ctx=canvas.getContext('2d');let paddle=170,ball={x:210,y:320,vx:3.2,vy:-3.2},score=0,running=true;const bricks=Array.from({length:35},(_,i)=>({x:18+(i%7)*57,y:35+Math.floor(i/7)*25,w:49,h:16,alive:true}));
  const off=keyboardController({arrowleft:-1,a:-1,arrowright:1,d:1},move=>paddle=Math.max(0,Math.min(340,paddle+move*24)));
  function frame(){if(!running)return;ball.x+=ball.vx;ball.y+=ball.vy;if(ball.x<7||ball.x>413)ball.vx*=-1;if(ball.y<7)ball.vy*=-1;if(ball.y>390&&ball.y<405&&ball.x>paddle&&ball.x<paddle+80){ball.vy=-Math.abs(ball.vy)}if(ball.y>430){running=false;toast(`GAME OVER // SCORE ${score}`);return}for(const b of bricks){if(b.alive&&ball.x>b.x&&ball.x<b.x+b.w&&ball.y>b.y&&ball.y<b.y+b.h){b.alive=false;ball.vy*=-1;score++;win.querySelector('[data-score]').textContent=score;break}}draw();win._raf=requestAnimationFrame(frame)}
  function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,420,420);grid(ctx);bricks.forEach((b,i)=>{if(b.alive){ctx.fillStyle=['#67e8f9','#a78bfa','#fb7185'][i%3];ctx.fillRect(b.x,b.y,b.w,b.h)}});ctx.fillStyle='#fff';ctx.fillRect(paddle,395,80,8);ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(ball.x,ball.y,6,0,Math.PI*2);ctx.fill()}draw();frame();win._cleanup=()=>{running=false;cancelAnimationFrame(win._raf);off()};
}

function initPong(win){
  const canvas=win.querySelector('[data-game="pong"]');if(!canvas)return;const ctx=canvas.getContext('2d');let player=170,ai=170,ball={x:210,y:210,vx:4,vy:2.7},score=0,running=true;const off=keyboardController({arrowup:-1,w:-1,arrowdown:1,s:1},move=>player=Math.max(0,Math.min(340,player+move*28)));
  function reset(direction){ball={x:210,y:210,vx:4*direction,vy:(Math.random()>.5?1:-1)*2.8}}
  function frame(){if(!running)return;ai+=Math.sign(ball.y-(ai+40))*2.6;ai=Math.max(0,Math.min(340,ai));ball.x+=ball.vx;ball.y+=ball.vy;if(ball.y<6||ball.y>414)ball.vy*=-1;if(ball.x<24&&ball.y>player&&ball.y<player+80)ball.vx=Math.abs(ball.vx);if(ball.x>396&&ball.y>ai&&ball.y<ai+80)ball.vx=-Math.abs(ball.vx);if(ball.x>430){score++;win.querySelector('[data-score]').textContent=score;reset(-1)}if(ball.x<-10){score=Math.max(0,score-1);win.querySelector('[data-score]').textContent=score;reset(1)}draw();win._raf=requestAnimationFrame(frame)}
  function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,420,420);ctx.strokeStyle='rgba(103,232,249,.25)';ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(210,0);ctx.lineTo(210,420);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#67e8f9';ctx.fillRect(12,player,8,80);ctx.fillStyle='#fb7185';ctx.fillRect(400,ai,8,80);ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(ball.x,ball.y,6,0,Math.PI*2);ctx.fill()}draw();frame();win._cleanup=()=>{running=false;cancelAnimationFrame(win._raf);off()};
}
function grid(ctx){ctx.strokeStyle='rgba(103,232,249,.055)';for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(i*21,0);ctx.lineTo(i*21,420);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*21);ctx.lineTo(420,i*21);ctx.stroke()}}

function cycleTheme(){const themes=['','theme-violet','theme-amber'];const stored=Storage.get('theme','');const current=themes.indexOf(stored);const next=themes[(current+1)%themes.length];document.body.classList.remove(...themes.filter(Boolean));if(next)document.body.classList.add(next);Storage.set('theme',next)}
function updateClock(){const clock=document.querySelector('[data-clock]');if(clock)clock.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function toast(text){let node=document.querySelector('.system-toast');if(!node){node=document.createElement('div');node.className='system-toast';node.style.cssText='position:fixed;right:18px;bottom:90px;z-index:999;padding:12px 15px;border:1px solid var(--line);border-radius:9px;background:rgba(5,10,24,.94);color:var(--cyan);font:700 .7rem JetBrains Mono;box-shadow:var(--shadow)';document.body.appendChild(node)}node.textContent=text;clearTimeout(node._timer);node._timer=setTimeout(()=>node.remove(),2600)}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}

const storedTheme=Storage.get('theme','');if(storedTheme)document.body.classList.add(storedTheme);if(Storage.get('reduceMotion',false))document.body.classList.add('reduce-motion');
window.ArcadeOS={openApp,registerApp,registry:AppRegistry,bus:SystemBus,storage:Storage};