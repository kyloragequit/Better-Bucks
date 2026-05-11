import { useState, useRef, useCallback } from "react";
import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, RefreshCw, Calendar, BarChart2, Users, ShoppingCart, Tag, Building2, DollarSign, Loader2 } from "lucide-react";
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
  LabelList,
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
  const [showTable, setShowTable] = useState(false);
  const chartData = dailySpending
    .filter(d => d.credited > 0 || d.debited > 0)
    .map(d => ({
      date: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      awarded: +(d.credited / rate).toFixed(2),
      spent: +(d.debited / rate).toFixed(2),
    }));
  if (chartData.length === 0) return null;
  const showLabels = chartData.length <= 14;
  return (
    <div data-testid="chart-daily-spending">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <DollarSign className="h-3 w-3" /> Daily Dollar Spending
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={() => setShowTable(t => !t)}
          aria-pressed={showTable}
          data-testid="button-toggle-daily-spending-table"
        >
          {showTable ? "View chart" : "View as table"}
        </Button>
      </div>
      {showTable ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <caption className="sr-only">Daily Dollar Spending — Awarded and Spent</caption>
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-green-700">Awarded ($)</th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-red-600">Spent ($)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={d.date} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                  <td className="px-3 py-1.5">{d.date}</td>
                  <td className="px-3 py-1.5 text-right text-green-700 font-medium">${d.awarded.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right text-red-600 font-medium">${d.spent.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label="Line chart showing daily awarded and spent dollar amounts">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: showLabels ? 18 : 4, right: 8, left: 0, bottom: 0 }}>
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
              <Line type="monotone" dataKey="awarded" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} name="Awarded">
                {showLabels && (
                  <LabelList
                    dataKey="awarded"
                    position="top"
                    style={{ fontSize: 9, fill: "#15803d", fontWeight: 500 }}
                    formatter={(v: number) => v > 0 ? `$${v}` : ""}
                  />
                )}
              </Line>
              <Line type="monotone" dataKey="spent" stroke="#dc2626" strokeWidth={2} dot={{ r: 3, fill: "#dc2626" }} name="Spent">
                {showLabels && (
                  <LabelList
                    dataKey="spent"
                    position="bottom"
                    style={{ fontSize: 9, fill: "#b91c1c", fontWeight: 500 }}
                    formatter={(v: number) => v > 0 ? `$${v}` : ""}
                  />
                )}
              </Line>
            </LineChart>
          </ResponsiveContainer>
          {/* Screen-reader accessible data table (always present for AT users) */}
          <table className="sr-only">
            <caption>Daily Dollar Spending — Awarded and Spent</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Awarded ($)</th>
                <th scope="col">Spent ($)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map(d => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.awarded.toFixed(2)}</td>
                  <td>{d.spent.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, onPrint, downloadingId }: { report: MonthlyReport; onPrint: (r: MonthlyReport) => void; downloadingId: number | null }) {
  const data = report.reportData;
  const budgetPct = data.monthlyBudgetBucks > 0 ? Math.round((data.budgetUsed / data.monthlyBudgetBucks) * 100) : null;
  const totalCatBucks = data.categoryStats.reduce((s, c) => s + c.totalBucks, 0);
  const deptStats: DeptStat[] = data.departmentStats ?? [];
  const rate = data.conversionRate ?? 100;
  const isDownloading = downloadingId === report.id;
  const isAnyDownloading = downloadingId !== null;

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
              disabled={isAnyDownloading}
              data-testid={`button-download-report-${report.year}-${report.month}`}
            >
              {isDownloading ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF</>
              )}
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

function ReportPdfContent({ report }: { report: MonthlyReport }) {
  const data = report.reportData;
  const budgetPct = data.monthlyBudgetBucks > 0 ? Math.round((data.budgetUsed / data.monthlyBudgetBucks) * 100) : null;
  const totalCatBucks = data.categoryStats.reduce((s, c) => s + c.totalBucks, 0);
  const deptStats: DeptStat[] = data.departmentStats ?? [];
  const rate = data.conversionRate ?? 100;

  return (
    <div style={{ width: 595, padding: 40, fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13, color: "#1a1a1a", background: "#fff" }}>
      <div style={{ borderBottom: "2px solid #162A4A", paddingBottom: 16, marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#162A4A" }}>Monthly Activity Report</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>{data.orgName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#162A4A" }}>{MONTH_NAMES[report.month - 1]} {report.year}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Generated {new Date(report.generatedAt).toLocaleDateString()}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{rate} bucks = $1.00</div>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#162A4A" }}>Summary</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Bucks Awarded</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>{data.totalAwarded.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#16a34a" }}>${(data.totalAwarded / rate).toFixed(2)}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Bucks Spent</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c" }}>{data.totalSpent.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#dc2626" }}>${(data.totalSpent / rate).toFixed(2)}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Active Employees</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.activeEmployees ?? 0}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Store Orders</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.totalOrders}</div>
        </div>
      </div>

      {budgetPct !== null && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#162A4A" }}>Monthly Budget</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "#6b7280" }}>Bucks used</span>
              <span style={{ fontWeight: 600 }}>{data.budgetUsed.toLocaleString()} / {data.monthlyBudgetBucks.toLocaleString()} ({budgetPct}%)</span>
            </div>
            <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(budgetPct, 100)}%`, background: budgetPct >= 90 ? "#ef4444" : budgetPct >= 70 ? "#f59e0b" : "#22c55e" }} />
            </div>
          </div>
        </div>
      )}

      {deptStats.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#162A4A" }}>Bucks by Department</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f9fafb" }}>
              <span>Department</span>
              <span style={{ textAlign: "right", color: "#15803d" }}>Credited</span>
              <span style={{ textAlign: "right", color: "#dc2626" }}>Debited</span>
            </div>
            {deptStats.map((d, i) => (
              <div key={d.deptId ?? i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "8px 12px", fontSize: 12, borderTop: "1px solid #e5e7eb" }}>
                <span style={{ fontWeight: 500 }}>{d.deptName ?? "No Department"}</span>
                <span style={{ textAlign: "right", color: "#15803d", fontWeight: 600 }}>+{d.credited.toLocaleString()}</span>
                <span style={{ textAlign: "right", color: "#dc2626", fontWeight: 600 }}>{d.debited > 0 ? `−${d.debited.toLocaleString()}` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.categoryStats.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#162A4A" }}>Bucks by Category</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            {data.categoryStats.map((c, i) => {
              const pct = totalCatBucks > 0 ? Math.round((c.totalBucks / totalCatBucks) * 100) : 0;
              return (
                <div key={c.categoryId ?? i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", fontSize: 12, borderTop: i > 0 ? "1px solid #e5e7eb" : "none" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: c.categoryColor ?? "#9CA3AF" }} />
                  <span style={{ flex: 1 }}>{c.categoryName ?? "Uncategorized"}</span>
                  <span style={{ fontWeight: 600 }}>{c.totalBucks.toLocaleString()}</span>
                  <span style={{ color: "#6b7280", width: 40, textAlign: "right" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.topEmployees.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#162A4A" }}>Top Recipients</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            {data.topEmployees.map((e, i) => (
              <div key={e.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", fontSize: 12, borderTop: i > 0 ? "1px solid #e5e7eb" : "none" }}>
                <span style={{ color: "#6b7280", fontFamily: "monospace", width: 24 }}>#{i + 1}</span>
                <span style={{ flex: 1 }}>{e.name}</span>
                <span style={{ fontWeight: 600, color: "#15803d" }}>{e.received.toLocaleString()} bucks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 20, fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
        Generated by Better Bucks · betterbucks.net
      </div>
    </div>
  );
}

async function downloadReportPdf(report: MonthlyReport, containerEl: HTMLDivElement) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(containerEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pxW = canvas.width;
  const pxH = canvas.height;

  const pdfW = 595.28;
  const pdfH = (pxH * pdfW) / pxW;

  const pageH = 841.89;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  if (pdfH <= pageH) {
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
  } else {
    let yOffset = 0;
    let page = 0;
    while (yOffset < pdfH) {
      if (page > 0) pdf.addPage();
      const srcY = (yOffset / pdfH) * pxH;
      const sliceH = Math.min(pageH, pdfH - yOffset);
      const srcSliceH = (sliceH / pdfH) * pxH;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = pxW;
      sliceCanvas.height = srcSliceH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcY, pxW, srcSliceH, 0, 0, pxW, srcSliceH);

      pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, sliceH);
      yOffset += pageH;
      page++;
    }
  }

  const fileName = `BetterBucks_Report_${MONTH_NAMES[report.month - 1]}_${report.year}.pdf`;
  pdf.save(fileName);
}

export default function AdminDocumentsPage() {
  const { data: currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [pdfReport, setPdfReport] = useState<MonthlyReport | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPdf = useCallback(async (report: MonthlyReport) => {
    if (downloadingId !== null) return;
    setDownloadingId(report.id);
    setPdfReport(report);

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const el = pdfContainerRef.current;
      if (!el) {
        toast({ title: "PDF generation failed", description: "Could not prepare report content. Please try again.", variant: "destructive" });
        return;
      }
      await downloadReportPdf(report, el);
      toast({ title: "PDF downloaded", description: `${MONTH_NAMES[report.month - 1]} ${report.year} report saved.` });
    } catch (err) {
      toast({ title: "PDF generation failed", description: String(err), variant: "destructive" });
    } finally {
      setDownloadingId(null);
      setPdfReport(null);
    }
  }, [toast, downloadingId]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <AdminLayout>
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {pdfReport && (
          <div ref={pdfContainerRef}>
            <ReportPdfContent report={pdfReport} />
          </div>
        )}
      </div>

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
                <ReportCard key={report.id} report={report} onPrint={handleDownloadPdf} downloadingId={downloadingId} />
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

    </AdminLayout>
  );
}
