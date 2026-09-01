import { createSignal, createEffect, Show } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { 
  LayoutDashboard, 
  Package, 
  QrCode, 
  FolderTree, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell,
  User,
  ShieldCheck,
  FolderGit2,
  Building2,
  MapPin,
  PackageCheck,
  History,
  ShoppingBag,
  Camera
} from "lucide-solid";
import { user, logout, apiFetch } from "../hooks/useAuth";
import { useDeepLink } from "../hooks/useDeepLink";
import { usbScannerService } from "../services/usbScannerService";
import ActiveListBottomDrawer from "./lists/ActiveListBottomDrawer";
import NavigationToolbar from "./NavigationToolbar";
import TestingModeBanner from "./TestingModeBanner";
import DatabaseOperationOverlay from "./DatabaseOperationOverlay";
import CameraScanModal from "./CameraScanModal";
import { DiagnosticsModal } from "./DiagnosticsModal";
import { Terminal } from "lucide-solid";

interface LayoutProps {
  children?: any;
}

export default function Layout(props: LayoutProps) {
  useDeepLink();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [lowStockCount, setLowStockCount] = createSignal(0);
  const [homelessCount, setHomelessCount] = createSignal(0);
  const [showCameraModal, setShowCameraModal] = createSignal(false);
  const [showDiagnostics, setShowDiagnostics] = createSignal(false);

  // Poll for low stock alerts & homeless count periodically to show notifications
  const checkCounts = async () => {
    try {
      const items = await apiFetch("/parts?low_stock=true");
      setLowStockCount(items.length);
    } catch (_) {}
    try {
      const res = await apiFetch("/parts/homeless/count");
      setHomelessCount(res?.count || 0);
    } catch (_) {}
  };

  createEffect(() => {
    if (user()) {
      checkCounts();
      usbScannerService.initGlobalListener(navigate);
      const interval = setInterval(checkCounts, 30000); // 30s
      return () => clearInterval(interval);
    }
  });

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    return path !== "/" && location.pathname.startsWith(path);
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "designer", "stocker", "puller", "analyst", "viewer"] },
    { name: "Parts Catalog", path: "/parts", icon: Package, roles: ["admin", "designer", "stocker", "puller", "analyst"] },
    { name: "Homeless Parts", path: "/inventory/homeless-parts", icon: PackageCheck, roles: ["admin", "designer", "stocker", "puller", "analyst"] },
    { name: "Audit Log", path: "/audit", icon: History, roles: ["admin", "designer", "stocker", "puller", "analyst", "viewer"] },
    { name: "PCB Projects", path: "/projects", icon: FolderGit2, roles: ["admin", "designer", "analyst"] },
    { name: "Suppliers", path: "/suppliers", icon: Building2, roles: ["admin", "designer", "stocker", "puller", "analyst"] },
    { name: "Scan / Check", path: "/scan", icon: QrCode, roles: ["admin", "stocker", "puller"] },
    { name: "Design Structure", path: "/design", icon: FolderTree, roles: ["admin", "designer"] },
    { name: "Part Kits", path: "/lists", icon: ShoppingBag, roles: ["admin", "designer", "stocker", "puller", "analyst", "viewer"] },
    { name: "Storage Locations", path: "/storage", icon: MapPin, roles: ["admin", "designer", "stocker", "puller"] }
  ];


  // Helper check
  const hasAccess = (itemRoles: string[]) => {
    const curUser = user();
    if (!curUser) return false;
    return itemRoles.includes(curUser.role);
  };

  return (
    <div class="min-h-screen flex flex-col">
      <TestingModeBanner />
      <DatabaseOperationOverlay />
      
      <div class="flex-1 flex flex-col md:flex-row">

      
      {/* ----------------- MOBILE HEADER ----------------- */}
      <header class="md:hidden glass-panel h-16 px-4 flex items-center justify-between border-b border-white/5 z-30">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-accentCyan to-accentBlue flex items-center justify-center font-bold text-white text-lg">
            S
          </div>
          <span class="font-bold text-white tracking-wide">SIDEKICK</span>
        </div>
        <div class="flex items-center gap-3">
          <button
            onClick={() => setShowCameraModal(true)}
            class="p-1.5 text-accentCyan hover:text-white bg-accentCyan/10 border border-accentCyan/20 rounded-lg flex items-center gap-1 transition-colors"
            title="Scan Barcode / DataMatrix"
          >
            <Camera size={18} />
          </button>

          <Show when={lowStockCount() > 0}>
            <A href="/" class="relative p-1 text-amber-400 hover:text-amber-300">
              <Bell size={20} class="animate-bounce" />
              <span class="absolute -top-1 -right-1 bg-amber-500 text-black font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {lowStockCount()}
              </span>
            </A>
          </Show>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen())}
            class="p-1 hover:text-white"
          >
            {mobileMenuOpen() ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <CameraScanModal
        isOpen={showCameraModal()}
        onClose={() => setShowCameraModal(false)}
      />

      {/* ----------------- SIDEBAR (DESKTOP) ----------------- */}
      <aside class="hidden md:flex flex-col w-64 glass-panel border-r border-white/5 h-screen sticky top-0 p-4">
        {/* Brand & Desktop Navigation Toolbar */}
        <div class="space-y-3 mb-6 relative z-50">
          <div class="flex items-center gap-3 px-2 pt-2">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accentCyan via-accentBlue to-accentPurple flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-accentCyan/15">
              S
            </div>
            <div>
              <h1 class="font-extrabold text-white tracking-wider text-base leading-none">SIDEKICK</h1>
              <span class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Inventory Manager</span>
            </div>
          </div>

          <NavigationToolbar />
        </div>

        {/* User Card */}
        <div class="glass-card p-3 rounded-xl mb-6 flex items-center gap-3 border border-white/5 relative z-10">
          <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-accentCyan">
            <User size={20} />
          </div>
          <div class="overflow-hidden">
            <h4 class="font-semibold text-white truncate text-sm">{user()?.username}</h4>
            <div class="flex items-center gap-1 mt-0.5">
              <ShieldCheck size={12} class="text-accentCyan" />
              <span class="text-[10px] text-accentCyan uppercase font-extrabold tracking-wider truncate">
                {user()?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Link Tree */}
        <nav class="flex-1 space-y-1">
          {navItems.filter(item => item.roles.includes(user()?.role || "")).map((item) => (
            <A
              href={item.path}
              class={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive(item.path)
                  ? "bg-gradient-to-r from-accentCyan/10 to-accentBlue/5 border-l-4 border-accentCyan text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
              <Show when={item.name === "Dashboard" && lowStockCount() > 0}>
                <span class="ml-auto bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {lowStockCount()} Alerts
                </span>
              </Show>
              <Show when={item.name === "Homeless Parts" && homelessCount() > 0}>
                <span class="ml-auto bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {homelessCount()}
                </span>
              </Show>
            </A>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div class="pt-4 border-t border-white/5 space-y-2">
          {/* Settings for all */}
          <A
            href="/settings"
            class={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive("/settings")
                ? "bg-gradient-to-r from-accentCyan/10 to-accentBlue/5 border-l-4 border-accentCyan text-white"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings size={18} />
            <span>Settings</span>
          </A>

          <button
            onClick={() => setShowDiagnostics(true)}
            class="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all duration-150 text-left cursor-pointer"
          >
            <Terminal size={18} />
            <span>Diagnostics Console</span>
          </button>
          
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            class="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all duration-150 text-left cursor-pointer"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ----------------- MOBILE HEADER ----------------- */}
      <div class="md:hidden glass-panel border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div class="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            class="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
          >
            <Menu size={20} />
          </button>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accentCyan to-accentBlue flex items-center justify-center font-extrabold text-white text-xs">
              SK
            </div>
            <span class="font-extrabold text-white text-sm tracking-wider">SIDEKICK</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <NavigationToolbar onOpenDiagnostics={() => setShowDiagnostics(true)} />
          <button
            onClick={() => setShowCameraModal(true)}
            class="p-2 rounded-xl bg-accentCyan/10 text-accentCyan border border-accentCyan/20 hover:bg-accentCyan/20 transition-all"
            title="Scan Barcode / QR Code"
          >
            <Camera size={18} />
          </button>
        </div>
      </div>

      {/* ----------------- MOBILE SLIDE-OUT MENU ----------------- */}
      <Show when={mobileMenuOpen()}>
        <div class="fixed inset-0 z-50 md:hidden flex">
          <div
            class="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside class="relative z-10 w-72 bg-[#0d0f17] border-r border-white/5 p-6 flex flex-col h-full overflow-y-auto">
            <div class="flex items-center justify-between mb-8">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accentCyan to-accentBlue flex items-center justify-center font-extrabold text-white">
                  SK
                </div>
                <div>
                  <h1 class="font-extrabold text-white text-base">SIDEKICK</h1>
                  <span class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Inventory</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                class="p-2 rounded-xl text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <nav class="flex-1 space-y-1">
              {navItems.filter(item => item.roles.includes(user()?.role || "")).map((item) => (
                <A
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  class={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? "bg-gradient-to-r from-accentCyan/10 to-accentBlue/5 border-l-4 border-accentCyan text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.name}</span>
                </A>
              ))}
            </nav>

            <div class="pt-4 border-t border-white/5 space-y-2 mt-auto">
              <A
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white"
              >
                <Settings size={18} />
                <span>Settings</span>
              </A>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowDiagnostics(true);
                }}
                class="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all text-left cursor-pointer"
              >
                <Terminal size={18} />
                <span>Diagnostics Console</span>
              </button>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                  navigate("/login");
                }}
                class="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-red-400"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      </Show>

      {/* ----------------- CONTENT CONTAINER ----------------- */}
      <main class="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
        {props.children}
      </main>

      {/* Sticky Active List Drawer */}
      <ActiveListBottomDrawer />

      {/* Camera Scan Modal */}
      <CameraScanModal
        isOpen={showCameraModal()}
        onClose={() => setShowCameraModal(false)}
      />

      {/* In-App Diagnostics Console Modal */}
      <DiagnosticsModal
        isOpen={showDiagnostics()}
        onClose={() => setShowDiagnostics(false)}
      />
      </div>
    </div>
  );
}
