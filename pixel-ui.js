/**
 * PIXEL FOOTBALL UI - 像素风格界面管理器
 * 
 * 功能:
 * 1. 像素风格渲染函数
 * 2. 球员卡片像素渲染
 * 3. 统计数据条像素渲染
 * 4. 按钮/卡片组件
 * 5. 动画效果
 */

// ============================================================
// 像素UI组件库
// ============================================================

const PixelUI = {
  // 颜色常量
  COLORS: {
    bg: '#1a1a2e',
    bgDark: '#0f0f23',
    bgLight: '#252542',
    border: '#4a4a6a',
    text: '#e8e8f0',
    textDim: '#9090b0',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    yellow: '#ffff00',
    green: '#00ff00',
    red: '#ff3333',
    orange: '#ff8800',
    gold: '#ffd700',
    blue: '#0088ff',
    purple: '#8844ff',
  },

  // ============================================================
  // 像素卡片
  // ============================================================
  card(title, content, options = {}) {
    const accentColor = options.accent || this.COLORS.cyan;
    const icon = options.icon || '◆';
    
    return `
      <div class="px-card" style="${options.style || ''}">
        ${title ? `<div class="px-card-title">${icon} ${title}</div>` : ''}
        ${content}
      </div>
    `;
  },

  // ============================================================
  // 像素按钮
  // ============================================================
  btn(text, onclick, variant = 'primary', style = '') {
    const variants = {
      primary: 'px-btn-primary',
      gold: 'px-btn-gold',
      green: 'px-btn-green',
      red: 'px-btn-red',
      purple: 'px-btn-purple',
      dark: 'px-btn-dark',
    };
    
    return `<button class="px-btn ${variants[variant]}" onclick="${onclick}" style="${style}">${text}</button>`;
  },

  // ============================================================
  // 像素统计条
  // ============================================================
  statBar(label, value, max = 100, color = 'cyan', showValue = true) {
    const percentage = Math.round((value / max) * 100);
    const colorMap = {
      cyan: 'px-stat-cyan',
      red: 'px-stat-red',
      green: 'px-stat-green',
      yellow: 'px-stat-yellow',
      purple: 'px-stat-purple',
      gold: 'px-stat-gold',
    };
    
    return `
      <div class="px-stat ${colorMap[color] || 'px-stat-cyan'}">
        <div class="px-stat-label">${label}</div>
        <div class="px-stat-bar">
          <div class="px-stat-fill" style="width: ${percentage}%"></div>
        </div>
        ${showValue ? `<div class="px-stat-value">${value}</div>` : ''}
      </div>
    `;
  },

  // ============================================================
  // 球员卡片 (像素风格)
  // ============================================================
  playerCard(player, options = {}) {
    const {
      showSign = false,
      showPrice = false,
      compact = false,
      onclick = `selPlayer=${JSON.stringify(player).replace(/"/g, '&quot;')};tab='playerDetail';render()`,
    } = options;

    const ratingClass = player.ovr >= 80 ? 'high' : player.ovr >= 65 ? 'medium' : '';
    const ratingColor = player.ovr >= 80 ? this.COLORS.gold : player.ovr >= 65 ? this.COLORS.cyan : this.COLORS.textDim;
    
    return `
      <div class="px-player-card" onclick="${onclick}">
        <div class="px-player-avatar" id="va-${player.id || player.name.replace(/\s+/g, '-')}"></div>
        <div class="px-player-info">
          <div class="px-player-name">${player.name}</div>
          <div class="px-player-meta">${player.age}岁 · ${player.position} · ${player.region}</div>
        </div>
        <div>
          <div class="px-player-rating ${ratingClass}" style="color: ${ratingColor}; text-shadow: 0 0 10px ${ratingColor}">${player.ovr}</div>
          ${showPrice ? `<div style="font-size: 12px; color: ${this.COLORS.gold}; text-align: right">${fmt(player.askPrice || player.value)}</div>` : ''}
        </div>
        ${showSign ? `
          <div style="display: flex; gap: 8px; margin-left: auto;">
            ${this.btn('签约', `signP('${player.id}')`, 'green', 'font-size: 8px; padding: 8px 12px')}
            ${this.btn('拒绝', `rejectP('${player.id}')`, 'red', 'font-size: 8px; padding: 8px 12px')}
          </div>
        ` : ''}
      </div>
    `;
  },

  // ============================================================
  // 排行榜行
  // ============================================================
  standingsRow(team, index, isMe) {
    const isTop3 = index < 3;
    const rowClass = isMe ? 'my-team' : isTop3 ? 'top-3' : '';
    
    return `
      <div class="px-standings-row ${rowClass}">
        <span class="px-standings-rank">${index + 1}</span>
        <span style="${isMe ? 'color: ' + this.COLORS.cyan : ''}">${getLN(team.index)}</span>
        <span style="text-align: center">${team.won}</span>
        <span style="text-align: right; font-family: 'Press Start 2P', monospace; font-size: 8px; color: ${this.COLORS.gold}">${team.pts}</span>
      </div>
    `;
  },

  // ============================================================
  // 比赛界面
  // ============================================================
  matchScore(myScore, oppScore, myName, oppName, minute, isLive) {
    return `
      <div class="px-match-score">
        <div class="px-match-team">
          <div class="px-match-team-name">${myName}</div>
          <div class="px-match-score-num" style="color: ${this.COLORS.cyan}">${myScore}</div>
        </div>
        <div style="text-align: center">
          <div class="px-match-vs">VS</div>
          ${isLive ? `<div class="px-match-time">${minute}'</div>` : ''}
        </div>
        <div class="px-match-team">
          <div class="px-match-team-name">${oppName}</div>
          <div class="px-match-score-num opp">${oppScore}</div>
        </div>
      </div>
    `;
  },

  // ============================================================
  // 事件日志项
  // ============================================================
  eventItem(event) {
    const iconMap = {
      goal: '⚽',
      shot: '🎯',
      pass: '👟',
      foul: '⚠️',
      defense: '🛡️',
      save: '🧤',
      red: '🟥',
      miss: '❌',
      info: '📢',
      end: '🏁',
    };
    
    const icons = iconMap[event.type] || '•';
    
    return `
      <div class="px-event ${event.type}">
        <span class="px-event-icon">${icons}</span>
        <span>${event.min}</span>
        <span style="margin-left: auto">${event.text}</span>
      </div>
    `;
  },

  // ============================================================
  // 导航栏
  // ============================================================
  navbar() {
    const tabs = [
      { id: 'home', icon: '🏠', label: '主页' },
      { id: 'team', icon: '👥', label: '球队' },
      { id: 'tactics', icon: '⚔️', label: '战术' },
      { id: 'facility', icon: '🏭', label: '设施' },
      { id: 'match', icon: '⚽', label: '比赛' },
    ];
    
    return `
      <nav class="px-nav">
        ${tabs.map(t => `
          <button class="px-nav-item ${tab === t.id ? 'active' : ''}" onclick="tab='${t.id}';render()">
            <span class="nav-icon">${t.icon}</span>
            <span>${t.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  },

  // ============================================================
  // 主屏幕统计卡片
  // ============================================================
  statGrid(myTeam) {
    const gd = myTeam.gf - myTeam.ga;
    const gdColor = gd >= 0 ? this.COLORS.green : this.COLORS.red;
    
    return `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; margin-bottom: 12px;">
        <div class="px-card" style="padding: 10px; text-align: center;">
          <div class="px" style="font-size: 20px; color: ${this.COLORS.cyan}; margin-bottom: 4px">#${myTeam.pos || '-'}</div>
          <div style="font-size: 10px; color: ${this.COLORS.textDim}">排名</div>
        </div>
        <div class="px-card" style="padding: 10px; text-align: center;">
          <div style="font-size: 16px; font-weight: bold">${myTeam.won}-${myTeam.drawn}-${myTeam.lost}</div>
          <div style="font-size: 10px; color: ${this.COLORS.textDim}">战绩</div>
        </div>
        <div class="px-card" style="padding: 10px; text-align: center;">
          <div class="px" style="font-size: 18px; color: ${gdColor}">${gd > 0 ? '+' : ''}${gd}</div>
          <div style="font-size: 10px; color: ${this.COLORS.textDim}">净胜球</div>
        </div>
        <div class="px-card" style="padding: 10px; text-align: center;">
          <div class="px" style="font-size: 20px; color: ${this.COLORS.gold}">${myTeam.pts}</div>
          <div style="font-size: 10px; color: ${this.COLORS.textDim}">积分</div>
        </div>
      </div>
    `;
  },

  // ============================================================
  // 球员详细属性
  // ============================================================
  playerStats(stats) {
    const statConfig = [
      { key: 'pace', label: '速度', color: 'cyan' },
      { key: 'shooting', label: '射门', color: 'red' },
      { key: 'passing', label: '传球', color: 'yellow' },
      { key: 'dribbling', label: '盘带', color: 'purple' },
      { key: 'defending', label: '防守', color: 'green' },
      { key: 'physical', label: '体能', color: 'gold' },
    ];
    
    return statConfig.map(s => {
      const value = stats[s.key] || 0;
      return this.statBar(s.label, value, 99, s.color);
    }).join('');
  },

  // ============================================================
  // 战术板
  // ============================================================
  tacticsBoard(formation, team) {
    const formations = {
      '4-4-2': [
        [0.5, 0.85], [0.2, 0.65], [0.4, 0.65], [0.6, 0.65], [0.8, 0.65],
        [0.2, 0.45], [0.4, 0.45], [0.6, 0.45], [0.8, 0.45],
        [0.35, 0.25], [0.65, 0.25]
      ],
      '4-3-3': [
        [0.5, 0.85], [0.2, 0.65], [0.4, 0.65], [0.6, 0.65], [0.8, 0.65],
        [0.3, 0.45], [0.5, 0.45], [0.7, 0.45],
        [0.2, 0.2], [0.5, 0.25], [0.8, 0.2]
      ],
      '3-5-2': [
        [0.5, 0.85], [0.3, 0.65], [0.5, 0.65], [0.7, 0.65],
        [0.1, 0.45], [0.3, 0.45], [0.5, 0.45], [0.7, 0.45], [0.9, 0.45],
        [0.35, 0.2], [0.65, 0.2]
      ],
    };
    
    const positions = formations[formation] || formations['4-4-2'];
    const roles = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT'];
    
    return `
      <div style="background: #1a4d1a; border: 4px solid ${this.COLORS.green}; position: relative; aspect-ratio: 2/1; margin-bottom: 16px;">
        <canvas id="tactics-canvas" width="400" height="200" style="width: 100%; height: 100%; image-rendering: pixelated;"></canvas>
      </div>
    `;
  },
};

// ============================================================
// 工具函数
// ============================================================

// 格式化数字
function fmt(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num;
}

// 获取联赛名称简称
function getLN(idx) {
  const names = {
    0: 'FC联', 1: '红魔', 2: '蓝月', 3: '枪手', 4: '红军',
    5: '蓝狮', 6: '白鹿', 7: '热刺', 8: '铁锤', 9: '狼队',
  };
  return names[idx] || `球队${idx}`;
}

// ============================================================
// Toast通知
// ============================================================
let toastTimeout = null;

function showToast(message, duration = 2000) {
  // 移除现有toast
  const existing = document.querySelector('.px-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'px-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.remove(), duration);
}

// ============================================================
// 球员头像初始化 (像素风格)
// ============================================================
async function initPlayerAvatars() {
  if (typeof LPCPlayerGenerator === 'undefined') return;
  
  const generator = new LPCPlayerGenerator();
  await generator.preload();
  
  // 为所有球员卡片生成头像
  document.querySelectorAll('[data-avatar="1"]').forEach(async el => {
    const player = JSON.parse(el.dataset.player.replace(/&apos;/g, "'"));
    const container = el;
    
    try {
      const teamData = { primaryColor: 'red', secondaryColor: 'white' };
      const appearance = generator.generateAppearance(player, teamData);
      const sprite = await generator.generatePlayerSprite(appearance, 'idle', 2, false, 0);
      
      container.innerHTML = '';
      sprite.style.width = '100%';
      sprite.style.height = '100%';
      container.appendChild(sprite);
    } catch (e) {
      console.warn('Avatar init failed:', e);
    }
  });
}

// ============================================================
// 导出
// ============================================================
window.PixelUI = PixelUI;
window.PixelUI_ShowToast = showToast;
window.PixelUI_InitAvatars = initPlayerAvatars;

console.log('🎮 Pixel UI System Loaded');
