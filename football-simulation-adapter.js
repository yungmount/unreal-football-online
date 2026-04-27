/**
 * football-simulation-adapter.js
 * =================================
 * 将 GallagherAiden/footballSimulationEngine 集成到足球游戏
 * 
 * 使用方法:
 *   importFootballEngine().then(engine => {
 *     engine.initiateGame(team1, team2, pitch).then(matchDetails => {
 *       // matchDetails 包含所有球员位置、球的实时位置、统计
 *       engine.playIteration(matchDetails).then(updatedDetails => {
 *         // updatedDetails.ball.position - 球的位置 [x, y, z]
 *         // updatedDetails.kickOffTeam.players[].currentPOS - 球员位置
 *         // updatedDetails.kickOffTeamStatistics/goals - 统计数据
 *       })
 *     })
 *   })
 */

class FootballSimulationAdapter {
  constructor() {
    this.engine = null;
    this.matchDetails = null;
  }

  // 加载并解析 CommonJS 模块 (用于浏览器)
  async importEngine() {
    if (this.engine) return this.engine;

    const engineCode = await fetch('./football-sim-lib/engine.js').then(r => r.text());
    const libFiles = [
      'common', 'setPositions', 'setVariables', 'playerMovement', 
      'ballMovement', 'validate', 'actions'
    ];
    
    const libs = {};
    for (const name of libFiles) {
      libs[name] = await fetch(`./football-sim-lib/lib/${name}.js`).then(r => r.text());
    }

    // 简单模拟 CommonJS require 环境
    const fakeRequire = (name) => {
      if (name === './lib/common') return this.evalModule(libs.common);
      if (name === './lib/setPositions') return this.evalModule(libs.setPositions);
      if (name === './lib/setVariables') return this.evalModule(libs.setVariables);
      if (name === './lib/playerMovement') return this.evalModule(libs.playerMovement);
      if (name === './lib/ballMovement') return this.evalModule(libs.ballMovement);
      if (name === './lib/validate') return this.evalModule(libs.validate);
      if (name === './lib/actions') return this.evalModule(libs.actions);
      return {};
    };

    const fakeModule = { exports: {} };
    
    // 解析 engine.js 并注入 require
    const fullCode = `
      const require = ${fakeRequire.toString()};
      const module = { exports: {} };
      ${engineCode}
      return module.exports;
    `;

    this.engine = eval(fullCode);
    return this.engine;
  }

  evalModule(code) {
    const fakeRequire = (name) => ({ default: {}, ...this._fakeRequire(name) });
    const fakeModule = { exports: {} };
    const fn = new Function('require', 'module', 'exports', code);
    fn(fakeRequire, fakeModule, fakeModule.exports);
    return fakeModule.exports;
  }

  // 将游戏球队数据转换为引擎格式
  convertTeam(gameTeam, isHome = true) {
    const positions = this.getFormationPositions(isHome);
    return {
      name: gameTeam.name,
      players: gameTeam.players.map((p, i) => ({
        name: p.name,
        position: p.position || this.getPositionByIndex(i),
        rating: p.overall || 75,
        skill: {
          passing: p.passing || 60,
          shooting: p.shooting || p.finishing || 60,
          tackling: p.tackling || 60,
          saving: p.position === 'GK' ? (p.saving || 70) : 10,
          agility: p.agility || 70,
          strength: p.strength || 65,
          penalty_taking: p.penaltyTaking || 50,
          perception: p.perception || 75,
          jumping: p.jumping || 70,
          control: p.control || 60
        },
        currentPOS: positions[i] || [340, 0],
        fitness: 100,
        height: p.height || 175,
        injured: false
      })),
      manager: gameTeam.manager || 'Unknown'
    };
  }

