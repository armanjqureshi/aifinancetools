import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import FactsheetWorkspacePage from "./pages/FactsheetWorkspacePage";
import LoginPage from "./pages/LoginPage";
import { LOGIN_PATH } from "./const";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path={LOGIN_PATH} component={LoginPage} />
            <Route path="/" component={FactsheetWorkspacePage} />
            <Route component={FactsheetWorkspacePage} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
