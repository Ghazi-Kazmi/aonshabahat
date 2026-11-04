/* Scroll-driven frame sequence: maps scroll position to a frame of the
   four Veo transition clips, holding on each event between them. */

export const CLIPS = 4;
export const PER_CLIP = 63; // frames per transition clip (8 fps × ~8 s)
const TOTAL = CLIPS * PER_CLIP;
export const STILLS = ["engagement", "nikah", "mehndi", "baraat", "valima"];

const frameSrc = (i: number) => {
  const clip = Math.floor(i / PER_CLIP) + 1;
  const n = String((i % PER_CLIP) + 1).padStart(3, "0");
  return `/assets/seq/c${clip}_${n}.webp`;
};
// Frame index where the camera rests on event k.
const holdFrame = (k: number) => (k === 0 ? 0 : k * PER_CLIP - 1);

type Segment =
  | { type: "hold"; k: number; len: number; start: number; end: number }
  | { type: "move"; clip: number; len: number; start: number; end: number }
  | { type: "outro"; len: number; start: number; end: number };

function buildSegments(eventCount: number) {
  const segs: Segment[] = [];
  let acc = 0;
  type Draft = Segment extends infer S ? (S extends Segment ? Omit<S, "start" | "end"> : never) : never;
  const push = (s: Draft) => {
    segs.push({ ...s, start: acc, end: acc + s.len } as Segment);
    acc += s.len;
  };
  for (let k = 0; k < eventCount; k++) {
    push({ type: "hold", k, len: k === 0 ? 1.0 : 1.25 });
    if (k < eventCount - 1) push({ type: "move", clip: k + 1, len: 2.1 });
  }
  push({ type: "outro", len: 1.4 });
  return { segs, total: acc };
}

// transit: index of the event the camera is travelling into, while mid-move; otherwise -1.
export type JourneyState = { card: number; rail: number; outro: boolean; scrolled: boolean; transit: number };

type Options = {
  fg: HTMLCanvasElement;
  bg: HTMLCanvasElement;
  frameEl: HTMLElement;
  track: HTMLElement;
  outroShade: HTMLElement;
  eventCount: number;
  onState: (s: JourneyState) => void;
  onProgress: (pct: number) => void;
  onReady: () => void;
};

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (t: number) => t * t * (3 - 2 * t);

