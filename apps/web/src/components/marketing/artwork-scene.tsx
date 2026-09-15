"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import styles from "./design-landing.module.css";

export const landingArtPath =
  "/images/landing-art/iconsax-motion-study-2026-09-13";

export type StyleArtwork = { id: string; label: string; src: string };

export const galleryArtwork = {
  lighthouse: `${landingArtPath}/styles/clay-3d.png`,
  teapot: `${landingArtPath}/gallery/teapot.png`,
  ginkgo: `${landingArtPath}/gallery/ginkgo.png`,
  shelter: `${landingArtPath}/gallery/alpine-shelter.png`,
};

type Ripple = { x: number; y: number; bornAt: number };

/** A fixed, low-contrast drawing field that responds to scroll, pointer distance, and clicks. */
export function AmbientGridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: -1000, y: -1000, active: false };
    const ripples: Ripple[] = [];
    let width = 1;
    let height = 1;
    let frame = 0;
    let disposed = false;

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number) => {
      frame = 0;
      if (disposed || document.hidden) return;
      context.clearRect(0, 0, width, height);
      const spacing = width < 760 ? 32 : 40;
      const yOffset = reduce.matches ? 0 : (-window.scrollY * 0.4) % spacing;

      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = yOffset - spacing; y < height + spacing; y += spacing) {
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          const proximity = pointer.active
            ? Math.max(0, 1 - distance / 150)
            : 0;
          let ring = 0;
          for (const ripple of ripples) {
            const radius = ((now - ripple.bornAt) / 800) * 600;
            const gap = Math.abs(
              Math.hypot(x - ripple.x, y - ripple.y) - radius,
            );
            ring = Math.max(ring, Math.max(0, 1 - gap / 36));
          }
          const alpha = Math.min(0.52, 0.09 + proximity * 0.34 + ring * 0.4);
          context.beginPath();
          context.fillStyle =
            ring > proximity
              ? `rgba(216, 75, 50, ${alpha})`
              : `rgba(241, 238, 230, ${alpha})`;
          context.arc(
            x,
            y,
            1 + Math.max(proximity, ring) * 1.2,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }

      while (ripples.length && now - ripples[0].bornAt > 950) ripples.shift();
      if (ripples.length) frame = requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = event.pointerType === "mouse";
      schedule();
    };
    const leave = () => {
      pointer.active = false;
      schedule();
    };
    const click = (event: PointerEvent) => {
      if (reduce.matches) return;
      ripples.push({
        x: event.clientX,
        y: event.clientY,
        bornAt: performance.now(),
      });
      schedule();
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", click, { passive: true });
    reduce.addEventListener("change", schedule);
    schedule();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", click);
      reduce.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={styles.ambientGrid} aria-hidden="true" />
  );
}

function ArtworkImage({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      preload={priority}
      sizes="(max-width: 760px) 84vw, 760px"
    />
  );
}

