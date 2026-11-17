import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  TrendingUp,
  Search,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FUND_HOUSE_COLORS: Record<string, string> = {
  "HDFC": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "ICICI Prudential": "bg-orange-500/15 text-orange-400 border-orange-500/25",
  "Axis": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "SBI": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "Aditya Birla": "bg-red-500/15 text-red-400 border-red-500/25",
  "Kotak": "bg-amber-500/15 text-amber-400 border-amber-500/25",
  "UTI": "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  "Nippon India": "bg-rose-500/15 text-rose-400 border-rose-500/25",
  "DSP": "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  "Franklin Templeton": "bg-teal-500/15 text-teal-400 border-teal-500/25",
  "Mirae Asset": "bg-sky-500/15 text-sky-400 border-sky-500/25",
};

function FundHouseBadge({ house }: { house: string }) {
  const cls = FUND_HOUSE_COLORS[house] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {house}
    </span>
  );
}

export default function FundsPage() {
  const { isAuthenticated } = useAuth();
  const [newFundName, setNewFundName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const utils = trpc.useUtils();
  const { data: funds, isLoading } = trpc.funds.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: detectedHouse } = trpc.funds.detectHouse.useQuery(
    { name: newFundName },
    { enabled: newFundName.length >= 3 }
  );

  const addMutation = trpc.funds.add.useMutation({
    onSuccess: () => {
      toast.success("Fund added successfully");
      setNewFundName("");
      setIsAdding(false);
      utils.funds.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.funds.update.useMutation({
    onSuccess: () => {
      toast.success("Fund updated");
      setEditingId(null);
      utils.funds.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.funds.delete.useMutation({
    onSuccess: () => {
      toast.success("Fund removed");
      setDeleteId(null);
      utils.funds.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Sign in to manage funds</h2>
            <Button onClick={() => startLogin()}>Sign In</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filtered = funds?.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.fundHouse.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const handleAdd = () => {
    if (!newFundName.trim()) return;
    addMutation.mutate({ name: newFundName.trim() });
  };

  const handleUpdate = (id: number) => {
    if (!editName.trim()) return;
    updateMutation.mutate({ id, name: editName.trim() });
  };

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Fund List</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage up to 40 mutual funds for monthly extraction</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-semibold text-primary">{funds?.length ?? 0}</span>
              <span className="text-xs text-muted-foreground ml-1">/ 40 funds</span>
            </div>
            <Button
              onClick={() => setIsAdding(!isAdding)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" /> Add Fund
            </Button>
          </div>
        </div>

        {/* Add Fund Panel */}
        {isAdding && (
          <Card className="bg-card border-primary/20 border">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-foreground mb-3">Add New Fund</p>
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="e.g. HDFC Flexi Cap Fund, Axis Bluechip Fund..."
                    value={newFundName}
                    onChange={(e) => setNewFundName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    autoFocus
                  />
                  {detectedHouse && newFundName.length >= 3 && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Detected fund house:</span>
                      <FundHouseBadge house={detectedHouse.fundHouse} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAdd}
                    disabled={!newFundName.trim() || addMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    size="sm"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => { setIsAdding(false); setNewFundName(""); }} variant="outline" size="sm" className="border-border">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search funds or fund houses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Fund Table */}
        <Card className="bg-card border-border">
          {isLoading ? (
            <CardContent className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </CardContent>
          ) : !filtered.length ? (
            <CardContent className="p-12 text-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">{searchQuery ? "No funds match your search" : "No funds added yet"}</p>
              <p className="text-muted-foreground text-sm mt-1">{searchQuery ? "Try a different search term" : "Click 'Add Fund' to get started"}</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fund Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fund House</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((fund, i) => (
                    <tr key={fund.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-5 py-3.5">
                        {editingId === fund.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(fund.id); if (e.key === "Escape") setEditingId(null); }}
                              className="h-7 text-sm bg-input border-border"
                              autoFocus
                            />
                            <button onClick={() => handleUpdate(fund.id)} className="text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">{fund.name}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><FundHouseBadge house={fund.fundHouse} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingId(fund.id); setEditName(fund.name); }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(fund.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remove Fund</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to remove this fund from your list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground hover:bg-muted">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
