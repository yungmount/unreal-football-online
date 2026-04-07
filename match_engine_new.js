function startMatch() {
  if(rafId){cancelAnimationFrame(rafId);rafId=null}
  if(window._engine){Matter.Engine.clear(window._engine);window._engine=null}
  MS = null; tab = 'match'; render();
  
  setTimeout(()=>{
    if(!window.Matter){alert('Loading physics...');return}
    
    const fp = FP[G.formation]||FP['4-4-2'];
    const myTeam = G.team.slice(0,11).map((p,i)=>{
      const pos = fp[i]||[.25,.5];
      return {...p, hx:pos[0]*0.46, hy:pos[1], x:pos[0]*0.46, y:pos[1], spd:(p.pace/100)*.5+.1, role:i===0?'GK':i<3?'DEF':i<7?'MID':'ATT', isMy:true, _idx:i};
    });
    
    const oppIdx = rand(1,G.league.length-1);
    const oppStr = G.league[oppIdx].strength;
    const oppFp = fp.map(p=>[0.54+(1-p[0])*0.46,p[1]]);
    const oppPos = ['GK','CB','CB','LB','RB','CDM','CM','CM','LW','RW','ST'];
    const oppTeam = oppPos.map((pos,i)=>{
      const p = createPlayer(['England','Spain','Brazil','Germany','France'][rand(0,4)],pos,oppStr);
      const op = oppFp[i]||[.75,.5];
      return {...p, hx:op[0], hy:op[1], x:op[0], y:op[1], spd:(p.pace/100)*.5+.1, role:i===0?'GK':i<3?'DEF':i<7?'MID':'ATT', isMy:false, _idx:i};
    });

    const calcStats=(t)=>{
      const att=t.filter(p=>p.role==='ATT'), def=t.filter(p=>p.role==='DEF'||p.role==='GK'), mid=t.filter(p=>p.role==='MID');
      const af=t.reduce((s,p)=>s+(p.morale||70),0)/11, ff=t.reduce((s,p)=>s+(p.fitness||80),0)/11;
      return {atk:(att.length?att.reduce((s,p)=>s+p.shooting+p.pace*.4,0)/att.length/1.4:40)*af/85*ff/80, def:(def.length?def.reduce((s,p)=>s+p.defending,0)/def.length:40)*ff/80};
    };
    const myS=calcStats(myTeam), opS=calcStats(oppTeam);

    const W=960, H=540;
    const Engine=Matter.Engine, World=Matter.World, Bodies=Matter.Bodies, Body=Matter.Body;
    const engine = Engine.create({gravity:{x:0,y:0}});
    const world = engine.world;
    window._engine = engine;
    
    const walls = [Bodies.rectangle(W/2,-5,W,10,{isStatic:true}),Bodies.rectangle(W/2,H+5,W,10,{isStatic:true}),Bodies.rectangle(-5,H/2,10,H,{isStatic:true}),Bodies.rectangle(W+5,H/2,10,H,{isStatic:true})];
    World.add(world, walls);

    const ballBody = Bodies.circle(W*.5,H*.5,10,{frictionAir:.02,restitution:.8});
    World.add(world, ballBody);

    const pBodies={};
    [...myTeam,...oppTeam].forEach((p,i)=>{
      const bx=p.hx*W, by=p.hy*H;
      const r=p.role==='GK'?16:14;
      const b=Bodies.circle(bx,by,r,{frictionAir:.1,friction:.05});
      Body.setMass(b,2);
      World.add(world,b);
      pBodies[p.isMy?'my_'+p._idx:'opp_'+p._idx]={body:b,player:p};
      p._body=b;
    });

    MS = {myTeam, oppTeam, oppName:getLN(oppIdx), myScore:0, oppScore:0, min:0, sec:0, ball:{x:.5,y:.5,owner:null,tx:.5,ty:.5}, poss:'my', phaseT:0, events:[], started:true, finished:false, htDone:false, shots:{my:0,opp:0}, lastEvt:0, myS, opS, LUCK:Math.random()*6+3, redCards:{my:0,opp:0}, engine, world, ballBody, pBodies};
    
    render();
    setTimeout(()=>{lastT=performance.now();rafId=requestAnimationFrame(matchLoop)},200);
  },100);
}

function matchLoop(ts) {
  if(!MS||!MS.started||MS.finished){rafId=null;return}
  const dt=Math.min((ts-lastT)/1000,.033);
  lastT=ts;
  if(MS.engine)Matter.Engine.update(MS.engine,dt*1000);
  updateMatch(dt,ts);
  drawMatch();
  rafId=requestAnimationFrame(matchLoop);
}

function updateMatch(dt,ts){
  const W=960,H=540;
  const ball=MS.ball;
  const myAtk=MS.poss==='my';
  const bb=MS.ballBody;
  
  ball.x=bb.position.x/W;
  ball.y=bb.position.y/H;
  
  Object.values(MS.pBodies).forEach(({body,player})=>{
    player.x=body.position.x/W;
    player.y=body.position.y/H;
  });
  
  MS.sec+=dt;
  if(MS.sec>=1){MS.sec=0;MS.min++;if(MS.min===45&&!MS.htDone){MS.htDone=true;addEvt('⏱️ 半场!','info')}if(MS.min>=90&&!MS.finished){endMatch();return}}
  
  MS.phaseT=Math.max(0,MS.phaseT-dt);
  if(MS.phaseT<=0&&!MS.finished){genEvt();MS.lastEvt=ts}
  
  const {Body}=Matter;
  if(ball.owner&&bb){
    const ob=ball.owner._body;
    if(ob){Body.setPosition(bb,{x:ob.position.x+(myAtk?15:-15),y:ob.position.y});Body.setVelocity(bb,{x:0,y:0})}
  }
  
  [...MS.myTeam,...MS.oppTeam].forEach((p,i)=>{
    const isMy=i<11,atk=isMy===myAtk;
    const pb=p._body;
    if(!pb)return;
    let tx=p.hx*W,ty=p.hy*H;
    if(atk&&ball.owner&&ball.owner.isMy===isMy){
      if(ball.owner.id===p.id){tx=p.hx*W+(myAtk?60:-60)+(Math.random()-0.5)*20;ty=H/2+(Math.random()-0.5)*H*.6}
      else{const dx=bb.position.x-pb.position.x,dy=bb.position.y-pb.position.y;tx=pb.position.x+dx*0.4;ty=pb.position.y+dy*0.3}
    }else if(!atk){tx=p.hx*W+(myAtk?-30:30)+(Math.random()-0.5)*10;ty=p.hy*H+(ball.y*H-p.hy*H)*0.1}
    const dx=tx-pb.position.x,dy=ty-pb.position.y,force=Math.min(Math.hypot(dx,dy)*0.0002,p.spd*0.001);
    Body.applyForce(pb,pb.position,{x:dx/Math.max(1,Math.hypot(dx,dy))*force,y:dy/Math.max(1,Math.hypot(dx,dy))*force});
    const nx=Math.max(20,Math.min(W-20,pb.position.x)),ny=Math.max(20,Math.min(H-20,pb.position.y));
    if(nx!==pb.position.x||ny!==pb.position.y)Body.setPosition(pb,{x:nx,y:ny});
  });
}