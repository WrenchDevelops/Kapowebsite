import { SOCIAL_LINKS } from "@/lib/store-facts";

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`social-links${className ? ` ${className}` : ""}`} aria-label="KAPO on Instagram and YouTube">
      {SOCIAL_LINKS.map((link) => (
        <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer">
          <img src={link.icon} alt="" width={28} height={28} />
          <span>{link.label}</span>
        </a>
      ))}
    </nav>
  );
}
