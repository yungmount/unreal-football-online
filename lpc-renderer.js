/**
 * LPC Spritesheet Character Generator - 完整集成版
 * 实现"千人千面"足球运动员渲染
 * 
 * 核心功能:
 * 1. 精灵加载器 - 加载 spritesheets 并提取帧
 * 2. 颜色重映射 - 动态改变皮肤、头发、衣服颜色
 * 3. 多层合成 - 按 z-order 组合多个精灵层
 * 4. 球员生成器 - 根据球员数据生成个性化外观
 */

// ============================================================
// LPC 配置与常量
// ============================================================

const LPC = {
  // 精灵尺寸
  FRAME_WIDTH: 64,
  FRAME_HEIGHT: 64,
  
  // 动画方向: 0=下, 1=左, 2=右, 3=上 (标准 LPC 顺序)
  DIRECTIONS: ['down', 'left', 'right', 'up'],
  
  // 默认方向: 正面 (下)
  DEFAULT_DIRECTION: 0,
  
  // 球员卡片使用的动画帧索引
  IDLE_FRAME: 0,
  
  // Z-order 层级 (决定渲染顺序)
  Z_LAYERS: {
    CAPE_BACK: 5,
    BODY: 10,
    LEGS: 20,
    FEET: 30,
    TORSO: 40,
    ARMS: 50,
    HEAD: 100,
    EARS: 102,
    NOSE: 105,
    EYES: 106,
    HAIR_BACK: 108,
    BEARD: 109,
    HAIR_FRONT: 110,
    FACE_EXPRESSION: 111,
    HAT: 120,
    WEAPON: 140,
  },
  
  // ============================================================
  // 足球运动员专用配置
  // ============================================================
  FOOTBALL: {
    // 可用体型 (排除 child, pregnant)
    BODY_TYPES: ['male', 'muscular', 'teen'],
    
    // 可用头部变体
    HEAD_TYPES: ['male', 'male_elderly', 'male_gaunt', 'male_plump', 'male_small'],
    
    // 可用发型 (基于实际下载的文件)
    HAIR_STYLES: [
      // 短发 (足球常见)
      'buzzcut', 'plain', 'cowlick', 'cowlick_tall', 'parted', 'parted2', 'parted3',
      // 中等长度
      'curtains', 'curtains_long', 'swoop', 'swoop_side', 'mop', 'messy1', 'messy2', 'messy3',
      'bedhead', 'unkempt', 'natural', 'relm_short', 'halfmessy',
      // 卷发
      'curly_short', 'curly_short2', 'curly_long', 'afro', 'jewfro',
      // 长发
      'half_up', 'long', 'long_messy', 'long_messy2', 'long_straight',
      'loose', 'lob', 'bob', 'bob_side_part', 'bangs', 'bangs_bun', 'bangslong', 'bangsshort',
      // 扎起来
      'page', 'page2', 'pigtails', 'pigtails_bangs', 'pixie',
      'extensions__ponytails__topknot_short', 'extensions__ties__high_bun',
      // 特殊风格
      'dreadlocks_short', 'dreadlocks_long', 'cornrows', 'twists_fade', 'twists_straight',
      // 莫霍克 (个性球员)
      'shorthawk', 'longhawk', 'spiked', 'spiked2', 'flat_top_fade', 'flat_top_straight', 'high_and_tight',
      // 其他
      'balding', 'idol',
    ],
    
    // 可用胡须风格
    BEARD_STYLES: [
      '5oclock_shadow', // 五点阴影 (轻度胡茬)
      'basic',          // 基础胡须
      'trimmed',        // 修剪整齐
      'medium',         // 中等长度
      'winter',         // 冬季大胡子
    ],
    
    // 可用小胡子风格
    MUSTACHE_STYLES: [
      'basic',      // 基础小胡子
      'chevron',    // 雪佛龙式
      'handlebar',  // 八字胡
      'horseshoe',  // 马蹄形
      'lampshade',  // 灯罩式
      'walrus',     // 海象式
    ],
    
    // 可用短裤 (足球)
    SHORTS_STYLES: ['shorts', 'short_shorts'],
    
    // 可用鞋子 (足球)
    BOOTS_STYLES: ['basic', 'revised', 'rimmed'],
    
    // 可用球衣
    JERSEY_STYLES: ['shortsleeve', 'longsleeve'],
    
    // 守门员手套
    GLOVES_STYLES: ['gloves'],
    
    // 不可用组件 (排除)
    EXCLUDED: {
      // 盔甲
      armour: true,
      plate: true,
      bracers: true,
      // 奇幻
      cape: true,
      dress: true,
      skirt: true,
      wings: true,
      tail: true,
      horn: true,
      halo: true,
      // 武器
      weapon: true,
      shield: true,
      // 过于正式
      formal: true,
      // 不适合足球的服装
      jacket: true,
      robe: true,
      vest: true,
      // 饰品
      necklace: true,
      earrings: true,
    },
  },
  
  // 资源路径
  ASSET_BASE: 'lpc-assets/',
  
  // 缓存
  cache: {
    sprites: new Map(),
    canvases: new Map(),
  },
};

