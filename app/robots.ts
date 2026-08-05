import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/recipe/", "/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"],
    },
    sitemap: "https://grocer-eaze.com/sitemap.xml",
    host: "https://grocer-eaze.com",
  };
}
