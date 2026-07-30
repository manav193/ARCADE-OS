const apps={
  library:{title:'APP LIBRARY',render:()=>`<div class="app-grid">${[
    ['terminal','>_','Terminal','Command-line system console'],['snake','◉','Neon Snake','Keyboard-controlled arcade game'],['notes','✦','Notes','Persistent local scratchpad'],['settings','⚙','System Config','Theme and storage controls'],['about','A','About ArcadeOS','Architecture and project details']
  ].map(([id,icon,name,desc])=>`<button class="app-card" data-open="${id}"><b>${icon}</b><strong>${name}</strong><span>${desc}</span></button>`).join('')}</div>`},
  terminal:{title:'TERMINAL',render:()=>`<div class="terminal" data-terminal-output>ArcadeOS shell v1.0\nType <strong>help</strong> to see commands.\n\n<span>guest@arcade:~$</span> <input class="terminal-input" data-terminal-input autofocus></div>`},
  notes:{title:'NOTES',render:()=>`<textarea class="notes" data-notes placeholder="Write something...">${escapeHtml(localStorage.getItem('arcadeos-notes')||'')}</textarea>`},
  settings:{title:'SYSTEM CONFIG',render:()=>`<div class="settings-list"><div class="setting"><div><strong>Visual theme</strong><small>Cycle system accent palette</small></div><button data-cycle-theme>CYCLE</button></div><div class="setting"><div><strong>Local data</strong><small>Clear notes and preferences</small></div><button data-clear-storage>CLEAR</button></div><div class="setting"><div><strong>Motion</strong><small>Toggle interface animation</small></div><button data-toggle-motion>TOGGLE</button></div></div>`},
  about:{title:'ABOUT ARCADEOS',render:()=>`<div class="about"><p class="eyebrow">SYSTEM BUILD 1.0</p><h2>A browser becomes an arcade operating system.</h2><p>ArcadeOS is an experimental desktop environment by <strong>Manav Agarwal</strong>. It includes a lightweight window manager, local persistence, command shell, theme system and playable applications using native HTML, CSS and JavaScript.</p><p>Architecture: <code>event-driven modules · no framework · local-first state</code></p></div>`},
  snake:{title:'NEON SNAKE',render:()=>`<div class="snake-wrap"><canvas class="snake-board" width="420" height="420" data-snake></canvas><div class="snake-meta"><span>SCORE <b data-score>0</b></span><span>ARROWS / WASD</span><button class="primary" data-restart-snake>RESTART</button></div></div>`}
};

const layer=document.querySelector('[data-window-layer]');
const template=document.querySelector('#window-template');
let topZ=40;
let windowOffset=0;

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>document.querySelector('[data-boot]')?.classList.add('is-done'),900);
  updateClock(); setInterval(updateClock,1000);
  document.addEventListener('click',handleClick);
});

function handleClick(event){
  const opener=event.target.closest('[data-open]');
  if(opener){openApp(opener.dataset.open);return}
  const win=event.target.closest('.os-window');
  if(!win)return;
  if(event.target.closest('[data-close]'))win.remove();
  if(event.target.closest('[data-minimize]'))win.classList.add('is-min');
  if(event.target.closest('[data-maximize]'))win.classList.toggle('is-max');
  if(event.target.closest('[data-cycle-theme]'))cycleTheme();
  if(event.target.closest('[data-clear-storage]')){localStorage.clear();toast('LOCAL DATA CLEARED')}
  if(event.target.closest('[data-toggle-motion]')){document.body.classList.toggle('reduce-motion');toast('MOTION MODE UPDATED')}
  if(event.target.closest('[data-restart-snake]'))initSnake(win,true);
}

function openApp(id){
  const app=apps[id]; if(!app)return;
  const existing=layer.querySelector(`[data-app="${id}"]`);
  if(existing){existing.classList.remove('is-min');focusWindow(existing);return}
  const node=template.content.firstElementChild.cloneNode(true);
  node.dataset.app=id;
  node.querySelector('.window-title').textContent=app.title;
  node.querySelector('.window-content').innerHTML=app.render();
  windowOffset=(windowOffset+24)%120;
  node.style.left=`calc(50% + ${windowOffset}px)`;
  node.style.top=`calc(48% + ${windowOffset/3}px)`;
  layer.appendChild(node);
  focusWindow(node);
  enableDrag(node);
  bindApp(node,id);
}

function bindApp(win,id){
  if(id==='notes'){
    const notes=win.querySelector('[data-notes]');
    notes?.addEventListener('input',()=>localStorage.setItem('arcadeos-notes',notes.value));
  }
  if(id==='terminal')initTerminal(win);
  if(id==='snake')initSnake(win);
}

function focusWindow(win){win.style.zIndex=String(++topZ)}

