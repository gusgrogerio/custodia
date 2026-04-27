import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

function formatApiErrorDetail(detail) {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const checkAuth = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/auth/me`, { withCredentials: true, headers });
      setUser(data);
    } catch (e) {
      setUser(false);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }
      setUser(data);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
        status: e.response?.status,
      };
    }
  };

  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }); }
    catch (e) { /* ignore */ }
    localStorage.removeItem('token');
    setToken(null);
    setUser(false);
  };

  const getAuthHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  const isAdmin = !!user && user.role === 'admin';
  const isOperator = !!user && user.role === 'operator';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      token,
      getAuthHeaders,
      isAuthenticated: !!user,
      isAdmin,
      isOperator,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
