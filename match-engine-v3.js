// ============================================================
// UFO Match Engine v3.0
// 整合: openfootmanager 多因子模型 + phaser-simple-soccer 状态机
// ============================================================

// ---- 球员状态机 ----
const PlayerState = {
  WAIT: 'wait',
  CHASE_BALL: 'chase',
  DRIBBLE: 'dribble',
  PASS: 'pass',
  SHOOT: 'shoot',
  RECEIVE_BALL: 'receive',
  RETURN_HOME: 'home',
  SUPPORT_ATTACKER: 'support',
  PRESS: 'press'
};

// ---- 比赛区域定义 ----
const Zone = {
  HOME_BOX: 'home_box',
  HOME_THIRD: 'home_third',
  MIDFIELD: 'midfield',
  AWAY_THIRD: 'away_third',
  AWAY_BOX: 'away_box'
};

function getZone(x, isMyTeam) {
  if (x < 0.2) return isMyTeam ? Zone.HOME_BOX : Zone.AWAY_BOX;
  if (x < 0.4) return isMyTeam ? Zone.HOME_THIRD : Zone.AWAY_THIRD;
  if (x < 0.6) return Zone.MIDFIELD;
  if (x < 0.8) return isMyTeam ? Zone.AWAY_THIRD : Zone.HOME_THIRD;
  return isMyTeam ? Zone.AWAY_BOX : Zone.HOME_BOX;
}

// ---- 球员属性扩展 ----
function expandPlayerStats(p) {
  return {
    ...p,
    // 基础属性 (来自你的系统)
    pace: p.pace || 70,
    shooting: p.shooting || 70,
    passing: p.passing || 70,
    defending: p.defending || 70,
    physical: p.physical || 70,
    
    // 扩展属性 (openfootmanager 风格)
    vision: Math.min(99, p.passing + rand(-5, 5)),
    composure: Math.min(99, p.shooting + rand(-8, 3)),
    teamwork: Math.min(99, p.passing + rand(-3, 8)),
    decisions: Math.min(99, (p.passing + p.defending) / 2 + rand(-5, 5)),
    positioning: Math.min(99, p.defending + rand(-3, 7)),
    tackling: Math.min(99, p.defending + rand(-5, 5)),
    agility: Math.min(99, p.pace + rand(-8, 2)),
    aerial: Math.min(99, p.physical + rand(-5, 5)),
    stamina: Math.min(99, p.physical + p.pace / 2 + rand(-10, 5)),
    
    // 状态机
    state: PlayerState.RETURN_HOME,
    stateTimer: 0,
    targetX: 0,
    targetY: 0,
    
    // 比赛数据
    distanceRun: 0,
    touches: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    shots: 0,
    tackles: 0,
    interceptions: 0
  };
}

// ---- 战术风格配置 ----
const Tactics = {
  TIKITAKA: { name: 'Tiki-Taka', passBonus: 1.15, pressBonus: 1.1, shootPenalty: 0.9 },
  COUNTER: { name: 'Counter Attack', paceBonus: 1.2, passPenalty: 0.9, shootBonus: 1.1 },
  PARK_BUS: { name: 'Park the Bus', defendBonus: 1.2, attackPenalty: 0.75 },
  GEGENPRESS: { name: 'Gegenpress', pressBonus: 1.25, staminaPenalty: 0.9 },
  WING_PLAY: { name: 'Wing Play', crossBonus: 1.2, aerialBonus: 1.1 }
};