// ============================================================
// LPC 颜色调色板 (从 item-metadata.js 提取 - 真实 LPC 标准)
// ============================================================

const LPC_PALETTES = {
  // 皮肤色调色板 (body.ulpc 标准 - 6 级渐变)
  skin: {
    // 标准肤色
    light:    ['#271920', '#99423c', '#cc8665', '#E4A47C', '#F9D5BA', '#FAECE7'],
    amber:    ['#281716', '#9E3E37', '#D28144', '#EA9F54', '#FDD082', '#FBE7A4'],
    olive:    ['#271920', '#442725', '#7F4C31', '#AE6B3F', '#D38B59', '#E4A47C'],
    taupe:    ['#271920', '#503734', '#785946', '#936849', '#BA8454', '#C7935F'],
    bronze:   ['#1A1213', '#442725', '#644133', '#7F4C31', '#AE6B3F', '#D38B59'],
    brown:    ['#120E10', '#412B29', '#5F4539', '#76513A', '#9C663E', '#B8773F'],
    black:    ['#000000', '#1A1213', '#2E1F1C', '#442725', '#603429', '#7F4C31'],
    // 幻想肤色
    blue:     ['#16171B', '#46425D', '#586B90', '#748DA4', '#A9C9CA', '#C8E8E8'],
    green:    ['#140C09', '#09320B', '#19541D', '#228236', '#39AA4E', '#53BF71'],
    lavender: ['#16171B', '#393B44', '#787C8F', '#A0A5BC', '#C9D0EE', '#FBECE6'],
    zombie:   ['#281820', '#6B5C40', '#928364', '#A79778', '#C5B38F', '#DBCBAB'],
  },
  
  // 发色调色板 (hair.ulpc 标准 - 6 级渐变)
  hair: {
    black:    ['#000000', '#080A0A', '#101414', '#1C2222', '#31313E', '#4A5057'],
    raven:    ['#010107', '#040B18', '#061421', '#071F2A', '#0D384D', '#1A5369'],
    gray:     ['#0E0E0E', '#292929', '#4B4B4B', '#777777', '#AAAAAA', '#D9D9D9'],
    white:    ['#1D1D21', '#484E57', '#8B9498', '#B8BBBC', '#D8DCDC', '#FFFFFF'],
    blonde:   ['#331313', '#552B15', '#AC5D1F', '#E09E2B', '#FCCF56', '#FFE67D'],
    sandy:    ['#1C0E06', '#633E2C', '#99622D', '#BF9D5A', '#EDDC7E', '#F6F6C2'],
    gold:     ['#5C0D00', '#902900', '#E47100', '#FFA913', '#FFE453', '#EEFE7E'],
    ginger:   ['#300500', '#6A1A00', '#9C3B01', '#CC6901', '#FAA301', '#FFE01E'],
    carrot:   ['#5A1500', '#8A2000', '#AC2800', '#EC673E', '#F68764', '#FFB39C'],
    redhead:  ['#260D14', '#3E111A', '#73171E', '#9E1F1F', '#C7341B', '#E74716'],
    red:      ['#300000', '#870000', '#A40712', '#CB0000', '#E21414', '#F1583A'],
    light_brown: ['#1A0E04', '#301B07', '#60350F', '#7D4513', '#AE682A', '#C88D58'],
    chestnut: ['#200C0D', '#3A130E', '#63200B', '#81310A', '#B6550E', '#D28102'],
    dark_brown: ['#050100', '#160701', '#290E02', '#421603', '#5F1F04', '#792806'],
    // 幻想发色
    pink:     ['#330410', '#71043A', '#B60A68', '#E941AA', '#E976C4', '#EA95D5'],
    purple:   ['#13112D', '#2B225A', '#402E82', '#7141B2', '#A966DD', '#D085ED'],
    blue:     ['#000027', '#00005E', '#000091', '#0041B4', '#0074CB', '#1E85EF'],
    navy:     ['#180716', '#20102B', '#281E41', '#322D6A', '#3C49AD', '#466AC9'],
    green:    ['#000400', '#001400', '#002D00', '#005000', '#007C00', '#00A700'],
  },
  
  // 球衣/衣服调色板 (cloth.ulpc 标准 - 6 级渐变)
  cloth: {
    red:      ['#1d131e', '#400B1F', '#651117', '#82171C', '#AB1E1E', '#CD2429'],
    blue:     ['#180716', '#281E41', '#322D6A', '#3C49AD', '#466AC9', '#61A0EF'],
    green:    ['#101820', '#192832', '#0B5C2F', '#214437', '#2F8136', '#64A42C'],
    yellow:   ['#301723', '#5F2F25', '#BA5B23', '#D99431', '#F3C03F', '#FFE360'],
    orange:   ['#301723', '#5F1D1B', '#9C3F23', '#D75B1A', '#EF7E19', '#FFA749'],
    purple:   ['#180716', '#13112D', '#261044', '#411357', '#621E78', '#813089'],
    lavender: ['#13112d', '#2B225A', '#402E82', '#7141B2', '#A966DD', '#D085ED'],
    white:    ['#281820', '#4D4A5D', '#958080', '#C4B59F', '#E5E6C7', '#FFFFFF'],
    black:    ['#000000', '#101414', '#1C2222', '#22282A', '#2A3034', '#4A5057'],
    pink:     ['#1d131e', '#54242E', '#6C3536', '#AE424A', '#C36072', '#E08080'],
    navy:     ['#180716', '#20102B', '#281E41', '#322D6A', '#3C49AD', '#466AC9'],
    maroon:   ['#1d131e', '#400B1F', '#551C22', '#682121', '#832121', '#AE424A'],
    teal:     ['#180716', '#1B2B47', '#0E4E72', '#156C99', '#0098B2', '#00CFDF'],
    forest:   ['#09131d', '#07391D', '#0B1F25', '#0B2B28', '#134507', '#1B5502'],
    tan:      ['#3e2613', '#684415', '#986A20', '#B78C41', '#B7996A', '#CFC587'],
    brown:    ['#1d131e', '#411E05', '#4B2B13', '#62351C', '#744B30', '#996B4A'],
    leather:  ['#2b1c1d', '#311210', '#4B2B13', '#704325', '#75502D', '#9A6F37'],
    sky:      ['#1a0d18', '#313148', '#586B90', '#9FBBCB', '#C6EEFD', '#FFFFFF'],
    slate:    ['#1d131e', '#31313E', '#4A5057', '#818B8B', '#B3AFA1', '#E5E6C7'],
    gray:     ['#0e0e18', '#201E2B', '#373340', '#585561', '#797580', '#A2A0A4'],
    charcoal: ['#000000', '#130D14', '#1C2222', '#2A3034', '#4A5057', '#6E7675'],
    bluegray: ['#11150b', '#0B2B28', '#2E403A', '#315B49', '#557E85', '#79979D'],
    rose:     ['#1d131e', '#301723', '#562323', '#77372B', '#8A3D28', '#B05F3C'],
    walnut:   ['#1d0f0e', '#3e2613', '#62351c', '#744b30', '#996b4a', '#a17c50'],
  },
  
  // 眼睛调色板 (eye.ulpc 标准 - 3 级渐变)
  eyes: {
    blue:   ['#2a3c49', '#5686ae', '#57cee4'],
    green:  ['#2b4b29', '#53b351', '#84ec50'],
    purple: ['#710862', '#b90da0', '#eba0e0'],
    red:    ['#532421', '#cb4a39', '#ff3d62'],
    orange: ['#a45227', '#be734b', '#ea9b71'],
    yellow: ['#b69953', '#d9bf46', '#fedf47'],
    brown:  ['#232017', '#544c2e', '#7e4e20'],
    gray:   ['#3d3c37', '#8b8979', '#ada18f'],
  },
  
  // 金属调色板 (metal.ulpc 标准 - 6 级渐变)
  metal: {
    brass:   ['#1A1213', '#3E2613', '#62351C', '#744B30', '#996B4A', '#A17C50'],
    bronze:  ['#000000', '#3E2613', '#442725', '#603429', '#7F4C31', '#965B38'],
    copper:  ['#1A0E04', '#62351C', '#744B30', '#AE6B3F', '#D38B59', '#E09C4C'],
    gold:    ['#331313', '#552B15', '#AC5D1F', '#E09E2B', '#FCCF56', '#FFE67D'],
    iron:    ['#000000', '#0F1218', '#1B192B', '#29253A', '#343043', '#484152'],
    silver:  ['#29253A', '#4B4B60', '#6A7587', '#818E97', '#A8B3B8', '#C7CFCC'],
    steel:   ['#0E0E18', '#201E2B', '#373340', '#585561', '#797580', '#A2A0A4'],
  },
};

