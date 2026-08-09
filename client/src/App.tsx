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
import Parts from "./pages/Parts";
import PartDetails from "./pages/PartDetails";
import Scan from "./pages/Scan";
import Design from "./pages/Design";
import Storage from "./pages/Storage";
import Settings from "./pages/Settings";
import Projects from "./pages/Projects";
import Suppliers from "./pages/Suppliers";
import Layout from "./components/Layout";
import { Toaster } from "solid-toast";
import { ConfirmProvider } from "./contexts/ConfirmContext";

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
      <ConfirmProvider>
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
          path="/parts" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Parts />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/parts/:id" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <PartDetails />
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
          path="/storage" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Storage />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/projects" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Projects />
              </Layout>
            </Show>
          )} 
        />
        <Route 
          path="/suppliers" 
          component={() => (
            <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
              <Layout>
                <Suppliers />
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
      <Toaster position="bottom-right" />
    </ConfirmProvider>
    </Show>
  );
}
