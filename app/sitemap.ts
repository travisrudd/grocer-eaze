import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://grocer-eaze.com/",
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
    images: ["https://grocer-eaze.com/og.png"],
  }];
}
