"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Box, ChevronRight, LayoutGrid, Mail, Megaphone, Package, ShieldCheck } from "lucide-react";

const navigation = [
  { href: "/admin", label: "Orders", icon: Package },
  { href: "/admin/rewards", label: "KAPO Club", icon: ShieldCheck },
  { href: "/admin/email", label: "Email studio", icon: Mail },
  { href: "/admin/marketing", label: "Newsletter", icon: Megaphone },
];

export function AdminWorkspace({ children, email }: { children: React.ReactNode; email?: string | null }) {
  const pathname = usePathname();
  const current = navigation.find((item) => item.href === pathname) ?? navigation[0];
  return (
    <div className="admin-workspace">
      <aside className="workspace-sidebar">
        <Link href="/admin" className="workspace-brand" aria-label="KAPO admin home">
          <img src="/kapo-wordmark.png" width="111" height="32" alt="KAPO" />
          <span>STUDIO</span>
        </Link>
        <div className="workspace-switcher"><span className="workspace-store-icon"><Box size={19} /></span><span><strong>KAPO store</strong><small>Admin workspace</small></span><ShieldCheck size={16} /></div>
        <p className="workspace-nav-label">WORKSPACE</p>
        <nav aria-label="Admin navigation">
          {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={current.href === href ? "is-active" : ""} aria-current={current.href === href ? "page" : undefined}><Icon size={19} /><span>{label}</span>{current.href === href && <ChevronRight size={15} />}</Link>)}
        </nav>
        <div className="workspace-sidebar-bottom">
          <div className="workspace-note"><img src="/kapo-mascot.png" alt="" width="56" height="56" /><strong>Small keys. Big character.</strong><p>A little space to keep the whole store moving.</p></div>
          <Link href="/" className="workspace-store-link">Visit storefront <ArrowUpRight size={16} /></Link>
          <div className="workspace-account"><span>{email?.charAt(0).toUpperCase() ?? "K"}</span><div><strong>{email ? "Store administrator" : "Admin access"}</strong><small title={email ?? undefined}>{email ?? "Sign in to continue"}</small></div></div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar"><div><LayoutGrid size={16} /><span>Workspace</span><ChevronRight size={13} /><strong>{current.label}</strong></div><Link href="/" aria-label="Open storefront">View store <ArrowUpRight size={14} /></Link></header>
        {children}
        <footer className="workspace-footer"><span>Made with character.</span><span>KAPO / Store workspace</span></footer>
      </div>
    </div>
  );
}
