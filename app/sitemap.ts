import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://grocer-eaze.com/",
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
    images: ["https://grocer-eaze.com/og.png"],
  }, {
    url: "https://grocer-eaze.com/privacy",
    lastModified: new Date("2026-08-04"),
    changeFrequency: "monthly",
    priority: 0.5,
  }];
}