// ---- 比赛引擎 v3.0 ----
class MatchEngine {
  constructor(myTeam, oppTeam, oppName, myTactic = Tactics.TIKITAKA, oppTactic = Tactics.COUNTER) {
    this.W = 960;
    this.H = 540;
    
    // 扩展球员属性
    this.myTeam = myTeam.map(p => expandPlayerStats(p));
    this.oppTeam = oppTeam.map(p => expandPlayerStats(p));
    this.oppName = oppName;
    
    // 战术
    this.myTactic = myTactic;
    this.oppTactic = oppTactic;
    
    // 比赛状态
    this.score = { my: 0, opp: 0 };
    this.min = 0;
    this.sec = 0;
    this.phase = 'first_half'; // first_half, half_time, second_half, finished
    this.possession = { my: 0, opp: 0, current: 'my' };
    this.ball = { x: 0.5, y: 0.5, owner: null, vx: 0, vy: 0 };
    
    // 事件
    this.events = [];
    this.phaseT = 0; // 阶段冷却时间
    
    // 统计
    this.stats = {
      my: { shots: 0, shotsOn: 0, passes: 0, passesComp: 0, tackles: 0, fouls: 0, corners: 0 },
      opp: { shots: 0, shotsOn: 0, passes: 0, passesComp: 0, tackles: 0, fouls: 0, corners: 0 }
    };
    
    // 物理引擎 (简化版，不用 Matter.js)
    this.players = new Map();
    [...this.myTeam, ...this.oppTeam].forEach((p, i) => {
      this.players.set(p.id, {
        ...p,
        x: p.hx || (p.isMy ? 0.3 : 0.7),
        y: p.hy || 0.5,
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0
      });
    });
    
    // 初始化阵型
    this.initFormation();
    
    this.started = true;
    this.finished = false;
  }
  
  initFormation() {
    const fp = FP[G.formation] || FP['4-4-2'];
    
    // 我方阵型
    this.myTeam.forEach((p, i) => {
      const pos = fp[i] || [0.25, 0.5];
      p.hx = pos[0];
      p.hy = pos[1];
      p.x = pos[0];
      p.y = pos[1];
      p.state = PlayerState.RETURN_HOME;
    });
    
    // 对方镜像阵型
    this.oppTeam.forEach((p, i) => {
      const pos = fp[i] || [0.75, 0.5];
      p.hx = 1 - pos[0];
      p.hy = pos[1];
      p.x = p.hx;
      p.y = p.hy;
      p.state = PlayerState.RETURN_HOME;
    });
  }
  
  // ---- 核心更新循环 ----
  update(dt) {
    if (!this.started || this.finished) return;
    
    // 时间更新
    this.sec += dt;
    if (this.sec >= 1) {
      this.sec = 0;
      this.min++;
      
      // 半场检查
      if (this.min === 45 && this.phase === 'first_half') {
        this.phase = 'half_time';
        this.addEvent('⏱️ 半场休息', 'info', 45);
        this.phaseT = 3; // 3秒半场时间
        return;
      }
      
      // 下半场开始
      if (this.min === 46 && this.phase === 'half_time') {
        this.phase = 'second_half';
        this.possession.current = 'opp'; // 对方开球
        this.ball.x = 0.5;
        this.ball.y = 0.5;
        this.addEvent('▶️ 下半场开始', 'info', 46);
      }
      
      // 全场结束
      if (this.min >= 90 && this.phase === 'second_half') {
        this.endMatch();
        return;
      }
    }
    
    // 阶段冷却
    if (this.phaseT > 0) {
      this.phaseT -= dt;
      return;
    }
    
    // 更新球员 AI (状态机)
    this.updatePlayersAI(dt);
    
    // 更新球
    this.updateBall(dt);
    
    // 更新控球统计
    if (this.ball.owner) {
      this.possession[this.ball.owner.isMy ? 'my' : 'opp'] += dt;
    }
    
    // 事件生成 (基于 openfootmanager 的分区模型)
    this.generateEvents();
  }
  
