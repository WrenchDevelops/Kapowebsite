"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
import { characters, searchSite } from "@/lib/catalog";
import { SUPPORT_EMAIL } from "@/lib/store-facts";
import { useCommerce } from "./CommerceProvider";
import { SocialLinks } from "./SocialLinks";

const navItems = [
  { label: "Shop", href: "/shop" },
  { label: "Characters", href: "/characters" },
  { label: "Macropad", href: "/macropad" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const { itemCount } = useCommerce();
  const suggestions = searchOpen ? searchSite(searchQuery) : [];
  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveIndex(0);
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  const openResult = (href: string) => {
    setSearchOpen(false);
    router.push(href);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (suggestions.length ? (index + 1) % suggestions.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (suggestions.length ? (index - 1 + suggestions.length) % suggestions.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = suggestions[activeIndex] ?? suggestions[0];
      if (hit) openResult(hit.href);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-compact" : ""}${scrolled && pathname !== "/" ? " is-short" : ""}${searchOpen ? " search-active" : ""}`}>
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="KAPO home">
          <img className="brand-mark" src="/kapo-mascot.png" alt="" width="42" height="42" />
          <img className="brand-name" src="/kapo-wordmark.png" alt="" width="111" height="32" />
        </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}
        </nav>

        <div className="header-actions">
          <form
            ref={searchRef}
            className={`header-search${searchOpen ? " is-open" : ""}`}
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const hit = suggestions[activeIndex] ?? suggestions[0];
              if (hit) openResult(hit.href);
            }}
          >
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search"
              aria-label="Search KAPO"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={searchOpen}
              aria-controls="search-suggestions"
              aria-activedescendant={searchOpen && suggestions[activeIndex] ? `search-option-${activeIndex}` : undefined}
              tabIndex={searchOpen ? 0 : -1}
            />
            <button
              className="icon-link"
              type="submit"
              aria-label={searchOpen ? "Submit search" : "Search"}
              aria-expanded={searchOpen}
              onClick={(event) => {
                if (!searchOpen) {
                  event.preventDefault();
                  closeMenu();
                  setSearchOpen(true);
                }
              }}
            >
              <Search aria-hidden="true" strokeWidth={2} />
            </button>
            {searchOpen && (
              <div className="search-suggest">
                <p id="search-suggest-label">{searchQuery.trim() ? "Results" : "Suggested"}</p>
                <div id="search-suggestions" role="listbox" aria-labelledby="search-suggest-label">
                  {suggestions.map((hit, index) => (
                    <Link
                      id={`search-option-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={index === activeIndex ? "is-active" : ""}
                      href={hit.href}
                      key={`${hit.type}-${hit.href}-${hit.title}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => setSearchOpen(false)}
                    >
                      {hit.image && <img src={hit.image} alt="" />}
                      <span>
                        <small>{hit.type}</small>
                        <strong>{hit.title}</strong>
                      </span>
                    </Link>
                  ))}
                  {searchQuery.trim() && suggestions.length === 0 && <p className="search-suggest-empty">No matches</p>}
                </div>
              </div>
            )}
          </form>
          <Link className="icon-link desktop-action" href="/account" aria-label="Account">
            <UserRound aria-hidden="true" strokeWidth={2} />
          </Link>
          <Link className="icon-link cart-link" href="/cart" aria-label={`Shopping cart, ${itemCount} items`}>
            <ShoppingCart aria-hidden="true" strokeWidth={2} />
            <span className="cart-count">{itemCount}</span>
          </Link>
          <details className="mobile-menu" ref={menuRef}>
            <summary aria-label="Open navigation menu" onClick={() => setSearchOpen(false)}>
              <Menu className="menu-icon menu-icon-open" aria-hidden="true" strokeWidth={2} />
              <X className="menu-icon menu-icon-close" aria-hidden="true" strokeWidth={2} />
            </summary>
            <nav aria-label="Mobile navigation" onClick={closeMenu}>
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}>
                  {item.label}
                </Link>
              ))}
              <Link href="/account" aria-current={pathname === "/account" ? "page" : undefined}>Account</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="footer" className="site-footer global-footer">
      <div className="footer-grid footer-grid-four">
        <div className="footer-brand-col">
          <Link className="brand footer-brand" href="/" aria-label="KAPO home">
            <img className="brand-mark" src="/kapo-mascot.png" alt="" width="42" height="42" />
            <img className="brand-name" src="/kapo-wordmark.png" alt="" width="111" height="32" />
          </Link>
          <SocialLinks />
        </div>
        <nav aria-label="Shop links">
          <p>Shop</p>
          <Link href="/shop">All products</Link>
          <Link href="/characters">Characters</Link>
          <Link href="/macropad">Macropad</Link>
          <Link href="/macropad/build">Pad preview</Link>
        </nav>
        <nav aria-label="Information links">
          <p>Info</p>
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
        </nav>
        <nav aria-label="Policy links">
          <p>Help</p>
          <Link href="/shipping-returns">Shipping &amp; Returns</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/llms.txt">Plain-text guide</Link>
        </nav>
      </div>
      <nav className="footer-characters" aria-label="Character pages">
        {characters.map((character) => <Link key={character.slug} href={`/characters/${character.slug}`}>{character.name}</Link>)}
      </nav>
      <div className="newsletter-row">
        <div>
          <p>KAPO news</p>
          <span>New characters, shop updates, and a weekly note. Orders and support chats are never added automatically.</span>
        </div>
        <NewsletterForm />
      </div>
      <div className="footer-bottom global-footer-bottom">
        <span>© 2026 KAPO</span>
        <div>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
        <span>Keycaps with character.</span>
      </div>
    </footer>
  );
}

function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="newsletter-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const form = event.currentTarget;
        setPending(true);
        setMessage("");
        void fetch("/api/newsletter", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: String(data.get("email") ?? ""),
            consent: data.get("consent") === "yes",
            source: "footer",
            company: String(data.get("company") ?? ""),
          }),
        }).then(async (response) => {
          const payload = await response.json() as { message?: string };
          setMessage(payload.message ?? "KAPO could not save that signup.");
          setPending(false);
          if (response.ok) form.reset();
        }).catch(() => {
          setMessage("KAPO could not save that signup.");
          setPending(false);
        });
      }}
    >
      <label htmlFor="kapo-news-email">Email</label>
      <input id="kapo-news-email" name="email" type="email" autoComplete="email" required />
      <label className="newsletter-consent">
        <input name="consent" type="checkbox" value="yes" required />
        Email me KAPO news. I can unsubscribe at any time.
      </label>
      <input className="support-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" name="company" defaultValue="" />
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Sending…" : "Sign up"}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
