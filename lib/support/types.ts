export type SupportWidgetConfig = {
  greeting: string;
  welcome: string;
  supportEmail: string | null;
  maxInputChars: number;
};

export type PublicProduct = {
  id: string;
  name: string;
  style: string;
  priceLabel: string;
  availability: string;
  href: string;
  image: string;
};

export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
  at: number;
};
