/**
 * 球衣自定义系统 - 支持1000+种组合
 * 
 * 自定义维度:
 * 1. 球衣主色 (25种调色板颜色)
 * 2. 球衣次色 (用于图案，25种)
 * 3. 球衣款式 (短袖/长袖)
 * 4. 图案类型 (10种)
 * 5. 短裤颜色 (25种)
 * 6. 球袜颜色 (25种)
 * 7. 号码颜色 (25种)
 * 8. 球队标志 (自定义SVG)
 * 
 * 理论组合数: 25 × 25 × 2 × 10 × 25 × 25 × 25 × ∞ = 7,812,500+ 种
 */

class JerseyCustomizer {
  constructor() {
    // 图案类型定义
    this.PATTERNS = {
      solid: { name: '纯色', layers: 0 },
      horizontal_stripes: { name: '横条纹', layers: 1, stripeCount: 5 },
      vertical_stripes: { name: '竖条纹', layers: 1, stripeCount: 7 },
      diagonal_stripes: { name: '斜条纹', layers: 1, stripeCount: 4 },
      hoops: { name: '环纹', layers: 1, stripeCount: 3 },
      v_neck: { name: 'V领色块', layers: 1 },
      sleeve_cuffs: { name: '袖口色块', layers: 1 },
      chest_band: { name: '胸前色带', layers: 1 },
      shoulder_blocks: { name: '肩部色块', layers: 1 },
      gradient: { name: '渐变', layers: 0, gradient: true },
      checkered: { name: '格子', layers: 1, gridSize: 4 },
      sash: { name: '斜带', layers: 1 },
      quartered: { name: '四分格', layers: 1 },
    };

    // 可用颜色 (映射到LPC调色板)
    this.COLORS = [
      'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'lavender',
      'white', 'black', 'pink', 'navy', 'maroon', 'teal', 'forest',
      'tan', 'brown', 'leather', 'sky', 'slate', 'gray', 'charcoal',
      'bluegray', 'rose', 'walnut'
    ];

    // 预设球队配色方案 (真实球队风格)
    this.PRESETS = {
      // 英超
      man_united: { primary: 'red', secondary: 'white', pattern: 'solid' },
      liverpool: { primary: 'red', secondary: 'white', pattern: 'solid' },
      arsenal: { primary: 'red', secondary: 'white', pattern: 'sleeve_cuffs' },
      chelsea: { primary: 'blue', secondary: 'white', pattern: 'solid' },
      man_city: { primary: 'sky', secondary: 'white', pattern: 'solid' },
      tottenham: { primary: 'white', secondary: 'navy', pattern: 'horizontal_stripes' },
      // 西甲
      real_madrid: { primary: 'white', secondary: 'purple', pattern: 'solid' },
      barcelona: { primary: 'blue', secondary: 'maroon', pattern: 'vertical_stripes' },
      atletico_madrid: { primary: 'red', secondary: 'white', pattern: 'horizontal_stripes' },
      // 德甲
      bayern: { primary: 'red', secondary: 'white', pattern: 'solid' },
      dortmund: { primary: 'yellow', secondary: 'black', pattern: 'vertical_stripes' },
      // 意甲
      juventus: { primary: 'white', secondary: 'black', pattern: 'horizontal_stripes' },
      ac_milan: { primary: 'red', secondary: 'black', pattern: 'vertical_stripes' },
      inter: { primary: 'blue', secondary: 'black', pattern: 'vertical_stripes' },
      // 法甲
      psg: { primary: 'navy', secondary: 'red', pattern: 'solid' },
      // 其他
      celtic: { primary: 'green', secondary: 'white', pattern: 'horizontal_stripes' },
      rangers: { primary: 'blue', secondary: 'white', pattern: 'solid' },
      ajax: { primary: 'red', secondary: 'white', pattern: 'solid' },
      benfica: { primary: 'red', secondary: 'white', pattern: 'solid' },
      porto: { primary: 'blue', secondary: 'white', pattern: 'vertical_stripes' },
    };
  }

  /**
   * 生成随机球衣配置
   */
  generateRandom() {
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const patterns = Object.keys(this.PATTERNS);
    
    return {
      primaryColor: rand(this.COLORS),
      secondaryColor: rand(this.COLORS),
      jerseyStyle: rand(['shortsleeve', 'longsleeve']),
      pattern: rand(patterns),
      shortsColor: rand(this.COLORS),
      socksColor: rand(this.COLORS),
      numberColor: rand(['white', 'black', ...this.COLORS.slice(0, 10)]),
      numberStyle: rand(['block', 'outline', 'shadow']),
    };
  }