export function HeroKineticStage({
  alt,
  styleArtwork,
}: {
  alt: string;
  styleArtwork: StyleArtwork[];
}) {
  return (
    <div className={styles.heroStage} data-pointer-depth>
      <div className={styles.heroStageGrid} aria-hidden="true" />
      <div className={styles.heroIndex} aria-hidden="true">
        EI 09
      </div>
      <div
        className={`${styles.heroObject} ${styles.heroTeapot}`}
        aria-hidden="true"
      >
        <ArtworkImage src={galleryArtwork.teapot} alt="" />
      </div>
      <div
        className={`${styles.heroObject} ${styles.heroGinkgo}`}
        aria-hidden="true"
      >
        <ArtworkImage src={galleryArtwork.ginkgo} alt="" />
      </div>
      <div
        className={`${styles.heroObject} ${styles.heroShelter}`}
        aria-hidden="true"
      >
        <ArtworkImage src={galleryArtwork.shelter} alt="" />
      </div>
      <div className={styles.heroPlate}>
        <span className={styles.heroPlateLine} aria-hidden="true" />
        <div className={styles.heroPlateGhost} aria-hidden="true">
          <ArtworkImage src={galleryArtwork.lighthouse} alt="" />
        </div>
        <div className={styles.heroPlateArtwork}>
          <ArtworkImage src={galleryArtwork.lighthouse} alt={alt} priority />
        </div>
        <div className={styles.heroPlateMask} aria-hidden="true">
          <ArtworkImage src={galleryArtwork.lighthouse} alt="" />
        </div>
      </div>
      <div className={styles.heroStyleTicker} aria-hidden="true">
        <div>
          {[...styleArtwork, ...styleArtwork].map((item, index) => (
            <span key={`${item.id}-${index}`}>
              {String((index % styleArtwork.length) + 1).padStart(2, "0")}{" "}
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.heroRegistration} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function StatementArtwork({ alt }: { alt: string }) {
  return (
    <div className={styles.statementArtwork} data-pointer-depth>
      <div className={styles.statementSheetBack} aria-hidden="true" />
      <div className={styles.statementSheet}>
        <div className={styles.statementCrop}>
          <ArtworkImage src={galleryArtwork.lighthouse} alt={alt} />
        </div>
        <div className={styles.statementScale} aria-hidden="true">
          <span>24</span>
          <span>64</span>
          <span>128</span>
        </div>
      </div>
      <div className={styles.statementType} aria-hidden="true">
        NINE
        <br />
        WAYS
        <br />
        TO SEE
      </div>
    </div>
  );
}

function MiniArtwork({ src, alt = "" }: { src: string; alt?: string }) {
  return (
    <span className={styles.miniArtwork}>
      <Image src={src} alt={alt} fill sizes="180px" />
    </span>
  );
}

export function CapabilityBento({
  styleArtwork,
  labels,
}: {
  styleArtwork: StyleArtwork[];
  labels: string[];
}) {
  return (
    <div className={styles.capabilityGrid}>
      <article
        className={`${styles.capabilityCard} ${styles.capabilityStyles}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>01</span>
          <p>{labels[0]}</p>
        </div>
        <div className={styles.styleStack} aria-hidden="true">
          {styleArtwork.slice(0, 4).map((item, index) => (
            <span
              key={item.id}
              style={{ "--card-index": index } as CSSProperties}
            >
              <MiniArtwork src={item.src} />
            </span>
          ))}
        </div>
      </article>

      <article
        className={`${styles.capabilityCard} ${styles.capabilityComposition}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>02</span>
          <p>{labels[1]}</p>
        </div>
        <div className={styles.compositionStage} aria-hidden="true">
          <div className={styles.compositionFrame}>
            <MiniArtwork src={galleryArtwork.lighthouse} />
          </div>
          <div className={styles.compositionFrame}>
            <MiniArtwork src={galleryArtwork.lighthouse} />
          </div>
          <div className={styles.compositionFrame}>
            <MiniArtwork src={galleryArtwork.lighthouse} />
          </div>
        </div>
      </article>

      <article
        className={`${styles.capabilityCard} ${styles.capabilityBackground}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>03</span>
          <p>{labels[2]}</p>
        </div>
        <div className={styles.backgroundStage} aria-hidden="true">
          <div className={styles.backgroundSwatch} />
          <MiniArtwork src={galleryArtwork.ginkgo} />
          <div className={styles.backgroundNames}>
            <span>ALPHA</span>
            <span>SOLID</span>
            <span>GRADIENT</span>
          </div>
        </div>
      </article>

      <article
        className={`${styles.capabilityCard} ${styles.capabilityOptions}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>04</span>
          <p>{labels[3]}</p>
        </div>
        <div className={styles.optionTriptych} aria-hidden="true">
          {styleArtwork.slice(4, 7).map((item) => (
            <MiniArtwork key={item.id} src={item.src} />
          ))}
        </div>
      </article>

      <article
        className={`${styles.capabilityCard} ${styles.capabilityDetail}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>05</span>
          <p>{labels[4]}</p>
        </div>
        <div className={styles.detailLens} aria-hidden="true">
          <MiniArtwork
            src={styleArtwork[7]?.src ?? galleryArtwork.lighthouse}
          />
          <span className={styles.detailSweep} />
        </div>
      </article>

      <article
        className={`${styles.capabilityCard} ${styles.capabilityExport}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>06</span>
          <p>{labels[5]}</p>
        </div>
        <div className={styles.exportSizes} aria-hidden="true">
          {[24, 64, 128].map((size, index) => (
            <div key={size} style={{ "--size-index": index } as CSSProperties}>
              <MiniArtwork src={galleryArtwork.teapot} />
              <span>{size}</span>
            </div>
          ))}
        </div>
      </article>

      <article
        className={`${styles.capabilityCard} ${styles.capabilityPng}`}
        data-pointer-depth
      >
        <div className={styles.cardMeta}>
          <span>07</span>
          <p>{labels[6]}</p>
        </div>
        <div className={styles.pngStage} aria-hidden="true">
          <div className={styles.pngRing}>
            <MiniArtwork src={galleryArtwork.shelter} />
          </div>
          <strong>PNG</strong>
        </div>
      </article>
    </div>
  );
}

export function StyleDepthGrid({
  artwork,
  title,
}: {
  artwork: StyleArtwork[];
  title: string;
}) {
  return (
    <div className={styles.styleDepthGrid} data-pointer-depth>
      <p className={styles.styleDepthTitle}>{title}</p>
      {artwork.map((item, index) => (
        <article
          className={styles.styleDepthCell}
          key={item.id}
          style={{ "--style-index": index } as CSSProperties}
        >
          <span className={styles.styleCellNumber}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className={styles.styleCellLayers}>
            <span className={styles.styleCellBack} aria-hidden="true">
              <MiniArtwork src={item.src} />
            </span>
            <span className={styles.styleCellMid} aria-hidden="true">
              <MiniArtwork src={item.src} />
            </span>
            <MiniArtwork src={item.src} alt={item.label} />
          </div>
          <p>{item.label}</p>
        </article>
      ))}
    </div>
  );
}

function useDragRail(ref: RefObject<HTMLDivElement | null>) {
  const state = useRef({
    dragging: false,
    start: 0,
    base: 0,
    offset: 0,
    velocity: 0,
    lastX: 0,
    frame: 0,
  });
  useEffect(() => () => cancelAnimationFrame(state.current.frame), []);
  const paint = () =>
    ref.current?.style.setProperty(
      "--drag-offset",
      `${state.current.offset.toFixed(1)}px`,
    );
  const release = () => {
    if (!state.current.dragging) return;
    state.current.dragging = false;
    if (ref.current) ref.current.dataset.dragging = "false";
    const coast = () => {
      state.current.velocity *= 0.92;
      state.current.offset += state.current.velocity;
      paint();
      if (Math.abs(state.current.velocity) > 0.08)
        state.current.frame = requestAnimationFrame(coast);
    };
    cancelAnimationFrame(state.current.frame);
    state.current.frame = requestAnimationFrame(coast);
  };
  return {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      cancelAnimationFrame(state.current.frame);
      state.current.dragging = true;
      state.current.start = event.clientX;
      state.current.lastX = event.clientX;
      state.current.base = state.current.offset;
      state.current.velocity = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = "true";
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (!state.current.dragging) return;
      const delta = event.clientX - state.current.lastX;
      state.current.lastX = event.clientX;
      state.current.velocity = delta;
      state.current.offset =
        state.current.base + event.clientX - state.current.start;
      paint();
    },
    onPointerUp: release,
    onPointerCancel: release,
  };
}

export function ShowcaseRail({
  artwork,
  label,
}: {
  artwork: StyleArtwork[];
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useDragRail(ref);
  const items = [...artwork, ...artwork];
  return (
    <div className={styles.showcaseRail} ref={ref} {...drag} aria-label={label}>
      <div className={styles.showcaseTrack}>
        {items.map((item, index) => (
          <figure key={`${item.id}-${index}`} className={styles.showcaseItem}>
            <MiniArtwork
              src={item.src}
              alt={index < artwork.length ? item.label : ""}
            />
            <figcaption>
              {String((index % artwork.length) + 1).padStart(2, "0")}{" "}
              {item.label}
            </figcaption>
          </figure>
        ))}
      </div>
      <div
        className={`${styles.showcaseTrack} ${styles.showcaseTrackReverse}`}
        aria-hidden="true"
      >
        {[...items].reverse().map((item, index) => (
          <figure
            key={`reverse-${item.id}-${index}`}
            className={styles.showcaseItem}
          >
            <MiniArtwork src={item.src} />
            <figcaption>
              {String((index % artwork.length) + 1).padStart(2, "0")}{" "}
              {item.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function GenerationStage({ labels }: { labels: string[] }) {
  return (
    <div className={styles.generationStage} data-pointer-depth>
      <div className={styles.generationPrompt}>
        <span>{labels[0]}</span>
        <p>{labels[1]}</p>
        <i aria-hidden="true" />
      </div>
      <div className={styles.generationSubject}>
        <ArtworkImage src={galleryArtwork.shelter} alt={labels[2]} />
      </div>
      <div className={styles.generationEcho} aria-hidden="true">
        <MiniArtwork src={galleryArtwork.ginkgo} />
        <MiniArtwork src={galleryArtwork.teapot} />
      </div>
      <div className={styles.generationBands} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function OutputStage({ label }: { label: string }) {
  return (
    <div className={styles.outputStage} data-pointer-depth aria-label={label}>
      <div className={styles.outputMaster}>
        <ArtworkImage src={galleryArtwork.lighthouse} alt={label} />
      </div>
      <div className={styles.outputMeasures} aria-hidden="true">
        {["ORIGINAL", "128", "64", "24"].map((size, index) => (
          <div key={size} style={{ "--output-index": index } as CSSProperties}>
            <MiniArtwork src={galleryArtwork.lighthouse} />
            <span>{size}</span>
          </div>
        ))}
      </div>
      <div className={styles.outputBaseline} aria-hidden="true" />
    </div>
  );
}

export function GalleryTriptych({ labels }: { labels: string[] }) {
  const items = [
    galleryArtwork.teapot,
    galleryArtwork.ginkgo,
    galleryArtwork.shelter,
  ];
  return (
    <div className={styles.galleryTriptych} data-pointer-depth>
      {items.map((src, index) => (
        <figure key={src} style={{ "--gallery-index": index } as CSSProperties}>
          <MiniArtwork src={src} alt={labels[index]} />
          <figcaption>{labels[index]}</figcaption>
        </figure>
      ))}
    </div>
  );
}

type PhysicsBody = {
  angle: number;
  angularVelocity: number;
  image: number;
  radius: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

/** An original icon field with gravity, collisions, pointer force, and click-to-spawn. */
export function PhysicsIconField({ artwork }: { artwork: StyleArtwork[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const images = artwork.map((item) => {
      const image = document.createElement("img");
      image.decoding = "async";
      image.src = item.src;
      return image;
    });
    const bodies: PhysicsBody[] = [];
    const pointer = {
      x: -1000,
      y: -1000,
      active: false,
      pressed: false,
      lastSpawn: 0,
    };
    let width = 1;
    let height = 1;
    let frame = 0;
    let visible = true;
    let disposed = false;
    let previous = performance.now();

    const makeBody = (
      x = Math.random() * width,
      y = Math.random() * Math.max(1, height * 0.55),
    ): PhysicsBody => ({
      angle: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() - 0.5) * 0.045,
      image: Math.floor(Math.random() * Math.max(1, images.length)),
      radius: 20 + Math.random() * 14,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 0.8,
      x,
      y,
    });

    const seed = () => {
      bodies.length = 0;
      const count = width < 680 ? 34 : 72;
      for (let index = 0; index < count; index += 1) {
        const body = makeBody();
        body.x =
          body.radius + Math.random() * Math.max(1, width - body.radius * 2);
        body.y =
          body.radius + Math.random() * Math.max(1, height - body.radius * 2);
        bodies.push(body);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
    };

    const collide = () => {
      for (let first = 0; first < bodies.length; first += 1) {
        const a = bodies[first];
        for (let second = first + 1; second < bodies.length; second += 1) {
          const b = bodies[second];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minimum = (a.radius + b.radius) * 0.7;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared >= minimum * minimum || distanceSquared === 0)
            continue;
          const distance = Math.sqrt(distanceSquared);
          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = (minimum - distance) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const impulse = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (impulse < 0) {
            a.vx += impulse * nx * 0.55;
            a.vy += impulse * ny * 0.55;
            b.vx -= impulse * nx * 0.55;
            b.vy -= impulse * ny * 0.55;
          }
        }
      }
    };

    const render = (now: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const delta = Math.min(2, Math.max(0.35, (now - previous) / 16.67));
      previous = now;
      context.clearRect(0, 0, width, height);
      const root = canvas.closest<HTMLElement>("[data-paused]");
      const stopped = root?.dataset.paused === "true" || reduce.matches;

      if (!stopped) {
        for (const body of bodies) {
          const dx = body.x - pointer.x;
          const dy = body.y - pointer.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          if (pointer.active && distance < 130) {
            const force =
              (1 - distance / 130) * (pointer.pressed ? -0.09 : 0.06);
            body.vx += (dx / distance) * force * delta;
            body.vy += (dy / distance) * force * delta;
          }
          body.vy += 0.025 * delta;
          body.vx *= Math.pow(0.998, delta);
          body.vy *= Math.pow(0.998, delta);
          body.x += body.vx * delta;
          body.y += body.vy * delta;
          body.angle += body.angularVelocity * delta;

          if (body.x < body.radius) {
            body.x = body.radius;
            body.vx = Math.abs(body.vx) * 0.72;
          }
          if (body.x > width - body.radius) {
            body.x = width - body.radius;
            body.vx = -Math.abs(body.vx) * 0.72;
          }
          if (body.y < body.radius) {
            body.y = body.radius;
            body.vy = Math.abs(body.vy) * 0.72;
          }
          if (body.y > height - body.radius) {
            body.y = height - body.radius;
            body.vy = -Math.max(0.55, Math.abs(body.vy) * 0.72);
          }
        }
        collide();
      }

      for (const body of bodies) {
        const image = images[body.image];
        context.save();
        context.translate(body.x, body.y);
        context.rotate(body.angle);
        if (image?.complete && image.naturalWidth) {
          context.drawImage(
            image,
            -body.radius,
            -body.radius,
            body.radius * 2,
            body.radius * 2,
          );
        } else {
          context.fillStyle =
            body.image % 3 === 0
              ? "#d84b32"
              : body.image % 3 === 1
                ? "#f0c870"
                : "#68766a";
          context.beginPath();
          context.arc(0, 0, body.radius * 0.72, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }
      frame = requestAnimationFrame(render);
    };

    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      if (
        pointer.pressed &&
        performance.now() - pointer.lastSpawn > 70 &&
        bodies.length < 100
      ) {
        bodies.push(makeBody(pointer.x, pointer.y));
        pointer.lastSpawn = performance.now();
      }
    };
    const down = (event: PointerEvent) => {
      pointer.pressed = true;
      point(event);
      if (bodies.length < 100) bodies.push(makeBody(pointer.x, pointer.y));
      canvas.setPointerCapture(event.pointerId);
    };
    const up = () => {
      pointer.pressed = false;
    };
    const leave = () => {
      pointer.active = false;
      pointer.pressed = false;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !frame) {
          previous = performance.now();
          frame = requestAnimationFrame(render);
        }
      },
      { rootMargin: "200px" },
    );
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(canvas);
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointermove", point, { passive: true });
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", leave);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", point);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, [artwork]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.physicsField}
      aria-hidden="true"
    />
  );
}
