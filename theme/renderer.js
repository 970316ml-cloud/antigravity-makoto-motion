(() => {
  'use strict';
  if ((typeof isRemoteWindow !== 'undefined' && isRemoteWindow) || window.top !== window || location.protocol !== 'https:' ||
      location.hostname !== '127.0.0.1') return;
  const { webFrame } = require('electron');
  const paragraph = '[data-testid="agent-response"] [data-markdown-root] > p';
  const bubbleSelector = '[data-testid="user-message-bubble"], [data-testid="planner-response-text"], [data-testid="agent-response"] [data-step-list] > div';

  function butterfly() {
    const body = document.createElement('span');
    body.setAttribute('data-makoto-butterfly', '');
    body.setAttribute('aria-hidden', 'true');
    return body;
  }
  function mark(p) {
    p.toggleAttribute('data-makoto-long-prose', p.textContent.trim().length >= 320);
  }
  function drawP3Splash(ctx, w, h, t, cfg) {
    const ox = cfg.ox, oy = cfg.oy, baseR = cfg.baseR;
    const seed = cfg.seed || 0;
    const dark = cfg.dark;
    const isSettings = cfg.mode === 'settings';
    const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
    const smooth = (a, b, x) => {
      const k = clamp01((x - a) / (b - a));
      return k * k * (3 - 2 * k);
    };
    const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
    const wob = (a, s) =>
      1 + 0.085 * Math.sin(a * 3 + s + t * 4.5) +
      0.045 * Math.sin(a * 5 - s * 1.7 - t * 3.2) +
      0.03 * Math.sin(a * 9 + s * 3.1);

    const pal = dark
      ? { deep: '#1a6fff', mid: '#3eb8ff', cyan: '#62dcff', foam: '#f4fdff', alpha: 0.86 }
      : { deep: '#175fe0', mid: '#38a6ff', cyan: '#5cc8ff', foam: '#eafaff', alpha: 0.72 };

    const fade = smooth(0, 0.10, t) * (1 - smooth(0.68, 1.0, t));
    if (fade <= 0.002) return;
    const baseAlpha = fade * pal.alpha;

    // 1. Two staggered organic wobbly liquid water rings (40 steps, zero ctx.save/restore)
    const rings = [
      { delay: 0, span: 0.78, s: seed, maxOut: baseR * 0.96, col: pal.deep, rim: 0.85 },
      { delay: 0.08, span: 0.86, s: seed + 2.3, maxOut: baseR * 1.18, col: pal.cyan, rim: 0.7 }
    ];
    const steps = 40;
    const stepRad = (Math.PI * 2) / steps;
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const rg = rings[rIdx];
      const rt = clamp01((t - rg.delay) / rg.span);
      if (rt <= 0 || rt >= 1) continue;
      const re = easeOut(rt);
      const rOut = baseR * 0.18 + (rg.maxOut - baseR * 0.18) * re;
      const holeK = smooth(0.08, 0.75, rt);
      const rIn = rOut * (0.28 + 0.68 * holeK);
      const rf = (1 - smooth(0.55, 1.0, rt)) * (rIdx === 0 ? 0.56 : 0.40);
      if (rf <= 0.01) continue;

      ctx.globalAlpha = baseAlpha * rf;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = i * stepRad;
        const rad = rOut * wob(a, rg.s);
        const px = ox + Math.cos(a) * rad;
        const py = oy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (rIn > 2) {
        for (let i = 0; i <= steps; i++) {
          const a = i * stepRad;
          const rad = rIn * wob(a + 1.3, rg.s + 4.0);
          const px = ox + Math.cos(a) * rad;
          const py = oy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.fillStyle = rg.col;
      ctx.fill('evenodd');

      if (rIn > 4) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const a = i * stepRad;
          const rad = rIn * wob(a + 1.3, rg.s + 4.0);
          const px = ox + Math.cos(a) * rad;
          const py = oy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = pal.foam;
        ctx.lineWidth = Math.max(1.4, baseR * 0.014 * (1 - rt * 0.6));
        ctx.globalAlpha = baseAlpha * rg.rim * (1 - smooth(0.58, 1.0, rt));
        ctx.stroke();
      }
    }

    // 2. 6 cel-shaded tapered liquid plumes curving along motion direction
    const plumeAngles = isSettings
      ? [2.15, 2.42, 2.70, 2.96, 1.88, 3.22]
      : [-2.18, -2.52, -1.85, -2.86, 2.82, -1.48];
    const plumeCurve = isSettings ? 0.36 : -0.32;
    const N = 12;
    const leftX = new Float32Array(N), leftY = new Float32Array(N);
    const rightX = new Float32Array(N), rightY = new Float32Array(N);
    const foamX = new Float32Array(N), foamY = new Float32Array(N);
    for (let pIdx = 0; pIdx < 6; pIdx++) {
      const ang = plumeAngles[pIdx] + Math.sin(seed * 1.9 + pIdx * 2.1) * 0.08;
      const delay = pIdx * 0.035;
      const pt = clamp01((t - delay) / (0.86 - delay));
      if (pt <= 0.01 || pt >= 0.99) continue;
      const head = Math.min(1, easeOut(pt) * 1.04);
      const tail = clamp01((pt - 0.16) / 0.80);
      if (head - tail <= 0.03) continue;

      const reach = baseR * (0.92 + (pIdx % 3) * 0.18);
      const p0x = ox + Math.cos(ang) * baseR * 0.08;
      const p0y = oy + Math.sin(ang) * baseR * 0.08;
      const bend = ang + plumeCurve * (pIdx % 2 === 0 ? 1 : 0.72);
      const p1x = ox + Math.cos(bend) * reach * 0.56;
      const p1y = oy + Math.sin(bend) * reach * 0.56;
      const p2x = ox + Math.cos(ang + plumeCurve * 0.45) * reach;
      const p2y = oy + Math.sin(ang + plumeCurve * 0.45) * reach;

      const maxW = baseR * (0.085 + (pIdx % 2) * 0.025) * (1 - pt * 0.45);
      for (let i = 0; i < N; i++) {
        const k = i / (N - 1);
        const s = tail + (head - tail) * k;
        const u = 1 - s;
        const px = u * u * p0x + 2 * u * s * p1x + s * s * p2x;
        const py = u * u * p0y + 2 * u * s * p1y + s * s * p2y;
        const tx = 2 * u * (p1x - p0x) + 2 * s * (p2x - p1x);
        const ty = 2 * u * (p1y - p0y) + 2 * s * (p2y - p1y);
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;
        const env = Math.sin(Math.PI * Math.pow(k, 0.72)) * (1 - 0.15 * k);
        const hw = maxW * env;
        leftX[i] = px + nx * hw; leftY[i] = py + ny * hw;
        rightX[i] = px - nx * hw; rightY[i] = py - ny * hw;
        foamX[i] = px + nx * hw * 0.42; foamY[i] = py + ny * hw * 0.42;
      }

      const pFade = baseAlpha * (1 - smooth(0.66, 1.0, pt));
      ctx.globalAlpha = pFade * 0.78;
      ctx.beginPath();
      ctx.moveTo(leftX[0], leftY[0]);
      for (let i = 1; i < N; i++) ctx.lineTo(leftX[i], leftY[i]);
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(rightX[i], rightY[i]);
      ctx.closePath();
      ctx.fillStyle = pIdx % 2 === 0 ? pal.deep : pal.mid;
      ctx.fill();

      ctx.globalAlpha = pFade * 0.92;
      ctx.beginPath();
      ctx.moveTo(leftX[0], leftY[0]);
      for (let i = 1; i < N; i++) ctx.lineTo(leftX[i], leftY[i]);
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(foamX[i], foamY[i]);
      ctx.closePath();
      ctx.fillStyle = pal.foam;
      ctx.fill();
    }

    // 3. 28 velocity-aligned cel-shaded droplets via direct vertex rotation
    for (let dIdx = 0; dIdx < 28; dIdx++) {
      const h1 = Math.sin((dIdx + 1) * 12.9898 + seed * 7.13) * 43758.5453;
      const r1 = h1 - Math.floor(h1);
      const h2 = Math.sin((dIdx + 1) * 78.233 + seed * 3.71) * 24634.6345;
      const r2 = h2 - Math.floor(h2);
      const delay = r1 * 0.14;
      const dt = clamp01((t - delay) / (0.86 - delay));
      if (dt <= 0.01 || dt >= 0.99) continue;

      const spread = isSettings
        ? 1.55 + r2 * 1.95
        : -2.95 + r2 * 2.35;
      const cs = Math.cos(spread), sn = Math.sin(spread);
      const speed = baseR * (0.55 + r1 * 0.85);
      const drag = 1 - Math.pow(1 - dt, 2.4);
      const liftY = isSettings ? dt * dt * baseR * 0.14 : -dt * dt * baseR * 0.16;
      const px = ox + cs * speed * drag;
      const py = oy + sn * speed * drag + liftY;

      const vMag = speed * 2.4 * Math.pow(1 - dt, 1.4);
      const vx = cs * vMag;
      const vy = sn * vMag + (isSettings ? 2 : -2) * dt * baseR * 0.15;
      const vLen = Math.hypot(vx, vy) || 1;
      const cd = vx / vLen, sd = vy / vLen;
      const scale = smooth(0, 0.12, dt) * (1 - smooth(0.55, 1.0, dt));
      const rad = Math.max(1.5, baseR * (0.014 + r2 * 0.022) * scale);
      if (rad < 0.6) continue;

      ctx.globalAlpha = baseAlpha * (dIdx % 3 === 0 ? 0.94 : 0.78);
      const tipX = px + cd * rad * 1.4, tipY = py + sd * rad * 1.4;
      const tailX = px - cd * rad * 2.4, tailY = py - sd * rad * 2.4;
      const sideX = -sd * rad * 0.9, sideY = cd * rad * 0.9;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo(px + sideX, py + sideY, tailX, tailY);
      ctx.quadraticCurveTo(px - sideX, py - sideY, tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = dIdx % 3 === 0 ? pal.foam : (dIdx % 2 === 0 ? pal.cyan : pal.mid);
      ctx.fill();
    }

    // 4. 14 hollow rising micro-bubbles bridging into ambient water layer
    if (t > 0.16) {
      const bt = clamp01((t - 0.16) / 0.84);
      const bFade = smooth(0, 0.22, bt) * (1 - smooth(0.55, 1.0, bt));
      if (bFade > 0.01) {
        ctx.globalAlpha = baseAlpha * bFade * 0.76;
        ctx.strokeStyle = pal.foam;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let bIdx = 0; bIdx < 14; bIdx++) {
          const hb = Math.sin((bIdx + 3) * 41.123 + seed * 5.3) * 19283.41;
          const rb = hb - Math.floor(hb);
          const angle = (isSettings ? 1.8 : -2.6) + (rb - 0.5) * 1.8;
          const dist = baseR * (0.28 + rb * 0.72);
          const bx = ox + Math.cos(angle) * dist + Math.sin(bt * 6 + bIdx) * 4;
          const by = oy + Math.sin(angle) * dist - bt * baseR * (isSettings ? 0.16 : 0.28);
          const br = Math.max(1.5, baseR * (0.01 + (bIdx % 4) * 0.006));
          ctx.moveTo(bx + br, by);
          ctx.arc(bx, by, br, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }
  function createP3Splash(canvas, opts) {
    let raf = 0, elapsed = 0, lastNow = 0, active = false, cfg = null;
    let boxW = opts.fallbackW, boxH = opts.fallbackH, dpr = 1;
    function stop() {
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function tick(now) {
      if (!active || !canvas.isConnected) {
        stop();
        return;
      }
      if (!lastNow) {
        lastNow = now;
      } else {
        const dt = Math.min(Math.max(0, now - lastNow), 28);
        lastNow = now;
        elapsed += dt;
      }
      const t = elapsed / opts.duration;
      if (t >= 1) {
        stop();
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        stop();
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, boxW, boxH);
      drawP3Splash(ctx, boxW, boxH, Math.max(0, t), cfg);
      raf = requestAnimationFrame(tick);
    }
    return {
      trigger(nextCfg) {
        cancelAnimationFrame(raf);
        const cw = Math.max(2, nextCfg.cw || canvas.parentElement?.clientWidth || opts.fallbackW);
        const ch = Math.max(2, nextCfg.ch || canvas.parentElement?.clientHeight || opts.fallbackH);
        const reach = Math.ceil((nextCfg.baseR || 120) * 1.48);
        const x0 = Math.max(0, Math.floor(nextCfg.ox - reach));
        const y0 = Math.max(0, Math.floor(nextCfg.oy - reach));
        const x1 = Math.min(cw, Math.ceil(nextCfg.ox + reach));
        const y1 = Math.min(ch, Math.ceil(nextCfg.oy + reach));
        boxW = Math.max(2, x1 - x0);
        boxH = Math.max(2, y1 - y0);
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.style.left = x0 + 'px';
        canvas.style.top = y0 + 'px';
        canvas.style.width = boxW + 'px';
        canvas.style.height = boxH + 'px';
        const pw = Math.max(1, Math.round(boxW * dpr));
        const ph = Math.max(1, Math.round(boxH * dpr));
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        cfg = {
          ox: nextCfg.ox - x0,
          oy: nextCfg.oy - y0,
          baseR: nextCfg.baseR,
          seed: nextCfg.seed,
          dark: nextCfg.dark,
          mode: nextCfg.mode
        };
        elapsed = 0;
        lastNow = 0;
        active = true;
        raf = requestAnimationFrame(tick);
      },
      cancel: stop
    };
  }
  function mount() {
    webFrame.insertCSS(/* MAKOTO_CSS */);
    document.documentElement.setAttribute('data-makoto-ui', '');
    let resumeFrame = 0;
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const portraitUrl = /* MAKOTO_PORTRAIT */;
    let portrait, cachedPortrait = null, dive, sweep, conversation, entrance, pendingEntrance = false, transitionRaf = 0;
    let pendingFrom = null, hydrationLockUntil = 0, needsContentReveal = false, expectedCascadeId = null;
    let splashSeed = 1, chatSplash = null, settingsSplash = null;
    const chatAnims = [];
    let settingsModal = null, settingsHeader = null, settingsWater = null, settingsCanvas = null, settingsTab = null, settingsClock = 0;
    const settingsAnims = [];
    let pageRoot = null, pageStage = null, pageFx = null, pageAura = null, pageSweep = null;
    let pageCanvas = null, pageSplash = null, pageButterfly = null;
    let pageKey = null, pageSubTab = null, sidecarMode = null, pageClock = performance.now();
    let pageNeedsCards = false, pageCardsUntil = 0, lastMainView = null, viewInitialized = false;
    const pageAnims = [];
    function canMotion() {
      return !document.hidden && !reduced.matches && !root.hasAttribute('data-makoto-paused');
    }
    function isDarkUi(el) {
      return Boolean((el || root).closest('.dark, .theme-dark, [data-theme="dark"]') ||
        root.matches('.dark, .theme-dark, [data-theme="dark"]') ||
        document.body?.matches('.dark, .theme-dark, [data-theme="dark"]'));
    }
    function triggerSweep(el, list) {
      if (!el?.isConnected) return;
      try {
        list.push(el.animate([
          { opacity: 0, transform: 'translate3d(42%, 0, 0)' },
          { opacity: 1, offset: 0.24 },
          { opacity: 0, transform: 'translate3d(-46%, 0, 0)' }
        ], { duration: 420, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
      } catch {}
    }
    function cancelChatAnims() {
      cancelAnimationFrame(transitionRaf);
      transitionRaf = 0;
      entrance?.cancel();
      entrance = null;
      chatSplash?.cancel();
      while (chatAnims.length) {
        try { chatAnims.pop().cancel(); } catch {}
      }
    }
    function cancelSettingsAnims() {
      settingsSplash?.cancel();
      while (settingsAnims.length) {
        try { settingsAnims.pop().cancel(); } catch {}
      }
    }
    function cancelPageAnims() {
      pageSplash?.cancel();
      while (pageAnims.length) {
        try { pageAnims.pop().cancel(); } catch {}
      }
    }
    function playPortrait() {
      if (!canMotion()) {
        cancelChatAnims();
        cancelSettingsAnims();
        cancelPageAnims();
        pendingEntrance = false;
        pendingFrom = null;
        needsContentReveal = false;
        expectedCascadeId = null;
        pageNeedsCards = false;
        portrait?.pause();
        return;
      }
      if (portrait?.paused) {
        portrait.play().catch(() => {});
      }
    }
    function animateConversationViewport() {
      if (!canMotion() || !area) return false;
      if (conversation === 'home') {
        const greeting = area.querySelector('[data-testid="home-greeting"]');
        if (!greeting) return false;
        try {
          chatAnims.push(greeting.animate([
            { opacity: 0.15, transform: 'translate3d(-12px, 0, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ], { duration: 240, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
        } catch {}
        return true;
      }
      if (typeof conversation === 'string' && conversation.startsWith('/c/')) {
        const convView = area.querySelector('[data-testid="conversation-view"]');
        const actualId = convView?.getAttribute('data-cascade-id');
        if (expectedCascadeId && actualId && actualId !== expectedCascadeId) {
          return false;
        }
        const viewport = area.querySelector('[data-testid="autoscroll-viewport"]');
        if (!viewport || !viewport.querySelector('[data-testid="user-message-bubble"], [data-testid="agent-response"]')) {
          return false;
        }
        try {
          chatAnims.push(viewport.animate([
            { opacity: 0.45, transform: 'translate3d(0, 6px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ], { duration: 190, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
        } catch {}
        return true;
      }
      return false;
    }
    function runChatTransition(fromView, toView) {
      if (!canMotion() || !portrait?.isConnected || !area?.isConnected) return;
      const isHome = toView === 'home';
      const targetOpacity = isHome ? 1 : (parseFloat(getComputedStyle(portrait).opacity) || (isDarkUi(area) ? 0.32 : 0.22));
      let keyframes, duration = 380;
      if (fromView?.startsWith('/c/') && toView?.startsWith('/c/')) {
        duration = 360;
        keyframes = [
          {
            opacity: +(targetOpacity * 0.56).toFixed(3),
            transform: 'translate3d(16px, 0, 0) scale(1.012)'
          },
          {
            opacity: +Math.min(1, targetOpacity * 1.18).toFixed(3),
            transform: 'translate3d(-2px, 0, 0) scale(1.002)',
            offset: 0.56
          },
          {
            opacity: targetOpacity,
            transform: 'translate3d(0, 0, 0) scale(1)'
          }
        ];
      } else if (fromView === 'home' && toView?.startsWith('/c/')) {
        duration = 400;
        keyframes = [
          {
            opacity: +Math.min(0.72, targetOpacity * 2.4).toFixed(3),
            transform: 'translate3d(-8px, 4px, 0) scale(1.12)'
          },
          {
            opacity: targetOpacity,
            transform: 'translate3d(0, 0, 0) scale(1)'
          }
        ];
      } else if (isHome) {
        duration = 400;
        keyframes = [
          {
            opacity: fromView?.startsWith('/c/') ? 0.34 : 0.14,
            transform: 'translate3d(18px, 6px, 0) scale(0.90)'
          },
          {
            opacity: 1,
            transform: 'translate3d(0, 0, 0) scale(1)'
          }
        ];
      } else {
        keyframes = [
          {
            opacity: 0.08,
            transform: 'translate3d(20px, 4px, 0) scale(1.015)'
          },
          {
            opacity: targetOpacity,
            transform: 'translate3d(0, 0, 0) scale(1)'
          }
        ];
      }
      entrance = portrait.animate(keyframes, { duration, easing: 'cubic-bezier(.16, .84, .24, 1)' });
      triggerSweep(sweep, chatAnims);
      if (dive?.isConnected && layer?.isConnected) {
        if (!chatSplash) chatSplash = createP3Splash(dive, { duration: 580, fallbackW: 900, fallbackH: 700 });
        const lRect = layer.getBoundingClientRect();
        const pRect = portrait.getBoundingClientRect();
        const hasBox = lRect.width > 10 && pRect.width > 10 && pRect.height > 10;
        const cw = lRect.width || 900, ch = lRect.height || 700;
        const ox = hasBox ? (pRect.left - lRect.left + pRect.width * 0.56) : cw * 0.84;
        const oy = hasBox ? (pRect.top - lRect.top + pRect.height * 0.44) : ch * 0.58;
        const baseR = hasBox ? Math.min(pRect.width, pRect.height) * 0.62 : Math.min(cw, ch) * 0.38;
        chatSplash.trigger({
          ox,
          oy,
          baseR,
          cw,
          ch,
          seed: splashSeed++,
          dark: isHome || isDarkUi(area),
          mode: 'chat'
        });
      }
      const titleSlot = area?.previousElementSibling?.querySelector('div:has(> [data-testid="pane-titlebar-toolbar"]) > :first-child') ||
                        document.querySelector('div:has(> [data-testid="pane-titlebar-toolbar"]) > :first-child');
      if (titleSlot && titleSlot.getAttribute('data-testid') !== 'pane-titlebar-toolbar') {
        try {
          chatAnims.push(titleSlot.animate([
            { opacity: 0.22, transform: 'translate3d(10px, 0, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ], { duration: 200, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
        } catch {}
      }
      if (animateConversationViewport()) {
        needsContentReveal = false;
        expectedCascadeId = null;
      }
    }
    function enterConversation() {
      if (!pendingEntrance || !portrait?.hasAttribute('data-ready')) return;
      const fromView = pendingFrom;
      const toView = conversation;
      pendingEntrance = false;
      pendingFrom = null;
      cancelChatAnims();
      if (!canMotion()) return;
      transitionRaf = requestAnimationFrame(() => {
        transitionRaf = 0;
        runChatTransition(fromView, toView);
      });
    }
    reduced.addEventListener('change', playPortrait);
    function syncVisibility() {
      cancelAnimationFrame(resumeFrame);
      root.setAttribute('data-makoto-paused', '');
      playPortrait();
      if (!document.hidden) {
        resumeFrame = requestAnimationFrame(() => {
          resumeFrame = requestAnimationFrame(() => {
            if (!document.hidden) {
              root.removeAttribute('data-makoto-paused');
              playPortrait();
            }
          });
        });
      }
    }
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    let area, layer, rail, insect, latest, queued = false;
    function detectFeaturePage() {
      const sidecars = document.querySelector('.agy-shell [data-testid="sidecars-view"]');
      if (sidecars) return sidecars;
      const tabs = document.querySelector('.agy-shell [data-testid="plugins-tabs"]');
      return tabs?.closest('.bg-background.h-full') || null;
    }
    function getMainViewKey() {
      if (document.querySelector('.agy-shell .agy-home')) return 'home';
      const feat = detectFeaturePage();
      if (feat) return feat.matches('[data-testid="sidecars-view"]') ? 'automations' : 'customizations';
      return location.pathname;
    }
    function ensurePortraitVideo() {
      if (cachedPortrait) return cachedPortrait;
      const video = document.createElement('video');
      video.setAttribute('data-makoto-portrait', '');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.disablePictureInPicture = true;
      video.addEventListener('playing', () => {
        if (video !== portrait) return;
        video.setAttribute('data-ready', '');
        enterConversation();
      });
      video.addEventListener('loadeddata', () => {
        if (video !== portrait) return;
        video.setAttribute('data-ready', '');
      });
      video.src = portraitUrl;
      cachedPortrait = video;
      return video;
    }
    function syncPortrait() {
      const feat = detectFeaturePage();
      const isHome = Boolean(area?.querySelector('.agy-home'));
      const route = !feat && (isHome ? 'home' : (location.pathname.startsWith('/c/') ? location.pathname : null));
      const viewKey = getMainViewKey();
      if (viewKey !== conversation) {
        if (conversation !== undefined) {
          pendingFrom = conversation;
          hydrationLockUntil = performance.now() + 480;
          needsContentReveal = Boolean(route && route.startsWith('/c/'));
          expectedCascadeId = route && route.startsWith('/c/') ? route.slice(3).replace(/\/+$/, '') : null;
        }
        pendingEntrance = Boolean(route && conversation !== undefined && canMotion());
        conversation = viewKey;
      }
      if (!route || !area || !layer?.isConnected) {
        cancelChatAnims();
        portrait?.pause();
        portrait?.remove();
        portrait = null;
        return;
      }
      if (portrait?.parentNode !== layer) {
        portrait?.pause();
        const video = ensurePortraitVideo();
        portrait = video;
        if (video.readyState >= 2) video.setAttribute('data-ready', '');
        layer.prepend(video);
        playPortrait();
      }
      enterConversation();
    }
    function animateSettingsCards(modal, baseDelay) {
      let targets = [...modal.querySelectorAll('.max-w-2xl > :not(:first-child) .space-y-2')];
      if (!targets.length) targets = [...modal.querySelectorAll('.max-w-2xl > :not(:first-child)')];
      const visible = targets.filter(el => el.offsetHeight > 0).slice(0, 6);
      visible.forEach((el, i) => {
        try {
          settingsAnims.push(el.animate([
            { opacity: 0, transform: 'translate3d(10px, 4px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ], {
            duration: 240,
            delay: baseDelay + i * 32,
            easing: 'cubic-bezier(.16, .84, .24, 1)',
            fill: 'backwards'
          }));
        } catch {}
      });
    }
    function syncSettingsDive() {
      const modal = document.querySelector('.settings-modal-container');
      if (!modal) {
        cancelSettingsAnims();
        settingsModal = settingsHeader = settingsWater = settingsCanvas = settingsSplash = settingsTab = null;
        return;
      }
      if (modal !== settingsModal) {
        cancelSettingsAnims();
        settingsModal = modal;
        settingsHeader = null;
        settingsCanvas = null;
        settingsSplash = null;
        settingsTab = null;
        settingsClock = performance.now();
        settingsWater = modal.querySelector('[data-makoto-settings-water]');
        if (!settingsWater) {
          settingsWater = document.createElement('span');
          settingsWater.setAttribute('data-makoto-settings-water', '');
          settingsWater.setAttribute('aria-hidden', 'true');
          modal.prepend(settingsWater);
        }
        if (canMotion()) {
          try {
            settingsAnims.push(modal.animate([
              { opacity: 0, transform: 'translate3d(0, 12px, 0) scale(.986)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
            ], { duration: 220, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
          } catch {}
          animateSettingsCards(modal, 40);
        }
      } else if (settingsWater && !settingsWater.isConnected) {
        modal.prepend(settingsWater);
      }
      const header = modal.querySelector('.max-w-2xl > :first-child:has(h2.text-2xl)');
      if (header && header !== settingsHeader) {
        settingsHeader = header;
        const elapsed = Math.max(0, performance.now() - settingsClock);
        header.style.setProperty('--mk-sway-delay', '-' + ((elapsed % 5200) / 1000).toFixed(3) + 's');
        header.style.setProperty('--mk-blink-delay', '-' + ((elapsed % 6400) / 1000).toFixed(3) + 's');
        settingsCanvas = header.querySelector('canvas[data-makoto-settings-dive]');
        if (!settingsCanvas) {
          settingsCanvas = document.createElement('canvas');
          settingsCanvas.setAttribute('data-makoto-settings-dive', '');
          settingsCanvas.setAttribute('aria-hidden', 'true');
          header.append(settingsCanvas);
        }
        settingsSplash = createP3Splash(settingsCanvas, { duration: 480, fallbackW: 620, fallbackH: 118 });
      }
      const active = modal.querySelector('[data-testid="settings-sidebar"] .bg-sidebar-secondary')?.getAttribute('data-testid') ||
                     modal.querySelector('h2.text-2xl')?.textContent?.trim() || null;
      if (active && settingsTab && active !== settingsTab && canMotion()) {
        cancelSettingsAnims();
        if (header) {
          try {
            settingsAnims.push(header.animate([
              { translate: '0 -12px', opacity: 0.72, filter: 'drop-shadow(10px 6px 0 rgb(88 232 255 / 48%)) brightness(1.18)' },
              { translate: '0 3px', opacity: 1, filter: 'drop-shadow(7px 2px 0 rgb(88 232 255 / 30%)) brightness(1.04)', offset: 0.54 },
              { translate: '0 0', opacity: 1, filter: 'drop-shadow(6px 2px 0 rgb(88 232 255 / 26%)) brightness(1)' }
            ], { pseudoElement: '::after', duration: 420, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
          } catch {}
          const titleBox = header.querySelector('h2.text-2xl')?.parentElement;
          if (titleBox) {
            try {
              settingsAnims.push(titleBox.animate([
                { opacity: 0, transform: 'translate3d(12px, 0, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' }
              ], { duration: 200, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
            } catch {}
          }
          if (settingsSplash && settingsCanvas?.isConnected) {
            const hr = header.getBoundingClientRect();
            const hw = hr.width || 620, hh = hr.height || 118;
            settingsSplash.trigger({
              ox: hw * 0.86,
              oy: hh * 0.10,
              baseR: Math.min(hw * 0.24, hh * 1.15),
              cw: hw,
              ch: hh,
              seed: splashSeed++,
              dark: true,
              mode: 'settings'
            });
          }
        }
        animateSettingsCards(modal, 20);
      }
      if (active) settingsTab = active;
    }
    function getActivePluginsTab(el) {
      const active = el?.querySelector('[data-testid="plugins-tabs"] a[aria-current="page"], [data-testid="plugins-tabs"] a.bg-background');
      return active ? (active.getAttribute('data-testid') || active.getAttribute('href') || active.textContent?.trim() || null) : null;
    }
    function animateFeatureItems(rootEl, baseDelay) {
      if (!rootEl || !canMotion()) return false;
      let items = [...rootEl.querySelectorAll(
        '[data-testid="automation-group"], [data-testid="sidecar-row"], .agy-spotlight-card, [data-testid="customization-card"], [data-testid="mcp-server-row"]'
      )].filter(el => el.offsetHeight > 0).slice(0, 8);
      if (!items.length && pageKey === 'automations' && sidecarMode === 'editor') {
        items = [...rootEl.querySelectorAll('div[class*="rounded"][class*="border"], textarea')]
          .filter(el => el.offsetHeight > 0).slice(0, 6);
      }
      if (!items.length) return false;
      items.forEach((el, i) => {
        try {
          pageAnims.push(el.animate([
            { opacity: 0, transform: 'translate3d(12px, 6px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' }
          ], {
            duration: 240,
            delay: baseDelay + i * 26,
            easing: 'cubic-bezier(.16, .84, .24, 1)',
            fill: 'backwards'
          }));
        } catch {}
      });
      pageNeedsCards = false;
      return true;
    }
    function triggerPageTransition(kind, toKey, fromView) {
      if (!pageRoot || !canMotion()) return;
      cancelPageAnims();
      const csOpacity = parseFloat(getComputedStyle(pageRoot, '::after').opacity);
      const targetOp = Number.isFinite(csOpacity) && csOpacity > 0.05 ? csOpacity : (isDarkUi(pageRoot) ? 0.32 : 0.22);
      const restFilter = 'drop-shadow(10px -4px 0 rgb(72 232 255 / 22%)) brightness(1)';
      try {
        let charFrames, charDur = 440;
        if (kind === 'tab') {
          charDur = 360;
          charFrames = [
            {
              translate: '12px -4px',
              scale: '1.022',
              opacity: +(Math.min(1, targetOp * 0.72)).toFixed(3),
              filter: 'drop-shadow(18px -6px 0 rgb(83 238 255 / 46%)) brightness(1.18)'
            },
            {
              translate: '-2px 1px',
              scale: '0.996',
              opacity: +(Math.min(1, targetOp * 1.36)).toFixed(3),
              filter: 'drop-shadow(12px -4px 0 rgb(78 234 255 / 32%)) brightness(1.06)',
              offset: 0.56
            },
            {
              translate: '0px 0px',
              scale: '1',
              opacity: targetOp,
              filter: restFilter
            }
          ];
        } else if (toKey === 'automations') {
          charFrames = [
            {
              translate: '18px 24px',
              scale: '0.92',
              opacity: +(Math.min(1, targetOp * 0.35)).toFixed(3),
              filter: 'drop-shadow(22px 12px 0 rgb(83 238 255 / 50%)) brightness(1.18)'
            },
            {
              translate: '-2px -3px',
              scale: '1.012',
              opacity: +(Math.min(1, targetOp * 1.38)).toFixed(3),
              filter: 'drop-shadow(13px -3px 0 rgb(78 234 255 / 32%)) brightness(1.06)',
              offset: 0.58
            },
            {
              translate: '0px 0px',
              scale: '1',
              opacity: targetOp,
              filter: restFilter
            }
          ];
        } else {
          charFrames = [
            {
              translate: '26px 8px',
              scale: '1.04',
              opacity: +(Math.min(1, targetOp * 0.35)).toFixed(3),
              filter: 'drop-shadow(26px -8px 0 rgb(83 238 255 / 52%)) brightness(1.22)'
            },
            {
              translate: '-3px 0px',
              scale: '0.996',
              opacity: +(Math.min(1, targetOp * 1.42)).toFixed(3),
              filter: 'drop-shadow(14px -5px 0 rgb(78 234 255 / 34%)) brightness(1.07)',
              offset: 0.58
            },
            {
              translate: '0px 0px',
              scale: '1',
              opacity: targetOp,
              filter: restFilter
            }
          ];
        }
        pageAnims.push(pageRoot.animate(charFrames, {
          pseudoElement: '::after',
          duration: charDur,
          easing: 'cubic-bezier(.16, .84, .24, 1)'
        }));
      } catch {}
      if (pageAura?.isConnected) {
        try {
          pageAnims.push(pageAura.animate([
            { opacity: 0.22, transform: 'scale(0.84)' },
            { opacity: 0.88, transform: 'scale(1.04)', offset: 0.56 },
            { opacity: 0.66, transform: 'scale(1)' }
          ], { duration: kind === 'enter' ? 460 : 340, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
        } catch {}
      }
      triggerSweep(pageSweep, pageAnims);
      if (pageCanvas?.isConnected && pageFx?.isConnected) {
        if (!pageSplash) pageSplash = createP3Splash(pageCanvas, { duration: 560, fallbackW: 960, fallbackH: 680 });
        const fr = pageFx.getBoundingClientRect();
        const fw = fr.width || 960, fh = fr.height || 680;
        const charH = Math.min(fh * 0.68, 450);
        const charW = charH * (2 / 3);
        const ox = fw - fw * 0.012 - charW * 0.52;
        const oy = fh + 6 - charH * 0.54;
        const baseR = Math.min(charW * 0.92, charH * 0.54) * (kind === 'enter' ? 1 : 0.84);
        pageSplash.trigger({
          ox,
          oy,
          baseR,
          cw: fw,
          ch: fh,
          seed: splashSeed++,
          dark: isDarkUi(pageRoot),
          mode: toKey
        });
      }
      if (pageButterfly?.isConnected) {
        try {
          const betweenFeature = fromView === 'automations' || fromView === 'customizations';
          const flyFrom = kind === 'tab'
            ? 'translate3d(-18px, -10px, 0) scale(0.90)'
            : betweenFeature
              ? 'translate3d(34px, -22px, 0) scale(0.86)'
              : 'translate3d(-42px, -18px, 0) scale(0.82)';
          pageAnims.push(pageButterfly.animate([
            { opacity: 0.25, transform: flyFrom + ' rotate(-18deg)' },
            { opacity: 0.92, transform: 'translate3d(0, 0, 0) scale(1) rotate(-12deg)' }
          ], { duration: kind === 'enter' ? 480 : 340, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
        } catch {}
      }
      if (kind === 'enter') {
        const heading = pageRoot.querySelector('h1');
        if (heading) {
          try {
            pageAnims.push(heading.animate([
              { opacity: 0.16, transform: 'translate3d(-16px, 0, 0) scaleX(0.96)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0) scaleX(1)' }
            ], { duration: 230, easing: 'cubic-bezier(.16, .84, .24, 1)' }));
          } catch {}
        }
        const controls = [...pageRoot.querySelectorAll(
          '[data-testid="plugins-tabs"], [data-testid="customizations-search"], [data-testid="sidecars-search-input"], [data-testid="sidecar-create-with-prompt"], [data-testid="sidecar-new-button"]'
        )].filter(el => el.offsetHeight > 0).slice(0, 4);
        controls.forEach((ctrl, idx) => {
          try {
            pageAnims.push(ctrl.animate([
              { opacity: 0.18, transform: 'translate3d(12px, 0, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' }
            ], {
              duration: 220,
              delay: 25 + idx * 18,
              easing: 'cubic-bezier(.16, .84, .24, 1)',
              fill: 'backwards'
            }));
          } catch {}
        });
      }
      pageNeedsCards = true;
      pageCardsUntil = performance.now() + 420;
      animateFeatureItems(pageRoot, kind === 'enter' ? 40 : 12);
    }
    function syncFeaturePage() {
      const nextPage = detectFeaturePage();
      if (!nextPage) {
        if (pageRoot) {
          cancelPageAnims();
          pageStage?.remove();
          pageFx?.remove();
          pageRoot = pageStage = pageFx = pageAura = pageSweep = pageCanvas = pageSplash = pageButterfly = pageKey = pageSubTab = sidecarMode = null;
          pageNeedsCards = false;
        }
        return null;
      }
      const nextKey = nextPage.matches('[data-testid="sidecars-view"]') ? 'automations' : 'customizations';
      if (nextPage !== pageRoot || !pageStage?.isConnected || !pageFx?.isConnected) {
        const prevKey = pageKey || lastMainView;
        cancelPageAnims();
        pageStage?.remove();
        pageFx?.remove();
        nextPage.querySelectorAll('[data-makoto-page-stage], [data-makoto-page-fx]').forEach(el => el.remove());
        pageRoot = nextPage;
        pageKey = nextKey;
        const elapsed = Math.max(0, performance.now() - pageClock);
        const floatMod = nextKey === 'automations' ? 10400 : 9600;
        const cycleMod = nextKey === 'automations' ? 6400 : 6800;
        pageRoot.style.setProperty('--mk-page-float-delay', '-' + ((elapsed % floatMod) / 1000).toFixed(3) + 's');
        pageRoot.style.setProperty('--mk-page-cycle-delay', '-' + ((elapsed % cycleMod) / 1000).toFixed(3) + 's');

        pageStage = document.createElement('div');
        pageStage.setAttribute('data-makoto-page-stage', '');
        pageStage.setAttribute('aria-hidden', 'true');
        const pWater = document.createElement('span');
        pWater.setAttribute('data-makoto-page-water', '');
        pageAura = document.createElement('span');
        pageAura.setAttribute('data-makoto-page-aura', '');
        pageStage.append(pWater, pageAura);

        pageFx = document.createElement('div');
        pageFx.setAttribute('data-makoto-page-fx', '');
        pageFx.setAttribute('aria-hidden', 'true');
        pageSweep = document.createElement('span');
        pageSweep.setAttribute('data-makoto-page-sweep', '');
        pageCanvas = document.createElement('canvas');
        pageCanvas.setAttribute('data-makoto-page-dive', '');
        pageButterfly = butterfly();
        pageFx.append(pageSweep, pageCanvas, pageButterfly);

        pageRoot.prepend(pageStage, pageFx);
        pageSplash = createP3Splash(pageCanvas, { duration: 560, fallbackW: 960, fallbackH: 680 });
        pageSubTab = nextKey === 'customizations' ? getActivePluginsTab(pageRoot) : null;
        sidecarMode = nextKey === 'automations' ? (pageRoot.querySelector('textarea, [contenteditable="true"]') ? 'editor' : 'list') : null;
        if (viewInitialized && canMotion()) {
          triggerPageTransition('enter', nextKey, prevKey);
        }
      } else {
        if (nextKey === 'customizations') {
          const activeTab = getActivePluginsTab(pageRoot);
          if (activeTab && pageSubTab && activeTab !== pageSubTab) {
            pageSubTab = activeTab;
            if (canMotion()) triggerPageTransition('tab', nextKey, lastMainView);
          } else if (activeTab && !pageSubTab) {
            pageSubTab = activeTab;
          }
        } else if (nextKey === 'automations') {
          const curMode = pageRoot.querySelector('textarea, [contenteditable="true"]') ? 'editor' : 'list';
          if (sidecarMode && curMode !== sidecarMode) {
            sidecarMode = curMode;
            if (canMotion()) triggerPageTransition('tab', 'automations', 'automations');
          } else if (!sidecarMode) {
            sidecarMode = curMode;
          }
        }
        if (pageNeedsCards && performance.now() < pageCardsUntil && canMotion()) {
          animateFeatureItems(pageRoot, 10);
        } else if (pageNeedsCards && performance.now() >= pageCardsUntil) {
          pageNeedsCards = false;
        }
      }
      return nextKey;
    }
    function sync() {
      queued = false;
      const anchor = document.querySelector('.agy-shell .surface-composer, .agy-shell [data-testid="conversation-view"]');
      const next = anchor?.closest('[data-main-content-body]');
      if (area !== next || (next && !layer?.isConnected)) {
        area?.removeAttribute('data-makoto-chat');
        area?.removeAttribute('data-makoto-static');
        layer?.remove();
        area = next;
        chatSplash = null;
        if (area) {
          if (getComputedStyle(area).position === 'static') area.setAttribute('data-makoto-static', '');
          area.setAttribute('data-makoto-chat', '');
          layer = document.createElement('div');
          layer.setAttribute('data-makoto-layer', '');
          layer.setAttribute('aria-hidden', 'true');
          const water = document.createElement('span');
          water.setAttribute('data-makoto-water', '');
          sweep = document.createElement('span');
          sweep.setAttribute('data-makoto-sweep', '');
          dive = document.createElement('canvas');
          dive.setAttribute('data-makoto-dive', '');
          layer.append(water, sweep, dive, butterfly());
          area.prepend(layer);
          chatSplash = createP3Splash(dive, { duration: 580, fallbackW: 900, fallbackH: 700 });
        } else {
          sweep = null;
          dive = null;
        }
      }
      syncPortrait();
      const activeFeature = syncFeaturePage();
      syncSettingsDive();
      lastMainView = getMainViewKey();
      const shell = document.querySelector('.agy-shell');
      if (shell) {
        const viewTag = area?.querySelector('.agy-home') ? 'home' : (activeFeature || (location.pathname.startsWith('/c/') ? 'chat' : 'other'));
        if (shell.getAttribute('data-makoto-view') !== viewTag) shell.setAttribute('data-makoto-view', viewTag);
      }
      viewInitialized = true;
      const nav = document.querySelector('[data-testid="sidebar-navigation-items"]');
      if (rail !== nav || (nav && !insect?.isConnected)) {
        insect?.remove();
        rail = nav;
        if (rail) { insect = butterfly(); rail.append(insect); }
      }
      const messages = area?.querySelectorAll('[data-testid="agent-response"] [data-markdown-root]');
      const final = messages?.[messages.length - 1]?.parentElement;
      if (final !== latest) {
        latest?.removeAttribute('data-makoto-latest');
        final?.setAttribute('data-makoto-latest', '');
        latest = final;
      }
    }
    document.querySelectorAll(paragraph).forEach(mark);
    new MutationObserver(records => {
      const currentView = getMainViewKey();
      const routeChanged = currentView !== conversation || currentView !== lastMainView;
      const activeTab = pageKey === 'customizations' ? getActivePluginsTab(pageRoot) : null;
      const tabChanged = Boolean(pageKey === 'customizations' && activeTab && pageSubTab && activeTab !== pageSubTab);
      const now = performance.now();
      const canAnimateBubbles = Boolean(
        !routeChanged && now >= hydrationLockUntil &&
        conversation && typeof conversation === 'string' && conversation.startsWith('/c/') &&
        location.pathname === conversation && canMotion()
      );
      let sawMessageAdded = false;
      if (area) {
        for (const record of records) {
          const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
          if (!area.contains(element)) continue;
          const p = element?.closest(paragraph);
          if (p) mark(p);
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.matches(paragraph)) mark(node);
            else node.querySelectorAll(paragraph).forEach(mark);
            const msgTarget = node.matches(bubbleSelector) ? node : node.querySelector(bubbleSelector);
            if (msgTarget) {
              sawMessageAdded = true;
              if (canAnimateBubbles && !msgTarget.hasAttribute('data-makoto-bubble-seen')) {
                msgTarget.setAttribute('data-makoto-bubble-seen', '');
                msgTarget.setAttribute('data-makoto-bubble-enter', '');
                setTimeout(() => msgTarget.removeAttribute('data-makoto-bubble-enter'), 240);
              }
            }
          }
        }
      }
      if (routeChanged || tabChanged) {
        queued = false;
        sync();
      } else {
        if (needsContentReveal && sawMessageAdded && now < hydrationLockUntil && canMotion()) {
          if (animateConversationViewport()) {
            needsContentReveal = false;
            expectedCascadeId = null;
          }
        }
        if (pageNeedsCards && now < pageCardsUntil && canMotion()) {
          animateFeatureItems(pageRoot, 10);
        }
        if (!queued) { queued = true; requestAnimationFrame(sync); }
      }
    }).observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-cascade-id', 'aria-current']});
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