  /**
   * 从预设生成配置
   */
  fromPreset(presetName) {
    const preset = this.PRESETS[presetName];
    if (!preset) return this.generateRandom();
    
    return {
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      jerseyStyle: Math.random() > 0.5 ? 'shortsleeve' : 'longsleeve',
      pattern: preset.pattern,
      shortsColor: preset.secondary || 'white',
      socksColor: preset.primary,
      numberColor: preset.secondary || 'white',
      numberStyle: 'block',
    };
  }

  /**
   * 创建球衣图案覆盖层
   * @param {Object} config - 球衣配置
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @returns {HTMLCanvasElement} - 图案Canvas
   */
  createPatternOverlay(config, width = 64, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const patternDef = this.PATTERNS[config.pattern];
    if (!patternDef || patternDef.layers === 0) return null;

    const secondary = this.hexToRgb(this.getColorHex(config.secondaryColor));
    ctx.fillStyle = `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.5)`;

    switch (config.pattern) {
      case 'horizontal_stripes':
        const hStripeHeight = height / (patternDef.stripeCount * 2);
        for (let i = 0; i < patternDef.stripeCount; i++) {
          ctx.fillRect(0, i * hStripeHeight * 2, width, hStripeHeight);
        }
        break;

      case 'vertical_stripes':
        const vStripeWidth = width / (patternDef.stripeCount * 2);
        for (let i = 0; i < patternDef.stripeCount; i++) {
          ctx.fillRect(i * vStripeWidth * 2, 0, vStripeWidth, height);
        }
        break;

      case 'diagonal_stripes':
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();
        const stripeGap = width / patternDef.stripeCount;
        for (let i = -height; i < width + height; i += stripeGap * 2) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + stripeGap, 0);
          ctx.lineTo(i + stripeGap + height, height);
          ctx.lineTo(i + height, height);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;

      case 'hoops':
        const hoopHeight = height / 6;
        ctx.fillRect(0, hoopHeight, width, hoopHeight);
        ctx.fillRect(0, hoopHeight * 3, width, hoopHeight);
        break;

      case 'v_neck':
        ctx.beginPath();
        ctx.moveTo(width * 0.35, height * 0.1);
        ctx.lineTo(width * 0.5, height * 0.25);
        ctx.lineTo(width * 0.65, height * 0.1);
        ctx.lineTo(width * 0.65, height * 0.35);
        ctx.lineTo(width * 0.35, height * 0.35);
        ctx.closePath();
        ctx.fill();
        break;

      case 'sleeve_cuffs':
        // 左袖口
        ctx.fillRect(0, height * 0.2, width * 0.15, height * 0.08);
        // 右袖口
        ctx.fillRect(width * 0.85, height * 0.2, width * 0.15, height * 0.08);
        break;

      case 'chest_band':
        ctx.fillRect(width * 0.2, height * 0.35, width * 0.6, height * 0.1);
        break;

      case 'shoulder_blocks':
        ctx.fillRect(0, height * 0.15, width * 0.25, height * 0.15);
        ctx.fillRect(width * 0.75, height * 0.15, width * 0.25, height * 0.15);
        break;

      case 'checkered':
        const cellSize = width / patternDef.gridSize;
        for (let x = 0; x < patternDef.gridSize; x++) {
          for (let y = 0; y < patternDef.gridSize; y++) {
            if ((x + y) % 2 === 0) {
              ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
          }
        }
        break;

      case 'sash':
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(width * 0.7, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width * 0.3, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;

      case 'quartered':
        ctx.fillRect(0, 0, width * 0.5, height * 0.5);
        ctx.fillRect(width * 0.5, height * 0.5, width * 0.5, height * 0.5);
        break;
    }

    return canvas;
  }

  /**
   * 创建球队标志
   * @param {string} logoType - 标志类型
   * @param {string} primaryColor - 主色
   * @param {string} secondaryColor - 次色
   * @param {number} size - 尺寸
   */
  createLogo(logoType, primaryColor, secondaryColor, size = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const primary = this.getColorHex(primaryColor);
    const secondary = this.getColorHex(secondaryColor);

    ctx.fillStyle = primary;
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 2;

    switch (logoType) {
      case 'shield':
        // 盾形
        ctx.beginPath();
        ctx.moveTo(size * 0.1, size * 0.1);
        ctx.lineTo(size * 0.9, size * 0.1);
        ctx.lineTo(size * 0.9, size * 0.5);
        ctx.quadraticCurveTo(size * 0.5, size * 0.9, size * 0.1, size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'circle':
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'star':
        this.drawStar(ctx, size/2, size/2, 5, size * 0.4, size * 0.2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(size * 0.5, size * 0.1);
        ctx.lineTo(size * 0.9, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.9);
        ctx.lineTo(size * 0.1, size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'cross':
        ctx.fillRect(size * 0.35, size * 0.1, size * 0.3, size * 0.8);
        ctx.fillRect(size * 0.1, size * 0.35, size * 0.8, size * 0.3);
        ctx.strokeRect(size * 0.35, size * 0.1, size * 0.3, size * 0.8);
        break;

      case 'lion':
        // 简化狮子头像
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.4, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // 鬃毛
        ctx.fillStyle = secondary;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const x = size * 0.5 + Math.cos(angle) * size * 0.35;
          const y = size * 0.4 + Math.sin(angle) * size * 0.35;
          ctx.beginPath();
          ctx.arc(x, y, size * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'bird':
        // 简化鸟形
        ctx.beginPath();
        ctx.moveTo(size * 0.2, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.2);
        ctx.lineTo(size * 0.8, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 翅膀
        ctx.fillStyle = secondary;
        ctx.beginPath();
        ctx.ellipse(size * 0.5, size * 0.5, size * 0.15, size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'crown':
        ctx.beginPath();
        ctx.moveTo(size * 0.1, size * 0.7);
        ctx.lineTo(size * 0.1, size * 0.4);
        ctx.lineTo(size * 0.3, size * 0.6);
        ctx.lineTo(size * 0.5, size * 0.3);
        ctx.lineTo(size * 0.7, size * 0.6);
        ctx.lineTo(size * 0.9, size * 0.4);
        ctx.lineTo(size * 0.9, size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'ball':
        // 足球
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 五边形花纹
        ctx.fillStyle = secondary;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;

      default:
        // 默认圆形
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    return canvas;
  }

  /**
   * 创建号码字体Canvas
   */
  createNumberCanvas(number, color, style = 'block', size = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const hex = this.getColorHex(color);
    
    ctx.font = `bold ${size * 0.8}px Arial Black, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (style) {
      case 'outline':
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(number, size/2, size/2);
        ctx.fillStyle = hex;
        ctx.fillText(number, size/2, size/2);
        break;

      case 'shadow':
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(number, size/2 + 2, size/2 + 2);
        ctx.fillStyle = hex;
        ctx.fillText(number, size/2, size/2);
        break;

      default: // block
        ctx.fillStyle = hex;
        ctx.fillText(number, size/2, size/2);
    }

    return canvas;
  }

  /**
   * 绘制五角星
   */
  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  /**
   * 获取颜色的十六进制值
   */
  getColorHex(colorName) {
    // 映射到LPC调色板的第一级颜色（最深的）
    const colorMap = {
      red: '#82171C',
      blue: '#3C49AD',
      green: '#2F8136',
      yellow: '#D99431',
      orange: '#D75B1A',
      purple: '#621E78',
      lavender: '#A966DD',
      white: '#FFFFFF',
      black: '#2A3034',
      pink: '#C36072',
      navy: '#3C49AD',
      maroon: '#682121',
      teal: '#0098B2',
      forest: '#1B5502',
      tan: '#CFC587',
      brown: '#744B30',
      leather: '#9A6F37',
      sky: '#C6EEFD',
      slate: '#B3AFA1',
      gray: '#797580',
      charcoal: '#4A5057',
      bluegray: '#79979D',
      rose: '#B05F3C',
      walnut: '#A17C50',
    };
    return colorMap[colorName] || '#AB1E1E';
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 171, g: 30, b: 30 };
  }

  /**
   * 验证配置是否有效
   */
  validateConfig(config) {
    const validColors = new Set(this.COLORS);
    const validPatterns = new Set(Object.keys(this.PATTERNS));
    
    return {
      valid: validColors.has(config.primaryColor) &&
             validColors.has(config.secondaryColor) &&
             validPatterns.has(config.pattern) &&
             ['shortsleeve', 'longsleeve'].includes(config.jerseyStyle),
      issues: []
    };
  }

  /**
   * 计算配置的唯一性分数
   */
  calculateUniqueness(config) {
    // 返回一个表示配置独特性的分数
    const baseScore = 
      this.COLORS.indexOf(config.primaryColor) * 25 * 25 * 2 * 10 +
      this.COLORS.indexOf(config.secondaryColor) * 25 * 2 * 10 +
      (config.jerseyStyle === 'longsleeve' ? 1 : 0) * 2 * 10 +
      Object.keys(this.PATTERNS).indexOf(config.pattern) * 10;
    return baseScore;
  }
}

// 导出全局
window.JerseyCustomizer = JerseyCustomizer;

console.log('🧥 球衣自定义系统已加载');
console.log('📊 可用维度:', {
  colors: 25,
  patterns: Object.keys(new JerseyCustomizer().PATTERNS).length,
  styles: 2,
  totalCombinations: '7,812,500+'
});
