import { useMemo, useState } from "react";
import { ExternalLink, Link2, Pencil, Search, ServerCog } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type SourceRow = {
  id: number;
  amcId: number;
  amcName: string;
  amcSlug: string;
  sourceUrl: string;
  sourceKind: "page" | "direct_pdf";
  documentScope: "unknown" | "amc" | "scheme" | "both";
  discoveryMode: "html" | "dynamic" | "selector" | "direct" | "manual";
  notes: string | null;
  priority: number;
  isActive: number;
  lastCheckedAt: Date | null;
};

const modeTone: Record<string, string> = {
  html: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  dynamic: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  selector: "bg-violet-500/10 text-violet-300 border-violet-500/25",
  direct: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  manual: "bg-rose-500/10 text-rose-300 border-rose-500/25",
};

export default function AmcRegistryPage() {
  const utils = trpc.useUtils();
  const sourcesQuery = trpc.amcs.listSources.useQuery();
  const seedMutation = trpc.amcs.seedProvidedSources.useMutation({
    onSuccess: ({ count }) => {
      toast.success(`${count} AMC sources registered.`);
      utils.amcs.listSources.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const discoveryMutation = trpc.amcs.discoverSchemes.useMutation({
    onSuccess: ({ totalDiscovered, amcsProcessed }) => {
      toast.success(`${totalDiscovered} scheme records processed across ${amcsProcessed} AMC sources.`);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.amcs.updateSource.useMutation({
    onSuccess: () => {
      toast.success("Source URL updated.");
      utils.amcs.listSources.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<SourceRow | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const visibleSources = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (sourcesQuery.data ?? []).filter((source) => !needle || source.amcName.toLowerCase().includes(needle) || source.sourceUrl.toLowerCase().includes(needle));
  }, [filter, sourcesQuery.data]);

  const openEdit = (source: SourceRow) => {
    setEditing(source);
    setSourceUrl(source.sourceUrl);
  };

  const saveSource = () => {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, sourceUrl });
    setEditing(null);
  };

  return (
    <AppLayout>
      <section className="p-6 lg:p-9 space-y-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Source Directory</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">AMC Registry</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The registered source pages guide scheme discovery and factsheet retrieval. Each AMC can use a consolidated factsheet, a scheme-specific document, or a dynamic first-party download page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => discoveryMutation.mutate()} disabled={discoveryMutation.isPending}>
              <Search className="h-4 w-4" />
              {discoveryMutation.isPending ? "Discovering…" : "Discover schemes"}
            </Button>
            <Button className="gap-2" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <ServerCog className="h-4 w-4" />
              {seedMutation.isPending ? "Registering…" : "Register provided sources"}
            </Button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-card border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground">Registered AMCs</p><p className="mt-2 text-3xl font-semibold text-foreground">{sourcesQuery.data?.length ?? "—"}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground">Direct factsheet sources</p><p className="mt-2 text-3xl font-semibold text-foreground">{sourcesQuery.data?.filter((source) => source.discoveryMode === "html" || source.discoveryMode === "direct").length ?? "—"}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground">Dynamic / selector sources</p><p className="mt-2 text-3xl font-semibold text-foreground">{sourcesQuery.data?.filter((source) => source.discoveryMode === "dynamic" || source.discoveryMode === "selector").length ?? "—"}</p></CardContent></Card>
        </div>

        <Card className="border-border bg-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter AMC or source URL" className="pl-9 bg-background" /></div>
            <p className="text-xs text-muted-foreground">{visibleSources.length} source{visibleSources.length === 1 ? "" : "s"} shown</p>
          </div>
          <div className="max-h-[600px] overflow-auto">
            {sourcesQuery.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div> : (
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-medium">AMC</th><th className="px-5 py-3 font-medium">Discovery</th><th className="px-5 py-3 font-medium">Document scope</th><th className="px-5 py-3 font-medium">Registered source</th><th className="px-5 py-3 font-medium text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {visibleSources.map((source) => <tr key={source.id} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium text-foreground">{source.amcName}</td><td className="px-5 py-4"><Badge variant="outline" className={modeTone[source.discoveryMode] ?? ""}>{source.discoveryMode}</Badge></td><td className="px-5 py-4 capitalize text-muted-foreground">{source.documentScope}</td><td className="max-w-[380px] px-5 py-4"><a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"><Link2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{source.sourceUrl}</span><ExternalLink className="h-3 w-3 shrink-0" /></a></td><td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEdit(source)}><Pencil className="h-3.5 w-3.5" />Edit</Button></td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </section>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader><DialogTitle>Edit registered source</DialogTitle><DialogDescription>{editing?.amcName} — update the landing page or direct PDF endpoint.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-2"><Label htmlFor="source-url">Source URL</Label><Input id="source-url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="bg-background" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveSource} disabled={updateMutation.isPending}>Save source</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
