import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getBlogPostBySlug, injectBlogMeta } from "./blogMeta";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    index: false,
  }));

  // Intercept blog post pages to inject server-side meta before the generic catch-all.
  // This ensures Googlebot sees the correct title, description, OG tags, and JSON-LD
  // immediately — without needing to render JavaScript.
  app.get("/blog/:slug", async (req, res, next) => {
    try {
      const post = await getBlogPostBySlug(req.params.slug);
      if (!post) return next();

      const indexPath = path.resolve(distPath, "index.html");
      let html = fs.readFileSync(indexPath, "utf-8");
      html = injectBlogMeta(html, post);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
      res.send(html);
    } catch (e) {
      next(e);
    }
  });

  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
