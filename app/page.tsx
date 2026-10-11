"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Menu,
  Music2,
  Search,
  ShoppingCart,
  UserRound,
  Video,
} from "lucide-react";

const navItems = [
  { label: "Shop", href: "#crew" },
  { label: "Characters", href: "#world" },
  { label: "Macropad", href: "#macropad" },
  { label: "About", href: "#behind" },
  { label: "FAQ", href: "#faq" },
];

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
  { title: "Printing Spore", image: "/products/spore-artisan.png" },
  { title: "Designing a character", image: "/products/rivet-flat.png" },
  { title: "Packing an order", image: "/products/macropad-white-build.png" },
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
  const [baseColor, setBaseColor] = useState<"white" | "black">("white");
  const [crewStyle, setCrewStyle] = useState<"flat" | "artisan">("artisan");
  const [crewPage, setCrewPage] = useState(0);
  const [crewItemsPerPage, setCrewItemsPerPage] = useState(4);
  const [storyIndex, setStoryIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);

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

    const handleScroll = () => setScrolled(window.scrollY > 36);
    const handleResize = () => {
      const itemsPerPage = window.innerWidth <= 680 ? 2 : 4;
      setCrewItemsPerPage(itemsPerPage);
      setCrewPage((page) => Math.min(page, Math.ceil(characters.length / itemsPerPage) - 1));
    };
    handleScroll();
    handleResize();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      document.documentElement.classList.remove("has-js");
    };
  }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 981px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let wheelGestureActive = false;
    let navigationLocked = false;
    let wheelEndTimer: number | undefined;
    let navigationTimer: number | undefined;

    const getSnapPositions = () => {
      const headerHeight = document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const positions = Array.from(document.querySelectorAll<HTMLElement>(".slide"))
        .map((section) => Math.min(maxScroll, Math.max(0, section.offsetTop - headerHeight)));

      // Keep the footer reachable as the final stop after the last full-height section.
      if (maxScroll - positions[positions.length - 1] > 8) {
        positions.push(maxScroll);
      }

      return positions.filter((position, index) => index === 0 || position !== positions[index - 1]);
    };

    const moveToAdjacentSection = (direction: -1 | 1) => {
      if (!desktopQuery.matches || navigationLocked) return;

      const positions = getSnapPositions();
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
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(wheelEndTimer);
      window.clearTimeout(navigationTimer);
    };
  }, []);

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

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className={`site-header${scrolled ? " is-compact" : ""}`}>
        <div className="header-inner">
          <a className="brand" href="#hero" aria-label="KAPO home">
            <img className="brand-mark" src="/kapo-mascot.png" alt="" width="42" height="42" />
            <span className="brand-name">KAPO</span>
          </a>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.label} href={item.href}>{item.label}</a>
            ))}
          </nav>

          <div className="header-actions">
            <a className="icon-link desktop-action" href="#crew" aria-label="Search">
              <Search aria-hidden="true" strokeWidth={2} />
            </a>
            <a className="icon-link desktop-action" href="#footer" aria-label="Account">
              <UserRound aria-hidden="true" strokeWidth={2} />
            </a>
            <a className="icon-link cart-link" href="#crew" aria-label="Shopping cart, 0 items">
              <ShoppingCart aria-hidden="true" strokeWidth={2} />
              <span className="cart-count">0</span>
            </a>
            <details className="mobile-menu">
              <summary aria-label="Open navigation menu">
                <Menu aria-hidden="true" strokeWidth={2} />
              </summary>
              <nav aria-label="Mobile navigation">
                {navItems.map((item) => (
                  <a key={item.label} href={item.href}>{item.label}</a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

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
                <a className="button button-dark" href="#crew"><ArrowLink>Shop the collection</ArrowLink></a>
                <a className="text-link" href="#crew"><ArrowLink>Meet the characters</ArrowLink></a>
              </div>
              <p className="hero-note hero-step hero-step-5">8 characters · Flat + Artisan · MX compatible</p>
            </div>
            <div className="hero-media">
              <img src="/products/macropad-white-build.png" alt="Six KAPO artisan character keycaps installed on a white macropad" />
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
            <div className="crew-carousel reveal-target">
              <div
                className="crew-track"
                style={{
                  "--crew-page": crewPage,
                  "--crew-items": crewItemsPerPage,
                } as React.CSSProperties}
              >
                {characters.map((character) => (
                  <a className="crew-item" href="#styles" key={character.name}>
                    <div className="crew-image">
                      <img src={character[crewStyle]} alt={`${character.name} ${crewStyle} keycap`} loading="lazy" />
                    </div>
                    <div className="crew-meta">
                      <h3>{character.name}</h3>
                      <div><span>Flat $4.99</span><span>Artisan $11.99</span></div>
                    </div>
                  </a>
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
                <span>$4.99</span>
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

        <section id="macropad" className="slide reveal-section macropad-slide" aria-labelledby="macropad-title">
          <div className="slide-inner macropad-grid">
            <div className="macropad-copy reveal-target">
              <p className="eyebrow">Six keys. Your cast.</p>
              <h2 id="macropad-title">Build a<br />KAPO Pad.</h2>
              <p className="macropad-lead">A programmable 6-key macropad built around your favorite characters.</p>

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

              <a className="button button-dark" href="#final"><ArrowLink>Build your Macropad</ArrowLink></a>
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
              <p>{baseColor} · {macropadMode === "artisan" ? "Artisan Build" : "Bare"}</p>
            </div>
          </div>
        </section>

        <section id="world" className="slide reveal-section world-slide" aria-labelledby="world-title">
          <div className="slide-inner world-grid">
            <div className="world-intro reveal-target">
              <p className="slide-number">05 / 07</p>
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
            <div className="story-carousel reveal-target" aria-live="polite">
              <article className="story-card" key={activeStory.name}>
                <div className="story-image"><img src={activeStory.artisan} alt={`${activeStory.name} artisan keycap character`} /></div>
                <div className="story-copy">
                  <p className="eyebrow">Character {String(storyIndex + 1).padStart(2, "0")}</p>
                  <h3>{activeStory.name}</h3>
                  <p>{activeStory.story}</p>
                  <a className="text-link" href="#crew"><ArrowLink>Meet {activeStory.name}</ArrowLink></a>
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

        <section id="behind" className="slide reveal-section behind-slide" aria-labelledby="behind-title">
          <div className="slide-inner behind-layout">
            <header className="slide-heading reveal-target">
              <div><p className="slide-number">06 / 07</p><h2 id="behind-title">Watch KAPO come to life.</h2></div>
              <div className="social-links" aria-label="KAPO social links">
                <a href="#behind" aria-label="KAPO on TikTok"><Music2 aria-hidden="true" /></a>
                <a href="#behind" aria-label="KAPO on YouTube"><Video aria-hidden="true" /></a>
                <a href="#behind" aria-label="KAPO on Instagram"><Camera aria-hidden="true" /></a>
                <span>@KAPO</span>
              </div>
            </header>
            <div className="video-grid">
              {videos.map((video, index) => (
                <a className="video-panel reveal-target" href="#behind" key={video.title} style={{ "--i": index } as React.CSSProperties}>
                  <img src={video.image} alt="" loading="lazy" />
                  <span>{video.title}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="final" className="slide reveal-section final-slide" aria-labelledby="final-title">
          <div className="slide-inner final-inner">
            <div className="final-copy reveal-target">
              <p className="eyebrow">Start your collection</p>
              <h2 id="final-title">Which one are<br />you picking first?</h2>
              <a className="button button-dark" href="#crew"><ArrowLink>Shop the collection</ArrowLink></a>
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

      <footer id="footer" className="site-footer">
        <div className="footer-grid">
          <a className="brand footer-brand" href="#hero" aria-label="KAPO home">
            <img className="brand-mark" src="/kapo-mascot.png" alt="" width="42" height="42" />
            <span className="brand-name">KAPO</span>
          </a>
          <nav aria-label="Footer navigation">
            {navItems.slice(0, 4).map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}
          </nav>
          <div id="faq" className="footer-support">
            <p>FAQ</p>
            <span>MX compatible</span>
            <span>Shipping calculated at checkout</span>
            <span>Flat + Artisan styles</span>
          </div>
        </div>
        <div className="footer-bottom"><span>© 2026 KAPO</span><span>Keycaps with character.</span></div>
      </footer>
    </div>
  );
}
