import { FileText } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(109,87,170,0.18)]">
              <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-[-0.04em] text-foreground">1 Finance</p>
              <p className="truncate text-xs text-muted-foreground">Mutual Fund Factsheet Reader</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#16a349]" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground">Evidence-first research</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}