  getPositionByIndex(index) {
    const positions = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'RW', 'ST'];
    return positions[index] || 'ST';
  }

  getFormationPositions(isHome) {
    // 4-3-3 阵型位置 (虚拟球场坐标)
    // 球场宽度 680, 高度 1050
    const w = 680, h = 1050;
    const centerX = w / 2;
    
    if (isHome) {
      return [
        [centerX, 50],      // GK
        [80, 200],          // LB
        [230, 200],         // CB
        [450, 200],         // CB
        [600, 200],         // RB
        [centerX, 350],     // CDM
        [200, 400],         // CM
        [480, 400],         // CM
        [120, 500],         // LW
        [560, 500],         // RW
        [centerX, 550]      // ST
      ];
    } else {
      // 客队位置 (镜像)
      return [
        [centerX, h - 50], // GK (守门员靠近己方球门)
        [600, h - 200],     // LB → RB
        [450, h - 200],     // CB
        [230, h - 200],     // CB
        [80, h - 200],      // RB → LB
        [centerX, h - 350], // CDM
        [480, h - 400],     // CM
        [200, h - 400],     // CM
        [560, h - 500],     // LW → RW
        [120, h - 500],     // RW → LW
        [centerX, h - 550]  // ST
      ];
    }
  }

  // 标准球场配置
  getPitchConfig() {
    return {
      pitchWidth: 680,
      pitchHeight: 1050,
      goalWidth: 90
    };
  }

  // 初始化比赛
  async initMatch(homeTeam, awayTeam) {
    const engine = await this.importEngine();
    
    const team1 = this.convertTeam(homeTeam, true);
    const team2 = this.convertTeam(awayTeam, false);
    const pitch = this.getPitchConfig();

    this.matchDetails = await engine.initiateGame(team1, team2, pitch);
    return this.matchDetails;
  }

  // 执行一次模拟迭代
  async nextIteration() {
    if (!this.matchDetails) throw new Error('Match not initialized');
    const engine = await this.importEngine();
    this.matchDetails = await engine.playIteration(this.matchDetails);
    return this.matchDetails;
  }

  // 开始下半场
  async startSecondHalf() {
    if (!this.matchDetails) throw new Error('Match not initialized');
    const engine = await this.importEngine();
    this.matchDetails = await engine.startSecondHalf(this.matchDetails);
    return this.matchDetails;
  }

  // 获取球的位置 (归一化到 0-1)
  getBallPosition() {
    if (!this.matchDetails) return { x: 0.5, y: 0.5 };
    const [x, y] = this.matchDetails.ball.position;
    return {
      x: x / this.matchDetails.pitchSize[0],
      y: y / this.matchDetails.pitchSize[1]
    };
  }

  // 获取所有球员位置
  getAllPlayerPositions() {
    if (!this.matchDetails) return { home: [], away: [] };
    return {
      home: this.matchDetails.kickOffTeam.players.map(p => ({
        name: p.name,
        position: p.position,
        x: p.currentPOS[0] / this.matchDetails.pitchSize[0],
        y: p.currentPOS[1] / this.matchDetails.pitchSize[1],
        hasBall: p.hasBall
      })),
      away: this.matchDetails.secondTeam.players.map(p => ({
        name: p.name,
        position: p.position,
        x: p.currentPOS[0] / this.matchDetails.pitchSize[0],
        y: p.currentPOS[1] / this.matchDetails.pitchSize[1],
        hasBall: p.hasBall
      }))
    };
  }

  // 获取比分
  getScore() {
    if (!this.matchDetails) return { home: 0, away: 0 };
    return {
      home: this.matchDetails.kickOffTeamStatistics?.goals || 0,
      away: this.matchDetails.secondTeamStatistics?.goals || 0
    };
  }

  // 获取比赛统计
  getStatistics() {
    if (!this.matchDetails) return null;
    return {
      home: this.matchDetails.kickOffTeamStatistics,
      away: this.matchDetails.secondTeamStatistics
    };
  }
}

// 导出
window.FootballSimulationAdapter = FootballSimulationAdapter;