  // ---- 球员 AI 状态机 (phaser-simple-soccer 风格) ----
  updatePlayersAI(dt) {
    const allPlayers = [...this.myTeam, ...this.oppTeam];
    const myAtk = this.possession.current === 'my';
    
    allPlayers.forEach(p => {
      const player = this.players.get(p.id);
      if (!player) return;
      
      // 状态机处理
      switch (p.state) {
        case PlayerState.WAIT:
          this.handleWaitState(p, player, myAtk);
          break;
        case PlayerState.CHASE_BALL:
          this.handleChaseState(p, player, myAtk);
          break;
        case PlayerState.DRIBBLE:
          this.handleDribbleState(p, player, myAtk);
          break;
        case PlayerState.PASS:
          this.handlePassState(p, player, myAtk);
          break;
        case PlayerState.SHOOT:
          this.handleShootState(p, player, myAtk);
          break;
        case PlayerState.RECEIVE_BALL:
          this.handleReceiveState(p, player, myAtk);
          break;
        case PlayerState.RETURN_HOME:
          this.handleReturnState(p, player, myAtk);
          break;
        case PlayerState.SUPPORT_ATTACKER:
          this.handleSupportState(p, player, myAtk);
          break;
        case PlayerState.PRESS:
          this.handlePressState(p, player, myAtk);
          break;
      }
      
      // 物理移动
      this.movePlayer(p, player, dt);
    });
  }
  
  handleWaitState(p, player, myAtk) {
    const isMy = p.isMy;
    const ballDist = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
    
    // 如果球接近，切换追球状态
    if (ballDist < 0.15 && this.isClosestToBall(p)) {
      p.state = PlayerState.CHASE_BALL;
      return;
    }
    
    // 如果控球方是我方且我是进攻球员，寻找支持位置
    if (isMy === myAtk && p.role === 'ATT' && !p.isControllingPlayer) {
      p.state = PlayerState.SUPPORT_ATTACKER;
      return;
    }
    
    // 防守方压迫
    if (isMy !== myAtk && ballDist < 0.25) {
      p.state = PlayerState.PRESS;
      return;
    }
    
    // 否则回家
    p.state = PlayerState.RETURN_HOME;
  }
  
  handleChaseState(p, player, myAtk) {
    const ballDist = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
    
    // 到达球的位置
    if (ballDist < 0.03) {
      this.ball.owner = p;
      p.touches++;
      
      // 决定下一步动作
      const zone = getZone(player.x, p.isMy);
      const canShoot = this.canShoot(p, zone);
      const canPass = this.findBestPass(p);
      
      if (canShoot && Math.random() < 0.4) {
        p.state = PlayerState.SHOOT;
      } else if (canPass && Math.random() < 0.7) {
        p.state = PlayerState.PASS;
        p.passTarget = canPass;
      } else {
        p.state = PlayerState.DRIBBLE;
      }
      return;
    }
    
    // 设置目标为球的位置
    p.targetX = this.ball.x;
    p.targetY = this.ball.y;
  }
  
  handleDribbleState(p, player, myAtk) {
    const zone = getZone(player.x, p.isMy);
    const isMy = p.isMy;
    
    // 带球朝向对方球门
    const goalX = isMy ? 0.95 : 0.05;
    const goalY = 0.5;
    
    // 根据视野和决策找空档
    const visionMod = p.vision / 100;
    const decisionMod = p.decisions / 100;
    
    // 简单 AI：向球门移动，但避开防守球员
    let bestX = player.x + (goalX - player.x) * 0.1;
    let bestY = player.y + (goalY - player.y) * 0.05;
    
    // 检查是否有防守球员接近
    const defenders = (isMy ? this.oppTeam : this.myTeam).filter(d => d.role !== 'GK');
    let avoidX = 0, avoidY = 0;
    
    defenders.forEach(d => {
      const dPlayer = this.players.get(d.id);
      if (!dPlayer) return;
      const dist = Math.hypot(dPlayer.x - player.x, dPlayer.y - player.y);
      if (dist < 0.15) {
        avoidX -= (dPlayer.x - player.x) / dist * 0.05;
        avoidY -= (dPlayer.y - player.y) / dist * 0.05;
      }
    });
    
    p.targetX = Math.max(0.05, Math.min(0.95, bestX + avoidX));
    p.targetY = Math.max(0.1, Math.min(0.9, bestY + avoidY));
    
    // 同步球位置
    this.ball.x = player.x;
    this.ball.y = player.y;
    this.ball.vx = (p.targetX - player.x) * 2;
    this.ball.vy = (p.targetY - player.y) * 2;
    
    // 检查是否进入射门区域
    if (zone === (isMy ? Zone.AWAY_BOX : Zone.HOME_BOX) && Math.random() < 0.3) {
      p.state = PlayerState.SHOOT;
      return;
    }
    
    // 检查是否有更好的传球选择
    const passOption = this.findBestPass(p);
    if (passOption && Math.random() < 0.2) {
      p.state = PlayerState.PASS;
      p.passTarget = passOption;
      return;
    }
    
    // 如果被紧逼，可能丢球
    const press = defenders.filter(d => {
      const dPlayer = this.players.get(d.id);
      return dPlayer && Math.hypot(dPlayer.x - player.x, dPlayer.y - player.y) < 0.08;
    }).length;
    
    if (press > 0 && Math.random() < press * 0.15) {
      this.ball.owner = null;
      p.state = PlayerState.CHASE_BALL;
      this.addEvent(`🤺 ${p.name.split(' ').pop()} 被抢断!`, 'defense');
    }
  }
  
