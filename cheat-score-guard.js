export function installCheatScoreGuard(ArcadeOS){
  if(!ArcadeOS||ArcadeOS.cheatScoreGuardInstalled)return;
  const storage=ArcadeOS.storage;
  const originalSet=storage.set.bind(storage);
  storage.set=(key,value)=>{
    if(key==='scores'&&ArcadeOS.cheats?.shouldBlockScore?.()){
      try{sessionStorage.setItem('arcadeos:developer:scores',JSON.stringify(value));}catch{}
      ArcadeOS.bus?.dispatchEvent(new CustomEvent('cheat:score-isolated',{detail:{scores:value}}));
      return;
    }
    return originalSet(key,value);
  };
  ArcadeOS.cheatScoreGuardInstalled=true;
  ArcadeOS.services&&(ArcadeOS.services.scoreGuard={getIsolatedScores(){try{return JSON.parse(sessionStorage.getItem('arcadeos:developer:scores')||'{}')}catch{return{}}}});
}