// ============================================================
// LPC 精灵加载器
// ============================================================

class LPCSpriteLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
    this.failedAssets = new Set(); // 记录失败的资源
  }
  
  /**
   * 加载精灵图
   * @param {string} path - 精灵图路径 (相对于 lpc-assets/)
   * @param {boolean} silent - 是否静默失败 (不打印错误)
   * @returns {Promise<Image|null>}
   */
  async load(path, silent = false) {
    const cacheKey = path;
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 检查是否已知失败
    if (this.failedAssets.has(cacheKey)) {
      return null;
    }
    
    // 检查是否正在加载
    if (this.loading.has(cacheKey)) {
      try {
        return await this.loading.get(cacheKey);
      } catch {
        return null;
      }
    }
    
    const loadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.cache.set(cacheKey, img);
        this.loading.delete(cacheKey);
        resolve(img);
      };
      
      img.onerror = () => {
        this.loading.delete(cacheKey);
        this.failedAssets.add(cacheKey);
        reject(new Error(`Failed to load sprite: ${path}`));
      };
      
      img.src = `${LPC.ASSET_BASE}${path}`;
    });
    
    this.loading.set(cacheKey, loadPromise);
    
    try {
      return await loadPromise;
    } catch (e) {
      if (!silent) {
        console.debug(`精灵加载失败: ${path}`);
      }
      return null;
    }
  }
  
  /**
   * 批量加载精灵图
   * @param {string[]} paths - 精灵图路径数组
   * @returns {Promise<Map<string, Image>>}
   */
  async loadBatch(paths) {
    const results = new Map();
    await Promise.all(paths.map(async (path) => {
      try {
        const img = await this.load(path, true);
        if (img) {
          results.set(path, img);
        }
      } catch (e) {
        // 静默失败
      }
    }));
    return results;
  }
  
  /**
   * 从精灵图中提取单帧
   * @param {Image} sprite - 精灵图
   * @param {number} frameIndex - 帧索引
   * @param {number} rowIndex - 行索引 (方向)
   * @returns {ImageData}
   */
  extractFrame(sprite, frameIndex = 0, rowIndex = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = LPC.FRAME_WIDTH;
    canvas.height = LPC.FRAME_HEIGHT;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
      sprite,
      frameIndex * LPC.FRAME_WIDTH,  // sx
      rowIndex * LPC.FRAME_HEIGHT,   // sy
      LPC.FRAME_WIDTH,               // sWidth
      LPC.FRAME_HEIGHT,              // sHeight
      0, 0,                          // dx, dy
      LPC.FRAME_WIDTH,               // dWidth
      LPC.FRAME_HEIGHT               // dHeight
    );
    
    return ctx.getImageData(0, 0, LPC.FRAME_WIDTH, LPC.FRAME_HEIGHT);
  }
}

