import { useState } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, RefreshCw, Calendar, BarChart2, Users, ShoppingCart, Tag, Building2, DollarSign } from "lucide-react";
import { SpinningLogo } from "@/components/spinning-logo";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type CategoryStat = { categoryId: number | null; categoryName: string | null; categoryColor: string | null; totalBucks: number };
type DeptStat = { deptId: number | null; deptName: string | null; credited: number; debited: number };
type DailySpending = { date: string; credited: number; debited: number };
type ReportData = {
  orgName: string;
  year: number;
  month: number;
  totalAwarded: number;
  totalSpent: number;
  totalOrders: number;
  budgetUsed: number;
  monthlyBudgetBucks: number;
  conversionRate?: number;
  dailySpending?: DailySpending[];
  categoryStats: CategoryStat[];
  departmentStats: DeptStat[];
  topEmployees: { userId: number; name: string; received: number }[];
  activeEmployees: number;
  txCount: number;
};
type MonthlyReport = {
  id: number;
  orgId: number;
  year: number;
  month: number;
  reportData: ReportData;
  generatedAt: string;
};

function DailySpendingChart({ dailySpending, conversionRate }: { dailySpending: DailySpending[]; conversionRate: number }) {
  const rate = conversionRate || 100;
  const chartData = dailySpending
    .filter(d => d.credited > 0 || d.debited > 0)
    .map(d => ({
      date: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      awarded: +(d.credited / rate).toFixed(2),
      spent: +(d.debited / rate).toFixed(2),
    }));
  if (chartData.length === 0) return null;
  return (
    <div data-testid="chart-daily-spending">
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
        <DollarSign className="h-3 w-3" /> Daily Dollar Spending
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === "awarded" ? "Awarded" : "Spent"]}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Line type="monotone" dataKey="awarded" stroke="#16a34a" strokeWidth={2} dot={false} name="Awarded" />
          <Line type="monotone" dataKey="spent" stroke="#dc2626" strokeWidth={2} dot={false} name="Spent" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReportCard({ report, onPrint }: { report: MonthlyReport; onPrint: (r: MonthlyReport) => void }) {
  const data = report.reportData;
  const budgetPct = data.monthlyBudgetBucks > 0 ? Math.round((data.budgetUsed / data.monthlyBudgetBucks) * 100) : null;
  const totalCatBucks = data.categoryStats.reduce((s, c) => s + c.totalBucks, 0);
  const deptStats: DeptStat[] = data.departmentStats ?? [];
  const rate = data.conversionRate ?? 100;

  return (
    <Card className="border shadow-sm" data-testid={`card-report-${report.year}-${report.month}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {MONTH_NAMES[report.month - 1]} {report.year}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Generated {new Date(report.generatedAt).toLocaleDateString()}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPrint(report)}
              data-testid={`button-download-report-${report.year}-${report.month}`}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conversion rate */}
        <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg text-sm">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Conversion Rate:</span>
          <span className="font-semibold">{rate} bucks = $1.00</span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-xl font-bold text-green-700" data-testid={`text-report-awarded-${report.year}-${report.month}`}>{data.totalAwarded.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bucks Awarded</p>
            <p className="text-xs text-green-600 mt-0.5">${(data.totalAwarded / rate).toFixed(2)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <p className="text-xl font-bold text-red-700">{data.totalSpent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bucks Spent</p>
            <p className="text-xs text-red-600 mt-0.5">${(data.totalSpent / rate).toFixed(2)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-xl font-bold text-blue-700">{data.activeEmployees ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active Employees</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-center">
            <p className="text-xl font-bold text-indigo-700">{data.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Store Orders</p>
          </div>
        </div>

        {/* Daily spending chart */}
        {data.dailySpending && data.dailySpending.length > 0 && (
          <DailySpendingChart dailySpending={data.dailySpending} conversionRate={rate} />
        )}

        {/* Budget progress */}
        {budgetPct !== null && (
          <div>
            <div className="flex justify-between items-center mb-1 text-sm">
              <span className="text-muted-foreground">Budget Used</span>
              <span className="font-semibold">{data.budgetUsed.toLocaleString()} / {data.monthlyBudgetBucks.toLocaleString()} bucks ({budgetPct}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${budgetPct >= 90 ? "bg-red-500" : budgetPct >= 70 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
          </div>
        )}

        {/* Department breakdown */}
        {deptStats.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Building2 className="h-3 w-3" /> Bucks by Department</p>
            <div className="space-y-1.5">
              {deptStats.slice(0, 6).map((d, i) => (
                <div key={d.deptId ?? i} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground truncate">{d.deptName ?? "No Department"}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-green-700 font-medium">+{d.credited.toLocaleString()}</span>
                    {d.debited > 0 && <span className="text-red-600 font-medium">−{d.debited.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {data.categoryStats.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Tag className="h-3 w-3" /> Bucks by Category</p>
            <div className="space-y-2">
              {data.categoryStats.slice(0, 5).map((c, i) => {
                const pct = totalCatBucks > 0 ? Math.round((c.totalBucks / totalCatBucks) * 100) : 0;
                return (
                  <div key={c.categoryId ?? i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.categoryColor ?? "#9CA3AF" }} />
                        {c.categoryName ?? "Uncategorized"}
                      </span>
                      <span className="font-medium">{c.totalBucks.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.categoryColor ?? "#9CA3AF" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top employees */}
        {data.topEmployees.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Users className="h-3 w-3" /> Top Recipients</p>
            <div className="space-y-1">
              {data.topEmployees.slice(0, 5).map((e, i) => (
                <div key={e.userId} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-4">#{i + 1}</span>
                    {e.name}
                  </span>
                  <span className="font-semibold text-green-700">{e.received.toLocaleString()} bucks</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrintableReport({ report, onClose }: { report: MonthlyReport; onClose: () => void }) {
  const data = report.reportData;
  const budgetPct = data.monthlyBudgetBucks > 0 ? Math.round((data.budgetUsed / data.monthlyBudgetBucks) * 100) : null;
  const totalCatBucks = data.categoryStats.reduce((s, c) => s + c.totalBucks, 0);
  const deptStats: DeptStat[] = data.departmentStats ?? [];
  const rate = data.conversionRate ?? 100;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:block" id="printable-report">
      <div className="max-w-2xl mx-auto p-8 print:p-6">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <h2 className="text-xl font-bold">Print Preview</h2>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}>Print / Save PDF</Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>

        {/* Report header */}
        <div className="border-b pb-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Monthly Activity Report</h1>
              <p className="text-muted-foreground">{data.orgName}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{MONTH_NAMES[report.month - 1]} {report.year}</p>
              <p className="text-sm text-muted-foreground">Generated {new Date(report.generatedAt).toLocaleDateString()}</p>
              <p className="text-sm font-medium mt-1">Rate: {rate} bucks = $1.00</p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Summary</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Bucks Awarded</p>
            <p className="text-2xl font-bold text-green-700">{data.totalAwarded.toLocaleString()}</p>
            <p className="text-sm text-green-600">${(data.totalAwarded / rate).toFixed(2)}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Bucks Spent (Store)</p>
            <p className="text-2xl font-bold text-red-700">{data.totalSpent.toLocaleString()}</p>
            <p className="text-sm text-red-600">${(data.totalSpent / rate).toFixed(2)}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Active Employees</p>
            <p className="text-2xl font-bold">{data.activeEmployees ?? 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Store Orders</p>
            <p className="text-2xl font-bold">{data.totalOrders}</p>
          </div>
        </div>

        {/* Daily spending chart (screen only, not in print) */}
        {data.dailySpending && data.dailySpending.length > 0 && (
          <div className="mb-6 print:hidden">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Daily Dollar Spending</h2>
            <div className="border rounded-lg p-4">
              <DailySpendingChart dailySpending={data.dailySpending} conversionRate={rate} />
            </div>
          </div>
        )}

        {/* Budget */}
        {budgetPct !== null && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Monthly Budget</h2>
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bucks used</span>
                <span className="font-semibold">{data.budgetUsed.toLocaleString()} / {data.monthlyBudgetBucks.toLocaleString()} ({budgetPct}%)</span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${budgetPct >= 90 ? "bg-red-500" : budgetPct >= 70 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Department breakdown */}
        {deptStats.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Bucks by Department</h2>
            <div className="border rounded-lg divide-y">
              <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
                <span className="col-span-2">Department</span>
                <span className="text-right text-green-700">Credited</span>
                <span className="text-right text-red-600">Debited</span>
              </div>
              {deptStats.map((d, i) => (
                <div key={d.deptId ?? i} className="grid grid-cols-4 items-center px-4 py-3 text-sm">
                  <span className="col-span-2 font-medium">{d.deptName ?? "No Department"}</span>
                  <span className="text-right text-green-700 font-semibold">+{d.credited.toLocaleString()}</span>
                  <span className="text-right text-red-600 font-semibold">{d.debited > 0 ? `−${d.debited.toLocaleString()}` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {data.categoryStats.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Tag className="h-4 w-4" /> Bucks by Category</h2>
            <div className="border rounded-lg divide-y">
              {data.categoryStats.map((c, i) => {
                const pct = totalCatBucks > 0 ? Math.round((c.totalBucks / totalCatBucks) * 100) : 0;
                return (
                  <div key={c.categoryId ?? i} className="flex items-center gap-4 px-4 py-3">
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.categoryColor ?? "#9CA3AF" }} />
                    <span className="flex-1 text-sm">{c.categoryName ?? "Uncategorized"}</span>
                    <span className="text-sm font-semibold">{c.totalBucks.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top employees */}
        {data.topEmployees.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Top Recipients</h2>
            <div className="border rounded-lg divide-y">
              {data.topEmployees.map((e, i) => (
                <div key={e.userId} className="flex items-center gap-4 px-4 py-3">
                  <span className="text-sm text-muted-foreground font-mono w-6">#{i + 1}</span>
                  <span className="flex-1 text-sm">{e.name}</span>
                  <span className="text-sm font-semibold text-green-700">{e.received.toLocaleString()} bucks</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-6 text-xs text-muted-foreground text-center">
          Generated by Better Bucks · betterbucks.net
        </div>
      </div>
    </div>
  );
}

export default function AdminDocumentsPage() {
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [printingReport, setPrintingReport] = useState<MonthlyReport | null>(null);

  const now = new Date();
  const [genYear, setGenYear] = useState(String(now.getFullYear()));
  const [genMonth, setGenMonth] = useState(String(now.getMonth() + 1));

  const { data: reports, isLoading } = useQuery<MonthlyReport[]>({
    queryKey: [`/api/organizations/${currentUser?.organizationId}/reports`],
    enabled: !!currentUser?.organizationId,
  });

  const { mutate: generateReport, isPending: generating } = useMutation({
    mutationFn: () => apiRequest("POST", `/api/organizations/${currentUser?.organizationId}/reports/generate`, {
      year: parseInt(genYear),
      month: parseInt(genMonth),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentUser?.organizationId}/reports`] });
      toast({ title: "Report generated", description: `${MONTH_NAMES[parseInt(genMonth) - 1]} ${genYear} report is ready.` });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <AdminLayout>
      {printingReport && (
        <PrintableReport report={printingReport} onClose={() => setPrintingReport(null)} />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-documents-title">Documents</h1>
          <p className="text-muted-foreground mt-1">Monthly activity reports for your organization</p>
        </div>

        {/* Generate Report Card */}
        <Card data-testid="card-generate-report">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Generate Report
            </CardTitle>
            <CardDescription>
              Generate a monthly report for any period. Reports include bucks activity, category breakdown, budget usage, and top employees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-sm font-medium">Month</label>
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger className="w-40" data-testid="select-gen-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Year</label>
                <Select value={genYear} onValueChange={setGenYear}>
                  <SelectTrigger className="w-28" data-testid="select-gen-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => generateReport()}
                disabled={generating}
                data-testid="button-generate-report"
              >
                {generating ? <><SpinningLogo className="mr-2 h-4 w-4" /> Generating…</> : <><RefreshCw className="mr-2 h-4 w-4" /> Generate</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing reports */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Saved Reports
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <SpinningLogo className="h-6 w-6" />
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map(report => (
                <ReportCard key={report.id} report={report} onPrint={setPrintingReport} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground">No reports yet. Generate your first report above.</p>
                <p className="text-xs text-muted-foreground mt-1">Reports are also auto-generated on the 1st of each month.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body > div:not(#printable-report) { display: none !important; }
          #printable-report { position: static !important; }
        }
      `}</style>
    </AdminLayout>
  );
}
