import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, Settings, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: cronConfig, isLoading } = trpc.runs.getCronConfig.useQuery(undefined, { enabled: isAuthenticated });

  const updateCronMutation = trpc.runs.updateCronConfig.useMutation({
    onSuccess: () => {
      toast.success("Settings updated");
      utils.runs.getCronConfig.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Sign in to view settings</h2>
            <Button onClick={() => startLogin()}>Sign In</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure your monthly automation schedule</p>
        </div>

        {/* Monthly Schedule */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" /> Monthly Automation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable Monthly Run</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Automatically download and extract factsheets on the 1st of each month</p>
                  </div>
                  <Switch
                    checked={cronConfig?.isEnabled === 1}
                    onCheckedChange={(checked) =>
                      updateCronMutation.mutate({ isEnabled: checked ? 1 : 0 })
                    }
                  />
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Schedule: </span>
                      <span className="text-foreground font-medium">1st of every month at 6:00 AM UTC</span>
                    </div>
                  </div>
                  {cronConfig?.nextRunAt && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Next run: </span>
                        <span className="text-foreground font-medium">
                          {new Date(cronConfig.nextRunAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  )}
                  {cronConfig?.lastRunAt && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Last run: </span>
                        <span className="text-foreground font-medium">
                          {new Date(cronConfig.lastRunAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">About Monthly Automation</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The monthly automation runs on the 1st of each month at 6:00 AM UTC. It downloads the latest factsheets from all fund house websites, extracts sector and asset allocation data, and generates a consolidated Excel report. The cron job is managed by the Manus platform and runs independently of your browser session.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  To activate the monthly schedule, deploy this application first using the Publish button, then the cron will be registered automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

