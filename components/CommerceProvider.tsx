"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AddCartItem, CartItem } from "@/lib/cart";
import { isMacropadId, macropadPurchasable, type MacropadLaunchState } from "@/lib/catalog";

type CommerceContextValue = {
  ready: boolean;
  items: CartItem[];
  itemCount: number;
  addItem: (item: AddCartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);
const CART_STORAGE_KEY = "kapo-cart-v1";

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [macropadOpen, setMacropadOpen] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      let open = false;
      try {
        const response = await fetch("/api/catalog/launch");
        const body = await response.json() as { macropad?: MacropadLaunchState };
        open = body.macropad ? macropadPurchasable(body.macropad) : false;
      } catch {
        open = false;
      }
      if (cancel) return;
      setMacropadOpen(open);
      try {
        const saved = window.localStorage.getItem(CART_STORAGE_KEY);
        const stored = saved ? JSON.parse(saved) as CartItem[] : [];
        const sellable = stored.filter((item) => item?.productId && (open || !isMacropadId(item.productId)));
        setItems((current) => {
          const kept = current.filter((item) => open || !isMacropadId(item.productId));
          if (!kept.length) return sellable;
          const ids = new Set(kept.map((item) => item.id));
          return [...sellable.filter((item) => !ids.has(item.id)), ...kept];
        });
      } catch {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      }
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CommerceContextValue>(() => ({
    ready,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    addItem: (incoming) => setItems((current) => {
      if (isMacropadId(incoming.productId) && !macropadOpen) return current;
      const quantity = incoming.quantity ?? 1;
      const existing = current.find((item) => item.id === incoming.id && !incoming.configuration);
      if (existing) {
        return current.map((item) => item.id === incoming.id
          ? { ...item, quantity: item.quantity + quantity }
          : item);
      }
      return [...current, { ...incoming, quantity }];
    }),
    updateQuantity: (id, quantity) => setItems((current) => (
      quantity < 1
        ? current.filter((item) => item.id !== id)
        : current.map((item) => item.id === id ? { ...item, quantity } : item)
    )),
    removeItem: (id) => setItems((current) => current.filter((item) => item.id !== id)),
    clearCart: () => setItems([]),
  }), [items, macropadOpen, ready]);

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error("useCommerce must be used inside CommerceProvider");
  return value;
}
