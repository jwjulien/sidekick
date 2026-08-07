import { createEffect, Show } from "solid-js";
import { Router, Route, Navigate } from "@solidjs/router";
import { 
  isAuthenticated, 
  isLoading, 
  initializeAuth 
} from "./hooks/useAuth";

// Import Pages
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import ItemDetails from "./pages/ItemDetails";
import Scan from "./pages/Scan";
import Design from "./pages/Design";
import Settings from "./pages/Settings";
import Layout from "./components/Layout";

export default function App() {
  // Try to authenticate session on startup
  createEffect(() => {
    initializeAuth();
  });

  return (
    <Show 
      when={!isLoading()} 
      fallback={
        <div class="min-h-screen bg-[#0b0b0e] flex flex-col items-center justify-center">
          <div class="w-12 h-12 border-4 border-accentCyan/30 border-t-accentCyan rounded-full animate-spin"></div>
          <span class="text-xs text-gray-500 mt-4 tracking-widest uppercase font-semibold">Loading Sidekick...</span>
        </div>
      }
    >
      <Router>
        {/* Unauthenticated public views */}
        <Route path="/login" component={Login} />
        <Route path="/auth-callback" component={AuthCallback} />
        
        {/* Secured paths wrapped in Navigation Layout shell */}
        <Route 
          path="/" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Dashboard />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/inventory" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Inventory />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/inventory/item/:id" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <ItemDetails />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/scan" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Scan />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/design" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Design />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/settings" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Settings />
              </Layout>
            </Show>
          )} 
        />
        
        {/* Fallback wildcard router */}
        <Route path="*all" component={() => <Navigate href="/" />} />
      </Router>
    </Show>
  );
}
