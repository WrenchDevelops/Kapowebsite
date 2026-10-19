"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SocialLinks } from "@/components/SocialLinks";
import { usePageSnap } from "@/components/usePageSnap";
import { SUPPORT_EMAIL } from "@/lib/store-facts";

const characters = [
  {
    name: "Spore",
    artisan: "/products/spore-artisan.png",
    flat: "/products/spore-flat.png",
    story: "A tiny forest guide who always takes the scenic route.",
  },
  {
    name: "Gloop",
    artisan: "/products/gloop-artisan.png",
    flat: "/products/gloop-flat.png",
    story: "A lovable lab escapee with zero chill and endless curiosity.",
  },
  {
    name: "Rango",
    artisan: "/products/rango-artisan.png",
    flat: "/products/rango-flat.png",
    story: "A pocket-sized sheriff with a giant sense of adventure.",
  },
  {
    name: "Brine",
    artisan: "/products/brine-artisan.png",
    flat: "/products/brine-flat.png",
    story: "A deep-sea dreamer charting strange corners of the desktop.",
  },
  {
    name: "Bitz",
    artisan: "/products/bitz-artisan.png",
    flat: "/products/bitz-flat.png",
    story: "An arcade regular who treats every shortcut like a high score.",
  },
  {
    name: "Orbit",
    artisan: "/products/orbit-artisan.png",
    flat: "/products/orbit-flat.png",
    story: "An eager explorer collecting keyboard signals from the stars.",
  },
  {
    name: "Kobi",
    artisan: "/products/kobi-artisan.png",
    flat: "/products/kobi-flat.png",
    story: "A calm garden guardian who moves only when the timing is right.",
  },
  {
    name: "Rivet",
    artisan: "/products/rivet-artisan.png",
    flat: "/products/rivet-flat.png",
    story: "A cheerful tinkerer who can fix almost anything before lunch.",
  },
];

const videos = [
  { title: "Printing Spore", image: "/products/spore-artisan.png", alt: "" },
  { title: "Designing a character", image: "/products/rivet-flat.png", alt: "" },
  { title: "Packaging", image: "/products/kapo-packaging.jpg", alt: "Gloop packed in a KAPO box", fit: "contain" as const },
];

function ArrowLink({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span>{children}</span>
      <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
    </>
  );
}

