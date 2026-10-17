"use client";

import { useState } from "react";
import { macropadPurchasable, shopProducts, type MacropadLaunchState } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

const filters = [
  { id: "all", label: "All" },
  { id: "flat", label: "Flat" },
  { id: "artisan", label: "Artisan" },
  { id: "macropads", label: "Macropads" },
] as const;

export function ShopGrid({ launch }: { launch: MacropadLaunchState }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const open = macropadPurchasable(launch);
  const listed = shopProducts
    .filter((product) => product.category !== "macropads" || launch.published)
    .map((product) => product.category === "macropads"
      ? { ...product, comingSoon: !open, price: open && launch.priceCents !== null ? launch.priceCents / 100 : null }
      : product);
  const products = filter === "all" ? listed : listed.filter((product) => product.category === filter);

  return (
    <>
      <div className="filter-grid" role="group" aria-label="Filter products">
        {filters.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="product-grid" aria-live="polite">
        {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
      </div>
    </>
  );
}
