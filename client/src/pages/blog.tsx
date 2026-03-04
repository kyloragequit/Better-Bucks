import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { PageSEO } from "@/components/page-seo";
import { SiteFooter } from "@/components/site-footer";
import { InstagramFloat } from "@/components/instagram-float";
import { ArrowLeft, LogIn, Building2, Info, Calendar, Menu } from "lucide-react";
import type { BlogPost } from "@shared/schema";
import { useState } from "react";

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogPage() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageSEO
        title="Blog – Better Bucks Employee Incentive Platform"
        description="Insights on employee recognition, incentive program management, workplace rewards, and performance motivation for logistics, warehousing, and manufacturing teams."
        canonicalPath="/blog"
        keywords="employee incentive blog, employee recognition tips, workplace rewards insights, incentive program management"
      />

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={() => setLocation("/home")}
          >
            <AppLogo size="sm" />
            <span className="text-lg font-bold text-gray-900">Better Bucks</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/about")} data-testid="button-header-about">
              <Info className="mr-1.5 h-4 w-4" />
              About
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/blog")} className="text-primary font-semibold" data-testid="button-header-blog">
              Blog
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/login")} data-testid="button-header-login">
              <LogIn className="mr-1.5 h-4 w-4" />
              Log In
            </Button>
            <Button size="sm" onClick={() => setLocation("/signup")} data-testid="button-header-signup">
              <Building2 className="mr-1.5 h-4 w-4" />
              Sign Up
            </Button>
          </div>
          <div className="sm:hidden relative">
            <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
              <Menu className="h-4 w-4" />
            </Button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-lg shadow-lg border py-1 z-50">
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setLocation("/about"); setMobileMenuOpen(false); }}>
                    <Info className="h-4 w-4" /> About
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary font-semibold hover:bg-gray-100" onClick={() => { setLocation("/blog"); setMobileMenuOpen(false); }}>
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

      <section className="bg-gray-50 border-b py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Better Bucks Blog</h1>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            Insights on employee recognition, incentive programs, and building motivated teams.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-square" />
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">No posts yet</p>
            <p className="text-sm mt-1">Check back soon for insights and updates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <button
                key={post.id}
                onClick={() => setLocation(`/blog/${post.slug}`)}
                className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-white text-left flex flex-col"
                data-testid={`card-blog-post-${post.id}`}
              >
                <div className="aspect-square w-full overflow-hidden bg-gray-100 relative">
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/162A4A/white?text=Better+Bucks"; }}
                  />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h2 className="font-semibold text-gray-900 leading-snug text-base group-hover:text-primary transition-colors line-clamp-2" data-testid={`text-blog-title-${post.id}`}>
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2 flex-1">{post.excerpt}</p>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    {post.authorPhotoUrl ? (
                      <img src={post.authorPhotoUrl} alt={post.authorName} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {post.authorName.charAt(0)}
                      </div>
                    )}
                    <span className="text-xs text-gray-500">{post.authorName}</span>
                    <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
      <InstagramFloat />
    </div>
  );
}
