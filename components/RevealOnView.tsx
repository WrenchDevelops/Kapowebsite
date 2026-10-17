"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const pendingSelector = ".reveal:not(.in-view), .reveal-section:not(.in-view)";

export function RevealOnView() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let secondFrame = 0;

    const pending = () => document.querySelectorAll<HTMLElement>(pendingSelector);

    const reveal = (element: HTMLElement) => {
      element.classList.add("in-view");
    };

    const showOnScreen = () => {
      pending().forEach((element) => {
        const box = element.getBoundingClientRect();
        const onScreen = box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
        if (reducedMotion || onScreen) reveal(element);
        else observer.observe(element);
      });
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "120px 0px", threshold: 0 });

    const settlePage = () => {
      const hash = window.location.hash.slice(1);
      const target = hash ? document.getElementById(hash) : null;
      if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
      else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      showOnScreen();
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(showOnScreen);
    };

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    showOnScreen();
    settlePage();
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(settlePage);
    });
    const settleTimer = window.setTimeout(settlePage, 50);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [pathname]);

  return null;
}
