import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/onboarding", "/applications", "/favorites", "/resume", "/copilot", "/radar", "/map", "/interviews", "/outreach", "/compare", "/analytics", "/urgence", "/notifications", "/settings", "/admin", "/login", "/register"] },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
