(function installInputOwnershipGuard(global){
  if(global.ArcadeInputGuard) return;

  const nativeAdd = global.addEventListener.bind(global);
  const nativeRemove = global.removeEventListener.bind(global);
  const records = new WeakMap();
  const GAME_SELECTOR = '[data-game], [data-exp-game]';

  const captureValue = options => typeof options === 'boolean' ? options : Boolean(options?.capture);
  const isEditable = target => target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  const visibleWindows = () => [...document.querySelectorAll('.os-window')]
    .filter(win => win.isConnected && !win.classList.contains('is-min') && win.getClientRects().length)
    .sort((a,b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0));
  const activeWindow = () => visibleWindows().at(-1) || null;
  const registrationOwner = () => {
    const win = activeWindow();
    return win?.querySelector(GAME_SELECTOR) ? win : null;
  };
  const listenerCall = (listener, event) => typeof listener === 'function'
    ? listener.call(global, event)
    : listener?.handleEvent?.call(listener, event);

  global.addEventListener = function guardedAdd(type, listener, options){
    if(!listener || (type !== 'keydown' && type !== 'keyup')) return nativeAdd(type, listener, options);
    const owner = registrationOwner();
    if(!owner) return nativeAdd(type, listener, options);

    const capture = captureValue(options);
    const wrapped = event => {
      if(!owner.isConnected) return;
      if(type === 'keyup') return listenerCall(listener, event);
      if(document.hidden || owner.classList.contains('is-min') || isEditable(event.target)) return;
      if(activeWindow() !== owner) return;
      return listenerCall(listener, event);
    };

    const list = records.get(listener) || [];
    list.push({type, capture, wrapped});
    records.set(listener, list);
    return nativeAdd(type, wrapped, options);
  };

  global.removeEventListener = function guardedRemove(type, listener, options){
    const capture = captureValue(options);
    const list = records.get(listener);
    const index = list?.findIndex(record => record.type === type && record.capture === capture) ?? -1;
    if(index < 0) return nativeRemove(type, listener, options);
    const [{wrapped}] = list.splice(index, 1);
    if(!list.length) records.delete(listener);
    return nativeRemove(type, wrapped, options);
  };

  const api = Object.freeze({
    version: 1,
    getActiveWindow: activeWindow,
    getActiveGame(){
      const win = activeWindow();
      return win?.querySelector(GAME_SELECTOR)?.dataset.game || win?.querySelector(GAME_SELECTOR)?.dataset.expGame || null;
    },
    isInputAllowed(win){
      return Boolean(win?.isConnected && !document.hidden && !win.classList.contains('is-min') && activeWindow() === win);
    }
  });

  global.ArcadeInputGuard = api;
  document.addEventListener('arcadeos:ready', () => {
    if(global.ArcadeOS){
      global.ArcadeOS.inputGuard = api;
      if(global.ArcadeOS.services) global.ArcadeOS.services.inputGuard = api;
    }
  }, {once:true});
})(window);