// ============================================================
// LPC 颜色重映射器
// ============================================================

class LPCColorRemapper {
  /**
   * 重映射图像颜色
   * @param {ImageData} imageData - 原始图像数据
   * @param {Object} colorMap - 颜色映射 {oldColor: newColor}
   * @returns {ImageData}
   */
  remapColors(imageData, colorMap) {
    const data = imageData.data;
    const colorMapRgb = this.parseColorMap(colorMap);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a < 10) continue; // 跳过透明像素
      
      const colorKey = `${r},${g},${b}`;
      if (colorMapRgb[colorKey]) {
        const [nr, ng, nb] = colorMapRgb[colorKey];
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }
    
    return imageData;
  }
  
  /**
   * 应用调色板重映射
   * @param {ImageData} imageData - 原始图像数据
   * @param {string[]} sourcePalette - 源调色板颜色
   * @param {string[]} targetPalette - 目标调色板颜色
   * @returns {ImageData}
   */
  applyPalette(imageData, sourcePalette, targetPalette) {
    if (sourcePalette.length !== targetPalette.length) {
      console.warn('调色板长度不匹配');
      return imageData;
    }
    
    const colorMap = {};
    sourcePalette.forEach((src, i) => {
      colorMap[src] = targetPalette[i];
    });
    
    return this.remapColors(imageData, colorMap);
  }
  
  /**
   * 解析颜色映射为 RGB
   * @param {Object} colorMap - 颜色映射 {hex: hex}
   * @returns {Object} RGB 映射
   */
  parseColorMap(colorMap) {
    const rgbMap = {};
    for (const [src, dst] of Object.entries(colorMap)) {
      const srcRgb = this.hexToRgb(src);
      const dstRgb = this.hexToRgb(dst);
      if (srcRgb && dstRgb) {
        rgbMap[`${srcRgb.r},${srcRgb.g},${srcRgb.b}`] = [dstRgb.r, dstRgb.g, dstRgb.b];
      }
    }
    return rgbMap;
  }
  
  /**
   * HEX 转 RGB
   * @param {string} hex - 十六进制颜色
   * @returns {Object|null}
   */
  hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    hex = hex.replace('#', '');
    if (hex.length !== 6) return null;
    
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16),
    };
  }
  
  /**
   * RGB 转 HEX
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @returns {string}
   */
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  /**
   * 查找最近颜色 (用于调色板匹配)
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {string[]} palette - 调色板颜色数组
   * @returns {string} 最接近的颜色
   */
  findClosestColor(r, g, b, palette) {
    let minDist = Infinity;
    let closest = palette[0];
    
    for (const hex of palette) {
      const rgb = this.hexToRgb(hex);
      if (!rgb) continue;
      
      const dist = Math.sqrt(
        Math.pow(r - rgb.r, 2) +
        Math.pow(g - rgb.g, 2) +
        Math.pow(b - rgb.b, 2)
      );
      
      if (dist < minDist) {
        minDist = dist;
        closest = hex;
      }
    }
    
    return closest;
  }
}

