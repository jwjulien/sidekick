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
  Building2
} from "lucide-solid";
import { user, logout, apiFetch } from "../hooks/useAuth";

interface LayoutProps {
  children?: any;
}

export default function Layout(props: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [lowStockCount, setLowStockCount] = createSignal(0);

  // Poll for low stock alerts periodically to show notifications
  const checkLowStock = async () => {
    try {
      const items = await apiFetch("/items?low_stock=true");
      setLowStockCount(items.length);
    } catch (_) {}
  };

  createEffect(() => {
    if (user()) {
      checkLowStock();
      const interval = setInterval(checkLowStock, 30000); // 30s
      return () => clearInterval(interval);
    }
  });

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    return path !== "/" && location.pathname.startsWith(path);
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "designer", "stocker", "puller", "analyst", "viewer"] },
    { name: "Parts Catalog", path: "/inventory", icon: Package, roles: ["admin", "designer", "stocker", "puller", "analyst"] },
    { name: "PCB Projects", path: "/projects", icon: FolderGit2, roles: ["admin", "designer", "analyst"] },
    { name: "Suppliers", path: "/suppliers", icon: Building2, roles: ["admin", "designer", "stocker", "puller", "analyst"] },
    { name: "Scan / Check", path: "/scan", icon: QrCode, roles: ["admin", "stocker", "puller"] },
    { name: "Design Structure", path: "/design", icon: FolderTree, roles: ["admin", "designer"] }
  ];

  // Helper check
  const hasAccess = (itemRoles: string[]) => {
    const curUser = user();
    if (!curUser) return false;
    return itemRoles.includes(curUser.role);
  };

  return (
    <div class="min-h-screen bg-[#0b0b0e] text-gray-200 flex flex-col md:flex-row">
      
      {/* ----------------- MOBILE HEADER ----------------- */}
      <header class="md:hidden glass-panel h-16 px-4 flex items-center justify-between border-b border-white/5 z-50">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-accentCyan to-accentBlue flex items-center justify-center font-bold text-white text-lg">
            S
          </div>
          <span class="font-bold text-white tracking-wide">SIDEKICK</span>
        </div>
        <div class="flex items-center gap-4">
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

      {/* ----------------- SIDEBAR (DESKTOP) ----------------- */}
      <aside class="hidden md:flex flex-col w-64 glass-panel border-r border-white/5 h-screen sticky top-0 p-4">
        {/* Brand */}
        <div class="flex items-center gap-3 px-2 py-4 mb-6">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accentCyan via-accentBlue to-accentPurple flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-accentCyan/15">
            S
          </div>
          <div>
            <h1 class="font-extrabold text-white tracking-wider text-base leading-none">SIDEKICK</h1>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Inventory Manager</span>
          </div>
        </div>

        {/* User Card */}
        <div class="glass-card p-3 rounded-xl mb-6 flex items-center gap-3 border border-white/5">
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

      {/* ----------------- MOBILE NAV OVERLAY ----------------- */}
      <Show when={mobileMenuOpen()}>
        <div class="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={() => setMobileMenuOpen(false)}>
          <aside class="w-64 glass-panel border-r border-white/5 h-full p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between pb-6 border-b border-white/5">
              <span class="font-bold text-white">Navigation</span>
              <button onClick={() => setMobileMenuOpen(false)} class="p-1">
                <X size={20} />
              </button>
            </div>
            
            <nav class="flex-1 mt-4 space-y-1">
              {navItems.filter(item => item.roles.includes(user()?.role || "")).map((item) => (
                <A
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  class={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive(item.path)
                      ? "bg-gradient-to-r from-accentCyan/10 to-accentBlue/5 border-l-4 border-accentCyan text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.name}</span>
                </A>
              ))}
            </nav>
            
            <div class="pt-4 border-t border-white/5 space-y-2">
              <A
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
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
        </div>
      </Show>

      {/* ----------------- CONTENT CONTAINER ----------------- */}
      <main class="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
        {props.children}
      </main>
    </div>
  );
}
