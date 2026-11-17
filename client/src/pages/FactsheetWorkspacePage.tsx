import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Circle, Download, ExternalLink, FileText, Layers3, Loader2, Plus, RefreshCw, Search, Send, Sparkles, Upload, User, X } from "lucide-react";
import { Streamdown } from "streamdown";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { goToLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { isFactsheetStale, mergeBulkDownloadResults, runBulkDownload, splitBulkSourcesByCache, type BulkDownloadResult } from "@/lib/bulkDownload";
import { toAllocationChartRows, type AllocationChartInput } from "@/lib/allocationChartData";
import { getCachedFactsheetSources } from "@/lib/cachedFactsheets";
import { refreshDownloadedFactsheetSelector } from "@/lib/factsheetSelectorRefresh";
import { chooseComparisonMarketCap } from "@/lib/schemeComparison";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ActiveDocument = {
  id: number;
  amcName: string;
  asOfLabel: string;
  fileUrl: string;
  resolvedPdfUrl?: string | null;
  textLength?: number;
  pdfReportingPeriodLabel?: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type BulkResult = BulkDownloadResult<ActiveDocument>;

type SelectedSourceFailure = {
  amcName: string;
  sourceUrl: string;
  error: string;
};

type ComparisonScheme = {
  key: string;
  documentId: number;
  amcName: string;
  asOfLabel: string;
  schemeName: string;
  allocations: Array<{ label: string; percentage: number }>;
  source: "factsheet" | "calculated" | "unavailable";
  note: string;
};

function formatVerifiedAt(value: Date | string | null | undefined) {
  if (!value) return "Not checked yet";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked yet";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const INDUSTRY_CHART_COLORS = ["#6d57aa", "#8a7cc9", "#4e85b8", "#4f7d68", "#d1993e", "#957e61", "#6c6a62", "#b0a9dc"];
const MARKET_CAP_CHART_COLORS = ["#6d57aa", "#4e85b8", "#4f7d68", "#d1993e", "#8a7cc9", "#957e61", "#6c6a62", "#b0a9dc"];
function AllocationBarChart({ title, items, colors }: { title: string; items: AllocationChartInput[]; colors: string[] }) {
  const rows = useMemo(() => toAllocationChartRows(items), [items]);
  if (rows.length === 0) return null;
  const chartHeight = Math.max(150, rows.length * 28);
  const hasMore = items.length > rows.length;

  return (
    <figure className="rounded-xl border border-border bg-[#f7f7f5] p-3" aria-label={`${title} chart`}>
      <figcaption className="mb-2 flex items-baseline justify-between gap-2"><span className="text-xs font-medium text-foreground">Visual breakdown</span><span className="text-[10px] text-muted-foreground">{hasMore ? `Top ${rows.length}` : `${rows.length} entries`}</span></figcaption>
      <div style={{ height: chartHeight }} role="img" aria-label={`${title}: ${rows.map((row) => `${row.label} ${row.percentage.toFixed(2)} percent`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#817f75", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" hide />
            <Tooltip
              cursor={{ fill: "rgba(109, 87, 170, 0.08)" }}
              contentStyle={{ background: "#ffffff", border: "1px solid #d4d4cf", borderRadius: "12px", color: "#272623", fontSize: "12px", boxShadow: "0 8px 24px rgba(39, 38, 35, 0.08)" }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, "Allocation"]}
              labelStyle={{ color: "#6c6a62" }}
            />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {rows.map((row) => <Cell key={row.label} fill={colors[row.index % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Bars follow the values in the adjacent table.{hasMore ? " Remaining parsed entries stay available in the table." : ""}</p>
    </figure>
  );
}

export default function FactsheetWorkspacePage() {
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [useArchivePeriod, setUseArchivePeriod] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null);
  const [selectedSchemeName, setSelectedSchemeName] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkAction, setBulkAction] = useState<"all" | "stale" | null>(null);
  const [selectedSourceFailure, setSelectedSourceFailure] = useState<SelectedSourceFailure | null>(null);
  const [comparisonSchemes, setComparisonSchemes] = useState<ComparisonScheme[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const officialPdfInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const amcsQuery = trpc.factsheets.listAmcs.useQuery(undefined, { enabled: isAuthenticated });
  const recentQuery = trpc.factsheets.recent.useQuery(undefined, { enabled: isAuthenticated });
  const archiveCoverageQuery = trpc.factsheets.archiveCoverage.useQuery(undefined, { enabled: isAuthenticated });
  const documentSchemesQuery = trpc.factsheets.documentSchemes.useQuery(
    { documentId: activeDocument?.id ?? 1 },
    { enabled: isAuthenticated && Boolean(activeDocument?.id) },
  );
  const schemeAllocationsQuery = trpc.factsheets.schemeAllocations.useQuery(
    { documentId: activeDocument?.id ?? 1, schemeName: selectedSchemeName || "No selected scheme" },
    { enabled: isAuthenticated && Boolean(activeDocument?.id) && Boolean(selectedSchemeName) },
  );

  useEffect(() => {
    setSelectedSchemeName("");
    setMessages([]);
  }, [activeDocument?.id]);
  const visibleAmcs = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (amcsQuery.data ?? []).filter((amc) => !needle || amc.name.toLowerCase().includes(needle));
  }, [amcsQuery.data, filter]);
  const cachedAmcs = useMemo(() => getCachedFactsheetSources(amcsQuery.data ?? []), [amcsQuery.data]);
  const staleAmcCount = useMemo(() => (amcsQuery.data ?? []).filter((source) => isFactsheetStale(source)).length, [amcsQuery.data]);
  const selectedAmc = (amcsQuery.data ?? []).find((amc) => amc.slug === selectedSlug);
  const bulkSummary = useMemo(() => ({
    downloaded: bulkResults.filter((item) => item.status === "success").length,
    blocked: bulkResults.filter((item) => item.failureKind === "blocked").length,
    unavailable: bulkResults.filter((item) => item.failureKind === "unavailable").length,
    timedOut: bulkResults.filter((item) => item.failureKind === "timed_out").length,
    noPdf: bulkResults.filter((item) => item.failureKind === "no_pdf").length,
  }), [bulkResults]);

  const downloadMutation = trpc.factsheets.downloadLatest.useMutation({
    onSuccess: (outcome) => {
      if (!outcome.success) {
        setSelectedSourceFailure(outcome);
        toast.message(`${outcome.amcName}: ${outcome.error}`);
        return;
      }
      setSelectedSourceFailure(null);
      setActiveDocument(outcome);
      setMessages([]);
      void refreshDownloadedFactsheetSelector({ invalidateRecent: () => utils.factsheets.recent.invalidate(), invalidateAmcs: () => utils.factsheets.listAmcs.invalidate() });
      toast.success(`${outcome.amcName} factsheet is ready to read.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const directLinkMutation = trpc.factsheets.downloadFromSourceLink.useMutation({
    onSuccess: (outcome) => {
      if (!outcome.success) {
        setSelectedSourceFailure(outcome);
        toast.message(`${outcome.amcName}: ${outcome.error}`);
        return;
      }
      setSelectedSourceFailure(null);
      setActiveDocument(outcome);
      setMessages([]);
      setDirectUrl("");
      void refreshDownloadedFactsheetSelector({ invalidateRecent: () => utils.factsheets.recent.invalidate(), invalidateAmcs: () => utils.factsheets.listAmcs.invalidate() });
      toast.success(`${outcome.amcName} factsheet is ready to read.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const officialUploadMutation = trpc.factsheets.uploadOfficialPdf.useMutation({
    onSuccess: (outcome) => {
      if (!outcome.success) {
        setSelectedSourceFailure(outcome);
        toast.message(`${outcome.amcName}: ${outcome.error}`);
        return;
      }
      setSelectedSourceFailure(null);
      setActiveDocument(outcome);
      setMessages([]);
      setUploadedFileName("");
      if (officialPdfInputRef.current) officialPdfInputRef.current.value = "";
      void refreshDownloadedFactsheetSelector({ invalidateRecent: () => utils.factsheets.recent.invalidate(), invalidateAmcs: () => utils.factsheets.listAmcs.invalidate() });
      toast.success(`${outcome.amcName} uploaded factsheet is ready to read.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkDownloadMutation = trpc.factsheets.downloadLatest.useMutation();
  const manualRetryMutation = trpc.factsheets.downloadLatest.useMutation({
    onSuccess: (outcome) => {
      if (!outcome.success) {
        setSelectedSourceFailure(outcome);
        toast.message(`${outcome.amcName}: ${outcome.error}`);
        return;
      }
      setSelectedSourceFailure(null);
      setActiveDocument(outcome);
      setMessages([]);
      void refreshDownloadedFactsheetSelector({ invalidateRecent: () => utils.factsheets.recent.invalidate(), invalidateAmcs: () => utils.factsheets.listAmcs.invalidate() });
      toast.success(`${outcome.amcName} was rechecked against its official source.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const askMutation = trpc.factsheets.ask.useMutation({
    onSuccess: ({ answer }) => {
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      window.setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (error) => toast.error(error.message),
  });

  const downloadFactsheet = () => {
    if (!selectedSlug) return;
    setSelectedSourceFailure(null);
    downloadMutation.mutate(useArchivePeriod
      ? { amcSlug: selectedSlug, requestedPeriod: { year: selectedYear, month: selectedMonth } }
      : { amcSlug: selectedSlug });
  };

  const retrySelectedAmc = () => {
    if (!selectedSlug) return;
    setSelectedSourceFailure(null);
    manualRetryMutation.mutate({ amcSlug: selectedSlug, forceRefresh: true });
  };

  const downloadDirectSource = () => {
    if (!selectedSlug || !directUrl.trim()) return;
    setSelectedSourceFailure(null);
    directLinkMutation.mutate(useArchivePeriod
      ? { amcSlug: selectedSlug, url: directUrl.trim(), requestedPeriod: { year: selectedYear, month: selectedMonth } }
      : { amcSlug: selectedSlug, url: directUrl.trim() });
  };

  const uploadOfficialPdf = async (file?: File) => {
    if (!selectedSlug || !file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Upload an official PDF under 15 MB.");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      toast.error("Choose a PDF file.");
      return;
    }
    setSelectedSourceFailure(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The PDF could not be read."));
        reader.onload = () => {
          const result = String(reader.result ?? "");
          resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
        };
        reader.readAsDataURL(file);
      });
      officialUploadMutation.mutate({
        amcSlug: selectedSlug,
        fileName: file.name,
        pdfBase64: base64,
        ...(useArchivePeriod ? { requestedPeriod: { year: selectedYear, month: selectedMonth } } : {}),
        confirmedOfficialSource: true,
        originalSourceUrl: selectedAmc?.sourceUrl,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The PDF could not be read.");
    }
  };

  const downloadAllFactsheets = async (staleOnly = false) => {
    const sources = amcsQuery.data ?? [];
    if (sources.length === 0 || bulkRunning) return;

    setBulkRunning(true);
    setBulkAction(staleOnly ? "stale" : "all");
    const sourcesToProcess = staleOnly ? sources.filter((source) => isFactsheetStale(source)) : sources;
    const { cached, pending } = splitBulkSourcesByCache(
      sourcesToProcess.map((source) => ({
        slug: source.slug,
        amcName: source.name,
        // Documents rejected as stale have no parsed latestDocument from the
        // API, so Download All explicitly queues them for remediation. Older
        // cached documents are also revalidated so the bulk action cannot
        // silently preserve last month's PDF.
        cachedDocument: source.latestDocument
          && !source.needsRemediation
          && !isFactsheetStale(source)
          ? { id: source.latestDocument.id, amcName: source.name, asOfLabel: source.latestDocument.asOfLabel ?? "Downloaded factsheet", fileUrl: source.latestDocument.fileUrl ?? "" }
          : null,
      })),
    );
    setBulkResults(cached);
    const freshResults = await runBulkDownload(
      pending,
      async (source) => {
        const outcome = await bulkDownloadMutation.mutateAsync({ amcSlug: source.slug });
        if (!outcome.success) throw new Error(outcome.error);
        return outcome;
      },
      (updates) => setBulkResults(mergeBulkDownloadResults(cached, updates)),
      4,
    );
    const results = mergeBulkDownloadResults(cached, freshResults);
    setBulkRunning(false);
    setBulkAction(null);
    await refreshDownloadedFactsheetSelector({ invalidateRecent: () => utils.factsheets.recent.invalidate(), invalidateAmcs: () => utils.factsheets.listAmcs.invalidate() });
    const completed = results.filter((item) => item.status === "success").length;
    const firstDocument = results.find((item) => item.document)?.document;
    if (firstDocument) setActiveDocument((current) => current ?? firstDocument);
    toast.success(`Verified or refreshed ${completed} of ${results.length} AMC factsheets.`);
  };

  const askQuestion = () => {
    const value = question.trim();
    if (!value || !activeDocument) return;
    setMessages((current) => [...current, { role: "user", content: value }]);
    setQuestion("");
    askMutation.mutate({ documentId: activeDocument.id, question: value, ...(selectedSchemeName ? { schemeName: selectedSchemeName } : {}) });
    window.setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const addCurrentSchemeToComparison = () => {
    const data = schemeAllocationsQuery.data;
    if (!data || !activeDocument || !selectedSchemeName) return;
    const marketCap = chooseComparisonMarketCap({
      disclosed: data.marketCapAllocations,
      calculated: data.calculatedMarketCap?.allocations,
      calculationStatus: data.calculatedMarketCap?.calculationStatus,
    });
    const key = `${activeDocument.id}:${data.schemeName}`;
    const entry: ComparisonScheme = {
      key,
      documentId: activeDocument.id,
      amcName: activeDocument.amcName,
      asOfLabel: activeDocument.asOfLabel,
      schemeName: data.schemeName,
      allocations: marketCap.allocations,
      source: marketCap.source,
      note: marketCap.note,
    };
    setComparisonSchemes((current) => current.some((item) => item.key === key) ? current : [...current, entry]);
    toast.success(`${data.schemeName} added to comparison.`);
  };

  const chooseRecent = (item: NonNullable<typeof recentQuery.data>[number]) => {
    setActiveDocument({
      id: item.id,
      amcName: item.amcName,
      asOfLabel: item.asOfLabel ?? "Downloaded factsheet",
      fileUrl: item.fileUrl ?? "",
    });
    setSelectedSlug(item.amcSlug);
    setMessages([]);
  };

  const chooseCachedAmc = (slug: string) => {
    const source = cachedAmcs.find((item) => item.slug === slug);
    const document = source?.latestDocument;
    if (!source || !document?.fileUrl) return;
    setSelectedSlug(source.slug);
    setSelectedSourceFailure(null);
    setActiveDocument({
      id: document.id,
      amcName: source.name,
      asOfLabel: document.asOfLabel ?? "Downloaded factsheet",
      fileUrl: document.fileUrl,
    });
    setMessages([]);
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="mx-auto mt-20 max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><FileText className="h-7 w-7 text-primary" /></div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Read mutual fund factsheets</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose an AMC from your registered source directory, download its latest factsheet, and ask questions based on the PDF.</p>
          <Button className="mt-6" onClick={() => goToLogin()}>Sign in</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <section className="mb-8 max-w-4xl">
        <p className="brand-eyebrow">Mutual fund intelligence</p>
        <h1 className="brand-display mt-3 text-4xl text-foreground sm:text-[2.75rem]">Download. Read. Ask.</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-6 text-muted-foreground">Retrieve an official AMC factsheet, select its verified scheme, and explore only the information evidenced in that PDF.</p>
      </section>

      {archiveCoverageQuery.data && <div className="mb-6 rounded-2xl border border-[#e2e1f3] bg-[#f6f6fc] px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Historical coverage snapshot:</span> {archiveCoverageQuery.data.verifiedCount} of {archiveCoverageQuery.data.totalSources} AMC sources returned a PDF verified for {archiveCoverageQuery.data.auditedPeriod}. Latest-available retrieval independently accepts the newest content-valid official PDF for each AMC.
      </div>}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-primary" /> Select AMC</CardTitle>
            <CardDescription>Search a registered AMC source and retrieve its latest available factsheet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {amcsQuery.isLoading ? <Skeleton className="h-10 w-full" /> : <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="cached-factsheet-amc" className="flex items-center gap-2 text-xs font-semibold text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Use a downloaded factsheet</label><Badge variant="outline" className="border-primary/30 bg-background/40 text-[10px] text-primary">{cachedAmcs.length} stored</Badge></div>
                <select id="cached-factsheet-amc" aria-label="Choose an AMC with a downloaded factsheet" value={activeDocument && cachedAmcs.some((amc) => amc.slug === selectedSlug) ? selectedSlug : ""} onChange={(event) => chooseCachedAmc(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Choose a downloaded AMC</option>
                  {cachedAmcs.map((amc) => <option key={amc.slug} value={amc.slug}>{amc.name} · {amc.latestDocument?.asOfLabel ?? "Stored factsheet"} · checked {formatVerifiedAt(amc.revalidation.checkedAt)}</option>)}
                </select>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Opens the stored PDF immediately. Then choose a scheme from that AMC only—no AMC search or download is needed.</p>
              </div>
              <p className="border-t border-border pt-4 text-xs font-medium text-muted-foreground">Or find a new or historical factsheet</p>
              <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search AMC, e.g. HDFC" className="bg-background" />
              <select aria-label="Select AMC" value={selectedSlug} onChange={(event) => { setSelectedSlug(event.target.value); setSelectedSourceFailure(null); setActiveDocument(null); setSelectedSchemeName(""); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                <option value="">Choose an AMC source</option>
                {visibleAmcs.map((amc) => <option key={amc.id} value={amc.slug}>{amc.name}</option>)}
              </select>
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground"><input type="checkbox" checked={useArchivePeriod} onChange={(event) => setUseArchivePeriod(event.target.checked)} className="h-4 w-4 accent-primary" /> Request a specific historical month</label>
                <div className={`grid grid-cols-2 gap-2 ${useArchivePeriod ? "" : "opacity-50"}`}>
                  <select aria-label="Factsheet month" disabled={!useArchivePeriod} value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => <option key={month} value={index}>{month}</option>)}
                  </select>
                  <select aria-label="Factsheet year" disabled={!useArchivePeriod} value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                    {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
              </div>
              {selectedAmc && <div className="space-y-2"><p className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground break-all">Source: {selectedAmc.sourceUrl}</p><div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">Retrieval method</span><Badge variant="outline" className="border-primary/30 bg-background/40 text-[10px] font-medium">{selectedAmc.adapter.label}</Badge></div><p className="mt-1">{selectedAmc.adapter.guidance}</p></div><p className={`rounded-xl border px-3 py-2 text-xs leading-5 ${selectedAmc.revalidation.status === "current" ? "border-[#bbf7d1] bg-[#f0fdf5] text-[#166533]" : "border-[#fddd8a] bg-[#fff9eb] text-[#926d0e]"}`}><span className="font-medium">Last verified:</span> {formatVerifiedAt(selectedAmc.revalidation.checkedAt)} · <span className="font-medium">{selectedAmc.revalidation.status === "current" ? "current PDF verified" : selectedAmc.revalidation.status === "stale" ? "refresh recommended" : selectedAmc.revalidation.status === "unresolved" ? "source still unresolved" : "no current PDF available"}</span>{selectedAmc.revalidation.reason ? ` — ${selectedAmc.revalidation.reason}` : ""}</p></div>}
              {selectedSourceFailure && <div className="rounded-xl border border-[#fddd8a] bg-[#fff9eb] p-3 text-xs leading-5 text-[#926d0e]"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#d99e06]" /><div><p className="font-semibold">{selectedSourceFailure.amcName} is currently unavailable</p><p className="mt-1 text-[#926d0e]/85">{selectedSourceFailure.error}</p><a href={selectedSourceFailure.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-[#926d0e] underline underline-offset-2">Open the AMC source page</a></div></div></div>}
              <Button className="w-full gap-2" disabled={!selectedSlug || downloadMutation.isPending || bulkRunning} onClick={downloadFactsheet}>
                {downloadMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Finding factsheet…</> : <><Download className="h-4 w-4" /> {useArchivePeriod ? `Find ${new Date(selectedYear, selectedMonth, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} factsheet` : "Find latest available factsheet"}</>}
              </Button>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs leading-5 text-muted-foreground">If an AMC blocks its archive, paste an official direct PDF link. In historical mode, its reporting month must match your selected month.</p>
                <div className="flex gap-2">
                  <Input aria-label="Official direct PDF link" value={directUrl} onChange={(event) => setDirectUrl(event.target.value)} placeholder="https://…/factsheet.pdf" className="min-w-0 bg-background text-xs" />
                  <Button variant="outline" className="shrink-0" disabled={!selectedSlug || !directUrl.trim() || directLinkMutation.isPending} onClick={downloadDirectSource}>{directLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use link"}</Button>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs leading-5 text-muted-foreground">If a protected AMC host blocks the bot, upload the official PDF here. In latest mode its actual reporting period is stored; historical mode remains exact-match only.</p>
                <input
                  ref={officialPdfInputRef}
                  aria-label="Upload official AMC PDF"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(event) => setUploadedFileName(event.target.files?.[0]?.name ?? "")}
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="min-w-0 flex-1 gap-2" disabled={!selectedSlug || officialUploadMutation.isPending} onClick={() => officialPdfInputRef.current?.click()}>
                    {officialUploadMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying upload…</> : <><Upload className="h-4 w-4" /> {uploadedFileName ? "Change official PDF" : "Choose official PDF"}</>}
                  </Button>
                  <Button variant="outline" className="shrink-0" disabled={!selectedSlug || !uploadedFileName || officialUploadMutation.isPending} onClick={() => void uploadOfficialPdf(officialPdfInputRef.current?.files?.[0])}>Upload</Button>
                </div>
                {uploadedFileName && <p className="mt-2 truncate text-xs text-muted-foreground">Selected: {uploadedFileName}</p>}
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs leading-5 text-muted-foreground">Recently checked PDFs open immediately. Older cached documents are revalidated for a newer official release, with four sources processed in parallel.</p>
                <Button variant="outline" className="w-full gap-2" disabled={bulkRunning || amcsQuery.isLoading} onClick={() => void downloadAllFactsheets(false)}>
                  {bulkRunning && bulkAction === "all" ? <><Loader2 className="h-4 w-4 animate-spin" /> Downloading all…</> : <><Layers3 className="h-4 w-4" /> Download all latest factsheets</>}
                </Button>
                <Button variant="ghost" className="w-full gap-2 text-primary hover:bg-primary/5" disabled={bulkRunning || amcsQuery.isLoading || staleAmcCount === 0} onClick={() => void downloadAllFactsheets(true)}>
                  {bulkRunning && bulkAction === "stale" ? <><Loader2 className="h-4 w-4 animate-spin" /> Refreshing stale sources…</> : <><RefreshCw className="h-4 w-4" /> Refresh all stale factsheets{staleAmcCount > 0 ? ` (${staleAmcCount})` : ""}</>}
                </Button>
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs leading-5 text-muted-foreground">Retry only the selected AMC when you want to recheck its official source. The cached PDF stays available unless a newer content-valid document is found.</p>
                <Button variant="outline" className="w-full gap-2" disabled={!selectedSlug || manualRetryMutation.isPending || bulkRunning} onClick={retrySelectedAmc}>
                  {manualRetryMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Retrying selected AMC…</> : <><RefreshCw className="h-4 w-4" /> Retry selected AMC</>}
                </Button>
              </div>
            </>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Downloaded factsheet</CardTitle>
              <CardDescription>{activeDocument ? "This PDF is the only source used in the chat below." : "Download a factsheet to start reading and asking questions."}</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {activeDocument ? (
                <div className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/15"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0"><p className="font-medium text-foreground">{activeDocument.amcName}</p><p className="mt-0.5 text-sm text-muted-foreground">{activeDocument.asOfLabel} · PDF text ready for questions</p>{activeDocument.pdfReportingPeriodLabel && activeDocument.pdfReportingPeriodLabel !== activeDocument.asOfLabel && <p className="mt-1 text-xs text-muted-foreground">PDF-reported period: {activeDocument.pdfReportingPeriodLabel}</p>}</div>
                  </div>
                  {activeDocument.fileUrl && <a href={activeDocument.fileUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Open PDF</Button></a>}
                </div>
              ) : <p className="py-4 text-sm text-muted-foreground">No active factsheet. Choose an AMC on the left to begin.</p>}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-primary" /> Scheme allocations</CardTitle>
              <CardDescription>{activeDocument ? `Choose a validated full scheme name from ${activeDocument.amcName}'s downloaded ${activeDocument.asOfLabel} factsheet.` : "Download an AMC factsheet first; schemes are never mixed across AMCs."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              {!activeDocument ? <p className="text-sm text-muted-foreground">No active factsheet yet. The scheme dropdown will contain only schemes extracted from the AMC PDF you download.</p> : documentSchemesQuery.isLoading ? <Skeleton className="h-10 w-full" /> : (documentSchemesQuery.data?.schemes.length ?? 0) === 0 ? <div className="rounded-xl border border-[#fddd8a] bg-[#fff9eb] p-4 text-sm leading-6 text-[#926d0e]">No reliable scheme headings could be extracted from this factsheet. You can still ask the chatbot about the full AMC document below.</div> : <>
                <div className="space-y-2">
                  <label htmlFor="scheme-selector" className="text-sm font-medium text-foreground">Scheme in this factsheet</label>
                  <select id="scheme-selector" aria-label="Select scheme from active AMC factsheet" value={selectedSchemeName} onChange={(event) => { setSelectedSchemeName(event.target.value); setMessages([]); }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Choose a scheme from {activeDocument.amcName}</option>
                    {documentSchemesQuery.data?.schemes.map((scheme) => <option key={scheme} value={scheme}>{scheme}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">{documentSchemesQuery.data?.schemes.length ?? 0} validated scheme{(documentSchemesQuery.data?.schemes.length ?? 0) === 1 ? "" : "s"} shown. Headings, plan variants, and truncated fragments are excluded.</p>
                </div>

                {!selectedSchemeName ? <div className="rounded-lg border border-dashed border-border bg-muted/10 p-5 text-center text-sm text-muted-foreground">Select a scheme to view its Industry/Sector allocation, portfolio holdings, and market-cap allocation from this factsheet.</div> : schemeAllocationsQuery.isLoading ? <div className="space-y-4"><Skeleton className="h-56 w-full" /><Skeleton className="h-72 w-full" /><Skeleton className="h-56 w-full" /></div> : schemeAllocationsQuery.data ? <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="border-b border-border bg-muted/20 px-4 py-3"><p className="font-medium text-foreground">Industry/Sector allocation</p><p className="mt-0.5 text-xs text-muted-foreground">Only entries parsed for {schemeAllocationsQuery.data.schemeName}</p></div>
                    {schemeAllocationsQuery.data.industryAllocations.length > 0 ? <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_190px]"><div className="divide-y divide-border">{schemeAllocationsQuery.data.industryAllocations.map((item) => <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"><span className="min-w-0 truncate text-muted-foreground">{item.label}</span><span className="font-medium text-foreground">{item.percentage.toFixed(2)}%</span></div>)}</div><div className="border-t border-border p-3 sm:border-l sm:border-t-0"><AllocationBarChart title="Industry/Sector allocation" items={schemeAllocationsQuery.data.industryAllocations} colors={INDUSTRY_CHART_COLORS} /></div></div> : <div className="px-4 py-5 text-sm"><p className="font-medium text-foreground">No page-verified Industry/Sector allocation</p><p className="mt-1 leading-5 text-muted-foreground">{schemeAllocationsQuery.data.industryEvidence?.evidence ?? "This reader withholds Industry/Sector values until the selected scheme page exposes an explicit allocation table."}</p></div>}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3"><div><p className="font-medium text-foreground">Portfolio composition</p><p className="mt-0.5 text-xs text-muted-foreground">Instruments, funds, ETFs, cash, and subtotals disclosed for {schemeAllocationsQuery.data.schemeName}</p></div>{schemeAllocationsQuery.data.portfolioEvidence?.sourcePage && schemeAllocationsQuery.data.evidencePdfUrl && <a href={`${schemeAllocationsQuery.data.evidencePdfUrl}#page=${schemeAllocationsQuery.data.portfolioEvidence.sourcePage}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="shrink-0 gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Evidence</Button></a>}</div>
                    {schemeAllocationsQuery.data.portfolioHoldings.length > 0 ? <div className="max-h-[28rem] overflow-y-auto"><div className="sticky top-0 grid grid-cols-[minmax(0,1fr)_6rem] border-b border-border bg-background/95 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur"><span>Instrument</span><span className="text-right">Net assets</span></div><div>{schemeAllocationsQuery.data.portfolioHoldings.map((holding, index) => { const previousCategory = index > 0 ? schemeAllocationsQuery.data!.portfolioHoldings[index - 1]?.category : undefined; const showCategory = Boolean(holding.category && holding.category !== previousCategory && holding.rowType !== "grand_total"); const isTotal = holding.rowType === "subtotal" || holding.rowType === "grand_total"; return <div key={`${holding.companyName}-${index}`}>{showCategory && <div className="border-y border-border bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">{holding.category}</div>}<div className={`grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 border-b border-border px-4 py-2.5 text-sm ${isTotal ? "bg-muted/25 font-medium" : ""}`}><span className="min-w-0 text-foreground">{holding.companyName}</span><span className="text-right font-medium text-foreground">{holding.percentage.toFixed(2)}%</span></div></div>; })}</div></div> : <div className="px-4 py-5 text-sm"><p className="font-medium text-foreground">No page-verified portfolio composition</p><p className="mt-1 leading-5 text-muted-foreground">{schemeAllocationsQuery.data.portfolioEvidence?.evidence ?? "This reader withholds portfolio values until the selected scheme page exposes a reliable instrument or holding table."}</p></div>}
                  </div>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3"><div><p className="font-medium text-foreground">Market-cap allocation</p><p className="mt-0.5 text-xs text-muted-foreground">{schemeAllocationsQuery.data.marketCapEvidence?.method === "vision" ? `Visual chart verified${schemeAllocationsQuery.data.marketCapEvidence.sourcePage ? ` on PDF page ${schemeAllocationsQuery.data.marketCapEvidence.sourcePage}` : ""} · ${schemeAllocationsQuery.data.marketCapEvidence.confidence.toFixed(0)}% confidence` : "Large, mid, small-cap and related exposure"}</p></div><div className="flex shrink-0 gap-2">{schemeAllocationsQuery.data.marketCapEvidence?.sourcePage && schemeAllocationsQuery.data.evidencePdfUrl && <a href={`${schemeAllocationsQuery.data.evidencePdfUrl}#page=${schemeAllocationsQuery.data.marketCapEvidence.sourcePage}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Evidence</Button></a>}<Button variant="outline" size="sm" className="gap-1.5" onClick={addCurrentSchemeToComparison}><Plus className="h-3.5 w-3.5" /> Compare</Button></div></div>
                      {schemeAllocationsQuery.data.marketCapAllocations.length > 0 ? <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_190px]"><div className="divide-y divide-border">{schemeAllocationsQuery.data.marketCapAllocations.map((item) => <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"><span className="min-w-0 truncate text-muted-foreground">{item.label}</span><span className="font-medium text-foreground">{item.percentage.toFixed(2)}%</span></div>)}</div><div className="border-t border-border p-3 sm:border-l sm:border-t-0"><AllocationBarChart title="Market-cap allocation" items={schemeAllocationsQuery.data.marketCapAllocations} colors={MARKET_CAP_CHART_COLORS} /></div></div> : <div className="px-4 py-5 text-sm"><p className="font-medium text-foreground">No page-verified market-cap allocation</p><p className="mt-1 leading-5 text-muted-foreground">{schemeAllocationsQuery.data.marketCapEvidence?.evidence ?? "This reader withholds market-cap values until the selected scheme’s page heading and allocation chart or table can be verified together."}</p></div>}
                    </div>
                    {schemeAllocationsQuery.data.calculatedMarketCap && <div className="overflow-hidden rounded-xl border border-[#bfdbfe] bg-[#eff6ff]">
                      <div className="flex items-start justify-between gap-3 border-b border-[#bfdbfe] px-4 py-3"><div><p className="font-medium text-foreground">Calculated market-cap allocation</p><p className="mt-0.5 text-xs text-muted-foreground">Calculated from page-verified portfolio holdings using <a href={schemeAllocationsQuery.data.calculatedMarketCap.snapshot.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{schemeAllocationsQuery.data.calculatedMarketCap.snapshot.sourceLabel}</a>, effective {new Date(schemeAllocationsQuery.data.calculatedMarketCap.snapshot.effectiveFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. This is separate from factsheet-disclosed allocation.</p></div>{schemeAllocationsQuery.data.portfolioEvidence?.sourcePage && schemeAllocationsQuery.data.evidencePdfUrl && <a href={`${schemeAllocationsQuery.data.evidencePdfUrl}#page=${schemeAllocationsQuery.data.portfolioEvidence.sourcePage}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="shrink-0 gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Holdings evidence</Button></a>}</div>
                      {schemeAllocationsQuery.data.calculatedMarketCap.calculationStatus === "insufficient_portfolio_data" ? <div className="px-4 py-4 text-sm"><p className="font-medium text-foreground">Calculation withheld</p><p className="mt-1 leading-5 text-muted-foreground">The page-local table is {schemeAllocationsQuery.data.calculatedMarketCap.portfolioTableScope === "top_holdings" ? "a top-holdings list" : "not confirmed as a complete portfolio"}, or its verified rows represent less than 80% of portfolio weight. No calculated allocation is presented.</p></div> : <><div className="divide-y divide-border">{schemeAllocationsQuery.data.calculatedMarketCap.allocations.map((item) => <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"><span className="min-w-0 truncate text-muted-foreground">{item.label}</span><span className="font-medium text-foreground">{item.percentage.toFixed(2)}%</span></div>)}</div><div className="border-t border-[#bfdbfe] px-4 py-3 text-xs text-muted-foreground">{schemeAllocationsQuery.data.calculatedMarketCap.coveragePercent.toFixed(1)}% of extracted holding weight mapped · {schemeAllocationsQuery.data.calculatedMarketCap.unresolvedHoldings.length} unresolved holding{schemeAllocationsQuery.data.calculatedMarketCap.unresolvedHoldings.length === 1 ? "" : "s"} · {schemeAllocationsQuery.data.calculatedMarketCap.calculationStatus.replaceAll("_", " ")}</div></>}
                      <details className="border-t border-[#bfdbfe] px-4 py-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Mapping evidence · {schemeAllocationsQuery.data.calculatedMarketCap.mappedHoldings.length} mapped · {schemeAllocationsQuery.data.calculatedMarketCap.unresolvedHoldings.length} unresolved</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 font-medium text-foreground">Mapped holdings</p><p className="max-h-32 overflow-y-auto leading-5">{schemeAllocationsQuery.data.calculatedMarketCap.mappedHoldings.map((holding) => `${holding.companyName} — ${holding.category.replaceAll("_", " ")} (${holding.matchMethod})`).join("\n") || "None"}</p></div><div><p className="mb-1 font-medium text-foreground">Unresolved holdings</p><p className="max-h-32 overflow-y-auto leading-5">{schemeAllocationsQuery.data.calculatedMarketCap.unresolvedHoldings.map((holding) => `${holding.companyName} — ${holding.percentage.toFixed(2)}%`).join("\n") || "None"}</p></div></div></details>
                    </div>}
                </div> : <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#991b1b]">The selected scheme could not be matched to this factsheet. Choose another detected scheme.</div>}
              </>}
            </CardContent>
          </Card>

          <Card className="min-h-[500px] border-border bg-card">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> Ask this factsheet</CardTitle><CardDescription>{selectedSchemeName ? `Answers are grounded in ${selectedSchemeName} within the selected downloaded PDF.` : "Answers are grounded in the selected downloaded PDF, not general market knowledge."}</CardDescription></CardHeader>
            <CardContent className="flex min-h-[400px] flex-col p-0">
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {!activeDocument ? <div className="flex h-52 flex-col items-center justify-center text-center"><Sparkles className="h-7 w-7 text-primary/70" /><p className="mt-3 font-medium">Your factsheet chat will appear here</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Download an AMC factsheet first. Then ask about its investment objective, portfolio, sector exposure, performance, risk, or any information found in the PDF.</p></div> : messages.length === 0 ? <div className="flex h-52 flex-col items-center justify-center text-center"><Bot className="h-7 w-7 text-primary/70" /><p className="mt-3 font-medium">Ask a question about {selectedSchemeName || activeDocument.amcName}</p><div className="mt-4 flex flex-wrap justify-center gap-2">{[selectedSchemeName ? "What is this scheme's investment objective?" : "What is the investment objective?", selectedSchemeName ? "What are this scheme's largest industry exposures?" : "What are the largest sector exposures?", "What risks are stated in this factsheet?"].map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)} className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">{prompt}</button>)}</div></div> : messages.map((message, index) => <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15"><Bot className="h-3.5 w-3.5 text-primary" /></div>}
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-background text-foreground"}`}>{message.role === "assistant" ? <Streamdown>{message.content}</Streamdown> : message.content}</div>
                  {message.role === "user" && <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>}
                </div>)}
                {askMutation.isPending && <div className="flex gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15"><Bot className="h-3.5 w-3.5 text-primary" /></div><div className="rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div></div>}
                <div ref={chatBottomRef} />
              </div>
              <div className="border-t border-border p-4"><div className="flex items-end gap-3"><Textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askQuestion(); } }} disabled={!activeDocument || askMutation.isPending} placeholder={activeDocument ? "Ask a question about this factsheet…" : "Download a factsheet first"} rows={2} className="resize-none bg-background" /><Button size="icon" disabled={!activeDocument || !question.trim() || askMutation.isPending} onClick={askQuestion}><Send className="h-4 w-4" /></Button></div><p className="mt-2 text-xs text-muted-foreground">Press Enter to send. The response will cite the selected factsheet.</p></div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4"><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-primary" /> Compare schemes</CardTitle><CardDescription>Add the current scheme after choosing it above, then switch AMC or scheme and add more. Factsheet disclosure always takes priority over calculated fallback.</CardDescription></CardHeader>
            <CardContent className="p-5"><Tabs defaultValue="market-cap"><TabsList><TabsTrigger value="market-cap">Market-cap allocation</TabsTrigger></TabsList><TabsContent value="market-cap" className="mt-4">{comparisonSchemes.length === 0 ? <div className="rounded-lg border border-dashed border-border bg-muted/10 p-5 text-sm text-muted-foreground">Choose a scheme above and use <strong className="font-medium text-foreground">Compare</strong> beside its market-cap allocation. Add as many cached-factsheet schemes as you need.</div> : <div className="space-y-3">{comparisonSchemes.map((item) => <div key={item.key} className="rounded-lg border border-border bg-muted/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-foreground">{item.schemeName}</p><p className="mt-1 text-xs text-muted-foreground">{item.amcName} · {item.asOfLabel} · <span className="capitalize">{item.source}</span></p></div><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove ${item.schemeName} from comparison`} onClick={() => setComparisonSchemes((current) => current.filter((entry) => entry.key !== item.key))}><X className="h-4 w-4" /></Button></div>{item.allocations.length ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{item.allocations.map((allocation) => <div key={allocation.label} className="flex items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2 text-sm"><span className="text-muted-foreground">{allocation.label}</span><span className="font-medium text-foreground">{allocation.percentage.toFixed(2)}%</span></div>)}</div> : <p className="mt-3 text-sm leading-5 text-muted-foreground">{item.note}</p>}</div>)}</div>}</TabsContent></Tabs></CardContent>
          </Card>
        </div>
      </div>

      {bulkResults.length > 0 && <section className="mt-8"><Card className="border-border bg-card"><CardHeader className="border-b border-border pb-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-primary" /> Bulk download results</CardTitle><CardDescription>{bulkRunning ? `${bulkResults.filter((item) => item.status === "success" || item.status === "failed").length} of ${bulkResults.length} sources finished` : `${bulkSummary.downloaded} downloaded · ${bulkResults.filter((item) => item.status === "failed").length} unavailable`}</CardDescription></div><Badge variant="outline" className="w-fit border-primary/20 text-primary">{bulkResults.filter((item) => item.status === "success" || item.status === "failed").length} / {bulkResults.length} complete</Badge></div>{!bulkRunning && <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="outline" className="border-[#bbf7d1] bg-[#f0fdf5] text-[#166533]">{bulkSummary.downloaded} downloaded</Badge><Badge variant="outline" className="border-[#fddd8a] bg-[#fff9eb] text-[#926d0e]">{bulkSummary.blocked} blocked</Badge><Badge variant="outline" className="border-[#bfdbfe] bg-[#eff6ff] text-[#1e5faf]">{bulkSummary.unavailable} unavailable</Badge><Badge variant="outline" className="border-[#e2e1f3] bg-[#f6f6fc] text-[#5b498e]">{bulkSummary.timedOut} timed out</Badge><Badge variant="outline" className="border-[#fecaca] bg-[#fef2f2] text-[#991b1b]">{bulkSummary.noPdf} no PDF found</Badge></div>}</CardHeader><CardContent className="p-0"><div className="max-h-80 divide-y divide-border overflow-y-auto">{bulkResults.map((item) => <div key={item.slug} className="flex items-center gap-3 px-5 py-3"><div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">{item.status === "success" ? <CheckCircle2 className="h-4 w-4 text-[#16a349]" /> : item.status === "failed" ? <AlertCircle className="h-4 w-4 text-[#dc2626]" /> : item.status === "downloading" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.amcName}</p><p className="truncate text-xs text-muted-foreground">{item.status === "success" ? "Latest factsheet downloaded" : item.status === "failed" ? item.error : item.status === "downloading" ? "Downloading and reading PDF…" : "Waiting"}</p></div>{item.status === "success" && item.document && <Button variant="ghost" size="sm" onClick={() => { setActiveDocument(item.document!); setSelectedSlug(item.slug); setMessages([]); }}>Read & ask</Button>}</div>)}</div></CardContent></Card></section>}

      {recentQuery.data && recentQuery.data.length > 0 && <section className="mt-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recently downloaded</p><div className="flex flex-wrap gap-2">{recentQuery.data.map((item) => <button key={item.id} onClick={() => chooseRecent(item)} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"><Badge variant="outline" className="border-primary/20 text-primary">{item.amcName}</Badge><span className="text-muted-foreground">{item.asOfLabel ?? "Downloaded"}</span></button>)}</div></section>}
    </AppLayout>
  );
}