// ============================================================
// LPC 多层合成器
// ============================================================

class LPCComposer {
  constructor() {
    this.loader = new LPCSpriteLoader();
    this.remapper = new LPCColorRemapper();
  }
  
  /**
   * 合成多层精灵到一个 Canvas
   * @param {Array} layers - 层配置数组 [{sprite, z, palette?, colorMap?}]
   * @param {number} width - 输出宽度
   * @param {number} height - 输出高度
   * @returns {Promise<HTMLCanvasElement>}
   */
  async compose(layers, width = LPC.FRAME_WIDTH, height = LPC.FRAME_HEIGHT) {
    // 按 z-order 排序
    const sortedLayers = [...layers].sort((a, b) => (a.z || 0) - (b.z || 0));
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // 清除透明
    ctx.clearRect(0, 0, width, height);
    
    for (const layer of sortedLayers) {
      try {
        let imageData;
        
        if (layer.imageData) {
          imageData = layer.imageData;
        } else if (layer.sprite) {
          const img = await this.loader.load(layer.sprite);
          
          // 可选层加载失败时跳过
          if (!img && layer.optional) {
            console.debug(`可选层加载失败，跳过: ${layer.sprite}`);
            continue;
          }
          
          if (!img) {
            console.warn(`必需层加载失败: ${layer.sprite}`);
            continue;
          }
          
          imageData = this.loader.extractFrame(img, layer.frame || 0, layer.row || 0);
        } else {
          continue;
        }
        
        // 应用颜色重映射
        if (layer.colorMap || layer.palette) {
          const sourcePalette = layer.sourcePalette || LPC_PALETTES.skin.light;
          const targetPalette = layer.palette || Object.values(layer.colorMap);
          imageData = this.remapper.applyPalette(imageData, sourcePalette, targetPalette);
          
          // 或者使用精确颜色映射
          if (layer.colorMap) {
            imageData = this.remapper.remapColors(imageData, layer.colorMap);
          }
        }
        
        // 绘制到 canvas
        ctx.putImageData(imageData, layer.offsetX || 0, layer.offsetY || 0);
      } catch (e) {
        if (!layer.optional) {
          console.warn(`Failed to compose layer:`, layer, e);
        }
      }
    }
    
    return canvas;
  }
  
