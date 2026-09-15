"use client";

import { useEffect, type RefObject } from "react";
import { normalizePointer, sectionProgress } from "./landing-motion";

function setNumber(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, value.toFixed(4));
}

/** Coordinates restrained reveals, scroll progress, and local pointer depth. */
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealItems = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    const progressItems = [
      ...root.querySelectorAll<HTMLElement>("[data-scroll-progress]"),
    ];
    const tiltItems = [...root.querySelectorAll<HTMLElement>("[data-tilt]")];
    const motionGroups = [
      ...root.querySelectorAll<HTMLElement>("[data-motion-group]"),
    ];
    let frame = 0;
    let disposed = false;

    root.dataset.motionReady = "true";

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            (entry.target as HTMLElement).dataset.visible = "true";
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8%" },
    );
    revealItems.forEach((item) => revealObserver.observe(item));

    const motionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).dataset.active = entry.isIntersecting
            ? "true"
            : "false";
      },
      { threshold: 0.12, rootMargin: "-6% 0px -8%" },
    );
    motionGroups.forEach((group) => motionObserver.observe(group));

    const sequenceCleanups = motionGroups.flatMap((group) => {
      if (!group.hasAttribute("data-motion-sequence")) return [];
      const steps = [
        ...group.querySelectorAll<HTMLElement>("[data-motion-step]"),
      ];
      if (!steps.length) return [];
      let activeIndex = 0;
      const activate = (index: number) => {
        activeIndex = index;
        steps.forEach((step, stepIndex) => {
          step.dataset.motionActive = stepIndex === activeIndex ? "true" : "false";
        });
      };
      activate(activeIndex);
      const timer = window.setInterval(() => {
        if (
          group.dataset.active !== "true" ||
          root.dataset.paused === "true" ||
          reduce.matches ||
          document.hidden
        )
          return;
        activate((activeIndex + 1) % steps.length);
      }, 3600);
      const listeners = steps.map((step, stepIndex) => {
        const select = () => activate(stepIndex);
        step.addEventListener("pointerenter", select);
        step.addEventListener("focusin", select);
        return () => {
          step.removeEventListener("pointerenter", select);
          step.removeEventListener("focusin", select);
        };
      });
      return [() => {
        window.clearInterval(timer);
        listeners.forEach((remove) => remove());
        steps.forEach((step) => delete step.dataset.motionActive);
      }];
    });

    const draw = () => {
      frame = 0;
      if (disposed || document.hidden) return;
      if (root.dataset.paused === "true") return;
      for (const item of progressItems) {
        const rect = item.getBoundingClientRect();
        const progress = reduce.matches
          ? 0
          : sectionProgress(rect.top, rect.height, window.innerHeight, 80);
        setNumber(item, "--motion-progress", progress);
      }
      if (reduce.matches)
        revealItems.forEach((item) => {
          item.dataset.visible = "true";
        });
    };

    const schedule = () => {
      if (!frame && !disposed && !document.hidden)
        frame = requestAnimationFrame(draw);
    };

    const pauseObserver = new MutationObserver(() => {
      if (root.dataset.paused !== "true") schedule();
    });
    pauseObserver.observe(root, {
      attributes: true,
      attributeFilter: ["data-paused"],
    });

    const tiltCleanups = tiltItems.map((item) => {
      let pointerFrame = 0;
      let x = 0;
      let y = 0;
      const paint = () => {
        pointerFrame = 0;
        setNumber(item, "--tilt-x", x);
        setNumber(item, "--tilt-y", y);
      };
      const queue = () => {
        if (!pointerFrame) pointerFrame = requestAnimationFrame(paint);
      };
      const move = (event: PointerEvent) => {
        if (
          reduce.matches ||
          root.dataset.paused === "true" ||
          event.pointerType !== "mouse"
        )
          return;
        const rect = item.getBoundingClientRect();
        x = normalizePointer(event.clientX, rect.left, rect.width);
        y = normalizePointer(event.clientY, rect.top, rect.height);
        queue();
      };
      const reset = () => {
        x = 0;
        y = 0;
        queue();
      };

      item.addEventListener("pointermove", move, { passive: true });
      item.addEventListener("pointerleave", reset);
      return () => {
        cancelAnimationFrame(pointerFrame);
        item.removeEventListener("pointermove", move);
        item.removeEventListener("pointerleave", reset);
      };
    });

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        schedule();
      }
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener("change", schedule);
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    schedule();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      revealObserver.disconnect();
      motionObserver.disconnect();
      pauseObserver.disconnect();
      resizeObserver.disconnect();
      sequenceCleanups.forEach((cleanup) => cleanup());
      motionGroups.forEach((group) => delete group.dataset.active);
      tiltCleanups.forEach((cleanup) => cleanup());
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", schedule);
      delete root.dataset.motionReady;
    };
  }, [rootRef]);
}
