import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MonthlySpend = { month: string; total: number };
type ChartPoint = { label: string; total: number };

function buildChartData(history: MonthlySpend[]): ChartPoint[] {
  if (history.length === 0) return [];
  const byMonth = new Map(history.map((h) => [h.month, h.total]));
  const earliest = history[0].month;
  const [eYear, eMon] = earliest.split("-").map(Number);
  const now = new Date();
  const result: ChartPoint[] = [];
  let y = eYear;
  let m = eMon;
  while (
    y < now.getFullYear() ||
    (y === now.getFullYear() && m <= now.getMonth() + 1)
  ) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const d = new Date(y, m - 1, 1);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    result.push({ label, total: byMonth.get(key) ?? 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}

function formatCompact(n: number): string {
  if (n >= 1000)
    return `${n / 1000 % 1 === 0 ? n / 1000 : (n / 1000).toFixed(1)}k`;
  return String(n);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md bg-primary px-3 py-1.5 text-xs text-white shadow-md">
      <p className="font-semibold">{label}</p>
      <p>{payload[0].value.toLocaleString()} Bucks</p>
    </div>
  );
}

function CompactLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
}) {
  const { x = 0, y = 0, width = 0, value = 0 } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fontSize={9}
      fill="#94a3b8"
    >
      {formatCompact(value)}
    </text>
  );
}

export function SpendingChart() {
  const { data: authUser } = useUser();

  const { data: history = [], isError } = useQuery<MonthlySpend[]>({
    queryKey: ["/api/wallet/redemptions/history?months=12"],
    enabled: !!authUser,
  });

  const chartData = buildChartData(history);

  if (isError) {
    return (
      <Card className="shadow-md border-border/60 mb-8">
        <CardContent className="pt-5 pb-5 text-sm text-destructive">
          Could not load spending history.
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0 || chartData.every((d) => d.total === 0)) {
    return null;
  }

  const tickFormatter = (value: string, index: number): string => {
    const show =
      chartData.length <= 12 ||
      index % Math.ceil(chartData.length / 8) === 0 ||
      index === chartData.length - 1;
    return show ? value.split(" ")[0] : "";
  };

  return (
    <Card className="shadow-md border-border/60 mb-8" data-testid="card-spending-chart">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="h-4 w-4 text-primary" />
          Spending over time
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 8, left: 0, bottom: 4 }}
            barCategoryGap="25%"
          >
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickFormatter={tickFormatter}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              tickFormatter={formatCompact}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="total" content={<CompactLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
