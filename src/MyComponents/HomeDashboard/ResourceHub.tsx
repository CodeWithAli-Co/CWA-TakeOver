import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { 
  Code2, Bug, Cpu, Database, Gauge, GitPullRequest, 
  AlertCircle, CheckCircle2, Clock, Zap, Shield 
} from "lucide-react";

const MetricCard = ({ title, value, change, status }: {
  title: string;
  value: string;
  change: string;
  status: 'success' | 'warning' | 'error';
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="p-4 rounded-lg bg-black/60 border border-red-900/30"
  >
    <div className="flex justify-between items-start">
      <span className="text-sm text-amber-50/70">{title}</span>
      <Badge 
        variant="outline" 
        className={`
          ${status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'}
        `}
      >
        {change}
      </Badge>
    </div>
    <div className="mt-2 text-xl font-bold text-amber-50">{value}</div>
  </motion.div>
);

const ResourceMetric = ({ icon: Icon, label, value, status }: {
  icon: any;
  label: string;
  value: string;
  status: 'normal' | 'warning' | 'critical';
}) => (
  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-900/10">
    <div className={`p-2 rounded-lg ${
      status === 'normal' ? 'bg-emerald-500/20' :
      status === 'warning' ? 'bg-amber-500/20' :
      'bg-red-500/20'
    }`}>
      <Icon className={`h-4 w-4 ${
        status === 'normal' ? 'text-emerald-500' :
        status === 'warning' ? 'text-amber-500' :
        'text-red-500'
      }`} />
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-amber-50">{label}</span>
        <span className="text-xs text-amber-50/70">{value}</span>
      </div>
    </div>
  </div>
);

export const DeveloperResourceHub = () => {
  return (
    <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-amber-50">Developer Resource Hub</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-red-900/20 text-red-400">
              Live Updates
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              className="border-red-900/30 text-amber-50"
            >
              View Details
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="bg-black/40 border border-red-900/30">
            <TabsTrigger 
              value="performance" 
              className="data-[state=active]:bg-red-900/20"
            >
              Performance
            </TabsTrigger>
            <TabsTrigger 
              value="resources" 
              className="data-[state=active]:bg-red-900/20"
            >
              Resources
            </TabsTrigger>
            <TabsTrigger 
              value="quality" 
              className="data-[state=active]:bg-red-900/20"
            >
              Quality Control
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard
                title="API Response Time"
                value="124ms"
                change="-12ms"
                status="success"
              />
              <MetricCard
                title="Frontend Load Time"
                value="1.8s"
                change="+0.3s"
                status="warning"
              />
              <MetricCard
                title="Database Queries"
                value="892/min"
                change="+5%"
                status="success"
              />
              <MetricCard
                title="Error Rate"
                value="0.12%"
                change="-0.05%"
                status="success"
              />
            </div>

            <Card className="bg-black/60 border-red-900/30">
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-amber-50 mb-3">Live Performance Metrics</h3>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {[
                      { icon: Zap, label: "API Endpoint /users", value: "89ms", status: 'normal' },
                      { icon: Cpu, label: "Worker Process", value: "72% CPU", status: 'warning' },
                      { icon: Database, label: "DB Connection Pool", value: "87%", status: 'warning' },
                      { icon: Gauge, label: "Memory Usage", value: "64%", status: 'normal' },
                      { icon: Clock, label: "Avg. Response Time", value: "156ms", status: 'normal' }
                    ].map((metric, i) => (
                      <ResourceMetric key={i} {...metric} status={metric.status as 'normal' | 'warning' | 'critical'} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard
                title="Storage Usage"
                value="472GB"
                change="86% of limit"
                status="warning"
              />
              <MetricCard
                title="API Calls"
                value="125K"
                change="43% of quota"
                status="success"
              />
              <MetricCard
                title="CDN Bandwidth"
                value="1.2TB"
                change="92% of limit"
                status="error"
              />
              <MetricCard
                title="Cache Hit Rate"
                value="94.5%"
                change="+2.3%"
                status="success"
              />
            </div>

            <Card className="bg-black/60 border-red-900/30">
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-amber-50 mb-3">Resource Allocation</h3>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {[
                      { icon: Database, label: "Database Storage", value: "472GB / 550GB", status: 'warning' },
                      { icon: Cpu, label: "Processing Units", value: "8/10 active", status: 'normal' },
                      { icon: Shield, label: "SSL Certificates", value: "2 expiring soon", status: 'warning' },
                      { icon: Zap, label: "API Rate Limit", value: "43% utilized", status: 'normal' }
                    ].map((metric, i) => (
                      <ResourceMetric key={i} {...metric} status={metric.status as 'normal' | 'warning' | 'critical'} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard
                title="Code Coverage"
                value="87%"
                change="+2%"
                status="success"
              />
              <MetricCard
                title="Open Issues"
                value="24"
                change="+5"
                status="warning"
              />
              <MetricCard
                title="PR Review Time"
                value="4.2h"
                change="-1.1h"
                status="success"
              />
              <MetricCard
                title="Build Success"
                value="98.2%"
                change="-0.3%"
                status="success"
              />
            </div>

            <Card className="bg-black/60 border-red-900/30">
              <CardContent className="pt-4">
                <h3 className="text-sm font-medium text-amber-50 mb-3">Quality Metrics</h3>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {[
                      { icon: Code2, label: "Code Quality Score", value: "A+", status: 'normal' as 'normal' },
                      { icon: Bug, label: "Active Bugs", value: "12 open", status: 'warning' as 'warning' },
                      { icon: GitPullRequest, label: "Open PRs", value: "8 pending", status: 'normal' as 'normal' },
                      { icon: AlertCircle, label: "Security Issues", value: "None", status: 'normal' as 'normal' },
                      { icon: CheckCircle2, label: "Test Coverage", value: "87%", status: 'normal' as 'normal' }
                    ].map((metric, i) => (
                      <ResourceMetric key={i} {...metric} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};