export default function Home() {
  const [macropadMode, setMacropadMode] = useState<"bare" | "artisan">("artisan");
  const [macropadForSale, setMacropadForSale] = useState(false);
  const [baseColor, setBaseColor] = useState<"white" | "black">("white");
  const [crewStyle, setCrewStyle] = useState<"flat" | "artisan">("artisan");
  const [crewPage, setCrewPage] = useState(0);
  const [crewItemsPerPage, setCrewItemsPerPage] = useState(4);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/catalog/launch")
      .then((response) => response.json())
      .then((body: { macropad?: { published?: boolean; forSale?: boolean; priceCents?: number | null; inventory?: number | null } }) => {
        const pad = body.macropad;
        if (!cancel && pad?.published && pad.forSale && (pad.priceCents ?? 0) > 0 && pad.inventory !== 0) setMacropadForSale(true);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  usePageSnap(".slide");

  useEffect(() => {
    document.documentElement.classList.add("has-js");

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal-section"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.22 },
    );

    sections.forEach((section) => observer.observe(section));

    const handleResize = () => {
      const width = window.innerWidth;
      const itemsPerPage = width <= 680 ? 1 : width <= 1100 ? 2 : 4;
      setCrewItemsPerPage(itemsPerPage);
      setCrewPage((page) => Math.min(page, Math.ceil(characters.length / itemsPerPage) - 1));
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      document.documentElement.classList.remove("has-js");
    };
  }, []);

  const crewTouch = useRef({ x: 0, y: 0 });
  const storyTouch = useRef({ x: 0, y: 0 });
  const activeMacropad = `${baseColor}-${macropadMode}`;
  const crewPageCount = Math.ceil(characters.length / crewItemsPerPage);
  const activeStory = characters[storyIndex];

  const changeCrewStyle = (style: "flat" | "artisan") => {
    setCrewStyle(style);
    setCrewPage(0);
  };

  const moveCrew = (direction: number) => {
    setCrewPage((page) => (page + direction + crewPageCount) % crewPageCount);
  };

  const moveStory = (direction: number) => {
    setStoryIndex((index) => (index + direction + characters.length) % characters.length);
  };

  const swipeHandlers = (
    touch: React.MutableRefObject<{ x: number; y: number }>,
    onSwipe: (direction: number) => void,
  ) => ({
    onTouchStart: (event: React.TouchEvent) => {
      const point = event.changedTouches[0];
      touch.current = { x: point.clientX, y: point.clientY };
    },
    onTouchEnd: (event: React.TouchEvent) => {
      const point = event.changedTouches[0];
      const dx = point.clientX - touch.current.x;
      const dy = point.clientY - touch.current.y;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
  });

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || storyPaused) return;

    const section = document.getElementById("world");
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    }, { threshold: 0.45 });
    if (section) observer.observe(section);

    const timer = window.setInterval(() => {
      if (!visible || document.hidden) return;
      setStoryIndex((index) => (index + 1) % characters.length);
    }, 5000);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [storyPaused, storyIndex]);

  return (
    <div className="site-shell">
      <main id="main-content" className="slides">
        <section id="hero" className="slide hero-slide" aria-labelledby="hero-title">
          <div className="slide-inner hero-grid">
            <div className="hero-copy">
              <p className="eyebrow hero-step hero-step-1">Original characters. For your keyboard.</p>
              <h1 id="hero-title" className="hero-step hero-step-2">Keycaps with<br />character.</h1>
              <p className="hero-subtitle hero-step hero-step-3">
                Eight original characters.<br />Available in Flat and Artisan.
              </p>
              <div className="hero-actions hero-step hero-step-4">
                <Link className="button button-dark" href="/shop"><ArrowLink>Shop the collection</ArrowLink></Link>
                <Link className="text-link" href="/characters"><ArrowLink>Meet the characters</ArrowLink></Link>
              </div>
              <p className="hero-note hero-step hero-step-5">8 characters · Flat + Artisan · MX compatible</p>
            </div>
            <div className="hero-media">
              <img src="/products/kapo-crew.jpg" alt="Eight artisan KAPO keycaps displayed on a white platform" />
            </div>
          </div>
        </section>

        <section id="crew" className="slide reveal-section crew-slide" aria-labelledby="crew-title">
          <div className="slide-inner crew-layout">
            <header className="slide-heading crew-heading reveal-target">
              <div>
                <p className="slide-number">02 / 07</p>
                <h2 id="crew-title">Meet the KAPO crew.</h2>
              </div>
              <div className="carousel-toolbar">
                <div className="minimal-switch" role="group" aria-label="Choose keycap style">
                  <button type="button" className={crewStyle === "flat" ? "active" : ""} onClick={() => changeCrewStyle("flat")} aria-pressed={crewStyle === "flat"}>Flat</button>
                  <button type="button" className={crewStyle === "artisan" ? "active" : ""} onClick={() => changeCrewStyle("artisan")} aria-pressed={crewStyle === "artisan"}>Artisan</button>
                </div>
                <span className="carousel-count">{String(crewPage + 1).padStart(2, "0")} / {String(crewPageCount).padStart(2, "0")}</span>
                <div className="carousel-arrows">
                  <button type="button" onClick={() => moveCrew(-1)} aria-label="Previous KAPO characters"><ChevronLeft aria-hidden="true" /></button>
                  <button type="button" onClick={() => moveCrew(1)} aria-label="Next KAPO characters"><ChevronRight aria-hidden="true" /></button>
                </div>
              </div>
            </header>
            <div className="crew-carousel reveal-target" {...swipeHandlers(crewTouch, moveCrew)}>
              <div
                className="crew-track"
                style={{
                  "--crew-page": crewPage,
                  "--crew-items": crewItemsPerPage,
                  transform: `translate3d(-${crewPage * 100}%, 0, 0)`,
                } as React.CSSProperties}
              >
                {characters.map((character) => (
                  <Link className="crew-item" href={`/characters/${character.name.toLowerCase()}`} key={character.name}>
                    <div className="crew-image">
                      <img src={character[crewStyle]} alt={`${character.name} ${crewStyle} keycap`} loading="lazy" />
                    </div>
                    <div className="crew-meta">
                      <h3>{character.name}</h3>
                      <div><span>Flat $6.99</span><span>Artisan $11.99</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="styles" className="slide reveal-section styles-slide" aria-labelledby="styles-title">
          <div className="slide-inner styles-grid">
            <div className="styles-intro reveal-target">
              <div>
                <p className="eyebrow">Choose your style</p>
                <h2 id="styles-title">Same character.<br />Two ways to use it.</h2>
              </div>
              <p>Everyday or collectible.</p>
            </div>

            <article className="style-panel flat-panel reveal-target">
              <p className="panel-label">Flat</p>
              <div className="style-product">
                <img src="/products/spore-flat.png" alt="Spore Flat keycap" loading="lazy" />
              </div>
              <div className="style-details price-reveal">
                <span>$6.99</span>
                <p>Low-profile.<br />Made for everyday use.</p>
              </div>
            </article>

            <article className="style-panel artisan-panel reveal-target">
              <p className="panel-label">Artisan</p>
              <div className="style-product">
                <img src="/products/spore-artisan.png" alt="Spore Artisan keycap" loading="lazy" />
              </div>
              <div className="style-details price-reveal">
                <span>$11.99</span>
                <p>Fully sculpted.<br />Made to stand out.</p>
              </div>
            </article>
          </div>
        </section>

        <section
          id="world"
          className="slide reveal-section world-slide"
          aria-labelledby="world-title"
          onMouseEnter={() => setStoryPaused(true)}
          onMouseLeave={() => setStoryPaused(false)}
          onFocus={() => setStoryPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStoryPaused(false);
          }}
        >
          <div className="slide-inner world-grid">
            <div className="world-intro reveal-target">
              <p className="slide-number">04 / 07</p>
              <h2 id="world-title">More than<br />keycaps.</h2>
              <p className="world-lead">Every character has a little story of their own.</p>
              <div className="story-controls">
                <span className="carousel-count">{String(storyIndex + 1).padStart(2, "0")} / {String(characters.length).padStart(2, "0")}</span>
                <div className="carousel-arrows">
                  <button type="button" onClick={() => moveStory(-1)} aria-label="Previous character story"><ChevronLeft aria-hidden="true" /></button>
                  <button type="button" onClick={() => moveStory(1)} aria-label="Next character story"><ChevronRight aria-hidden="true" /></button>
                </div>
              </div>
            </div>
            <div className="story-carousel reveal-target" {...swipeHandlers(storyTouch, moveStory)}>
              <article className="story-card" key={activeStory.name}>
                <div className="story-image"><img src={activeStory.artisan} alt={`${activeStory.name} artisan keycap character`} /></div>
                <div className="story-copy">
                  <p className="eyebrow">Character {String(storyIndex + 1).padStart(2, "0")}</p>
                  <h3>{activeStory.name}</h3>
                  <p>{activeStory.story}</p>
                  <Link className="text-link" href={`/characters/${activeStory.name.toLowerCase()}`}><ArrowLink>Meet {activeStory.name}</ArrowLink></Link>
                </div>
              </article>
              <div className="story-index" aria-label="Choose a character story">
                {characters.map((character, index) => (
                  <button type="button" className={storyIndex === index ? "active" : ""} onClick={() => setStoryIndex(index)} aria-label={`Show ${character.name}'s story`} aria-pressed={storyIndex === index} key={character.name}>{character.name}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="macropad" className="slide reveal-section macropad-slide" aria-labelledby="macropad-title">
          <div className="slide-inner macropad-grid">
            <div className="macropad-copy reveal-target">
              <p className="eyebrow">{macropadForSale ? "Six keys. Your cast." : "Coming soon · Price TBD"}</p>
              <h2 id="macropad-title">Build a<br />KAPO Pad.</h2>
              <p className="macropad-lead">
                {macropadForSale
                  ? "A programmable 6-key macropad built around your favorite characters."
                  : "An upcoming six-key macropad. It is not for sale, and this preview does not take a preorder."}
              </p>

              <div className="control-row">
                <span>Build</span>
                <div className="minimal-switch" role="group" aria-label="Macropad build style">
                  <button type="button" className={macropadMode === "bare" ? "active" : ""} onClick={() => setMacropadMode("bare")} aria-pressed={macropadMode === "bare"}>Bare</button>
                  <button type="button" className={macropadMode === "artisan" ? "active" : ""} onClick={() => setMacropadMode("artisan")} aria-pressed={macropadMode === "artisan"}>Artisan Build</button>
                </div>
              </div>

              <div className="control-row">
                <span>Base</span>
                <div className="minimal-switch" role="group" aria-label="Macropad base color">
                  <button type="button" className={baseColor === "white" ? "active" : ""} onClick={() => setBaseColor("white")} aria-pressed={baseColor === "white"}>White</button>
                  <button type="button" className={baseColor === "black" ? "active" : ""} onClick={() => setBaseColor("black")} aria-pressed={baseColor === "black"}>Black</button>
                </div>
              </div>

              <ul className="spec-grid" aria-label="KAPO Pad features">
                <li>3 × 2 keys</li><li>OLED display</li><li>Rotary knob</li>
                <li>USB-C</li><li>MX compatible</li><li>White or black</li>
              </ul>

              <Link className="button button-dark" href="/macropad"><ArrowLink>{macropadForSale ? "Shop the KAPO Pad" : "Preview the KAPO Pad"}</ArrowLink></Link>
            </div>

            <div className="macropad-stage reveal-target" aria-live="polite">
              {["white-bare", "white-artisan", "black-bare", "black-artisan"].map((variant) => {
                const [color, mode] = variant.split("-");
                return (
                  <img
                    key={variant}
                    className={`macropad-option${activeMacropad === variant ? " active" : ""}`}
                    src={`/products/macropad-${color}-${mode === "artisan" ? "build" : "bare"}.png`}
                    alt={`${color} KAPO macropad ${mode === "artisan" ? "with six artisan keycaps" : "with exposed MX switches"}`}
                  />
                );
              })}
              <p>{baseColor} · {macropadMode === "artisan" ? "Artisan Build" : "Bare"}{macropadForSale ? "" : " · Coming soon"}</p>
            </div>
          </div>
        </section>

        <section id="behind" className="slide reveal-section behind-slide" aria-labelledby="behind-title">
          <div className="slide-inner behind-layout">
            <header className="slide-heading reveal-target">
              <div><p className="slide-number">06 / 07</p><h2 id="behind-title">Watch KAPO come to life.</h2></div>
              <div className="behind-links">
                <SocialLinks />
                <a className="behind-email" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </div>
            </header>
            <div className="video-grid">
              {videos.map((video, index) => (
                <article className={`video-panel reveal-target${"fit" in video && video.fit === "contain" ? " video-panel-contain" : ""}`} key={video.title} style={{ "--i": index } as React.CSSProperties}>
                  <img src={video.image} alt={video.alt} loading="lazy" />
                  <span>{video.title}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="final" className="slide reveal-section final-slide" aria-labelledby="final-title">
          <div className="slide-inner final-inner">
            <div className="final-copy reveal-target">
              <p className="eyebrow">Start your collection</p>
              <h2 id="final-title">Which one are<br />you picking first?</h2>
              <Link className="button button-dark" href="/shop"><ArrowLink>Shop the collection</ArrowLink></Link>
            </div>
            <div className="final-characters" aria-hidden="true">
              <img src="/products/spore-artisan.png" alt="" />
              <img src="/products/gloop-artisan.png" alt="" />
              <img src="/products/rango-artisan.png" alt="" />
              <img src="/products/orbit-artisan.png" alt="" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
