import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { ScrollText, RefreshCw, Filter, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ACTION_LABEL = {
  login_success: { label: 'Login bem-sucedido', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  login_failed: { label: 'Login inválido', class: 'bg-red-500/20 text-red-300 border-red-500/30' },
  login_locked: { label: 'Conta bloqueada', class: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  user_created: { label: 'Usuário criado', class: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  user_updated: { label: 'Usuário atualizado', class: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  user_deleted: { label: 'Usuário desativado', class: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  bulk_update: { label: 'Ação em massa', class: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
};

export default function AuditLogs() {
  const { getAuthHeaders } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', user_email: '' });

  const fetchLogs = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.user_email) params.append('user_email', filters.user_email);
      params.append('limit', '300');
      const { data } = await axios.get(`${API}/audit-logs?${params.toString()}`, { withCredentials: true, headers });
      setLogs(data);
    } catch (e) {
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatDate = (s) => {
    try {
      const d = new Date(s);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return s; }
  };

  const clearFilters = () => setFilters({ action: '', user_email: '' });
  const hasFilters = filters.action || filters.user_email;

  return (
    <Layout>
      <div className="space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo'] flex items-center gap-3">
              <ScrollText className="w-7 h-7 text-blue-400" />
              Auditoria
            </h1>
            <p className="text-slate-400 text-sm mt-1">{logs.length} evento(s) · ordem: mais recente primeiro</p>
          </div>
          <Button onClick={fetchLogs} variant="outline" size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800" data-testid="audit-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-300">Filtros</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}
                className="ml-auto text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Ação</Label>
              <Select value={filters.action || 'all'} onValueChange={(v) => setFilters({ ...filters, action: v === 'all' ? '' : v })}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="audit-filter-action">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-slate-200">Todas</SelectItem>
                  {Object.entries(ACTION_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-slate-200">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Usuário (e-mail contém)</Label>
              <Input
                value={filters.user_email}
                onChange={(e) => setFilters({ ...filters, user_email: e.target.value })}
                placeholder="ex: admin"
                className="bg-slate-950 border-slate-700 text-slate-100"
                data-testid="audit-filter-user"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="audit-table">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <ScrollText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-semibold">Data/Hora</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Ação</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Usuário</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden md:table-cell">IP</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l, idx) => {
                    const meta = ACTION_LABEL[l.action] || { label: l.action, class: 'bg-slate-700 text-slate-200' };
                    return (
                      <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="font-mono text-xs text-slate-400">{formatDate(l.created_at)}</TableCell>
                        <TableCell>
                          <Badge className={`${meta.class} border`}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          {l.user_email || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500 hidden md:table-cell">
                          {l.ip || '—'}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm max-w-md">
                          {l.details || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