  handlePassState(p, player, myAtk) {
    if (!p.passTarget) {
      p.state = PlayerState.DRIBBLE;
      return;
    }
    
    const target = p.passTarget;
    const targetPlayer = this.players.get(target.id);
    
    if (!targetPlayer) {
      p.state = PlayerState.DRIBBLE;
      return;
    }
    
    // 执行传球
    p.passesAttempted++;
    this.stats[p.isMy ? 'my' : 'opp'].passes++;
    
    // 传球成功率计算 (openfootmanager 风格)
    const passSkill = (p.passing + p.vision + p.composure + p.teamwork) / 4;
    const distance = Math.hypot(targetPlayer.x - player.x, targetPlayer.y - player.y);
    const pressure = this.calculatePressure(p);
    
    // 成功率公式
    const baseSuccess = 0.85;
    const skillMod = (passSkill - 50) / 200;
    const distPenalty = distance * 0.3;
    const pressPenalty = pressure * 0.15;
    const tacticMod = (p.isMy ? this.myTactic : this.oppTactic).passBonus || 1;
    
    const successRate = Math.max(0.3, Math.min(0.95, 
      (baseSuccess + skillMod - distPenalty - pressPenalty) * tacticMod
    ));
    
    // 传球动画
    this.ball.owner = null;
    this.ball.vx = (targetPlayer.x - player.x) * 3;
    this.ball.vy = (targetPlayer.y - player.y) * 3;
    
    // 判定结果
    setTimeout(() => {
      if (!this.started || this.finished) return;
      
      if (Math.random() < successRate) {
        // 传球成功
        this.ball.x = targetPlayer.x;
        this.ball.y = targetPlayer.y;
        this.ball.owner = target;
        this.ball.vx = 0;
        this.ball.vy = 0;
        
        target.state = PlayerState.RECEIVE_BALL;
        p.passesCompleted++;
        this.stats[p.isMy ? 'my' : 'opp'].passesComp++;
        
        this.possession.current = target.isMy ? 'my' : 'opp';
        this.addEvent(`👟 ${p.name.split(' ').pop()} → ${target.name.split(' ').pop()}`, 'pass');
      } else {
        // 传球被拦截
        const interceptors = (p.isMy ? this.oppTeam : this.myTeam).filter(d => d.role !== 'GK');
        const interceptor = interceptors[rand(0, interceptors.length - 1)];
        
        if (interceptor) {
          const iPlayer = this.players.get(interceptor.id);
          this.ball.x = iPlayer.x + (Math.random() - 0.5) * 0.1;
          this.ball.y = iPlayer.y + (Math.random() - 0.5) * 0.1;
          this.ball.owner = interceptor;
          this.ball.vx = 0;
          this.ball.vy = 0;
          
          interceptor.state = PlayerState.CHASE_BALL;
          interceptor.interceptions++;
          this.possession.current = interceptor.isMy ? 'my' : 'opp';
          
          this.addEvent(`🚫 ${interceptor.name.split(' ').pop()} 拦截!`, 'defense');
        }
      }
      
      p.state = PlayerState.WAIT;
    }, 400);
    
    p.state = PlayerState.WAIT;
    this.phaseT = 0.5;
  }
  
