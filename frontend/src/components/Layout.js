import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import RegionSwitcher from './RegionSwitcher';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  User, 
  LogOut,
  Package,
  Menu,
  X,
  Boxes
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/central', icon: Boxes, label: 'Central' },
  { path: '/nova-custodia', icon: PlusCircle, label: 'Nova Custódia' },
  { path: '/historico', icon: History, label: 'Histórico' },
  { path: '/perfil', icon: User, label: 'Perfil' },
];

export default function Layout({ children }) {
  const { logout, user } = useAuth();
  const { activeRegion } = useRegion();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="fixed top-0 left-0 w-64 h-screen bg-slate-900 border-r border-slate-800 hidden lg:flex flex-col z-50">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-50 font-['Chivo']">D1 Custódia</h1>
              <p className="text-xs text-slate-500">Sistema Logístico</p>
            </div>
          </div>
        </div>

        {/* Region Switcher (desktop) */}
        <div className="px-4 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 px-1">
            Operação Ativa
          </p>
          <RegionSwitcher variant="compact" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.path.replace('/', '')}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800 z-50">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-slate-50 font-['Chivo'] text-sm">D1 Custódia</span>
              <span className="text-[10px] text-blue-400 font-semibold">{activeRegion}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        {/* Region tabs strip on mobile */}
        <div className="px-3 pb-2">
          <RegionSwitcher variant="compact" />
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-950/80 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`lg:hidden fixed top-[6.25rem] right-0 w-64 h-[calc(100vh-6.25rem)] bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 flex justify-around items-center z-50 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.path.replace('/', '')}`}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                isActive 
                  ? 'text-blue-400' 
                  : 'text-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="pt-[6.25rem] pb-20 lg:pt-0 lg:pb-0 lg:pl-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
