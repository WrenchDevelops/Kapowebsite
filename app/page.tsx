import {
  Menu,
  Search,
  ShoppingCart,
  UserRound,
} from "lucide-react";

const navItems = ["Shop", "Characters", "Macropod", "About", "FAQ"];

export default function Home() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Kapo home">
          <img
            className="brand-mark"
            src="/kapo-mascot.png"
            alt=""
            width="44"
            height="44"
          />
          <span className="brand-name">KAPO</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>
              {item}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <a className="icon-link" href="#search" aria-label="Search">
            <Search aria-hidden="true" strokeWidth={2.35} />
          </a>
          <a className="icon-link account-link" href="#account" aria-label="Account">
            <UserRound aria-hidden="true" strokeWidth={2.35} />
          </a>
          <a className="icon-link" href="#cart" aria-label="Shopping cart">
            <ShoppingCart aria-hidden="true" strokeWidth={2.35} />
          </a>

          <details className="mobile-menu">
            <summary aria-label="Open navigation menu">
              <Menu aria-hidden="true" strokeWidth={2.35} />
            </summary>
            <nav aria-label="Mobile navigation">
              {navItems.map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`}>
                  {item}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </header>

      <main id="top" className="page-canvas" aria-label="Kapo storefront" />
    </div>
  );
}
