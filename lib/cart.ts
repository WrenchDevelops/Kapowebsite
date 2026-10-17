import type { CharacterSlug, KeycapStyle } from "./catalog";

export type MacropadKeySelection = {
  position: number;
  character: CharacterSlug | "none";
  style: KeycapStyle;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  style: string;
  image: string;
  unitPrice: number | null;
  quantity: number;
  base?: "white" | "black";
  configuration?: MacropadKeySelection[];
};

export type AddCartItem = Omit<CartItem, "quantity"> & { quantity?: number };
