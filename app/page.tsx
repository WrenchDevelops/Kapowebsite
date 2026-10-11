"use client";

import { useState } from "react";
import {
  ArrowRight,
  Camera,
  Menu,
  Music2,
  Play,
  Search,
  ShoppingCart,
  UserRound,
  Video,
} from "lucide-react";

const navItems = [
  { label: "Shop", href: "#shop" },
  { label: "Characters", href: "#characters" },
  { label: "Macropad", href: "#macropad" },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
];

const characters = [
  { name: "Spore", slug: "spore", image: "/products/spore-artisan.png" },
  { name: "Gloop", slug: "gloop", image: "/products/gloop-artisan.png" },
  { name: "Rango", slug: "rango", image: "/products/rango-artisan.png" },
  { name: "Brine", slug: "brine", image: "/products/brine-artisan.png" },
  { name: "Bitz", slug: "bitz", image: "/products/bitz-artisan.png" },
  { name: "Orbit", slug: "orbit", image: "/products/orbit-artisan.png" },
  { name: "Kobi", slug: "kobi", image: "/products/kobi-artisan.png" },
  { name: "Rivet", slug: "rivet", image: "/products/rivet-artisan.png" },
];

const stories = [
  {
    name: "Spore",
    image: "/products/spore-artisan.png",
    line: "The tiny forest guide who always knows the scenic route.",
  },
  {
    name: "Rango",
    image: "/products/rango-artisan.png",
    line: "A pocket-sized sheriff with a very big sense of adventure.",
  },
  {
    name: "Orbit",
    image: "/products/orbit-artisan.png",
    line: "An eager explorer collecting keyboard signals from the stars.",
  },
];