function enableDrag(win){
  const handle=win.querySelector('[data-drag-handle]');
  let active=false,startX=0,startY=0,startLeft=0,startTop=0;
  handle.addEventListener('pointerdown',event=>{
    if(event.target.closest('button')||win.classList.contains('is-max'))return;
    active=true;focusWindow(win);handle.setPointerCapture(event.pointerId);
    const rect=win.getBoundingClientRect();
    startX=event.clientX;startY=event.clientY;startLeft=rect.left;startTop=rect.top;
    win.style.transform='none';win.style.left=`${rect.left}px`;win.style.top=`${rect.top}px`;
  });
  handle.addEventListener('pointermove',event=>{
    if(!active)return;
    const maxX=innerWidth-win.offsetWidth,maxY=innerHeight-win.offsetHeight;
    win.style.left=`${Math.max(0,Math.min(maxX,startLeft+event.clientX-startX))}px`;
    win.style.top=`${Math.max(0,Math.min(maxY-54,startTop+event.clientY-startY))}px`;
  });
  const stop=()=>active=false;
  handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
  win.addEventListener('pointerdown',()=>focusWindow(win));
}

function initTerminal(win){
  const input=win.querySelector('[data-terminal-input]');
  const output=win.querySelector('[data-terminal-output]');
  input?.focus();
  input?.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    const command=input.value.trim().toLowerCase();
    const line=document.createElement('div');
    line.innerHTML=`<span>guest@arcade:~$</span> ${escapeHtml(input.value)}<br>${runCommand(command)}`;
    output.insertBefore(line,input.parentNode===output?input:null);
    input.value='';output.scrollTop=output.scrollHeight;
  });
}

function runCommand(command){
  if(command==='help')return 'Commands: help, apps, about, clear, date, theme, open snake';
  if(command==='apps')return Object.keys(apps).join(' · ');
  if(command==='about')return 'ArcadeOS by Manav Agarwal — native browser desktop environment.';
  if(command==='date')return new Date().toString();
  if(command==='theme'){cycleTheme();return 'Theme cycled.'}
  if(command==='open snake'){openApp('snake');return 'Launching Neon Snake...'}
  if(command==='clear'){setTimeout(()=>{const term=document.querySelector('[data-terminal-output]');if(term)term.innerHTML='<span>guest@arcade:~$</span> <input class="terminal-input" data-terminal-input autofocus>'},0);return ''}
  return command?`Command not found: ${escapeHtml(command)}`:'';
}

function initSnake(win,reset=false){
  const canvas=win.querySelector('[data-snake]');if(!canvas)return;
  if(win._snakeTimer)clearInterval(win._snakeTimer);
  const ctx=canvas.getContext('2d');const cell=21;let snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];let dir={x:1,y:0};let next={...dir};let food=spawn();let score=0;
  const keyHandler=event=>{
    const map={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
    const move=map[event.key];if(!move)return;
    if(move[0]!==-dir.x||move[1]!==-dir.y)next={x:move[0],y:move[1]};
  };
  window.addEventListener('keydown',keyHandler);
  const observer=new MutationObserver(()=>{if(!document.contains(win)){clearInterval(win._snakeTimer);window.removeEventListener('keydown',keyHandler);observer.disconnect()}});observer.observe(document.body,{childList:true,subtree:true});
  function spawn(){return{x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}
  function tick(){
    dir=next;const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
    if(head.x<0||head.y<0||head.x>=20||head.y>=20||snake.some(p=>p.x===head.x&&p.y===head.y)){clearInterval(win._snakeTimer);toast(`GAME OVER // SCORE ${score}`);return}
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){score++;food=spawn();win.querySelector('[data-score]').textContent=score}else snake.pop();
    draw();
  }
  function draw(){ctx.fillStyle='#02050c';ctx.fillRect(0,0,420,420);ctx.strokeStyle='rgba(103,232,249,.055)';for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(i*cell,0);ctx.lineTo(i*cell,420);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*cell);ctx.lineTo(420,i*cell);ctx.stroke()}ctx.fillStyle='#fb7185';ctx.shadowBlur=16;ctx.shadowColor='#fb7185';ctx.fillRect(food.x*cell+4,food.y*cell+4,cell-8,cell-8);snake.forEach((p,i)=>{ctx.fillStyle=i===0?'#67e8f9':'#22d3ee';ctx.shadowColor='#67e8f9';ctx.fillRect(p.x*cell+2,p.y*cell+2,cell-4,cell-4)});ctx.shadowBlur=0}
  draw();win._snakeTimer=setInterval(tick,115);
}

function cycleTheme(){
  const themes=['','theme-violet','theme-amber'];
  const current=themes.findIndex(theme=>theme&&document.body.classList.contains(theme));
  document.body.classList.remove(...themes.filter(Boolean));
  const next=themes[(current+1)%themes.length];if(next)document.body.classList.add(next);
  localStorage.setItem('arcadeos-theme',next);
}

function updateClock(){const clock=document.querySelector('[data-clock]');if(clock)clock.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function toast(text){let node=document.querySelector('.system-toast');if(!node){node=document.createElement('div');node.className='system-toast';node.style.cssText='position:fixed;right:18px;bottom:90px;z-index:999;padding:12px 15px;border:1px solid var(--line);border-radius:9px;background:rgba(5,10,24,.94);color:var(--cyan);font:700 .7rem JetBrains Mono;box-shadow:var(--shadow)';document.body.appendChild(node)}node.textContent=text;clearTimeout(node._timer);node._timer=setTimeout(()=>node.remove(),2600)}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))}

const storedTheme=localStorage.getItem('arcadeos-theme');if(storedTheme)document.body.classList.add(storedTheme);
