import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import Layout from '../components/Layout';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Eye,
  RefreshCw,
  Download,
  Filter,
  X,
  Calendar as CalendarIcon,
  Box,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Trash2,
  MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { OCCURRENCE_TYPES, isAutoReturnOccurrence } from '../constants/occurrences';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusMap = {
  pending: { label: 'Em andamento', class: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', icon: Clock },
  awaiting: { label: 'Aguardando retorno', class: 'bg-slate-500/20 text-slate-400 border border-slate-500/30', icon: Clock },
  resolved: { label: 'Finalizada', class: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', icon: CheckCircle2 },
  ready_for_return: { label: 'Apta devolução', class: 'bg-red-500/20 text-red-400 border border-red-500/30', icon: RotateCcw },
  returned: { label: 'Devolvida', class: 'bg-purple-500/20 text-purple-400 border border-purple-500/30', icon: Package },
};

const occurrenceTypes = OCCURRENCE_TYPES;

function MetricCard({ title, value, icon: Icon, color, onClick, active }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-slate-900 border rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 ${
        onClick ? 'cursor-pointer' : ''
      } ${active ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-slate-800 hover:border-slate-700'}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
          <p className={`text-2xl font-black mt-1 font-['Chivo'] ${color}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-')}/10`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

// Region Tab component - DEPRECATED: replaced by global RegionSwitcher in Layout
// Kept temporarily; safe to remove in future cleanup.
function _RegionTab_unused() { return null; }

// Mobile card component
function CustodyCard({ custody, isSelected, onSelect, onView, searchQuery }) {
  const [expanded, setExpanded] = useState(false);
  
  const getDisplayStatus = () => {
    if (custody.status === 'returned') return 'returned';
    if (custody.status === 'resolved') return 'resolved';
    if (custody.is_ready_for_return || custody.status === 'ready_for_return') return 'ready_for_return';
    if (custody.days_without_treatment >= 8) return 'ready_for_return';
    return 'pending';
  };

  const status = getDisplayStatus();
  const StatusIcon = statusMap[status]?.icon || Clock;
  
  // Highlight matching text
  const highlightText = (text) => {
    if (!searchQuery || !text) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</mark> : part
    );
  };

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
      custody.is_ready_for_return 
        ? 'border-red-500/50 bg-red-500/5' 
        : custody.is_near_return 
          ? 'border-amber-500/50 bg-amber-500/5'
          : 'border-slate-800'
    }`}>
      <div className="p-4 flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="mt-1"
        />
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-blue-400 font-semibold">{highlightText(custody.box_number || 'N/A')}</span>
            <Badge className={statusMap[status]?.class || 'status-pending'}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusMap[status]?.label || 'Em andamento'}
            </Badge>
          </div>
          <p className="text-slate-200 font-medium mt-1">{highlightText(custody.client_name)}</p>
          <p className="text-slate-400 text-sm">{highlightText(custody.shipment_code)}</p>
          
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-slate-700 text-slate-300 text-xs">
              <MapPin className="w-3 h-3 mr-1" />
              {custody.region || 'São Paulo'}
            </Badge>
            {custody.days_without_treatment >= 8 && (
              <Badge className={`${custody.days_without_treatment >= 10 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {custody.days_without_treatment >= 10 ? 'Pode devolver' : `${custody.days_without_treatment} dias`}
              </Badge>
            )}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Telefone:</span>
            <span className="text-slate-300">{custody.phone || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Cidade/UF:</span>
            <span className="text-slate-300">{custody.city || '-'} {custody.state ? `/ ${custody.state}` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Ocorrência:</span>
            <span className="text-slate-300">{occurrenceTypes[custody.occurrence_type] || custody.occurrence_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Dias s/ tratativa:</span>
            <span className={`font-medium ${custody.days_without_treatment >= 10 ? 'text-red-400' : custody.days_without_treatment >= 8 ? 'text-amber-400' : 'text-slate-300'}`}>
              {custody.days_without_treatment} dias
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Responsável:</span>
            <span className="text-slate-300">{custody.responsible_name}</span>
          </div>
          <Button 
            onClick={() => onView(custody.id)}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-500"
            size="sm"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver detalhes
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CentralCustodias() {
  const { getAuthHeaders } = useAuth();
  const { activeRegion } = useRegion();
  const [custodies, setCustodies] = useState([]);
  const [stats, setStats] = useState({ total: 0, awaiting_return: 0, near_return: 0, ready_for_return: 0, finalized: 0, no_photos: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Search query for real-time search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [filters, setFilters] = useState({
    status: '',
    occurrence_type: '',
    responsible_id: '',
    date_from: null,
    date_to: null,
    near_return: false,
    ready_for_return: false,
    no_photos: false,
    no_treatment: false,
    sort_by: ''
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      
      // Always filter by active region (from global RegionContext)
      params.append('region', activeRegion);
      
      // Apply search query
      if (debouncedSearch) {
        params.append('search_query', debouncedSearch);
      }
      
      if (filters.status) params.append('status', filters.status);
      if (filters.occurrence_type) params.append('occurrence_type', filters.occurrence_type);
      if (filters.responsible_id) params.append('responsible_id', filters.responsible_id);
      if (filters.date_from) params.append('date_from', filters.date_from.toISOString());
      if (filters.date_to) params.append('date_to', filters.date_to.toISOString());
      if (filters.near_return) params.append('near_return', 'true');
      if (filters.ready_for_return) params.append('ready_for_return', 'true');
      if (filters.no_photos) params.append('no_photos', 'true');
      if (filters.no_treatment) params.append('no_treatment', 'true');
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      params.append('limit', '500');
      
      const [custodiesRes, statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/custodies?${params.toString()}`, { withCredentials: true, headers }),
        axios.get(`${API}/custodies/central-stats?region=${encodeURIComponent(activeRegion)}`, { withCredentials: true, headers }),
        axios.get(`${API}/users`, { withCredentials: true, headers })
      ]);
      
      setCustodies(custodiesRes.data);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [activeRegion, debouncedSearch, filters, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      
      params.append('region', activeRegion);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from.toISOString());
      if (filters.date_to) params.append('date_to', filters.date_to.toISOString());
      
      const response = await axios.get(`${API}/custodies/export/csv?${params.toString()}`, {
        withCredentials: true,
        headers,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `central_${activeRegion.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Exportação concluída!');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Erro ao exportar');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos uma custódia');
      return;
    }

    try {
      const headers = getAuthHeaders();
      
      if (action === 'mark_returned') {
        await axios.post(`${API}/custodies/bulk-update`, {
          custody_ids: selectedIds,
          action: 'mark_returned'
        }, { withCredentials: true, headers });
        toast.success(`${selectedIds.length} custódias marcadas como devolvidas`);
      } else if (action === 'delete') {
        if (!window.confirm(`Apagar ${selectedIds.length} custódia(s)? Esta ação NÃO pode ser desfeita.`)) {
          return;
        }
        const { data } = await axios.post(`${API}/custodies/bulk-update`, {
          custody_ids: selectedIds,
          action: 'delete'
        }, { withCredentials: true, headers });
        const blocked = data.blocked_count || 0;
        toast.success(
          `${data.deleted_count || 0} custódia(s) apagada(s)` +
          (blocked > 0 ? ` · ${blocked} bloqueada(s) por permissão` : '')
        );
      } else if (action === 'export') {
        const selectedCustodies = custodies.filter(c => selectedIds.includes(c.id));
        const csv = generateCSV(selectedCustodies);
        downloadCSV(csv, 'custodias_selecionadas.csv');
        toast.success('Exportação concluída!');
      }
      
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      console.error('Error bulk action:', error);
      toast.error(error.response?.data?.detail || 'Erro ao executar ação');
    }
  };

  const generateCSV = (data) => {
    const headers = ['Nº Caixa', 'Código', 'Cliente', 'Telefone', 'Cidade', 'Estado', 'Região', 'Ocorrência', 'Status', 'Dias c/ Tratativa', 'Responsável'];
    const rows = data.map(c => [
      c.box_number || '',
      c.shipment_code,
      c.client_name,
      c.phone || '',
      c.city || '',
      c.state || '',
      c.region || 'São Paulo',
      occurrenceTypes[c.occurrence_type] || c.occurrence_type,
      statusMap[c.status]?.label || c.status,
      c.days_without_treatment || 0,
      c.responsible_name
    ]);
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === custodies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(custodies.map(c => c.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      occurrence_type: '',
      responsible_id: '',
      date_from: null,
      date_to: null,
      near_return: false,
      ready_for_return: false,
      no_photos: false,
      no_treatment: false,
      sort_by: ''
    });
    setSearchQuery('');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDisplayStatus = (custody) => {
    if (custody.status === 'returned') return 'returned';
    if (custody.status === 'resolved') return 'resolved';
    if (custody.is_ready_for_return || custody.status === 'ready_for_return') return 'ready_for_return';
    return 'pending';
  };

  // Highlight matching text in table
  const highlightText = (text) => {
    if (!debouncedSearch || !text) return text;
    const regex = new RegExp(`(${debouncedSearch})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">{part}</mark> : part
    );
  };

  const hasActiveFilters = filters.status || filters.occurrence_type || filters.responsible_id || 
    filters.date_from || filters.date_to || filters.near_return || filters.ready_for_return || 
    filters.no_photos || filters.no_treatment || debouncedSearch;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo']">
              Central de Custódias <span className="text-blue-400">· {activeRegion}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Operação isolada • {custodies.length} registros em {activeRegion}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-slate-700 text-slate-300 hover:bg-slate-800 ${hasActiveFilters ? 'border-blue-500 text-blue-400' : ''}`}
              data-testid="filter-button"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-900 border-slate-700">
                <DropdownMenuItem onClick={handleExport} className="text-slate-200 cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar CSV/Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar - Real Time */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            placeholder="Buscar por código da remessa, número da caixa ou nome do cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-slate-900 border-slate-700 text-slate-100 text-base placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            data-testid="central-search-input"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Region Tabs - removed: now controlled globally via Layout RegionSwitcher */}

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="central-metrics">
          <MetricCard 
            title="Total" 
            value={stats.total} 
            icon={Package} 
            color="text-blue-400"
          />
          <MetricCard 
            title="Aguardando" 
            value={stats.awaiting_return} 
            icon={Clock} 
            color="text-slate-400"
            onClick={() => setFilters(prev => ({ ...prev, status: 'pending', near_return: false, ready_for_return: false }))}
            active={filters.status === 'pending' && !filters.near_return && !filters.ready_for_return}
          />
          <MetricCard 
            title="Próx. Devolução" 
            value={stats.near_return} 
            icon={AlertTriangle} 
            color="text-amber-400"
            onClick={() => setFilters(prev => ({ ...prev, near_return: true, ready_for_return: false, status: '' }))}
            active={filters.near_return}
          />
          <MetricCard 
            title="Apta Devolução" 
            value={stats.ready_for_return} 
            icon={RotateCcw} 
            color="text-red-500"
            onClick={() => setFilters(prev => ({ ...prev, ready_for_return: true, near_return: false, status: '' }))}
            active={filters.ready_for_return}
          />
          <MetricCard 
            title="Finalizadas" 
            value={stats.finalized} 
            icon={CheckCircle2} 
            color="text-emerald-500"
            onClick={() => setFilters(prev => ({ ...prev, status: 'resolved', near_return: false, ready_for_return: false }))}
            active={filters.status === 'resolved'}
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Filtros Avançados</h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
              )}
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Status</Label>
                <Select value={filters.status || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? "" : value }))}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 z-50">
                    <SelectItem value="all" className="text-slate-200">Todos</SelectItem>
                    <SelectItem value="pending" className="text-slate-200">Em andamento</SelectItem>
                    <SelectItem value="resolved" className="text-slate-200">Finalizada</SelectItem>
                    <SelectItem value="ready_for_return" className="text-slate-200">Apta devolução</SelectItem>
                    <SelectItem value="returned" className="text-slate-200">Devolvida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Ocorrência</Label>
                <Select value={filters.occurrence_type || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, occurrence_type: value === "all" ? "" : value }))}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 z-50">
                    <SelectItem value="all" className="text-slate-200">Todas</SelectItem>
                    {Object.entries(occurrenceTypes).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-slate-200">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Responsável</Label>
                <Select value={filters.responsible_id || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, responsible_id: value === "all" ? "" : value }))}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 z-50">
                    <SelectItem value="all" className="text-slate-200">Todos</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="text-slate-200">{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Ordenar por</Label>
                <Select value={filters.sort_by || "created_at"} onValueChange={(value) => setFilters(prev => ({ ...prev, sort_by: value === "created_at" ? "" : value }))}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Data criação" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 z-50">
                    <SelectItem value="created_at" className="text-slate-200">Data criação</SelectItem>
                    <SelectItem value="days_without_treatment" className="text-slate-200">Dias com tratativa</SelectItem>
                    <SelectItem value="updated_at" className="text-slate-200">Última atualização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-slate-950 border-slate-700 text-slate-100 hover:bg-slate-800">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.date_from ? format(filters.date_from, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.date_from}
                      onSelect={(date) => setFilters(prev => ({ ...prev, date_from: date }))}
                      locale={ptBR}
                      className="bg-slate-900"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-slate-950 border-slate-700 text-slate-100 hover:bg-slate-800">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.date_to ? format(filters.date_to, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.date_to}
                      onSelect={(date) => setFilters(prev => ({ ...prev, date_to: date }))}
                      locale={ptBR}
                      className="bg-slate-900"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <Checkbox
                  checked={filters.near_return}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, near_return: checked }))}
                />
                Próximas da devolução
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <Checkbox
                  checked={filters.ready_for_return}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, ready_for_return: checked }))}
                />
                Aptas para devolução
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <Checkbox
                  checked={filters.no_photos}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, no_photos: checked }))}
                />
                Sem foto
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <Checkbox
                  checked={filters.no_treatment}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, no_treatment: checked }))}
                />
                Sem tratativa
              </label>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <span className="text-blue-400 font-medium">
              {selectedIds.length} custódia(s) selecionada(s)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction('mark_returned')}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Marcar como devolvida
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction('export')}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar selecionados
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction('delete')}
                className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                data-testid="bulk-delete-button"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar selecionados
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* No Results Message */}
        {custodies.length === 0 && debouncedSearch && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <Search className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">Nenhuma custódia encontrada</p>
            <p className="text-slate-500 text-sm mt-1">Tente buscar por outro termo ou limpe os filtros</p>
            <Button 
              variant="outline"
              className="mt-4 border-slate-700 text-slate-300"
              onClick={clearFilters}
            >
              Limpar busca
            </Button>
          </div>
        )}

        {/* Desktop Table */}
        {custodies.length > 0 && (
          <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="central-table">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === custodies.length && custodies.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-slate-400 font-semibold">Nº Caixa</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Código</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Cliente</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Telefone</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Cidade/UF</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Ocorrência</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Status</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Dias c/ Trat.</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Atualização</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Responsável</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custodies.map((custody) => {
                    const status = getDisplayStatus(custody);
                    const StatusIcon = statusMap[status]?.icon || Clock;
                    return (
                      <TableRow 
                        key={custody.id} 
                        className={`border-slate-800 transition-colors ${
                          custody.is_ready_for_return 
                            ? 'bg-red-500/5 hover:bg-red-500/10' 
                            : custody.is_near_return 
                              ? 'bg-amber-500/5 hover:bg-amber-500/10'
                              : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(custody.id)}
                            onCheckedChange={() => toggleSelect(custody.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-blue-400 font-semibold">
                          <div className="flex items-center gap-2">
                            <Box className="w-4 h-4" />
                            {highlightText(custody.box_number || 'N/A')}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-slate-200">{highlightText(custody.shipment_code)}</TableCell>
                        <TableCell className="text-slate-300">{highlightText(custody.client_name)}</TableCell>
                        <TableCell className="text-slate-400">{custody.phone || '-'}</TableCell>
                        <TableCell className="text-slate-400">
                          {custody.city || '-'}{custody.state ? ` / ${custody.state}` : ''}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {occurrenceTypes[custody.occurrence_type] || custody.occurrence_type}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusMap[status]?.class || 'status-pending'}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusMap[status]?.label || 'Em andamento'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <span className={`text-sm font-medium ${
                              custody.days_without_treatment >= 10 
                                ? 'text-red-400' 
                                : custody.days_without_treatment >= 8 
                                  ? 'text-amber-400' 
                                  : 'text-slate-400'
                            }`}>
                              {custody.days_without_treatment} dias
                            </span>
                            {custody.days_without_treatment >= 8 && (
                              <Badge className={`text-xs ${
                                custody.days_without_treatment >= 10 
                                  ? 'bg-red-500/20 text-red-400' 
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {custody.days_without_treatment >= 10 ? 'Pode devolver' : `${custody.days_without_treatment} dias`}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {formatDate(custody.updated_at)}
                        </TableCell>
                        <TableCell className="text-slate-400">{custody.responsible_name}</TableCell>
                        <TableCell className="text-right">
                          <Link to={`/custodia/${custody.id}`}>
                            <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Mobile Cards */}
        {custodies.length > 0 && (
          <div className="lg:hidden space-y-3">
            {custodies.map((custody) => (
              <CustodyCard
                key={custody.id}
                custody={custody}
                isSelected={selectedIds.includes(custody.id)}
                onSelect={() => toggleSelect(custody.id)}
                onView={(id) => window.location.href = `/custodia/${id}`}
                searchQuery={debouncedSearch}
              />
            ))}
          </div>
        )}

        {/* Empty State (no search) */}
        {custodies.length === 0 && !debouncedSearch && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">Nenhuma custódia encontrada em {activeRegion}</p>
            <Link to="/nova-custodia">
              <Button className="mt-4 bg-blue-600 hover:bg-blue-500">
                Criar Nova Custódia
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