const socialCards = [
  {
    title: "Printing Spore",
    label: "Behind the print",
    image: "/products/spore-artisan.png",
  },
  {
    title: "Designing a new character",
    label: "From sketch to sculpt",
    image: "/products/rivet-flat.png",
  },
  {
    title: "Packing a customer order",
    label: "KAPO studio",
    image: "/products/macropad-white-build.png",
  },
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
  const [macropadMode, setMacropadMode] = useState<"bare" | "artisan">(
    "artisan",
  );

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="KAPO home">
            <img
              className="brand-mark"
              src="/kapo-mascot.png"
              alt=""
              width="42"
              height="42"
            />
            <span className="brand-name">KAPO</span>
          </a>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a className="icon-link desktop-action" href="#shop" aria-label="Search">
              <Search aria-hidden="true" strokeWidth={2} />
            </a>
            <a className="icon-link desktop-action" href="#footer" aria-label="Account">
              <UserRound aria-hidden="true" strokeWidth={2} />
            </a>
            <a className="icon-link cart-link" href="#shop" aria-label="Shopping cart, 0 items">
              <ShoppingCart aria-hidden="true" strokeWidth={2} />
              <span className="cart-count">0</span>
            </a>

            <details className="mobile-menu">
              <summary aria-label="Open navigation menu">
                <Menu aria-hidden="true" strokeWidth={2} />
              </summary>
              <nav aria-label="Mobile navigation">
                {navItems.map((item) => (
                  <a key={item.label} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section id="top" className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-copy-inner">
              <h1 id="hero-title">Keycaps with character.</h1>
              <p className="hero-subtitle">
                Eight original characters. Available in Flat and Artisan.
              </p>
              <div className="hero-actions">
                <a className="button button-dark" href="#shop">
                  <ArrowLink>Shop the collection</ArrowLink>
                </a>
                <a className="text-link" href="#characters">
                  <ArrowLink>Meet the characters</ArrowLink>
                </a>
              </div>
              <p className="hero-note">8 characters · Flat + Artisan · MX compatible</p>
            </div>
          </div>
          <div className="hero-media">
            <img
              src="/products/macropad-white-build.png"
              alt="Six KAPO artisan character keycaps installed on a white macropad"
            />
          </div>
        </section>

        <section id="shop" className="crew-section content-frame" aria-labelledby="crew-title">
          <div className="section-heading section-heading-row">
            <div>
              <h2 id="crew-title">Meet the KAPO crew</h2>
              <p>Eight original characters. Collect your favorites.</p>
            </div>
            <a className="text-link view-all" href="#flat-artisan">
              <ArrowLink>View all keycaps</ArrowLink>
            </a>
          </div>

          <div className="character-grid" id="characters">
            {characters.map((character) => (
              <a
                className="character-card"
                key={character.name}
                href="#flat-artisan"
                aria-label={`View ${character.name} keycaps`}
              >
                <div className="character-image-wrap">
                  <img
                    src={character.image}
                    alt={`${character.name} artisan keycap`}
                    loading="lazy"
                  />
                </div>
                <div className="character-meta">
                  <h3>{character.name}</h3>
                  <p>Flat — $4.99</p>
                  <p>Artisan — $11.99</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="flat-artisan" className="comparison-section content-frame" aria-labelledby="comparison-title">
          <div className="section-heading centered-heading">
            <p className="eyebrow">Choose your style</p>
            <h2 id="comparison-title">Same character. Two ways to use it.</h2>
            <p>Pick a low-profile daily keycap or a fully sculpted desk collectible.</p>
          </div>

          <div className="comparison-grid">
            <article className="style-card">
              <div className="style-image">
                <img src="/products/spore-flat.png" alt="Spore Flat keycap" loading="lazy" />
              </div>
              <div className="style-copy">
                <div>
                  <p className="style-label">Flat</p>
                  <h3>Made for everyday use.</h3>
                  <p>Low-profile character keycaps with the artwork built into the upward-facing surface.</p>
                </div>
                <span className="price">$4.99</span>
              </div>
            </article>

            <article className="style-card">
              <div className="style-image">
                <img src="/products/spore-artisan.png" alt="Spore Artisan keycap" loading="lazy" />
              </div>
              <div className="style-copy">
                <div>
                  <p className="style-label">Artisan</p>
                  <h3>Sculpted to stand out.</h3>
                  <p>Fully sculpted collectible keycaps with an included MX-style mechanical switch.</p>
                </div>
                <span className="price">$11.99</span>
              </div>
            </article>
          </div>

          <div className="section-action">
            <a className="button button-outline" href="#shop">
              <ArrowLink>Explore both styles</ArrowLink>
            </a>
          </div>
        </section>

        <section id="macropad" className="macropad-section content-frame" aria-labelledby="macropad-title">
          <div className="macropad-copy">
            <p className="eyebrow">Six keys. Your cast.</p>
            <h2 id="macropad-title">Build a KAPO Pad.</h2>
            <p className="macropad-lead">
              A compact 6-key programmable macropad built for your favorite characters.
            </p>

            <div className="mode-switch" role="group" aria-label="Macropad preview style">
              <button
                className={macropadMode === "bare" ? "active" : ""}
                type="button"
                onClick={() => setMacropadMode("bare")}
                aria-pressed={macropadMode === "bare"}
              >
                Bare
              </button>
              <button
                className={macropadMode === "artisan" ? "active" : ""}
                type="button"
                onClick={() => setMacropadMode("artisan")}
                aria-pressed={macropadMode === "artisan"}
              >
                Artisan Build
              </button>
            </div>

            <ul className="spec-list" aria-label="Macropad features">
              <li>3 × 2 key layout</li>
              <li>OLED display</li>
              <li>Rotary knob</li>
              <li>USB-C</li>
              <li>MX compatible</li>
              <li>White or black</li>
            </ul>

            <div className="macropad-actions">
              <a className="button button-dark" href="#shop">
                <ArrowLink>Build your Macropad</ArrowLink>
              </a>
              <a className="text-link" href="#faq">
                <ArrowLink>Learn more</ArrowLink>
              </a>
            </div>
          </div>

          <div className="macropad-media" aria-live="polite">
            <img
              key={macropadMode}
              src={
                macropadMode === "bare"
                  ? "/products/macropad-white-bare.png"
                  : "/products/macropad-white-build.png"
              }
              alt={
                macropadMode === "bare"
                  ? "White six-key KAPO macropad with exposed MX switches"
                  : "White six-key KAPO macropad with six artisan character keycaps"
              }
            />
            <p>{macropadMode === "bare" ? "Bare · White" : "Artisan Build · White"}</p>
          </div>
        </section>

        <section id="about" className="story-section content-frame" aria-labelledby="story-title">
          <div className="section-heading section-heading-row">
            <div>
              <h2 id="story-title">More than keycaps.</h2>
              <p>Every KAPO character has a personality and a little world of their own.</p>
            </div>
            <a className="text-link view-all" href="#characters">
              <ArrowLink>Meet the full crew</ArrowLink>
            </a>
          </div>

          <div className="story-grid">
            {stories.map((story) => (
              <article className="story-card" key={story.name}>
                <div className="story-image">
                  <img src={story.image} alt={`${story.name} character`} loading="lazy" />
                </div>
                <div className="story-copy">
                  <h3>{story.name}</h3>
                  <p>{story.line}</p>
                  <a className="text-link" href="#shop">
                    <ArrowLink>Meet {story.name}</ArrowLink>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="social-section content-frame" aria-labelledby="social-title">
          <div className="section-heading section-heading-row">
            <div>
              <h2 id="social-title">Watch KAPO come to life.</h2>
              <p>Designs, prints, prototypes and order packing on TikTok and YouTube.</p>
            </div>
            <div className="social-links" aria-label="Social media links">
              <a href="#social-title" aria-label="KAPO on TikTok"><Music2 aria-hidden="true" /></a>
              <a href="#social-title" aria-label="KAPO on YouTube"><Video aria-hidden="true" /></a>
              <a href="#social-title" aria-label="KAPO on Instagram"><Camera aria-hidden="true" /></a>
              <span>@KAPO</span>
            </div>
          </div>

          <div className="social-grid">
            {socialCards.map((card) => (
              <a className="video-card" href="#social-title" key={card.title}>
                <img src={card.image} alt="" loading="lazy" />
                <span className="play-button"><Play aria-hidden="true" fill="currentColor" /></span>
                <div className="video-caption">
                  <span>{card.label}</span>
                  <h3>{card.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="faq" className="faq-section content-frame" aria-labelledby="faq-title">
          <div className="faq-intro">
            <p className="eyebrow">Good to know</p>
            <h2 id="faq-title">A few quick answers.</h2>
            <p>Everything you need before choosing your first KAPO.</p>
          </div>
          <div className="faq-list">
            <details>
              <summary>Will KAPO keycaps fit my keyboard?</summary>
              <p>Both Flat and Artisan styles are designed for MX-compatible stems and switches.</p>
            </details>
            <details>
              <summary>What comes with an Artisan keycap?</summary>
              <p>Each sculpted Artisan includes one MX-compatible mechanical switch.</p>
            </details>
            <details>
              <summary>How is shipping calculated?</summary>
              <p>Shipping is calculated separately at checkout based on destination and package size.</p>
            </details>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <div>
            <p className="eyebrow">Start your collection</p>
            <h2 id="cta-title">Which one are you picking first?</h2>
          </div>
          <a className="button button-dark" href="#shop">
            <ArrowLink>Shop the collection</ArrowLink>
          </a>
        </section>
      </main>

      <footer id="footer" className="site-footer">
        <div className="footer-top">
          <a className="brand footer-brand" href="#top" aria-label="KAPO home">
            <img className="brand-mark" src="/kapo-mascot.png" alt="" width="42" height="42" />
            <span className="brand-name">KAPO</span>
          </a>

          <div className="footer-links">
            <div>
              <p>Explore</p>
              <a href="#shop">Shop</a>
              <a href="#characters">Characters</a>
              <a href="#macropad">Macropad</a>
              <a href="#about">About</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <p>Help</p>
              <a href="#faq">Shipping</a>
              <a href="#faq">Returns</a>
              <a href="mailto:hello@kapo.example">Contact</a>
              <a href="#footer">Privacy</a>
              <a href="#footer">Terms</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 KAPO. Keycaps with character.</span>
          <div className="social-links" aria-label="Footer social media links">
            <a href="#social-title" aria-label="KAPO on TikTok"><Music2 aria-hidden="true" /></a>
            <a href="#social-title" aria-label="KAPO on YouTube"><Video aria-hidden="true" /></a>
            <a href="#social-title" aria-label="KAPO on Instagram"><Camera aria-hidden="true" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
