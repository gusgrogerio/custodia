import React, { useState } from 'react';
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
  Menu,
  X,
  Boxes,
  Users as UsersIcon,
  ScrollText,
  ShieldCheck,
  Package
} from 'lucide-react';
import { Button } from '../components/ui/button';

const baseNavItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/central', icon: Boxes, label: 'Central' },
  { path: '/nova-custodia', icon: PlusCircle, label: 'Nova Custódia' },
  { path: '/historico', icon: History, label: 'Histórico' },
  { path: '/perfil', icon: User, label: 'Perfil' },
];

const adminNavItems = [
  { path: '/usuarios', icon: UsersIcon, label: 'Usuários' },
  { path: '/auditoria', icon: ScrollText, label: 'Auditoria' },
];

function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      data-testid={`nav-${item.path.replace('/', '')}`}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-blue-500/10 text-blue-300'
          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
      }`}
    >
      {isActive && <span className="absolute left-0 w-0.5 h-5 bg-blue-500 rounded-full" />}
      <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
      <span className="text-sm font-medium">{item.label}</span>
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { logout, user, isAdmin } = useAuth();
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
      <aside className="fixed top-0 left-0 w-64 h-screen bg-slate-900/95 border-r border-slate-800 hidden lg:flex flex-col z-50">
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-950/30">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-50 font-['Chivo'] leading-tight">D1 Custódia</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Controle de custódias</p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">Operação ativa</p>
            <span className="text-[9px] font-semibold text-blue-400 truncate max-w-[92px]">{activeRegion}</span>
          </div>
          <RegionSwitcher variant="compact" />
        </div>

        <nav className="flex-1 px-3 pt-2 overflow-y-auto">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600 px-3 mb-2">Navegação</p>
          <div className="space-y-1">
            {baseNavItems.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>

          {isAdmin && (
            <div className="mt-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600 px-3 mb-2">Gestão</p>
              <div className="space-y-1">
                {adminNavItems.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    isActive={location.pathname === item.path}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-slate-800/80">
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className={`w-3 h-3 ${isAdmin ? 'text-purple-400' : 'text-blue-400'}`} />
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-600 truncate">
                    {isAdmin ? 'Administrador' : `Operador · ${user?.region || 'Sem região'}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full h-9 justify-start px-3 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 z-50">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
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
        <div className="px-3 pb-2">
          <RegionSwitcher variant="compact" />
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-950/80 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`lg:hidden fixed top-[6.25rem] right-0 w-64 h-[calc(100vh-6.25rem)] bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <nav className="p-3 space-y-1">
          {baseNavItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
          {isAdmin && adminNavItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
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

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 flex justify-around items-center z-50 lg:hidden">
        {baseNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.path.replace('/', '')}`}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                isActive ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <main className="pt-[6.25rem] pb-20 lg:pt-0 lg:pb-0 lg:pl-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
