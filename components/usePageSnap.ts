"use client";

import { useEffect } from "react";

export function usePageSnap(sectionSelector: string) {
  useEffect(() => {
    document.documentElement.classList.add("page-snap");

    const desktopQuery = window.matchMedia("(min-width: 981px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let wheelGestureActive = false;
    let navigationLocked = false;
    let wheelEndTimer: number | undefined;
    let navigationTimer: number | undefined;

    const getSnapPositions = () => {
      const headerHeight = document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const positions = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector))
        .map((section) => Math.min(maxScroll, Math.max(0, section.offsetTop - headerHeight)));

      if (positions.length && maxScroll - positions[positions.length - 1] > 8) {
        positions.push(maxScroll);
      }

      return positions.filter((position, index) => index === 0 || position !== positions[index - 1]);
    };

    const moveToAdjacentSection = (direction: -1 | 1) => {
      if (!desktopQuery.matches || navigationLocked) return;

      const positions = getSnapPositions();
      if (!positions.length) return;

      const currentIndex = positions.reduce((closestIndex, position, index) => (
        Math.abs(position - window.scrollY) < Math.abs(positions[closestIndex] - window.scrollY)
          ? index
          : closestIndex
      ), 0);
      const nextIndex = Math.min(positions.length - 1, Math.max(0, currentIndex + direction));

      if (nextIndex === currentIndex && Math.abs(window.scrollY - positions[currentIndex]) < 2) return;

      navigationLocked = true;
      window.scrollTo({
        top: positions[nextIndex],
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
      });

      window.clearTimeout(navigationTimer);
      navigationTimer = window.setTimeout(() => {
        navigationLocked = false;
      }, reducedMotionQuery.matches ? 80 : 560);
    };

    const handleWheel = (event: WheelEvent) => {
      if (!desktopQuery.matches || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      window.clearTimeout(wheelEndTimer);
      wheelEndTimer = window.setTimeout(() => {
        wheelGestureActive = false;
      }, 220);

      if (wheelGestureActive || Math.abs(event.deltaY) < 2) return;

      wheelGestureActive = true;
      moveToAdjacentSection(event.deltaY > 0 ? 1 : -1);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!desktopQuery.matches || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        moveToAdjacentSection(1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        moveToAdjacentSection(-1);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.classList.remove("page-snap");
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(wheelEndTimer);
      window.clearTimeout(navigationTimer);
    };
  }, [sectionSelector]);
}
