import { useRef, useState } from "react";
import { Bot, Loader2, Send, User } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string; sourceFunds?: { name: string; amc: string }[] };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [selectedFundIds, setSelectedFundIds] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const availableFundsQuery = trpc.chat.getAvailableFunds.useQuery();
  const askMutation = trpc.chat.ask.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, sourceFunds: data.sourceFunds }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (error) => toast.error(error.message),
  });

  const sendQuestion = () => {
    const q = question.trim();
    if (!q) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    askMutation.mutate({ question: q, fundIds: selectedFundIds.length ? selectedFundIds : undefined });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const toggleFund = (id: number) => {
    setSelectedFundIds((prev) => prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]);
  };

  const funds = availableFundsQuery.data ?? [];
  const hasData = funds.length > 0;

  return (
    <AppLayout>
      <section className="flex h-full flex-col overflow-hidden">
        <header className="flex-shrink-0 border-b border-border px-6 py-5 lg:px-9">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">AI Analysis</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Factsheet Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask questions about sector allocations, market-cap exposure, and asset mix — grounded in the latest downloaded factsheets.</p>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Fund selector sidebar */}
          <aside className="hidden w-64 flex-shrink-0 overflow-y-auto border-r border-border bg-sidebar p-4 lg:block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter by fund</p>
            {!hasData ? (
              <p className="text-xs text-muted-foreground">Run the pipeline first to populate factsheet data.</p>
            ) : (
              <div className="space-y-2">
                <button className="text-xs text-primary hover:underline" onClick={() => setSelectedFundIds([])}>Clear selection</button>
                {funds.map((fund) => fund && (
                  <div key={fund.id} className="flex items-start gap-2">
                    <Checkbox id={`fund-${fund.id}`} checked={selectedFundIds.includes(fund.id)} onCheckedChange={() => toggleFund(fund.id)} className="mt-0.5" />
                    <Label htmlFor={`fund-${fund.id}`} className="cursor-pointer text-xs leading-snug text-foreground">{fund.name}<span className="block text-muted-foreground">{fund.fundHouse}</span></Label>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Chat area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {messages.length === 0 ? (
                <Card className="mx-auto mt-8 max-w-2xl border-dashed border-border bg-card">
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <Bot className="h-10 w-10 text-primary/70" />
                    <h2 className="mt-4 font-semibold text-foreground">Ask about your factsheets</h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">Try questions like "What is the top sector in HDFC Flexi Cap?" or "Compare the large-cap allocation across all funds."</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {["What is the top sector allocation?", "Compare market-cap exposure across funds", "Which fund has the highest equity allocation?"].map((q) => (
                        <button key={q} onClick={() => setQuestion(q)} className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">{q}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center"><Bot className="h-3.5 w-3.5 text-primary" /></div>}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border text-card-foreground rounded-bl-sm"}`}>
                      {msg.role === "assistant" ? <Streamdown>{msg.content}</Streamdown> : msg.content}
                      {msg.sourceFunds && msg.sourceFunds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2">
                          <span className="text-xs text-muted-foreground">Sources:</span>
                          {msg.sourceFunds.map((sf) => <Badge key={sf.name} variant="outline" className="text-xs border-primary/20 bg-primary/5 text-primary">{sf.name}</Badge>)}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>}
                  </div>
                ))
              )}
              {askMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center"><Bot className="h-3.5 w-3.5 text-primary" /></div>
                  <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="flex-shrink-0 border-t border-border p-4">
              {!hasData && <p className="mb-2 text-center text-xs text-amber-400">No factsheet data yet — run the pipeline first to enable grounded answers.</p>}
              <div className="flex gap-3 items-end">
                <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendQuestion(); } }} placeholder="Ask about sector allocation, market-cap exposure, fund comparison…" rows={2} className="flex-1 resize-none bg-background" disabled={askMutation.isPending} />
                <Button onClick={sendQuestion} disabled={!question.trim() || askMutation.isPending} className="h-10 w-10 p-0 flex-shrink-0"><Send className="h-4 w-4" /></Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Press Enter to send, Shift+Enter for new line. {selectedFundIds.length > 0 ? `Filtering to ${selectedFundIds.length} fund(s).` : "Searching across all available factsheets."}</p>
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
