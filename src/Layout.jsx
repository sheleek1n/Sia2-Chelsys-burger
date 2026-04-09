import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Home,
  ShoppingCart,
  History,
  PackageOpen,
  Truck,
  UtensilsCrossed,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useCashierStore } from "@/lib/useCashierStore";

const LOGO_SRC = "/chelsys-burger-logo.png";

const NAV_ITEMS = [
  { label: "Home",           icon: Home,            page: "Dashboard",      roles: ["admin"] },
  { label: "New Order",      icon: ShoppingCart,    page: "CashierPOS",    roles: ["admin", "cashier"] },
  { label: "Order History",  icon: History,         page: "Orders",        roles: ["admin", "cashier"] },
  { label: "Production Log", icon: PackageOpen,     page: "ProductionLog", roles: ["admin", "cashier"] },
  { label: "Menu & Stock",   icon: UtensilsCrossed, page: "Products",      roles: ["admin"] },
  { label: "Deliveries",     icon: Truck,           page: "SupplyChain",   roles: ["admin"] },
];

function createPageUrl(page) {
  if (page === "Dashboard") return "/";
  return `/${page}`;
}

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);

  const { user: authUser, logout: authLogout } = useAuth();
  const { displayName, clearCashierSession } = useCashierStore();
  const navigate = useNavigate();

  useEffect(() => {
    setUser(authUser);
  }, [authUser]);

  // Determine role and active user details for UI display
  const isAdmin = user?.role === "admin";
  const role = isAdmin ? "admin" : "cashier";
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));
  
  const handleLogout = async () => {
    if (isAdmin) {
      await authLogout();
      clearCashierSession();
      navigate('/cashier-entry');
    } else {
      clearCashierSession();
      navigate('/cashier-entry');
    }
  };

  return (
    <div className="flex h-screen bg-[#faf8f5] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-[#2c1810] transition-all duration-300 flex-shrink-0 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
          {!collapsed ? (
            <img
              src={LOGO_SRC}
              alt="Chelsy's Burger"
              className="h-12 w-auto max-w-[140px] object-contain flex-shrink-0"
            />
          ) : (
            <img
              src={LOGO_SRC}
              alt="Chelsy's Burger"
              className="h-9 w-9 rounded-full object-contain object-center mx-auto flex-shrink-0"
            />
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-white/60 hover:text-white p-1 rounded ml-auto flex-shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = currentPageName === item.page;
            const Icon = item.icon;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[#B01010] text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
                title={collapsed ? item.label : ""}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-white/10 p-3">
          {!collapsed && (isAdmin || displayName) && (
            <div className="mb-2 px-1">
              <p className="text-white text-xs font-semibold truncate">
                {isAdmin ? user.full_name : displayName}
              </p>
              <p className="text-white/50 text-xs capitalize">{role}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/60 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-white/10 w-full"
            title={collapsed ? "Logout" : ""}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 min-h-full">{children}</div>
      </main>
    </div>
  );
}
