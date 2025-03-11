import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", users: 450, applications: 650, placements: 230 },
  { month: "Feb", users: 620, applications: 780, placements: 285 },
  { month: "Mar", users: 580, applications: 820, placements: 310 },
  { month: "Apr", users: 750, applications: 960, placements: 380 },
  { month: "May", users: 820, applications: 1100, placements: 425 },
  { month: "Jun", users: 950, applications: 1250, placements: 520 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-red-900/30 bg-black/60 p-2 shadow-sm backdrop-blur-sm">
        <div className="text-sm font-medium text-amber-50">{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-amber-50/70">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const PerformanceGraph = () => {
  return (
    <Card className="bg-black/40 border-red-900/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-amber-50">Performance Metrics</CardTitle>
        <div className="flex items-center gap-4">
          {[
            { label: "Users", color: "#ef4444" },
            { label: "Applications", color: "#f97316" },
            { label: "Placements", color: "#d97706" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-amber-50/70">{item.label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: 10,
                left: -20,
                bottom: 5,
              }}
            >
              <defs>
                {/* Gradients for bars */}
                <linearGradient id="users" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="applications" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="placements" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97706" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#d97706" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#991b1b"
                opacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke="#b45309"
                tick={{ fill: "#b45309", fontSize: 12 }}
                tickLine={{ stroke: "#b45309" }}
                axisLine={{ stroke: "#991b1b", strokeWidth: 1 }}
              />
              <YAxis
                stroke="#b45309"
                tick={{ fill: "#b45309", fontSize: 12 }}
                tickLine={{ stroke: "#b45309" }}
                axisLine={{ stroke: "#991b1b", strokeWidth: 1 }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#991b1b", opacity: 0.1 }}
              />
              <Bar
                dataKey="users"
                fill="url(#users)"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                animationDuration={2000}
              />
              <Bar
                dataKey="applications"
                fill="url(#applications)"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                animationDuration={2000}
                animationBegin={300}
              />
              <Bar
                dataKey="placements"
                fill="url(#placements)"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                animationDuration={2000}
                animationBegin={600}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
