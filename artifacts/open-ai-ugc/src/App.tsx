import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/saas/Navbar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Products from "@/pages/products";
import Avatars from "@/pages/avatars";
import Campaigns from "@/pages/campaigns";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Pricing from "@/pages/pricing";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/products" component={Products} />
      <Route path="/avatars" component={Avatars} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/settings" component={Settings} />
      <Route path="/pricing" component={Pricing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div
              className="h-dvh w-full flex flex-col antialiased transition-colors duration-500"
              data-theme="light"
            >
              <Navbar />
              <div className="flex-1 flex flex-col overflow-y-auto">
                <Router />
              </div>
            </div>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

export default App;