  handleShootState(p, player, myAtk) {
    p.shots++;
    this.stats[p.isMy ? 'my' : 'opp'].shots++;
    
    const isMy = p.isMy;
    const gk = (isMy ? this.oppTeam : this.myTeam)[0]; // 门将
    const gkPlayer = this.players.get(gk.id);
    
    // 射门动画
    const goalX = isMy ? 0.97 : 0.03;
    const goalY = 0.4 + Math.random() * 0.2;
    
    this.ball.owner = null;
    this.ball.vx = (goalX - player.x) * 4;
    this.ball.vy = (goalY - player.y) * 4;
    
    this.addEvent(`⚡ ${p.name.split(' ').pop()} 射门!`, 'shot');
    
    // 射门判定 (openfootmanager 公式)
    setTimeout(() => {
      if (!this.started || this.finished) return;
      
      const shootRating = (p.shooting + p.composure + p.decisions) / 3;
      const gkRating = (gk.defending + 30); // 简化门将能力
      
      // 精度检查
      const accuracyBase = 0.65;
      const accuracy = Math.max(0.15, Math.min(0.85,
        accuracyBase + (shootRating - 50) / 200
      ));
      
      if (Math.random() > accuracy) {
        // 射偏
        this.addEvent('❌ 偏出球门!', 'miss');
        this.ball.x = isMy ? 0.95 : 0.05;
        this.ball.y = Math.random() > 0.5 ? 0.1 : 0.9;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.possession.current = isMy ? 'opp' : 'my';
        this.phaseT = 2;
        return;
      }
      
      // 进球转化率
      const conversionBase = 0.35;
      const conversion = Math.max(0.10, Math.min(0.70,
        conversionBase + (shootRating - gkRating) / 150
      ));
      
      if (Math.random() < conversion) {
        // 进球！
        if (isMy) {
          this.score.my++;
          p.goals = (p.goals || 0) + 1;
        } else {
          this.score.opp++;
        }
        this.stats[isMy ? 'my' : 'opp'].shotsOn++;
        
        this.addEvent(`⚽ 进球! ${this.score.my}-${this.score.opp}`, 'goal');
        
        // 庆祝动画
        this.ball.x = goalX;
        this.ball.y = goalY;
        this.ball.vx = 0;
        this.ball.vy = 0;
        
        // 重置到中圈
        setTimeout(() => {
          this.ball.x = 0.5;
          this.ball.y = 0.5;
          this.ball.owner = null;
          this.possession.current = isMy ? 'opp' : 'my';
        }, 2000);
        
        this.phaseT = 3;
      } else {
        // 被扑出
        this.stats[isMy ? 'my' : 'opp'].shotsOn++;
        this.addEvent('🧤 门将扑出!', 'save');
        
        this.ball.x = isMy ? 0.9 : 0.1;
        this.ball.y = 0.3 + Math.random() * 0.4;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.possession.current = isMy ? 'opp' : 'my';
        this.phaseT = 2;
      }
      
      p.state = PlayerState.WAIT;
    }, 600);
    
    p.state = PlayerState.WAIT;
  }
  
  handleReceiveState(p, player, myAtk) {
    const ballDist = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
    
    if (ballDist < 0.05) {
      this.ball.owner = p;
      this.ball.x = player.x;
      this.ball.y = player.y;
      
      // 接球后决定下一步
      const zone = getZone(player.x, p.isMy);
      if (zone === (p.isMy ? Zone.AWAY_BOX : Zone.HOME_BOX)) {
        p.state = PlayerState.SHOOT;
      } else {
        p.state = PlayerState.DRIBBLE;
      }
    } else {
      p.targetX = this.ball.x;
      p.targetY = this.ball.y;
    }
  }
  
  handleReturnState(p, player, myAtk) {
    const distToHome = Math.hypot(p.hx - player.x, p.hy - player.y);
    
    if (distToHome < 0.05) {
      p.state = PlayerState.WAIT;
      player.vx *= 0.5;
      player.vy *= 0.5;
    } else {
      p.targetX = p.hx;
      p.targetY = p.hy;
    }
  }
  
