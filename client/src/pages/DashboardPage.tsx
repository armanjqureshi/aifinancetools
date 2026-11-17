import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import { Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    running: { label: "Running", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    failed: { label: "Failed", className: "bg-red-500/15 text-red-400 border-red-500/30" },
    downloading: { label: "Downloading", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    parsing: { label: "Parsing", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  };
  const config = map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const utils = trpc.useUtils();
  const { data: latestRun, isLoading: latestLoading } = trpc.runs.latest.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 5000 });
  const { data: runHistory, isLoading: historyLoading } = trpc.runs.list.useQuery({ limit: 5 }, { enabled: isAuthenticated });
  const activeRunId = selectedRunId ?? latestRun?.id;
  const { data: fundResults, isLoading: resultsLoading } = trpc.runs.getFundResults.useQuery(
    { runJobId: activeRunId! },
    { enabled: !!activeRunId && isAuthenticated, refetchInterval: latestRun?.status === "running" ? 3000 : false }
  );
  const { data: allocations, isLoading: allocLoading } = trpc.runs.getAllocations.useQuery(
    { runJobId: activeRunId! },
    { enabled: !!activeRunId && isAuthenticated }
  );
  const { data: excelData } = trpc.runs.getExcelUrl.useQuery(
    { runJobId: activeRunId! },
    { enabled: !!activeRunId && isAuthenticated }
  );

  const triggerMutation = trpc.runs.trigger.useMutation({
    onSuccess: () => {
      toast.success("Pipeline started! Downloading factsheets...");
      utils.runs.latest.invalidate();
      utils.runs.list.invalidate();
      setIsTriggering(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsTriggering(false);
    },
  });

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Sign in to continue</h2>
            <p className="text-muted-foreground text-sm">Access your mutual fund dashboard</p>
            <Button onClick={() => startLogin()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Sign In
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleRunNow = () => {
    setIsTriggering(true);
    triggerMutation.mutate();
  };

  const isRunning = latestRun?.status === "running" || latestRun?.status === "pending";

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Run Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Monitor pipeline status and extracted fund data</p>
          </div>
          <Button
            onClick={handleRunNow}
            disabled={isTriggering || isRunning}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-medium"
          >
            {isTriggering || isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-4 h-4" /> Run Now</>
            )}
          </Button>
        </div>

        {/* Stats */}
        {latestLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Last Run Status" value={latestRun?.status ?? "—"} icon={RefreshCw} color="bg-primary/10 text-primary" />
            <StatCard label="Funds Processed" value={latestRun ? `${latestRun.successCount ?? 0} / ${latestRun.totalFunds ?? 0}` : "—"} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Failed" value={latestRun?.failedCount ?? "—"} icon={XCircle} color="bg-red-500/10 text-red-400" />
            <StatCard label="Last Run Date" value={latestRun ? new Date(latestRun.startedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Never"} icon={Clock} color="bg-blue-500/10 text-blue-400" />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Run History */}
          <div className="xl:col-span-1">
            <Card className="bg-card border-border h-full">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Run History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : !runHistory?.length ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No runs yet. Click "Run Now" to start.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {runHistory.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${activeRunId === run.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <StatusBadge status={run.status} />
                          <span className="text-xs text-muted-foreground">{run.triggeredBy}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(run.startedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-foreground mt-0.5">{run.successCount}/{run.totalFunds} funds</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-Fund Results */}
          <div className="xl:col-span-2">
            <Card className="bg-card border-border h-full">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" /> Per-Fund Status
                  {activeRunId && <span className="text-xs text-muted-foreground font-normal">Run #{activeRunId}</span>}
                </CardTitle>
                {excelData?.url && (
                  <a href={excelData.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel
                    </Button>
                  </a>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {!activeRunId ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Select a run from history to view details.</div>
                ) : resultsLoading ? (
                  <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : !fundResults?.length ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No fund results for this run.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fund Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">House</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {fundResults.map((r) => (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 text-foreground font-medium max-w-[200px] truncate">{r.fundName}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{r.fundHouse}</span>
                            </td>
                            <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                            <td className="px-4 py-2.5">
                              {r.pdfFileUrl ? (
                                <a href={r.pdfFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : r.errorMessage ? (
                                <span className="text-xs text-red-400 truncate max-w-[120px] block" title={r.errorMessage}>Error</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Extracted Data Preview */}
        {allocations && allocations.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" /> Extracted Data Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-6">
                {allocations.slice(0, 5).map((fund) => (
                  <div key={fund.fundId} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{fund.fundName}</h3>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{fund.fundHouse}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {fund.assetAllocations.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Asset Allocation</p>
                          <div className="space-y-1.5">
                            {fund.assetAllocations.map((a) => (
                              <div key={a.label} className="flex items-center justify-between">
                                <span className="text-xs text-foreground">{a.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(parseFloat(a.percentage ?? "0"), 100)}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{a.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {fund.sectorAllocations.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Sector Allocation</p>
                          <div className="space-y-1.5">
                            {fund.sectorAllocations.slice(0, 6).map((s) => (
                              <div key={s.label} className="flex items-center justify-between">
                                <span className="text-xs text-foreground truncate max-w-[140px]">{s.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-chart-2 rounded-full" style={{ width: `${Math.min(parseFloat(s.percentage ?? "0"), 100)}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{s.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {fund.marketCapAllocations.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Market Cap Allocation</p>
                          <div className="space-y-1.5">
                            {fund.marketCapAllocations.map((m) => (
                              <div key={m.label} className="flex items-center justify-between">
                                <span className="text-xs text-foreground truncate max-w-[140px]">{m.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(parseFloat(m.percentage ?? "0"), 100)}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{m.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-b border-border" />
                  </div>
                ))}
                {allocations.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+ {allocations.length - 5} more funds — download Excel for full data</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
