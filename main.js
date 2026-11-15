/* krepped.nl: interactions
   Libraries (loaded before this file): GSAP + ScrollTrigger, Lenis. Three.js is imported on demand.
   Everything degrades: no JS libs -> static page, no WebGL -> no plates, reduced motion -> no animation. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const hasGsap = !!(gsap && ST);
  const motion = hasGsap && !reduce;
  if (hasGsap) gsap.registerPlugin(ST);

  // always start at the top (the inline script in <head> already stops the browser restoring the old spot)
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (hasGsap) ST.clearScrollMemory("manual"); // ScrollTrigger keeps its own scroll memory too
  window.scrollTo(0, 0);
  addEventListener("load", () => { if (window.scrollY > 0 && document.querySelector(".loader")) window.scrollTo(0, 0); });

  // the one exception: "/?to=work" (the "All work" link on a project page) lands on that section.
  // The URL is cleaned right away, so a reload after that starts at the top again.
  const goTo = (() => {
    const id = new URLSearchParams(location.search).get("to");
    return id && /^[a-z]+$/.test(id) && document.getElementById(id) ? id : null;
  })();
  if (goTo) history.replaceState(null, "", location.pathname);

  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=<>/\\[]{}$@";
  const pick = (s) => s[(Math.random() * s.length) | 0];
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pad2 = (n) => String(n).padStart(2, "0");

  /* ---------- scramble: morph text into a target string through random glyphs ---------- */
  function scramble(el, target, opts = {}) {
    const { duration = 1000, glyphs = GLYPHS } = opts;
    const from = opts.from ?? el._text ?? el.textContent;
    el._text = target;
    cancelAnimationFrame(el._raf);
    if (reduce) { el.textContent = target; return; }
    const n = Math.max(from.length, target.length);
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push({ a: from[i] || " ", b: target[i] || " ", t: Math.min(1, (i / Math.max(n, 1)) * 0.45 + Math.random() * 0.55) });
    }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      if (p >= 1) { el.textContent = target; return; }
      el.textContent = cells.map((c) => {
        if (p >= c.t) return c.b;
        const src = c.a !== " " ? c.a : c.b;
        return src === " " ? " " : pick(glyphs);
      }).join("").replace(/\s+$/, "");
      el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }
  const noise = (t, g = GLYPHS) => t.replace(/\S/g, () => pick(g));

  /* ---------- clock ---------- */
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const clocks = $$("[data-clock]");
  const tick = () => { const t = fmt.format(new Date()); clocks.forEach((c) => { c.textContent = t; }); };
  tick();
  setInterval(tick, 1000);

  /* ---------- copy email ---------- */
  $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
    const v = btn.dataset.copy;
    try { await navigator.clipboard.writeText(v); } catch (e) { location.href = "mailto:" + v; return; }
    scramble(btn, "Copied", { duration: 450 });
    clearTimeout(btn._t);
    btn._t = setTimeout(() => scramble(btn, "Copy", { duration: 450 }), 1800);
  }));

  /* ---------- work: numbering, count, layout mode ---------- */
  const work = $("#work");
  const pieces = $$(".piece");
  pieces.forEach((p, i) => { const n = $("[data-piece-num]", p); if (n) n.textContent = pad2(i + 1); });
  const countEl = $("[data-project-count]");
  if (countEl) countEl.textContent = `(${pad2(pieces.length)})`;
  if (work && pieces.length > 1) work.classList.add("is-multi");

  // page tint: sections and projects can carry data-bg
  const setBg = (c) => { if (c) document.body.style.setProperty("--bg", c); else document.body.style.removeProperty("--bg"); };
  let activePieceBg = null; // tint of the project currently in the sideways reel

  // coming-soon titles glitch now and then while they're on screen
  if (!reduce && "IntersectionObserver" in window) {
    $$(".is-soon .piece-title").forEach((t, i) => {
      const text = t.textContent.trim();
      let visible = false;
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(t);
      setInterval(() => {
        if (visible && !document.hidden) scramble(t, text, { from: noise(text), duration: 900 });
      }, 4200 + i * 1100);
    });
  }

  // "Explore project" pill drifts toward the cursor while hovering the image
  if (finePointer && !reduce && hasGsap) {
    pieces.forEach((p) => {
      const media = $(".piece-media", p), cta = $(".piece-cta", p);
      if (!media || !cta) return;
      const xTo = gsap.quickTo(cta, "x", { duration: 0.7, ease: "power3" });
      const yTo = gsap.quickTo(cta, "y", { duration: 0.7, ease: "power3" });
      media.addEventListener("pointermove", (e) => {
        const r = media.getBoundingClientRect();
        const homeX = cta.offsetLeft + cta.offsetWidth / 2, homeY = cta.offsetTop + cta.offsetHeight / 2;
        xTo((e.clientX - r.left - homeX) * 0.85);
        yTo((e.clientY - r.top - homeY) * 0.85);
      });
      media.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- hero headline ---------- */
  const heroLines = $$(".hero-title .scramble");
  heroLines.forEach((el) => { el._text = el.textContent; });
  const decrypt = (el, d) => scramble(el, el._text, { from: noise(el._text), duration: d });
  if (finePointer && !reduce) {
    let last = 0;
    $(".hero-title").addEventListener("pointerenter", () => {
      const now = performance.now();
      if (now - last < 1400) return;
      last = now;
      heroLines.forEach((el, i) => setTimeout(() => decrypt(el, 750), i * 90));
    });
  }

  /* ---------- WebGL: chrome plates that unfold into a spiral and lock back into a block ---------- */
  const canvas = $(".gl");
  const S = { intro: 1 }; // 1 = assembled block, 0 = spiral
  async function initGL() {
    if (!canvas) return null;
    let THREE, RoomEnvironment, RoundedBoxGeometry;
    try {
      THREE = await import("three");
      ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
      ({ RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js"));
    } catch (e) { return null; }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return null; }

    const small = Math.min(innerWidth, innerHeight) < 700;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 15);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(-5, 7, 6);
    scene.add(keyLight);

    const N = small ? 12 : 16;
    const geo = new RoundedBoxGeometry(1.45, 2.05, 0.07, 4, 0.11);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x3a4246, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06,
      iridescence: 0.3, iridescenceIOR: 1.4, iridescenceThicknessRange: [100, 280], envMapIntensity: 1.1,
    });
    const group = new THREE.Group();
    scene.add(group);
    const plates = [];
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(geo, mat); group.add(m); plates.push(m); }

    const about = $("#about"), contact = $("#contact");
    let vw = 0, vh = 0, aspect = 1;
    const resize = () => {
      vw = innerWidth; vh = innerHeight; aspect = vw / vh;
      renderer.setSize(vw, vh, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    };
    resize();
    let rq = 0;
    addEventListener("resize", () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(resize); });

    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    if (finePointer) addEventListener("pointermove", (e) => { mouse.x = e.clientX / vw - 0.5; mouse.y = e.clientY / vh - 0.5; }, { passive: true });

    const TAU = Math.PI * 2;
    const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    let phase = 0, vel = 0, lastY = scrollY, time = 0, prev = performance.now(), cleared = false;
    const cur = { x: 0, y: 0, s: 1, asm: 1 };

    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!reduce) time += dt;

      // scroll state, measured from the sections themselves
      const wide = aspect > 1.05;
      const aTop = about.getBoundingClientRect().top;
      const cTop = contact.getBoundingClientRect().top;
      const a = clamp(1 - aTop / vh, 0, 1); // About coming in: plates leave upward
      // Contact coming in: plates return and assemble (only on wide screens, where there is room beside the text)
      const c = wide ? clamp((vh * 0.75 - cTop) / (vh * 0.6), 0, 1) : 0;
      if (a >= 1 && c <= 0) {
        if (!cleared) { renderer.clear(); cleared = true; }
        lastY = scrollY;
        return;
      }
      cleared = false;

      const dy = scrollY - lastY;
      lastY = scrollY;
      vel = lerp(vel, dy, 0.12);
      if (!reduce) phase += dt * 0.22 + vel * 0.0035;

      // layout anchors in world units (the visible height is about 8 units)
      const fit = clamp(aspect / 1.6, 0.42, 1);
      let tx, ty, asm;
      if (c > 0) {
        tx = wide ? 3.7 * fit + 0.6 : 0;
        ty = (wide ? 0.2 : 1.9) - (1 - smooth(c)) * 9;
        asm = Math.max(S.intro, smooth(clamp(c * 1.15, 0, 1)));
      } else {
        tx = wide ? 1.9 * fit : 0.2;
        ty = (wide ? 1.75 : 2.0) + smooth(a) * 9;
        asm = S.intro;
      }
      const k = reduce ? 1 : 0.09;
      cur.x = lerp(cur.x, tx, k);
      cur.y = lerp(cur.y, ty, k);
      cur.s = lerp(cur.s, fit * (wide ? 0.88 : 0.95), k);
      cur.asm = lerp(cur.asm, asm, reduce ? 1 : 0.12);
      mouse.sx = lerp(mouse.sx, mouse.x, 0.05);
      mouse.sy = lerp(mouse.sy, mouse.y, 0.05);

      group.position.set(cur.x, cur.y, 0);
      group.scale.setScalar(cur.s);
      // the spiral runs along a diagonal; the block turns slowly in 3/4 view
      const A = cur.asm;
      group.rotation.set(
        lerp(0, -0.32, A) + mouse.sy * 0.25,
        lerp(0, 0.65 + time * 0.25, A) + mouse.sx * 0.35,
        lerp(-0.38, 0, A)
      );

      const len = 11, rad = 1.15;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const ang = t * TAU * 1.15 + phase;
        const sx = (t - 0.5) * len, sy = Math.cos(ang) * rad, sz = Math.sin(ang) * rad;
        const srx = ((ang % TAU) + TAU) % TAU;
        const bz = (i - (N - 1) / 2) * 0.105;
        const kk = smooth(clamp(A * 1.5 - t * 0.5, 0, 1)); // block assembles from one end
        const p = plates[i];
        p.position.set(lerp(sx, 0, kk), lerp(sy, 0, kk), lerp(sz, bz, kk));
        p.rotation.set(srx + angDiff(srx, 0) * kk, lerp(0.22, 0, kk), lerp(Math.PI / 2, 0, kk));
      }
      renderer.render(scene, camera);
    };
    requestAnimationFrame(frame);
    return {
      intro() {
        canvas.classList.add("is-on");
        if (motion) gsap.to(S, { intro: 0, duration: 2.6, ease: "expo.inOut", delay: 0.1 });
        else S.intro = 0;
      },
    };
  }
  const glReady = initGL();

  /* ---------- no animation libs or reduced motion: show everything and stop here ---------- */
  const loader = $(".loader");
  if (!motion) {
    loader && loader.remove();
    glReady.then((gl) => gl && gl.intro());
    if (hasGsap) themeTriggers();
    if (goTo) document.getElementById(goTo).scrollIntoView();
    return;
  }

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.stop();
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  }));

  /* ---------- loader + intro ---------- */
  gsap.set(".hero-title .line > span", { yPercent: 112 });
  gsap.set("[data-intro]", { autoAlpha: 0, y: 26 });
  heroLines.forEach((el) => { el.textContent = noise(el._text); });

  let seen = !!goTo; // coming back from a project page: skip the long loader
  try { seen = seen || sessionStorage.getItem("krep-intro") === "1"; } catch (e) { /* storage blocked */ }

  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
  const counted = new Promise((resolve) => {
    if (seen || !loader) { resolve(); return; }
    const n = $("[data-count]"), bar = $(".loader-bar i"), c = { v: 0 };
    gsap.to(c, {
      v: 100, duration: 1.6, ease: "power2.inOut",
      onUpdate: () => { n.textContent = String(Math.round(c.v)).padStart(3, "0"); bar.style.transform = `scaleX(${c.v / 100})`; },
      onComplete: resolve,
    });
  });

  Promise.all([fontsReady, counted]).then(() => {
    try { sessionStorage.setItem("krep-intro", "1"); } catch (e) { /* storage blocked */ }
    const tl = gsap.timeline({ onComplete: () => lenis && lenis.start() });
    if (goTo) {
      tl.add(() => {
        const el = document.getElementById(goTo);
        if (lenis) lenis.scrollTo(el, { immediate: true, force: true }); else el.scrollIntoView();
      }, 0);
    }
    if (loader) {
      if (seen) tl.to(loader, { autoAlpha: 0, duration: 0.45, ease: "power2.out" });
      else tl.to(loader, { clipPath: "inset(0 0 100% 0)", duration: 1.05, ease: "expo.inOut" });
      tl.add(() => loader.remove());
    }
    tl.add(() => glReady.then((gl) => gl && gl.intro()), seen ? 0 : 0.35);
    tl.to(".hero-title .line > span", { yPercent: 0, duration: 1.4, ease: "expo.out", stagger: 0.1 }, seen ? 0.1 : 0.6);
    tl.add(() => heroLines.forEach((el, i) => setTimeout(() => decrypt(el, 1500), i * 140)), "<");
    tl.to("[data-intro]", { autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out", stagger: 0.09 }, "<0.35");
  });

  /* ---------- scroll: progress bar + theme per section ---------- */
  const bar = $(".progress i");
  ST.create({ start: 0, end: "max", onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; } });
  themeTriggers();
  function themeTriggers() {
    $$("[data-theme]").forEach((sec) => {
      ST.create({
        trigger: sec, start: "top 55%", end: "bottom 55%",
        onToggle: (self) => {
          if (!self.isActive) return;
          document.body.classList.toggle("is-light", sec.dataset.theme === "light");
          const pinnedReel = sec === work && work.classList.contains("is-pinned");
          setBg(pinnedReel ? activePieceBg || sec.dataset.bg : sec.dataset.bg);
        },
      });
    });
  }

  /* ---------- reveals ---------- */
  $$("[data-reveal]").forEach((el) => {
    gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });
  $$("h2").forEach((h) => {
    const spans = $$("[data-rise]", h);
    if (!spans.length) return;
    gsap.from(spans, { yPercent: 112, duration: 1.4, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: h, start: "top 88%", once: true } });
  });

  // About: languages / focus / tools rows rise in one after another
  const kit = $(".kit");
  if (kit) {
    gsap.from($$(".kit-head, .kit-list li", kit), {
      y: 22, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.035,
      scrollTrigger: { trigger: kit, start: "top 85%", once: true },
    });
  }

  // About: words light up as you read
  const lead = $("[data-words]");
  if (lead) {
    lead.innerHTML = lead.textContent.trim().split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
    gsap.fromTo($$(".w", lead), { opacity: 0.13 }, {
      opacity: 1, ease: "none", stagger: 0.1,
      scrollTrigger: { trigger: lead, start: "top 80%", end: "bottom 48%", scrub: 0.5 },
    });
  }

  // work: each scene opens up as it arrives; titles decode
  const decodeTitle = (p) => {
    const t = $(".piece-title", p);
    if (t && !t._done) { t._done = true; scramble(t, t.textContent, { from: noise(t.textContent), duration: 1100 }); }
  };
  const mm = gsap.matchMedia();
  mm.add({ wide: "(min-width: 901px)", narrow: "(max-width: 900px)" }, (ctx) => {
    const multi = pieces.length > 1 && ctx.conditions.wide;
    if (!multi) {
      // stacked: every piece animates on its own as you scroll down
      pieces.forEach((p) => {
        const media = $(".piece-media", p), img = $(".piece-media img", p);
        gsap.fromTo(media, { clipPath: "inset(10% 8% 10% 8% round 8px)" }, {
          clipPath: "inset(0% 0% 0% 0% round 8px)", ease: "none",
          scrollTrigger: { trigger: p, start: "top 95%", end: "top 40%", scrub: 0.6 },
        });
        gsap.fromTo(img, { scale: 1.25 }, { scale: 1, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "top 30%", scrub: 0.6 } });
        ST.create({ trigger: p, start: "top 75%", once: true, onEnter: () => decodeTitle(p) });
        if (pieces.length > 1) {
          ST.create({ trigger: p, start: "top 55%", end: "bottom 55%", onToggle: (s) => { if (s.isActive) setBg(p.dataset.bg || work.dataset.bg); } });
        }
      });
      return;
    }
    // several projects on a wide screen: pin the section and scroll the reel sideways
    work.classList.add("is-pinned");
    const reel = $(".reel"), wrap = $(".reel-wrap"), bar = $(".reel-bar i");
    const dist = () => Math.max(0, reel.scrollWidth - wrap.clientWidth);
    // a pause after the section locks and after the last card arrives, so it doesn't start or let go abruptly
    const hold = () => Math.round(innerHeight * 0.35);
    const pin = ST.create({
      trigger: work, start: "top top", end: () => "+=" + (dist() + hold() * 2), pin: true,
      invalidateOnRefresh: true, refreshPriority: 1, // measure the pin first so later sections line up
    });
    // the slide uses plain scroll positions inside the pin (an element-based start would get pushed past the pin)
    const slide = gsap.to(reel, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        start: () => pin.start + hold(), end: () => pin.start + hold() + dist(), scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; },
      },
    });
    pieces.forEach((p, i) => {
      const img = $(".piece-media img", p);
      gsap.fromTo(img, { scale: 1.16, xPercent: 4 }, {
        scale: 1.04, xPercent: -4, ease: "none",
        scrollTrigger: { trigger: p, containerAnimation: slide, start: "left right", end: "right left", scrub: true },
      });
      ST.create({
        trigger: p, containerAnimation: slide, start: "left 65%", end: "right 35%",
        onToggle: (s) => {
          if (!s.isActive) return;
          activePieceBg = p.dataset.bg || work.dataset.bg;
          setBg(activePieceBg);
          decodeTitle(p);
        },
      });
      if (i === 0) ST.create({ trigger: work, start: "top 60%", once: true, onEnter: () => decodeTitle(p) });
    });
    return () => work.classList.remove("is-pinned");
  });
  ST.sort();

  addEventListener("load", () => ST.refresh());
})();