  /**
   * 将 Canvas 转换为 DataURL
   * @param {HTMLCanvasElement} canvas
   * @param {string} format - 'png' | 'jpeg'
   * @param {number} quality - JPEG 质量 (0-1)
   * @returns {string}
   */
  toDataURL(canvas, format = 'png', quality = 0.9) {
    return canvas.toDataURL(`image/${format}`, quality);
  }
}

// ============================================================
// LPC 球员生成器 - 千人千面核心
// ============================================================

class LPCPlayerGenerator {
  constructor() {
    this.composer = new LPCComposer();
    this.loader = new LPCSpriteLoader();
    this.remapper = new LPCColorRemapper();
  }
  
  /**
   * 生成球员外观配置
   * @param {Object} playerData - 球员数据
   * @param {Object} teamData - 球队数据 (颜色等)
   * @returns {Object} 外观配置
   */
  generateAppearance(playerData, teamData) {
    const seed = this.hashString(playerData.name || String(playerData.id));
    const rng = this.seededRandom(seed);
    
    // 使用足球运动员配置
    const config = LPC.FOOTBALL;
    
    // 体型 (随机选择男性体型)
    const bodyTypes = config.BODY_TYPES;
    const bodyType = playerData.bodyType || bodyTypes[Math.floor(rng() * bodyTypes.length)];
    
    // 头部变体
    const headTypes = config.HEAD_TYPES;
    const headType = playerData.headType || headTypes[Math.floor(rng() * headTypes.length)];
    
    // 肤色 (标准肤色为主)
    const skinTones = ['light', 'amber', 'olive', 'taupe', 'bronze', 'brown', 'black'];
    const skinTone = playerData.skinTone || skinTones[Math.floor(rng() * skinTones.length)];
    
    // 发型 (足球常见)
    const hairstyles = config.HAIR_STYLES;
    const hairstyle = playerData.hairstyle || hairstyles[Math.floor(rng() * hairstyles.length)];
    
    // 发色 (自然色为主)
    const hairColors = ['black', 'dark_brown', 'brown', 'light_brown', 'chestnut', 'blonde', 'sandy', 'red', 'ginger', 'gray', 'white'];
    const hairColor = playerData.hairColor || hairColors[Math.floor(rng() * hairColors.length)];
    
    // 胡须 (25% 概率)
    const hasBeard = playerData.hasBeard !== undefined ? playerData.hasBeard : (rng() < 0.25);
    const beardStyles = config.BEARD_STYLES;
    const beardStyle = hasBeard 
      ? (playerData.beardStyle || beardStyles[Math.floor(rng() * beardStyles.length)])
      : null;
    
    // 小胡子 (额外 15% 概率，独立于胡须)
    const hasMustache = !hasBeard && (playerData.hasMustache !== undefined ? playerData.hasMustache : (rng() < 0.15));
    const mustacheStyles = config.MUSTACHE_STYLES;
    const mustacheStyle = hasMustache 
      ? (playerData.mustacheStyle || mustacheStyles[Math.floor(rng() * mustacheStyles.length)])
      : null;
    
    // 眼睛颜色
    const eyeColors = ['brown', 'blue', 'green', 'gray'];
    const eyeColor = playerData.eyeColor || eyeColors[Math.floor(rng() * eyeColors.length)];
    
    // 球队颜色
    const jerseyColor = teamData.primaryColor || 'red';
    const shortsColor = teamData.secondaryColor || 'white';
    const bootsColor = teamData.bootsColor || 'black';
    
    // 短裤风格
    const shortsStyles = config.SHORTS_STYLES;
    const shortsStyle = playerData.shortsStyle || shortsStyles[Math.floor(rng() * shortsStyles.length)];
    
    // 球鞋风格
    const bootsStyles = config.BOOTS_STYLES;
    const bootsStyle = playerData.bootsStyle || bootsStyles[Math.floor(rng() * bootsStyles.length)];
    
    // 球衣风格 (短袖为主)
    const jerseyStyles = config.JERSEY_STYLES;
    const jerseyStyle = playerData.jerseyStyle || jerseyStyles[Math.floor(rng() * jerseyStyles.length)];
    
    return {
      bodyType,
      headType,
      skinTone,
      hairstyle,
      hairColor,
      beardStyle,
      mustacheStyle,
      eyeColor,
      jerseyColor,
      shortsColor,
      bootsColor,
      shortsStyle,
      bootsStyle,
      jerseyStyle,
      // 球衣号码
      jerseyNumber: playerData.jerseyNumber || Math.floor(rng() * 99) + 1,
      // 守门员
      isGoalkeeper: playerData.position === 'GK',
    };
  }
  
