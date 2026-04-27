import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RegionProvider } from "./context/RegionContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewCustody from "./pages/NewCustody";
import History from "./pages/History";
import CustodyDetails from "./pages/CustodyDetails";
import Profile from "./pages/Profile";
import CentralCustodias from "./pages/CentralCustodias";
import UserManagement from "./pages/UserManagement";
import AuditLogs from "./pages/AuditLogs";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Carregando...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      {/* /register is intentionally removed — closed system */}
      <Route path="/register" element={<Navigate to="/login" replace />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/nova-custodia" element={<ProtectedRoute><NewCustody /></ProtectedRoute>} />
      <Route path="/historico" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/central" element={<ProtectedRoute><CentralCustodias /></ProtectedRoute>} />
      <Route path="/custodia/:id" element={<ProtectedRoute><CustodyDetails /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      {/* Admin-only */}
      <Route path="/usuarios" element={<AdminRoute><UserManagement /></AdminRoute>} />
      <Route path="/auditoria" element={<AdminRoute><AuditLogs /></AdminRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <RegionProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
              },
            }}
          />
        </BrowserRouter>
      </RegionProvider>
    </AuthProvider>
  );
}

export default App;
