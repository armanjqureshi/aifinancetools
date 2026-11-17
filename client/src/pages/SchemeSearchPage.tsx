import { useMemo, useState } from "react";
import { Building2, FileSearch, Loader2, Plus, Search } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SchemeSearchPage() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const searchTerm = useMemo(() => query.trim(), [query]);
  const results = trpc.amcs.searchSchemes.useQuery({ query: searchTerm || "xx" }, { enabled: searchTerm.length >= 2 });
  const addFund = trpc.funds.add.useMutation({
    onSuccess: ({ fundHouse }) => { toast.success(`Added to the fund list (${fundHouse}).`); utils.funds.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  return (
    <AppLayout>
      <section className="p-6 lg:p-9 space-y-7">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Discovery Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Scheme Search</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Drop an exact or partial scheme name. The search checks the growing factsheet-derived scheme catalog across the registered AMC directory and then lets you add a matched scheme to your monitored list.</p>
        </header>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="p-5 sm:p-7">
            <div className="relative max-w-3xl"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “HDFC Flexi Cap”, “Small Cap”, or an exact scheme name" className="h-13 bg-background pl-12 text-base shadow-sm" /></div>
            <p className="mt-3 text-xs text-muted-foreground">Partial names are supported. Scheme records are added automatically as AMC factsheets are processed, and can also be registered manually through the AMC workflow.</p>
          </CardContent>
        </Card>

        {searchTerm.length < 2 ? (
          <Card className="border-dashed border-border bg-card"><CardContent className="flex min-h-56 flex-col items-center justify-center text-center"><FileSearch className="h-10 w-10 text-primary/70" /><h2 className="mt-4 font-semibold text-foreground">Search the registered AMC universe</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Enter at least two characters to search across schemes discovered from registered AMC factsheets.</p></CardContent></Card>
        ) : results.isLoading ? (
          <Card className="bg-card border-border"><CardContent className="flex min-h-56 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Searching scheme catalog…</CardContent></Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <Card className="border-border bg-card overflow-hidden"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold text-foreground">Matching schemes</h2><p className="mt-1 text-xs text-muted-foreground">{results.data?.schemes.length ?? 0} records found for “{searchTerm}”</p></div><div className="divide-y divide-border">{results.data?.schemes.length ? results.data.schemes.map((scheme) => <div key={scheme.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-foreground">{scheme.name}</p><div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{scheme.amcName}{scheme.isin ? <span>• {scheme.isin}</span> : null}</div></div><Button size="sm" className="gap-1.5" disabled={addFund.isPending} onClick={() => addFund.mutate({ name: scheme.name, isin: scheme.isin ?? undefined })}><Plus className="h-3.5 w-3.5" />Monitor</Button></div>) : <div className="p-8 text-center text-sm text-muted-foreground">No scheme record yet. Once a factsheet source is processed, its scheme names become searchable here.</div>}</div></Card>
            <Card className="border-border bg-card"><CardContent className="p-5"><h2 className="font-semibold text-foreground">AMC directory signals</h2><p className="mt-1 text-xs text-muted-foreground">Relevant AMCs in the registry</p><div className="mt-4 flex flex-wrap gap-2">{results.data?.matchingAmcs.length ? results.data.matchingAmcs.map((amc) => <Badge key={amc.id} variant="outline" className="border-primary/30 bg-primary/5 text-primary">{amc.name}</Badge>) : <p className="text-sm text-muted-foreground">No AMC name match. The search will rely on scheme names as the catalog grows.</p>}</div></CardContent></Card>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