  /**
   * 根据外观配置生成球员精灵 Canvas
   * @param {Object} appearance - 外观配置
   * @param {string} animation - 动画类型 ('idle' | 'walk')
   * @param {number} direction - 方向 (0=下, 1=左, 2=右, 3=上)
   * @returns {Promise<HTMLCanvasElement>}
   */
  async generatePlayerSprite(appearance, animation = 'idle', direction = 0) {
    const layers = [];
    
    // 体型映射（大部分装备只有 male/thin/female 变体，没有 muscular）
    const bodyTypeMap = {
      'male': 'male',
      'muscular': 'male',  // muscular 体型使用 male 装备
      'teen': 'thin',
      'female': 'female',
      'child': 'child',
    };
    const bodySuffix = bodyTypeMap[appearance.bodyType] || 'male';
    
    // 头部映射
    const headTypeMap = {
      'male': 'male',
      'male_elderly': 'male_elderly',
      'male_gaunt': 'male_gaunt',
      'male_plump': 'male_plump',
      'male_small': 'male_small',
    };
    const headSuffix = headTypeMap[appearance.headType] || 'male';
    
    // 1. 身体 (基础肤色)
    layers.push({
      sprite: `body__bodies__${bodySuffix}__${animation}.png`,
      z: LPC.Z_LAYERS.BODY,
      palette: LPC_PALETTES.skin[appearance.skinTone] || LPC_PALETTES.skin.light,
      sourcePalette: LPC_PALETTES.skin.light,
      row: direction,
      frame: 0,
    });
    
    // 2. 头部
    layers.push({
      sprite: `head__heads__human__${headSuffix}__${animation}.png`,
      z: LPC.Z_LAYERS.HEAD,
      palette: LPC_PALETTES.skin[appearance.skinTone] || LPC_PALETTES.skin.light,
      sourcePalette: LPC_PALETTES.skin.light,
      row: direction,
      frame: 0,
    });
    
    // 3. 头发 (需要检查文件是否存在)
    // 某些发型有 bg/fg 两层，需要特殊处理
    const hairBase = `hair__${appearance.hairstyle}__adult`;
    
    // 检查是否有 bg 层
    const hairBgPath = `${hairBase}__bg__${animation}.png`;
    const hairFgPath = `${hairBase}__fg__${animation}.png`;
    const hairSimplePath = `${hairBase}__${animation}.png`;
    
    // 尝试加载简单发型 (先尝试，失败则跳过)
    layers.push({
      sprite: hairSimplePath,
      z: LPC.Z_LAYERS.HAIR_FRONT,
      palette: LPC_PALETTES.hair[appearance.hairColor] || LPC_PALETTES.hair.brown,
      sourcePalette: LPC_PALETTES.hair.blonde,
      row: direction,
      frame: 0,
      optional: true, // 标记为可选
    });
    
    // 4. 胡须
    if (appearance.beardStyle) {
      layers.push({
        sprite: `beards__beard__${appearance.beardStyle}__male__${animation}.png`,
        z: LPC.Z_LAYERS.BEARD,
        palette: LPC_PALETTES.hair[appearance.hairColor] || LPC_PALETTES.hair.brown,
        sourcePalette: LPC_PALETTES.hair.brown,
        row: direction,
        frame: 0,
        optional: true,
      });
    }
    
    // 5. 小胡子
    if (appearance.mustacheStyle) {
      layers.push({
        sprite: `beards__mustache__${appearance.mustacheStyle}__${animation}.png`,
        z: LPC.Z_LAYERS.BEARD,
        palette: LPC_PALETTES.hair[appearance.hairColor] || LPC_PALETTES.hair.brown,
        sourcePalette: LPC_PALETTES.hair.brown,
        row: direction,
        frame: 0,
        optional: true,
      });
    }
    
    // 6. 短裤 (球队颜色)
    layers.push({
      sprite: `legs__shorts__${appearance.shortsStyle}__${bodySuffix}__${animation}.png`,
      z: LPC.Z_LAYERS.LEGS,
      palette: LPC_PALETTES.cloth[appearance.shortsColor] || LPC_PALETTES.cloth.white,
      sourcePalette: LPC_PALETTES.cloth.white,
      row: direction,
      frame: 0,
    });
    
    // 7. 球鞋
    layers.push({
      sprite: `feet__boots__${appearance.bootsStyle}__${bodySuffix}__${animation}.png`,
      z: LPC.Z_LAYERS.FEET,
      palette: LPC_PALETTES.cloth[appearance.bootsColor] || LPC_PALETTES.cloth.black,
      sourcePalette: LPC_PALETTES.cloth.black,
      row: direction,
      frame: 0,
    });
    
    // 8. 球衣 (球队颜色) - 使用短袖
    layers.push({
      sprite: `torso__clothes__${appearance.jerseyStyle}__${appearance.jerseyStyle}__${bodySuffix === 'thin' ? 'teen' : bodySuffix}__${animation}.png`,
      z: LPC.Z_LAYERS.TORSO,
      palette: LPC_PALETTES.cloth[appearance.jerseyColor] || LPC_PALETTES.cloth.red,
      sourcePalette: LPC_PALETTES.cloth.white,
      row: direction,
      frame: 0,
    });
    
    // 9. 守门员手套
    if (appearance.isGoalkeeper) {
      layers.push({
        sprite: `arms__hands__gloves__${bodySuffix}__${animation}.png`,
        z: LPC.Z_LAYERS.ARMS,
        row: direction,
        frame: 0,
        optional: true,
      });
    }
    
    // 合成
    return this.composer.compose(layers);
  }
  
