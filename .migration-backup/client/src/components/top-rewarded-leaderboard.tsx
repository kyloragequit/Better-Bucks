import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Trophy } from "lucide-react";

type Category = { name: string; color: string; percent: number };
type Entry = { rank: 1 | 2 | 3; userId: number; fullName: string; categories: Category[] };
type LeaderboardData = {
  period: { start: string; end: string; label: string };
  entries: Entry[];
};

const RANK_STYLES: Record<number, { ring: string; bg: string; crown: string; chip: string; label: string }> = {
  1: { ring: "ring-yellow-300", bg: "bg-gradient-to-br from-yellow-50 to-amber-50",   crown: "text-yellow-500",  chip: "bg-yellow-100 text-yellow-800",  label: "1st" },
  2: { ring: "ring-slate-300",  bg: "bg-gradient-to-br from-slate-50 to-zinc-50",     crown: "text-slate-400",   chip: "bg-slate-100 text-slate-800",   label: "2nd" },
  3: { ring: "ring-amber-300",  bg: "bg-gradient-to-br from-orange-50 to-amber-50",   crown: "text-amber-700",   chip: "bg-amber-100 text-amber-800",   label: "3rd" },
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
}

export function TopRewardedLeaderboard() {
  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard/top-rewarded"],
  });

  if (isLoading) return null;
  if (!data || !data.entries || data.entries.length === 0) return null;

  return (
    <Card className="mb-8 shadow-md border-border/60" data-testid="card-top-rewarded">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top Rewarded — {data.period.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Recognizing last month's top three teammates and the categories they earned in.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.entries.map(entry => {
            const style = RANK_STYLES[entry.rank];
            return (
              <div
                key={entry.userId}
                className={`rounded-xl border p-4 ring-1 ${style.ring} ${style.bg} transition-shadow hover:shadow-sm`}
                data-testid={`leaderboard-entry-${entry.rank}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-base font-semibold text-foreground">
                      {initials(entry.fullName)}
                    </div>
                    <Crown
                      className={`absolute -top-3 -right-1 h-5 w-5 ${style.crown} drop-shadow-sm`}
                      fill="currentColor"
                      strokeWidth={1.5}
                      data-testid={`crown-rank-${entry.rank}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {style.label} Place
                    </p>
                    <p className="font-semibold truncate" data-testid={`text-name-rank-${entry.rank}`}>
                      {entry.fullName}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {entry.categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No category data.</p>
                  ) : (
                    entry.categories.map(cat => (
                      <div key={cat.name} data-testid={`category-${entry.rank}-${cat.name}`}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1.5 truncate text-foreground/80">
                            <span
                              className="inline-block h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{cat.name}</span>
                          </span>
                          <span className="font-mono text-muted-foreground tabular-nums shrink-0">
                            {cat.percent}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
