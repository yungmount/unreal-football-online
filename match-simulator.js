/**
 * match-simulator.js
 * ==================
 * 将 AllenThomasDev/Football-Simulator 的 Python 模拟引擎
 * 移植为 JavaScript，与 UFO MatchEngine v4 集成
 *
 * 核心逻辑：
 * - 使用真实足球比赛概率数据（每分钟每种事件的概率）
 * - 射门 → 偏出/命中/被扑/进球 多层判定
 * - 进球分布（1球/2球/3球/4+球）
 * - 犯规/黄牌/红牌/换人完整事件链
 * - 球队强度影响进攻成功率
 *
 * 集成方式：
 * - 作为 UFO MatchEngine 的外部模拟器使用
 * - 提供事件列表用于高亮球员触发 LPC 动画
 */

(function(global) {
'use strict';

// ============================================================
// 概率辅助函数（模拟 Python random.choices）
// ============================================================

function weightedRandom(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function pickKey(obj) {
  const keys = Object.keys(obj);
  const vals = keys.map(k => obj[k]);
  const idx = weightedRandom(vals);
  return keys[idx];
}

// ============================================================
// 球队强度计算
// ============================================================

function calcTeamStrength(team) {
  // team: array of player objects with .overall
  const players = team.filter(p => p);
  if (!players.length) return 70;
  return players.reduce((s, p) => s + (p.overall || 65), 0) / players.length;
}

// ============================================================
// 射门结果判定
// ============================================================

const SHOT_OUTCOME = {
  'Off target': { prob: 0.4051192528422109 },
  'On target':  {
    prob: 0.3404717742815371,
    is_goal: [0.6947214602507242, 0.30527853974927577] // [saved, goal]
  },
  'Blocked':    { prob: 0.23602679643005214 },
  'Hit the bar':{ prob: 0.015602155934274555 },
};

// ============================================================
// 进球分布
// ============================================================

const GOAL_DIST = {
  1: 0.0,
  2: 0.13102119460500963,
  3: 0.5144508670520231,
  4: 0.35452793834296725,
};

// ============================================================
// 犯规处理
// ============================================================

const FOUL_TYPES = ['Foul', 'Free kick won', 'Yellow card', 'Red card', 'Second yellow card'];

// ============================================================
// 事件类型
// ============================================================

const EVENT_KEYS = [
  'Attempt', 'Corner', 'Failed through ball', 'Foul',
  'Free kick won', 'Hand ball', 'Key Pass', 'Offside',
  'Own goal', 'Penalty conceded', 'Red card', 'Second yellow card',
  'Sending off', 'Substitution', 'Yellow card'
];

// ============================================================
// MatchEvent 类
// ============================================================

class MatchEvent {
  constructor(event, side, minute, player) {
    this.event = event;
    this.side = side; // 'home' or 'away'
    this.minute = minute;
    this.player = player; // player name string
    this.subEvents = []; // sub-events (e.g. Attempt → On target → Goal)
  }

  getText(myTeamName, oppTeamName) {
    const teamName = this.side === 'home' ? myTeamName : oppTeamName;
    const playerName = this.player || 'Player';
    const shortName = playerName.split(' ').pop();

    switch (this.event) {
      case 'Goal': return `⚽ GOAL! ${shortName}!`;
      case 'On target': return this.subEvents.includes('Goal')
        ? `⚽ ${shortName} — ON TARGET → GOAL!`
        : `🧤 ${shortName} — ON TARGET`;
      case 'Saved': return `🧤 SAVED! ${shortName}`;
      case 'Off target': return `❌ ${shortName} — OFF TARGET`;
      case 'Blocked': return `🚫 ${shortName} — BLOCKED`;
      case 'Hit the bar': return `⚠️ ${shortName} — HIT THE BAR`;
      case 'Foul': return `🔺 FOUL! ${shortName}`;
      case 'Yellow card': return `🟨 YELLOW CARD — ${shortName}`;
      case 'Second yellow card':
      case 'Red card': return `🟥 RED CARD! ${shortName}`;
      case 'Corner': return `📍 CORNER KICK — ${teamName}`;
      case 'Offside': return `🚩 OFFSIDE — ${shortName}`;
      case 'Substitution': return `🔄 SUBSTITUTION — ${shortName}`;
      case 'Key Pass': return `🎯 KEY PASS — ${shortName}`;
      case 'Failed through ball': return `↗️ THROUGH BALL FAILED — ${teamName}`;
      case 'Penalty conceded': return `⚠️ PENALTY! ${shortName}`;
      case 'Own goal': return `🚨 OWN GOAL — ${shortName}`;
      default: return `${shortName} ${this.event}`;
    }
  }

  getType() {
    if (this.event === 'Goal') return 'goal';
    if (this.event.includes('card') || this.event.includes('Red') || this.event.includes('Second yellow')) return 'card';
    if (this.event === 'Saved') return 'save';
    if (this.event === 'Off target' || this.event === 'Hit the bar') return 'miss';
    if (['Foul', 'Penalty conceded'].includes(this.event)) return 'foul';
    if (this.event === 'Substitution') return 'sub';
    if (['On target', 'Blocked'].includes(this.event)) return 'shot';
    if (this.event === 'Key Pass' || this.event === 'Failed through ball') return 'pass';
    if (this.event === 'Offside') return 'offside';
    return 'info';
  }
}

// ============================================================
// 随机选球员
// ============================================================

function pickRandomPlayer(team, positions) {
  const pool = team.filter(p => p && positions.includes(p.role || p.position));
  if (!pool.length) return team[Math.floor(Math.random() * team.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomAnyPlayer(team) {
  return team[Math.floor(Math.random() * team.length)];
}

// ============================================================
// 进攻/防守强度修正
// ============================================================

function getDefenseFactor(homeAtk, homeMid, awayDef, awayAtk, awayMid, homeDef) {
  // hdf = (home_def^2 * home_mid) / (away_atk^2 * away_mid)
  const hdf = (homeDef * homeDef * homeMid) / (awayAtk * awayAtk * awayMid + 0.01);
  const adf = (awayDef * awayDef * awayMid) / (homeAtk * homeAtk * homeMid + 0.01);
  return { hdf, adf };
}

// ============================================================
// 主模拟器类
// ============================================================

class MatchSimulator {
  /**
   * @param {Object} homeTeam  - 我方球队 [{name, role, overall, position, ...}]
   * @param {Object} awayTeam  - 对方球队 [{name, role, overall, position, ...}]
   * @param {Object} oddsData  - 概率数据（match-odds.json）
   * @param {Object} opts
   */
  constructor(homeTeam, awayTeam, oddsData, opts = {}) {
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.oddsData = oddsData;
    this.homeName = opts.homeName || 'Home FC';
    this.awayName = opts.awayName || 'Away FC';
    this.homeTactic = opts.homeTactic || null;
    this.awayTactic = opts.awayTactic || null;

    // 球队强度
    this.homeAtk  = calcTeamStrength(homeTeam);
    this.homeMid  = calcTeamStrength(homeTeam);
    this.homeDef  = calcTeamStrength(homeTeam);
    this.awayAtk  = calcTeamStrength(awayTeam);
    this.awayMid  = calcTeamStrength(awayTeam);
    this.awayDef  = calcTeamStrength(awayTeam);

    // 初始化
    this.events = [];
    this.stats = {
      home: this._emptyStats(),
      away: this._emptyStats()
    };
    this.score = { home: 0, away: 0 };
    this.currentPossession = 'home';
    this.subCount = { home: 0, away: 0 };
    this.yellowCards = { home: new Set(), away: new Set() };
    this.redCards = { home: new Set(), away: new Set() };

    // 深拷贝 odds 并应用强度修正
    this._adjustedOdds = this._buildAdjustedOdds();
  }

  _emptyStats() {
    return {
      Goal: 0, 'On target': 0, Saved: 0, 'Off target': 0,
      Blocked: 0, 'Hit the bar': 0, Attempt: 0,
      Foul: 0, 'Yellow card': 0, 'Red card': 0,
      'Second yellow card': 0, 'Free kick won': 0,
      Corner: 0, Offside: 0, Substitution: 0,
      'Key Pass': 0, 'Failed through ball': 0,
      'Penalty conceded': 0, 'Own goal': 0,
    };
  }

  _buildAdjustedOdds() {
    // 深拷贝原始概率
    const odds = JSON.parse(JSON.stringify(this.oddsData.odds));

    // 计算进攻/防守因子
    const hdf = (this.homeDef * this.homeDef * this.homeMid) /
                (this.awayAtk * this.awayAtk * this.awayMid + 1);
    const adf = (this.awayDef * this.awayDef * this.awayMid) /
                (this.homeAtk * this.homeAtk * this.homeMid + 1);

    for (let minute = 0; minute < 100; minute++) {
      if (odds[minute]) {
        // 主队尝试概率降低（防守好/进攻差）
        if (odds[minute].Away && odds[minute].Away.Events) {
          const current = odds[minute].Away.Events.Attempt || 0;
          odds[minute].Away.Events.Attempt = current / Math.pow(adf, 2.33);
        }
        // 客队尝试概率降低
        if (odds[minute].Home && odds[minute].Home.Events) {
          const current = odds[minute].Home.Events.Attempt || 0;
          odds[minute].Home.Events.Attempt = current / Math.pow(hdf, 2.33);
        }
      }
    }
    return odds;
  }

  // ---- 获取进攻方 ----
  _atkTeam() {
    return this.currentPossession === 'home' ? this.homeTeam : this.awayTeam;
  }
  _defTeam() {
    return this.currentPossession === 'home' ? this.awayTeam : this.homeTeam;
  }
  _atkSide() {
    return this.currentPossession;
  }
  _defSide() {
    return this.currentPossession === 'home' ? 'away' : 'home';
  }

  // ---- 犯规与红黄牌 ----
  _resolveFoul(side, minute, team, defTeam) {
    const events = [];

    // 犯规方
    const foulPlayer = pickRandomPlayer(team, ['DEF', 'CDM', 'MID']);
    const foulEvent = new MatchEvent('Foul', side, minute, foulPlayer.name);
    foulEvent.subEvents.push('Foul');
    events.push(foulEvent);
    this._trackStat(side, 'Foul', 1);

    // 任意球方（犯规方对面）
    const fkSide = side === 'home' ? 'away' : 'home';
    const fkPlayer = pickRandomPlayer(defTeam, ['MID', 'ATT']);
    const fkEvent = new MatchEvent('Free kick won', fkSide, minute, fkPlayer.name);
    events.push(fkEvent);
    this._trackStat(fkSide, 'Free kick won', 1);

    // 随机是否出牌
    const minuteOdds = this._adjustedOdds[minute] || this._adjustedOdds[99] || { Home: { Events: {} }, Away: { Events: {} } };
    const sideEvents = minuteOdds[this._atkSide() === 'home' ? 'Home' : 'Away'].Events;

    const foulRate = sideEvents.Foul || 0.2;
    const yellowRate = sideEvents['Yellow card'] || 0.02;
    const redRate = sideEvents['Red card'] || 0.001;
    const secondYellowRate = sideEvents['Second yellow card'] || 0.005;

    // 黄牌
    if (yellowRate / foulRate > Math.random() * 2) {
      const ycEvent = new MatchEvent('Yellow card', side, minute, foulPlayer.name);
      events.push(ycEvent);
      this._trackStat(side, 'Yellow card', 1);
      this.yellowCards[side].add(foulPlayer.name);
    }

    // 第二张黄牌变红
    if (this.yellowCards[side].has(foulPlayer.name)) {
      const syEvent = new MatchEvent('Second yellow card', side, minute, foulPlayer.name);
      events.push(syEvent);
      this._trackStat(side, 'Second yellow card', 1);
      this.redCards[side].add(foulPlayer.name);
    }

    // 直接红牌
    if (redRate / foulRate > Math.random() * 5) {
      const rcEvent = new MatchEvent('Red card', side, minute, foulPlayer.name);
      events.push(rcEvent);
      this._trackStat(side, 'Red card', 1);
      this.redCards[side].add(foulPlayer.name);
    }

    return events;
  }

  // ---- 射门处理 ----
  _resolveAttempt(side, minute, atkTeam, defTeam) {
    const events = [];

    // 射门球员
    const shooter = pickRandomPlayer(atkTeam, ['ATT', 'MID']);
    const gk = pickRandomPlayer(defTeam, ['GK']);

    // 创建 Attempt 事件
    const attemptEvent = new MatchEvent('Attempt', side, minute, shooter.name);
    events.push(attemptEvent);
    this._trackStat(side, 'Attempt', 1);
    this._trackStat(side, 'Goal', 0); // init

    // 射门结果
    const shotKeys = Object.keys(SHOT_OUTCOME);
    const shotProbs = shotKeys.map(k => SHOT_OUTCOME[k].prob);
    const shotResult = shotKeys[weightedRandom(shotProbs)];

    if (shotResult === 'On target') {
      const otEvent = new MatchEvent('On target', side, minute, shooter.name);
      events.push(otEvent);
      this._trackStat(side, 'On target', 1);

      // 进球判定
      const goalProb = SHOT_OUTCOME['On target'].is_goal[1];
      // 守门员技能降低进球率
      const gkSkill = gk.defending || gk.overall || 65;
      const shootSkill = shooter.shooting || shooter.overall || 65;
      const adjGoalProb = goalProb * (0.5 + (shootSkill - 60) / 200) * (1.3 - (gkSkill - 60) / 200);

      if (adjGoalProb > Math.random()) {
        const goalEvent = new MatchEvent('Goal', side, minute, shooter.name);
        events.push(goalEvent);
        this._trackStat(side, 'Goal', 1);
        if (side === 'home') this.score.home++;
        else this.score.away++;
        // 进球后换球权
        this.currentPossession = side === 'home' ? 'away' : 'home';
      } else {
        const savedEvent = new MatchEvent('Saved', side === 'home' ? 'away' : 'home', minute, gk.name);
        events.push(savedEvent);
        this._trackStat(side === 'home' ? 'away' : 'home', 'Saved', 1);
        // 换球权
        this.currentPossession = side === 'home' ? 'away' : 'home';
      }
    } else if (shotResult === 'Off target') {
      const otEvent = new MatchEvent('Off target', side, minute, shooter.name);
      events.push(otEvent);
      this._trackStat(side, 'Off target', 1);
    } else if (shotResult === 'Blocked') {
      const blkEvent = new MatchEvent('Blocked', side, minute, shooter.name);
      events.push(blkEvent);
      this._trackStat(side, 'Blocked', 1);
    } else if (shotResult === 'Hit the bar') {
      const barEvent = new MatchEvent('Hit the bar', side, minute, shooter.name);
      events.push(barEvent);
      this._trackStat(side, 'Hit the bar', 1);
    }

    return events;
  }

  _trackStat(side, eventKey, delta) {
    if (this.stats[side][eventKey] !== undefined) {
      this.stats[side][eventKey] += delta;
    }
  }

  // ---- 单分钟模拟 ----
  _simulateMinute(minute) {
    const minuteData = this._adjustedOdds[minute] || this._adjustedOdds[99];
    if (!minuteData) return [];

    const atkSide = this._atkSide();
    const defSide = this._defSide();
    const atkTeam = this._atkTeam();
    const defTeam = this._defTeam();

    const sideKey = atkSide === 'home' ? 'Home' : 'Away';
    const defSideKey = defSide === 'home' ? 'Home' : 'Away';

    const minuteEvents = minuteData[sideKey];
    const eventProb = minuteData.Event || 0.005;

    // 每分钟最多一次事件（随机触发）
    if (Math.random() > eventProb * 10) return []; // ~10x events per minute originally

    // 每 tick（~1/3 minute），检查是否触发事件
    for (let tick = 0; tick < 3; tick++) {
      if (Math.random() > eventProb * 3) continue;

      const eventKeys = Object.keys(minuteEvents.Events);
      const eventProbs = eventKeys.map(k => minuteEvents.Events[k]);
      const evtType = eventKeys[weightedRandom(eventProbs)];

      const events = [];

      if (evtType === 'Foul') {
        events.push(...this._resolveFoul(atkSide, minute, atkTeam, defTeam));
      } else if (evtType === 'Attempt') {
        events.push(...this._resolveAttempt(atkSide, minute, atkTeam, defTeam));
      } else if (evtType === 'Corner') {
        const cornerPlayer = pickRandomPlayer(atkTeam, ['DEF', 'MID']);
        events.push(new MatchEvent('Corner', atkSide, minute, cornerPlayer.name));
        this._trackStat(atkSide, 'Corner', 1);
      } else if (evtType === 'Offside') {
        const offPlayer = pickRandomPlayer(atkTeam, ['ATT', 'MID']);
        events.push(new MatchEvent('Offside', atkSide, minute, offPlayer.name));
        this._trackStat(atkSide, 'Offside', 1);
      } else if (evtType === 'Yellow card') {
        const ycPlayer = pickRandomPlayer(atkTeam, ['DEF', 'CDM', 'MID']);
        events.push(new MatchEvent('Yellow card', atkSide, minute, ycPlayer.name));
        this._trackStat(atkSide, 'Yellow card', 1);
        this.yellowCards[atkSide].add(ycPlayer.name);
      } else if (evtType === 'Red card') {
        const rcPlayer = pickRandomPlayer(atkTeam, ['DEF', 'CDM']);
        events.push(new MatchEvent('Red card', atkSide, minute, rcPlayer.name));
        this._trackStat(atkSide, 'Red card', 1);
        this.redCards[atkSide].add(rcPlayer.name);
      } else if (evtType === 'Key Pass') {
        const kpPlayer = pickRandomPlayer(atkTeam, ['MID', 'ATT']);
        events.push(new MatchEvent('Key Pass', atkSide, minute, kpPlayer.name));
        this._trackStat(atkSide, 'Key Pass', 1);
      } else if (evtType === 'Failed through ball') {
        const ftbPlayer = pickRandomPlayer(atkTeam, ['MID']);
        events.push(new MatchEvent('Failed through ball', atkSide, minute, ftbPlayer.name));
        this._trackStat(atkSide, 'Failed through ball', 1);
      } else if (evtType === 'Substitution') {
        if (this.subCount[atkSide] < 3) {
          const subPlayer = pickRandomAnyPlayer(atkTeam);
          events.push(new MatchEvent('Substitution', atkSide, minute, subPlayer.name));
          this._trackStat(atkSide, 'Substitution', 1);
          this.subCount[atkSide]++;
        }
      } else if (evtType === 'Penalty conceded') {
        const pcPlayer = pickRandomPlayer(atkTeam, ['DEF', 'CDM']);
        events.push(new MatchEvent('Penalty conceded', atkSide, minute, pcPlayer.name));
        this._trackStat(atkSide, 'Penalty conceded', 1);
      }

      // 添加所有事件
      events.forEach(e => this.events.push(e));
    }

    return [];
  }

  // ---- 模拟整场比赛 ----
  simulate() {
    this.events = [];

    for (let minute = 0; minute < 100; minute++) {
      // 45分钟半场切换
      if (minute === 45) {
        // 半场休息，球回到中场
        this.currentPossession = 'home';
        this.events.push(new MatchEvent('Half Time', 'home', 45, null));
        continue;
      }

      this._simulateMinute(minute);
    }

    this.events.push(new MatchEvent('Full Time', 'home', 90, null));
    return {
      score: this.score,
      events: this.events,
      stats: this.stats,
      homeName: this.homeName,
      awayName: this.awayName,
    };
  }

  // ---- 获取比赛结果文本 ----
  getResultText() {
    const { score, events, homeName, awayName } = this.simulate();
    const lines = [];
    lines.push(`🏆 ${homeName} ${score.home} - ${score.away} ${awayName}`);
    lines.push('');
    events.filter(e => e.minute <= 90 && e.minute >= 0).forEach(e => {
      if (e.event === 'Half Time' || e.event === 'Full Time') {
        lines.push(`--- ${e.event} ---`);
      } else {
        lines.push(`${e.minute}' ${e.getText(homeName, awayName)}`);
      }
    });
    return lines.join('\n');
  }
}

// ============================================================
// UFO MatchEngine 集成接口
// ============================================================

/**
 * 包装 MatchSimulator 用于 UFO MatchEngine
 * 生成与 MatchEngine v4 兼容的事件格式
 */
class UFOEventSimulator {
  constructor(homeTeam, awayTeam, oddsData, homeName, awayName) {
    this.sim = new MatchSimulator(homeTeam, awayTeam, oddsData, {
      homeName, awayName
    });
  }

  /**
   * 返回 UFO MatchEngine 格式的事件列表
   */
  run() {
    const result = this.sim.simulate();
    return result.events
      .filter(e => e.event !== 'Half Time' && e.event !== 'Full Time')
      .map(e => ({
        text: e.getText(result.homeName, result.awayName),
        type: e.getType(),
        min: `${e.minute}'`,
        isMy: e.side === 'home',
        minute: e.minute,
        event: e.event,
        player: e.player,
        score: { ...this.sim.score },
      }));
  }

  getScore() { return { ...this.sim.score }; }
  getStats() { return JSON.parse(JSON.stringify(this.sim.stats)); }
  getResultText() { return this.sim.getResultText(); }
}

// ============================================================
// 导出
// ============================================================

global.MatchSimulator = MatchSimulator;
global.UFOEventSimulator = UFOEventSimulator;
global.MATCH_ODDS = null; // 动态加载

/**
 * 异步加载概率数据
 */
global.loadMatchOdds = function(path) {
  return fetch(path)
    .then(r => r.json())
    .then(data => {
      global.MATCH_ODDS = data;
      console.log('[MatchSimulator] 概率数据加载完成');
      return data;
    });
};

/**
 * UFO MatchEngine v5 助手 — 替换当前模拟
 */
global.useSimulatorInMatch = function(homeTeam, awayTeam, homeName, awayName) {
  if (!global.MATCH_ODDS) {
    console.warn('[MatchSimulator] 概率数据未加载');
    return null;
  }
  const sim = new UFOEventSimulator(homeTeam, awayTeam, global.MATCH_ODDS, homeName, awayName);
  return {
    events: sim.run(),
    score: sim.getScore(),
    stats: sim.getStats(),
    resultText: sim.getResultText(),
  };
};

})(window);