function loadImg(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => img.decode().catch(() => {}).then(() => resolve(img));
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadQueue<T extends { src: string }>(
  items: T[], concurrency: number, onEach: (item: T, img: HTMLImageElement | null) => void, alive: () => boolean,
) {
  let i = 0;
  const worker = async () => {
    while (i < items.length && alive()) {
      const item = items[i++];
      onEach(item, await loadImg(item.src));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

export function createJourney(o: Options) {
  const { segs, total: TIMELINE } = buildSegments(o.eventCount);
  const fgx = o.fg.getContext("2d")!;
  const bgx = o.bg.getContext("2d")!;
  const desktopMQ = window.matchMedia("(min-width: 900px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const frames: (HTMLImageElement | null)[] = new Array(TOTAL).fill(null);
  const stills: Record<string, HTMLImageElement> = {};
  let vh = window.innerHeight, vw = window.innerWidth;
  const target = { f: 0, still: 1, stillK: 0, outro: 0 };
  const cur = { f: 0, still: 1, stillK: 0, outro: 0 };
  let last: JourneyState = { card: -2, rail: -1, outro: false, scrolled: false, transit: -2 };
  let dirty = true, alive = true, raf = 0;

  function layout() {
    o.track.style.height = `${(TIMELINE + 1) * vh}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.fg.width = Math.round(o.frameEl.clientWidth * dpr);
    o.fg.height = Math.round(o.frameEl.clientHeight * dpr);
    o.bg.width = 72; o.bg.height = 128;
    dirty = true;
  }

  function readScroll() {
    const u = clamp(window.scrollY / vh, 0, TIMELINE);
    const seg = segs.find((s) => u >= s.start && u < s.end) ?? segs[segs.length - 1];
    const t = clamp((u - seg.start) / seg.len);
    let card = -1, rail = 0, transit = -1;

    if (seg.type === "hold") {
      target.f = holdFrame(seg.k);
      target.stillK = seg.k; target.still = 1; target.outro = 0;
      rail = seg.k;
      if ((seg.k === 0 || t > 0.12) && t < 0.88) card = seg.k;
    } else if (seg.type === "move") {
      const k = seg.clip;
      target.f = (k - 1) * PER_CLIP + smooth(t) * (PER_CLIP - 1);
      target.outro = 0;
      if (t < 0.5) { target.stillK = k - 1; target.still = clamp(1 - t / 0.08); }
      else { target.stillK = k; target.still = clamp((t - 0.92) / 0.08); }
      rail = t < 0.5 ? k - 1 : k;
      // Middle stretch of the move, while the foreground wipe fills the frame.
      if (t > 0.24 && t < 0.84) transit = k;
    } else {
      target.f = TOTAL - 1;
      target.stillK = STILLS.length - 1; target.still = 1;
      target.outro = clamp(t / 0.45) * 0.86;
      rail = o.eventCount - 1;
    }

    const next: JourneyState = {
      card, rail, outro: seg.type === "outro" && t > 0.3, scrolled: window.scrollY > 40, transit,
    };
    if (
      next.card !== last.card || next.rail !== last.rail || next.outro !== last.outro ||
      next.scrolled !== last.scrolled || next.transit !== last.transit
    ) {
      last = next;
      o.onState(next);
    }
  }

  function nearestFrame(i: number) {
    for (let d = 0; d < TOTAL; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }

  function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null | undefined, w: number, h: number, alpha: number) {
    if (!img || alpha <= 0.003) return;
    const ir = img.naturalWidth / img.naturalHeight, cr = w / h;
    let dw: number, dh: number;
    if (cr > ir) { dw = w; dh = w / ir; } else { dh = h; dw = h * ir; }
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }

  function paint(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const a = Math.floor(cur.f), t = cur.f - a;
    const base = nearestFrame(clamp(a, 0, TOTAL - 1));
    const still = stills[STILLS[cur.stillK]];
    if (!base && !still) return;
    ctx.fillStyle = "#0f0b08";
    ctx.fillRect(0, 0, w, h);
    drawCover(ctx, base, w, h, 1);
    if (t > 0.01 && frames[a + 1]) drawCover(ctx, frames[a + 1], w, h, t);
    drawCover(ctx, still, w, h, cur.still);
  }

  function tick() {
    const df = target.f - cur.f;
    cur.f = Math.abs(df) < 0.002 ? target.f : cur.f + df * (reduceMotion ? 1 : 0.16);
    cur.stillK = target.stillK;
    const ds = target.still - cur.still;
    cur.still = Math.abs(ds) < 0.002 ? target.still : cur.still + ds * (reduceMotion ? 1 : 0.2);
    const dO = target.outro - cur.outro;
    cur.outro = Math.abs(dO) < 0.002 ? target.outro : cur.outro + dO * 0.15;

    if (dirty || Math.abs(df) > 0.002 || Math.abs(ds) > 0.002 || Math.abs(dO) > 0.002) {
      paint(fgx, o.fg.width, o.fg.height);
      if (desktopMQ.matches) paint(bgx, o.bg.width, o.bg.height);
      o.outroShade.style.opacity = cur.outro.toFixed(3);
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  }

  async function preload() {
    const coarse: { i: number; src: string }[] = [], fine: { i: number; src: string }[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const isCoarse = i % 4 === 0 || STILLS.some((_, k) => holdFrame(k) === i);
      (isCoarse ? coarse : fine).push({ i, src: frameSrc(i) });
    }
    const first: { i?: number; still?: string; src: string }[] = [
      ...STILLS.map((still) => ({ still, src: `/assets/stills/${still}.webp` })),
      ...coarse,
    ];
    let done = 0;
    await loadQueue(first, 6, (item, img) => {
      if (img) { if (item.still) stills[item.still] = img; else frames[item.i!] = img; }
      done++;
      o.onProgress(Math.round((done / first.length) * 100));
      dirty = true;
    }, () => alive);
    if (!alive) return;
    o.onReady();
    dirty = true;
    loadQueue(fine, 4, (item, img) => { if (img) { frames[item.i] = img; dirty = true; } }, () => alive);
  }

  function onResize() {
    // Ignore the small height changes from mobile address bars hiding/showing.
    const w = window.innerWidth, h = window.innerHeight;
    if (w !== vw || Math.abs(h - vh) > 140) {
      const u = window.scrollY / vh;
      vw = w; vh = h;
      layout();
      window.scrollTo(0, u * vh);
    } else {
      layout();
    }
    readScroll();
  }

  layout();
  readScroll();
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", onResize);
  desktopMQ.addEventListener("change", layout);
  raf = requestAnimationFrame(tick);
  preload();

  return {
    scrollToEvent(k: number) {
      const seg = segs.find((s) => s.type === "hold" && s.k === k)!;
      const u = k === 0 ? 0 : seg.start + seg.len * 0.5;
      window.scrollTo({ top: u * vh, behavior: reduceMotion ? "auto" : "smooth" });
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", onResize);
      desktopMQ.removeEventListener("change", layout);
    },
  };
}