  handleSupportState(p, player, myAtk) {
    const controller = this.getControllingPlayer(p.isMy);
    if (!controller) {
      p.state = PlayerState.WAIT;
      return;
    }
    
    // 计算最佳支持位置
    const goalX = p.isMy ? 0.95 : 0.05;
    const cPlayer = this.players.get(controller.id);
    
    // 在控球者前方寻找空档
    const supportX = cPlayer.x + (goalX - cPlayer.x) * 0.3;
    const supportY = cPlayer.y + (Math.random() - 0.5) * 0.3;
    
    p.targetX = Math.max(0.1, Math.min(0.9, supportX));
    p.targetY = Math.max(0.1, Math.min(0.9, supportY));
    
    // 如果到达支持位置，等待传球
    const distToTarget = Math.hypot(p.targetX - player.x, p.targetY - player.y);
    if (distToTarget < 0.08) {
      player.vx *= 0.3;
      player.vy *= 0.3;
    }
  }
  
  handlePressState(p, player, myAtk) {
    const controller = this.getControllingPlayer(!p.isMy);
    if (!controller) {
      p.state = PlayerState.RETURN_HOME;
      return;
    }
    
    const cPlayer = this.players.get(controller.id);
    const dist = Math.hypot(cPlayer.x - player.x, cPlayer.y - player.y);
    
    if (dist < 0.05) {
      // 尝试抢断
      const tackleSkill = p.tackling / 100;
      const dribbleSkill = controller.dribbling / 100;
      
      if (Math.random() < tackleSkill * 0.4 - dribbleSkill * 0.2) {
        // 抢断成功
        this.ball.owner = p;
        p.tackles++;
        this.stats[p.isMy ? 'my' : 'opp'].tackles++;
        this.possession.current = p.isMy ? 'my' : 'opp';
        this.addEvent(`🤺 ${p.name.split(' ').pop()} 抢断成功!`, 'defense');
        p.state = PlayerState.DRIBBLE;
      } else {
        // 犯规可能
        if (Math.random() < 0.15) {
          this.addEvent(`⚠️ ${p.name.split(' ').pop()} 犯规!`, 'foul');
          this.stats[p.isMy ? 'my' : 'opp'].fouls++;
          this.phaseT = 2;
        }
      }
    } else {
      p.targetX = cPlayer.x;
      p.targetY = cPlayer.y;
    }
  }
  
  // ---- 辅助方法 ----
  movePlayer(p, player, dt) {
    if (p.targetX === undefined || p.targetY === undefined) return;
    
    const dx = p.targetX - player.x;
    const dy = p.targetY - player.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 0.01) return;
    
    // 最大速度基于 pace 和体能
    const maxSpeed = (p.pace / 100) * 0.4 * (p.fitness / 100) * 0.8;
    const accel = 2.0;
    
    // 朝向目标加速
    player.vx += (dx / dist) * accel * dt;
    player.vy += (dy / dist) * accel * dt;
    
