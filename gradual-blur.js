class GradualBlur {
  static DEFAULT_CONFIG = {
    position: 'bottom',
    strength: 2,
    height: '6rem',
    divCount: 5,
    exponential: false,
    zIndex: 1000,
    animated: false,
    duration: '0.3s',
    easing: 'ease-out',
    opacity: 1,
    curve: 'linear',
    responsive: false,
    target: 'parent',
    className: '',
    style: {}
  };

  static PRESETS = {
    top: { position: 'top', height: '6rem' },
    bottom: { position: 'bottom', height: '6rem' },
    left: { position: 'left', height: '6rem' },
    right: { position: 'right', height: '6rem' },
    subtle: { height: '4rem', strength: 1, opacity: 0.8, divCount: 3 },
    intense: { height: '10rem', strength: 4, divCount: 8, exponential: true },
    smooth: { height: '8rem', curve: 'bezier', divCount: 10 },
    sharp: { height: '5rem', curve: 'linear', divCount: 4 },
    header: { position: 'top', height: '8rem', curve: 'ease-out' },
    footer: { position: 'bottom', height: '8rem', curve: 'ease-out' },
    sidebar: { position: 'left', height: '6rem', strength: 2.5 },
    'page-header': { position: 'top', height: '10rem', target: 'page', strength: 3 },
    'page-footer': { position: 'bottom', height: '10rem', target: 'page', strength: 3 }
  };

  static CURVE_FUNCTIONS = {
    linear: (p) => p,
    bezier: (p) => p * p * (3 - 2 * p),
    'ease-in': (p) => p * p,
    'ease-out': (p) => 1 - Math.pow(1 - p, 2),
    'ease-in-out': (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
  };

  constructor(selector, options = {}) {
    this.container = typeof selector === 'string' ? document.querySelector(selector) : selector;
    
    if (!this.container) {
      console.error('GradualBlur: Container not found');
      return;
    }

    this.config = this.mergeConfigs(
      GradualBlur.DEFAULT_CONFIG,
      options.preset && GradualBlur.PRESETS[options.preset] ? GradualBlur.PRESETS[options.preset] : {},
      options
    );

    this.isHovered = false;
    this.isVisible = this.config.animated !== 'scroll';
    this.resizeTimeout = null;

    this.init();
  }

  mergeConfigs(...configs) {
    return configs.reduce((acc, c) => ({ ...acc, ...c }), {});
  }

  getGradientDirection(position) {
    const directions = {
      top: 'to top',
      bottom: 'to bottom',
      left: 'to left',
      right: 'to right'
    };
    return directions[position] || 'to bottom';
  }

  debounce(fn, wait) {
    return (...args) => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => fn(...args), wait);
    };
  }

  getResponsiveDimension(key) {
    if (!this.config.responsive) return this.config[key];

    const w = window.innerWidth;
    const capitalizedKey = key[0].toUpperCase() + key.slice(1);
    
    if (w <= 480 && this.config[`mobile${capitalizedKey}`])
      return this.config[`mobile${capitalizedKey}`];
    else if (w <= 768 && this.config[`tablet${capitalizedKey}`])
      return this.config[`tablet${capitalizedKey}`];
    else if (w <= 1024 && this.config[`desktop${capitalizedKey}`])
      return this.config[`desktop${capitalizedKey}`];
    
    return this.config[key];
  }

  setupIntersectionObserver() {
    if (this.config.animated !== 'scroll') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        this.updateContainerStyle();

        if (this.isVisible && this.config.onAnimationComplete) {
          const ms = parseFloat(this.config.duration) * 1000;
          setTimeout(() => this.config.onAnimationComplete(), ms);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(this.container);
    this.observer = observer;
  }

  createBlurDivs() {
    const divs = [];
    const increment = 100 / this.config.divCount;
    const currentStrength = this.isHovered && this.config.hoverIntensity 
      ? this.config.strength * this.config.hoverIntensity 
      : this.config.strength;

    const curveFunc = GradualBlur.CURVE_FUNCTIONS[this.config.curve] || GradualBlur.CURVE_FUNCTIONS.linear;

    for (let i = 1; i <= this.config.divCount; i++) {
      let progress = i / this.config.divCount;
      progress = curveFunc(progress);

      let blurValue;
      if (this.config.exponential) {
        blurValue = Math.pow(2, progress * 4) * 0.0625 * currentStrength;
      } else {
        blurValue = 0.0625 * (progress * this.config.divCount + 1) * currentStrength;
      }

      const p1 = Math.round((increment * i - increment) * 10) / 10;
      const p2 = Math.round(increment * i * 10) / 10;
      const p3 = Math.round((increment * i + increment) * 10) / 10;
      const p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      let gradient = `transparent ${p1}%, black ${p2}%`;
      if (p3 <= 100) gradient += `, black ${p3}%`;
      if (p4 <= 100) gradient += `, transparent ${p4}%`;

      const direction = this.getGradientDirection(this.config.position);

      const div = document.createElement('div');
      div.style.cssText = `
        position: absolute;
        inset: 0;
        mask-image: linear-gradient(${direction}, ${gradient});
        -webkit-mask-image: linear-gradient(${direction}, ${gradient});
        backdrop-filter: blur(${blurValue.toFixed(3)}rem);
        -webkit-backdrop-filter: blur(${blurValue.toFixed(3)}rem);
        opacity: ${this.config.opacity};
        ${this.config.animated && this.config.animated !== 'scroll' 
          ? `transition: backdrop-filter ${this.config.duration} ${this.config.easing};` 
          : ''}
      `;

      divs.push(div);
    }

    return divs;
  }

  updateContainerStyle() {
    const isVertical = ['top', 'bottom'].includes(this.config.position);
    const isHorizontal = ['left', 'right'].includes(this.config.position);
    const isPageTarget = this.config.target === 'page';

    const responsiveHeight = this.getResponsiveDimension('height');
    const responsiveWidth = this.getResponsiveDimension('width');

    let styles = {
      position: isPageTarget ? 'fixed' : 'absolute',
      pointerEvents: this.config.hoverIntensity ? 'auto' : 'none',
      opacity: this.isVisible ? '1' : '0',
      transition: this.config.animated ? `opacity ${this.config.duration} ${this.config.easing}` : '',
      zIndex: isPageTarget ? this.config.zIndex + 100 : this.config.zIndex,
      ...this.config.style
    };

    if (isVertical) {
      styles.height = responsiveHeight;
      styles.width = responsiveWidth || '100%';
      styles[this.config.position] = '0';
      styles.left = '0';
      styles.right = '0';
    } else if (isHorizontal) {
      styles.width = responsiveWidth || responsiveHeight;
      styles.height = '100%';
      styles[this.config.position] = '0';
      styles.top = '0';
      styles.bottom = '0';
    }

    Object.assign(this.container.style, styles);
  }

  render() {
    // Clear container
    this.container.innerHTML = '';

    // Add classes
    this.container.className = `gradual-blur ${
      this.config.target === 'page' ? 'gradual-blur-page' : 'gradual-blur-parent'
    } ${this.config.className}`;

    // Update container styles
    this.updateContainerStyle();

    // Create inner wrapper
    const inner = document.createElement('div');
    inner.className = 'gradual-blur-inner';
    inner.style.cssText = 'position: relative; width: 100%; height: 100%;';

    // Add blur divs
    const blurDivs = this.createBlurDivs();
    blurDivs.forEach(div => inner.appendChild(div));

    this.container.appendChild(inner);
    this.innerElement = inner;
  }

  setupEventListeners() {
    if (this.config.hoverIntensity) {
      this.container.addEventListener('mouseenter', () => {
        this.isHovered = true;
        this.render();
      });

      this.container.addEventListener('mouseleave', () => {
        this.isHovered = false;
        this.render();
      });
    }

    if (this.config.responsive) {
      const handleResize = this.debounce(() => this.render(), 100);
      window.addEventListener('resize', handleResize);
      this.resizeHandler = handleResize;
    }
  }

  init() {
    this.render();
    this.setupEventListeners();
    this.setupIntersectionObserver();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.container.innerHTML = '';
  }

  update(newOptions) {
    this.config = this.mergeConfigs(this.config, newOptions);
    this.render();
  }
}

// Auto-inject base styles
(function injectStyles() {
  const styleId = 'gradual-blur-styles';
  if (document.getElementById(styleId)) return;

  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = `
    .gradual-blur { pointer-events: none; transition: opacity 0.3s ease-out; }
    .gradual-blur-parent { overflow: hidden; }
    .gradual-blur-inner { pointer-events: none; }
  `;

  document.head.appendChild(styleElement);
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GradualBlur;
  }