  /**
   * 生成球员卡片 (用于显示)
   * @param {Object} playerData - 球员数据
   * @param {Object} teamData - 球队数据
   * @param {number} width - 卡片宽度
   * @param {number} height - 卡片高度
   * @returns {Promise<HTMLCanvasElement>}
   */
  async generatePlayerCard(playerData, teamData, width = 200, height = 300) {
    const appearance = this.generateAppearance(playerData, teamData);
    const sprite = await this.generatePlayerSprite(appearance, 'idle', 0);
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // 球队颜色边框
    const teamColor = this.hexToTeamColor(teamData.primaryColor);
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    
    // 绘制球员精灵 (放大)
    const scale = Math.min(width * 0.8 / LPC.FRAME_WIDTH, height * 0.7 / LPC.FRAME_HEIGHT);
    const spriteWidth = LPC.FRAME_WIDTH * scale;
    const spriteHeight = LPC.FRAME_HEIGHT * scale;
    const spriteX = (width - spriteWidth) / 2;
    const spriteY = (height - spriteHeight) / 2 - 20;
    
    ctx.imageSmoothingEnabled = false; // 像素风格
    ctx.drawImage(sprite, spriteX, spriteY, spriteWidth, spriteHeight);
    
    // 球员名字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(playerData.name || 'Player', width / 2, height - 40);
    
    // 位置/评分
    ctx.font = '12px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`${playerData.position || 'MID'} • ${playerData.rating || 75}`, width / 2, height - 20);
    
    // 球衣号码
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = teamColor;
    ctx.fillText(`#${appearance.jerseyNumber}`, width - 30, 30);
    
    return canvas;
  }
  
  /**
   * 字符串哈希
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  /**
   * 带种子的随机数生成器
   */
  seededRandom(seed) {
    let s = seed;
    return function() {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }
  
  /**
   * 球队颜色名称转 HEX
   */
  hexToTeamColor(colorName) {
    const colors = {
      red: '#dc143c',
      blue: '#4169e1',
      green: '#228b22',
      yellow: '#ffd700',
      orange: '#ff8c00',
      purple: '#9370db',
      white: '#ffffff',
      black: '#1a1a1a',
      pink: '#ff69b4',
      navy: '#000080',
      maroon: '#800000',
      teal: '#008080',
    };
    return colors[colorName] || '#888888';
  }
}

// ============================================================
// 导出
// ============================================================

// 全局实例
window.LPC = LPC;
window.LPC_PALETTES = LPC_PALETTES;
window.LPCSpriteLoader = LPCSpriteLoader;
window.LPCColorRemapper = LPCColorRemapper;
window.LPCComposer = LPCComposer;
window.LPCPlayerGenerator = LPCPlayerGenerator;

// 便捷函数
window.generatePlayer = async function(playerData, teamData) {
  const generator = new LPCPlayerGenerator();
  return generator.generatePlayerCard(playerData, teamData);
};

console.log('LPC Spritesheet Character Generator 已加载');
console.log('使用方法: generatePlayer({name: "Messi", id: 1}, {primaryColor: "blue"})');
