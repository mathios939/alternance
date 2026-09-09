export const siteConfig = {
  name: "Alternance OS",
  tagline: "Trouve ton alternance avant les autres.",
  description:
    "Toutes les offres, les entreprises à contacter et les outils nécessaires pour décrocher ton alternance, réunis au même endroit.",
  url: process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
  locale: "fr_FR",
  twitter: "@alternanceos",
  isDemoMode: process.env["NEXT_PUBLIC_DEMO_MODE"] !== "false",
} as const;