    // 限制最大速度
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }
    
    // 应用摩擦力
    player.vx *= 0.92;
    player.vy *= 0.92;
    
    // 更新位置
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    
    // 边界限制
    player.x = Math.max(0.02, Math.min(0.98, player.x));
    player.y = Math.max(0.05, Math.min(0.95, player.y));
    
    // 记录跑动距离
    p.distanceRun += speed * dt;
  }
  
  updateBall(dt) {
    // 球的运动
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    
    // 摩擦力
    this.ball.vx *= 0.96;
    this.ball.vy *= 0.96;
    
    // 边界反弹
    if (this.ball.x < 0.02 || this.ball.x > 0.98) {
      this.ball.vx *= -0.6;
      this.ball.x = Math.max(0.02, Math.min(0.98, this.ball.x));
    }
    if (this.ball.y < 0.05 || this.ball.y > 0.95) {
      this.ball.vy *= -0.6;
      this.ball.y = Math.max(0.05, Math.min(0.95, this.ball.y));
    }
  }
  
  canShoot(p, zone) {
    const isMy = p.isMy;
    const inBox = zone === (isMy ? Zone.AWAY_BOX : Zone.HOME_BOX);
    const inThird = zone === (isMy ? Zone.AWAY_THIRD : Zone.HOME_THIRD);
    return inBox || (inThird && p.shooting > 75);
  }
  
  findBestPass(p) {
    const teammates = (p.isMy ? this.myTeam : this.oppTeam).filter(t => t.id !== p.id);
    let bestTarget = null;
    let bestScore = -1;
    
    teammates.forEach(t => {
      const tPlayer = this.players.get(t.id);
      if (!tPlayer) return;
      
      const dist = Math.hypot(tPlayer.x - p.x, tPlayer.y - p.y);
      if (dist < 0.1 || dist > 0.5) return; // 太近或太远
      
      // 评分：距离适中 + 前方位置 + 无人盯防
      const forwardBonus = (p.isMy ? tPlayer.x > p.x : tPlayer.x < p.x) ? 0.2 : 0;
      const openBonus = 0.3 - this.calculatePressureAt(tPlayer.x, tPlayer.y, !p.isMy) * 0.3;
      
      const score = (0.4 - dist) + forwardBonus + openBonus + t.positioning / 200;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = t;
      }
    });
    
    return bestTarget;
  }
  
  calculatePressure(p) {
    return this.calculatePressureAt(p.x, p.y, !p.isMy);
  }
  
  calculatePressureAt(x, y, isMyTeam) {
    const opponents = (isMyTeam ? this.myTeam : this.oppTeam).filter(o => o.role !== 'GK');
    let pressure = 0;
    
    opponents.forEach(o => {
      const oPlayer = this.players.get(o.id);
      if (!oPlayer) return;
      const dist = Math.hypot(oPlayer.x - x, oPlayer.y - y);
      if (dist < 0.2) {
        pressure += (0.2 - dist) / 0.2;
      }
    });
    
    return Math.min(1, pressure);
  }
  
  isClosestToBall(p) {
    const all = [...this.myTeam, ...this.oppTeam];
    const myDist = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
    
    return !all.some(other => {
      if (other.id === p.id) return false;
      const dist = Math.hypot(this.ball.x - other.x, this.ball.y - other.y);
      return dist < myDist - 0.02;
    });
  }
  
  getControllingPlayer(isMyTeam) {
    const team = isMyTeam ? this.myTeam : this.oppTeam;
    return team.find(p => this.ball.owner && this.ball.owner.id === p.id);
  }
  
  generateEvents() {
    // 事件由状态机自然产生，这里处理一些随机事件
    if (Math.random() < 0.001) {
      // 极低概率的红牌
      const team = Math.random() < 0.5 ? this.myTeam : this.oppTeam;
      const player = team[rand(1, 10)];
      if (player) {
        this.addEvent(`🟥 ${player.name.split(' ').pop()} 红牌!`, 'red');
        player.redCard = true;
        this.phaseT = 3;
      }
    }
  }
  
  addEvent(text, type, minute = null) {
    const min = minute !== null ? minute : this.min;
    this.events.unshift({ text, type, min: `${min}'` });
    if (this.events.length > 20) this.events.pop();
  }
  
  endMatch() {
    this.finished = true;
    this.started = false;
    this.addEvent(`🏁 全场结束 ${this.score.my}-${this.score.opp}`, 'end', 90);
  }
  
  // ---- 渲染数据获取 ----
  getRenderData() {
    const players = [];
    this.players.forEach((p, id) => {
      players.push({
        ...p,
        x: p.x,
        y: p.y,
        isMy: this.myTeam.some(mp => mp.id === id)
      });
    });
    
    return {
      score: this.score,
      min: this.min,
      ball: this.ball,
      players,
      events: this.events,
      possession: this.possession,
      stats: this.stats
    };
  }
}

// ============================================================
// 导出到全局
// ============================================================
if (typeof window !== 'undefined') {
  window.MatchEngine = MatchEngine;
  window.PlayerState = PlayerState;
  window.Tactics = Tactics;
}
