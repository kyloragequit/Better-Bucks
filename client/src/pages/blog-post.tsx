import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { PageSEO } from "@/components/page-seo";
import { SiteFooter } from "@/components/site-footer";
import { InstagramFloat } from "@/components/instagram-float";
import { ArrowLeft, Calendar, ExternalLink, LogIn, Building2, Info, Menu, ArrowRight } from "lucide-react";
import type { BlogPost } from "@shared/schema";
import { useState } from "react";
import { Loader } from "@/components/ui/loader";

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

type Source = { label: string; url: string };

function parseSources(raw: string | null | undefined): Source[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function BlogPostPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ slug: string }>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ["/api/blog", params.slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${params.slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
  });

  const sources = parseSources(post?.sources);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {post && (
        <PageSEO
          title={`${post.title} – Better Bucks Blog`}
          description={post.excerpt}
          canonicalPath={`/blog/${post.slug}`}
          ogImage={post.imageUrl}
        />
      )}

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={() => setLocation("/")}
          >
            <AppLogo size="sm" />
            <span className="text-lg font-bold text-gray-900">Better Bucks</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/about")} data-testid="button-header-about">
              <Info className="mr-1.5 h-4 w-4" /> About
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/blog")} data-testid="button-header-blog">
              Blog
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/login")} data-testid="button-header-login">
              <LogIn className="mr-1.5 h-4 w-4" /> Log In
            </Button>
            <Button size="sm" onClick={() => setLocation("/signup")} data-testid="button-header-signup">
              <Building2 className="mr-1.5 h-4 w-4" /> Sign Up
            </Button>
          </div>
          <div className="sm:hidden relative">
            <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="h-4 w-4" />
            </Button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-lg shadow-lg border py-1 z-50">
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/about"); setMobileMenuOpen(false); }}>
                    <Info className="h-4 w-4" /> About
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/blog"); setMobileMenuOpen(false); }}>
                    Blog
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/login"); setMobileMenuOpen(false); }}>
                    <LogIn className="h-4 w-4" /> Log In
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/signup"); setMobileMenuOpen(false); }}>
                    <Building2 className="h-4 w-4" /> Sign Up
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 w-full">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-gray-600 hover:text-gray-900"
          onClick={() => setLocation("/blog")}
          data-testid="button-back-blog"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Blog
        </Button>

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader />
          </div>
        )}

        {isError && (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-gray-700">Post not found</p>
            <Button variant="outline" className="mt-4" onClick={() => setLocation("/blog")}>
              Back to Blog
            </Button>
          </div>
        )}

        {post && (
          <article>
            <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-2">
              <img
                src={post.imageUrl}
                alt={post.imageAlt || post.title}
                className="w-full max-h-96 object-cover"
                data-testid="img-blog-hero"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/800x400/162A4A/white?text=Better+Bucks"; }}
              />
            </div>

            {post.imageSource && (
              <p className="text-xs text-muted-foreground mb-6" data-testid="text-blog-image-source">
                {post.imageSource}
              </p>
            )}

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4" data-testid="text-blog-post-title">
              {post.title}
            </h1>

            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100">
              {post.authorPhotoUrl ? (
                <img
                  src={post.authorPhotoUrl}
                  alt={post.authorName}
                  className="h-11 w-11 rounded-full object-cover border border-gray-200"
                  data-testid="img-blog-author-photo"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary">
                  {post.authorName.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm" data-testid="text-blog-author-name">{post.authorName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(post.publishedAt)}
                </p>
              </div>
            </div>

            <div
              className="prose prose-gray max-w-none prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: post.content }}
              data-testid="div-blog-content"
            />

            <div className="mt-10 rounded-2xl px-8 py-10 text-center" style={{ background: "linear-gradient(135deg, #162A4A 0%, #1e3a63 100%)" }} data-testid="div-blog-cta">
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#4E9F3D" }}>Ready to get started?</p>
              <h2 className="text-2xl font-bold text-white mb-3">Reward your team. Retain your people.</h2>
              <p className="text-gray-300 mb-6 max-w-md mx-auto text-sm leading-relaxed">Join organizations using Better Bucks to drive engagement and reduce turnover — no complicated setup required.</p>
              <Button
                size="lg"
                onClick={() => setLocation("/signup")}
                data-testid="button-blog-cta-signup"
                className="font-semibold text-white shadow-lg"
                style={{ background: "#4E9F3D" }}
              >
                Sign up and see the difference
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {sources.length > 0 && (
              <div className="mt-10 pt-6 border-t border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Sources</h2>
                <ul className="space-y-2">
                  {sources.map((src, i) => (
                    <li key={i}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline"
                        data-testid={`link-source-${i}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        {src.label || src.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        )}
      </main>

      <SiteFooter />
      <InstagramFloat />
    </div>
  );
}
