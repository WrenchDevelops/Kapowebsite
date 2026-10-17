import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ShopProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/catalog";

export function ProductCard({ product, index = 0 }: { product: ShopProduct; index?: number }) {
  return (
    <Link
      className="product-cell reveal"
      href={product.href}
      style={{ "--reveal-delay": `${(index % 4) * 65}ms` } as React.CSSProperties}
    >
      <div className="product-cell-image">
        {product.comingSoon && <span className="coming-soon">Coming soon</span>}
        <img src={product.image} alt={`${product.name} ${product.style}`} loading="lazy" />
      </div>
      <div className="product-cell-meta">
        <div><h2>{product.name}</h2><p>{product.style}</p></div>
        <div className="product-price-row"><span>{product.comingSoon ? "Price TBD" : formatPrice(product.price)}</span><ArrowRight aria-hidden="true" /></div>
      </div>
    </Link>
  );
}
