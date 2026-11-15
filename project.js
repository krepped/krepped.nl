/* krepped.nl: project pages (work/<slug>/index.html)
   Same libraries as the home page (GSAP + ScrollTrigger, Lenis), loaded before this file.
   Everything degrades: without the libraries or with reduced motion, the page is simply static. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const hasGsap = !!(gsap && ST);
  const motion = hasGsap && !reduce;
  if (hasGsap) gsap.registerPlugin(ST);

  // always start at the top (the inline script in <head> already stops the browser restoring the old spot)
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (hasGsap) ST.clearScrollMemory("manual");
  window.scrollTo(0, 0);

  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=<>/\\[]{}$@";
  const pick = (s) => s[(Math.random() * s.length) | 0];

  /* ---------- scramble: morph text into a target string through random glyphs ---------- */
  function scramble(el, target, opts = {}) {
    const { duration = 1000, glyphs = GLYPHS } = opts;
    const from = opts.from ?? el.textContent;
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

  /* ---------- chapter bar: sits right under the menu, whatever height the menu has ---------- */
  const navEl = $(".nav");
  const setNavH = () => { if (navEl) document.documentElement.style.setProperty("--nav-h", navEl.offsetHeight + "px"); };
  setNavH();
  addEventListener("resize", setNavH);
  if (document.fonts) document.fonts.ready.then(setNavH);
  const barOffset = () => -((navEl ? navEl.offsetHeight : 74) + ($(".cs-index") ? $(".cs-index").offsetHeight : 50) + 24);

  /* ---------- chapter bar: highlight the chapter you're reading ---------- */
  const indexLinks = $$(".cs-index-links a");
  if (indexLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(indexLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        indexLinks.forEach((a) => a.classList.remove("is-active"));
        const a = byId.get(e.target.id);
        if (!a) return;
        a.classList.add("is-active");
        // on narrow screens the bar scrolls sideways: keep the current chapter in view
        const box = a.parentElement;
        if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: Math.max(0, a.offsetLeft - box.offsetLeft - 20), behavior: reduce ? "auto" : "smooth" });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    byId.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- "Coming soon" in the next-project band glitches now and then ---------- */
  if (!reduce && "IntersectionObserver" in window) {
    $$("[data-soon]").forEach((t) => {
      const text = t.textContent.trim();
      let visible = false;
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(t);
      setInterval(() => { if (visible && !document.hidden) scramble(t, text, { from: noise(text), duration: 900 }); }, 4200);
    });
  }

  /* ---------- page tint per section ---------- */
  const setBg = (c) => { if (c) document.body.style.setProperty("--bg", c); else document.body.style.removeProperty("--bg"); };
  function themeTriggers() {
    $$("[data-theme]").forEach((sec) => {
      ST.create({
        trigger: sec, start: "top 55%", end: "bottom 55%",
        onToggle: (self) => {
          if (!self.isActive) return;
          document.body.classList.toggle("is-light", sec.dataset.theme === "light");
          setBg(sec.dataset.bg);
        },
      });
    });
  }

  if (!motion) {
    if (hasGsap) themeTriggers();
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
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null || !lenis) return;
    e.preventDefault();
    // land below the menu and the chapter bar
    lenis.scrollTo(target, { offset: target === 0 ? 0 : barOffset(), duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  }));

  /* ---------- intro: the title rises and decodes ---------- */
  const title = $(".cs-title-text");
  if (title) {
    const text = title.textContent;
    title.textContent = noise(text);
    gsap.from(".cs-title .line > span", { yPercent: 112, duration: 1.4, ease: "expo.out", delay: 0.1 });
    setTimeout(() => scramble(title, text, { from: title.textContent, duration: 1400 }), 150);
  }

  /* ---------- scroll: progress bar, tints, reveals ---------- */
  const bar = $(".progress i");
  if (bar) ST.create({ start: 0, end: "max", onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; } });
  themeTriggers();

  $$("[data-reveal]").forEach((el) => {
    gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });
  $$("h2").forEach((h) => {
    const spans = $$("[data-rise]", h);
    if (!spans.length) return;
    gsap.from(spans, { yPercent: 112, duration: 1.4, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: h, start: "top 88%", once: true } });
  });
  $$(".cs-list, .cs-points").forEach((list) => {
    gsap.from($$("li", list), {
      y: 26, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.06,
      scrollTrigger: { trigger: list, start: "top 85%", once: true },
    });
  });

  // cover render: opens up and settles while you scroll
  const cover = $(".cs-cover-in");
  if (cover) {
    gsap.fromTo(cover, { clipPath: "inset(6% 5% 6% 5% round 10px)" }, {
      clipPath: "inset(0% 0% 0% 0% round 10px)", ease: "none",
      scrollTrigger: { trigger: cover, start: "top 95%", end: "top 25%", scrub: 0.6 },
    });
    gsap.fromTo($("img", cover), { scale: 1.14 }, { scale: 1, ease: "none", scrollTrigger: { trigger: cover, start: "top bottom", end: "bottom top", scrub: 0.6 } });
  }

  // numbers decode into their values
  $$("[data-num]").forEach((el) => {
    const target = el.textContent;
    const digits = (t) => t.replace(/\d/g, () => pick("0123456789"));
    el.textContent = digits(target);
    ST.create({ trigger: el, start: "top 88%", once: true, onEnter: () => scramble(el, target, { from: digits(target), glyphs: "0123456789", duration: 1300 }) });
  });

  addEventListener("load", () => ST.refresh());
})();
