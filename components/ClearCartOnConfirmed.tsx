"use client";

import { useEffect } from "react";
import { useCommerce } from "./CommerceProvider";

export function ClearCartOnConfirmed({ confirmed }: { confirmed: boolean }) {
  const { clearCart } = useCommerce();
  useEffect(() => {
    if (confirmed) clearCart();
  }, [confirmed, clearCart]);
  return null;
}
