import React, { useState, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusMap = {
  pending: { label: 'Pendente', class: 'status-pending', icon: Clock },
  resolved: { label: 'Resolvido', class: 'status-resolved', icon: CheckCircle2 },
  expired: { label: 'Vencido', class: 'status-expired', icon: AlertTriangle },
  ready_for_return: { label: 'Apta Devolução', class: 'bg-red-500/20 text-red-400 border border-red-500/30', icon: RotateCcw },
};

const occurrenceTypes = {
  'desconhecido_no_local': 'Desconhecido no local',
  'numero_nao_localizado': 'Número não localizado',
  'endereco_nao_localizado': 'Endereço não localizado',
  'mudou_se': 'Mudou-se',
  'cliente_ausente': 'Cliente ausente',
  'recusado': 'Recusado',
  'entrega_reagendada': 'Entrega reagendada',
  'outro': 'Outro',
};

export default function History() {
  const { getAuthHeaders } = useAuth();
  const { activeRegion } = useRegion();
  const [custodies, setCustodies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    status: '',
    occurrence_type: '',
    responsible_id: '',
    date_from: null,
    date_to: null,
  });

  const fetchCustodies = async () => {
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      params.append('region', activeRegion);
      
      if (filters.status) params.append('status', filters.status);
      if (filters.occurrence_type) params.append('occurrence_type', filters.occurrence_type);
      if (filters.responsible_id) params.append('responsible_id', filters.responsible_id);
      if (filters.date_from) params.append('date_from', filters.date_from.toISOString());
      if (filters.date_to) params.append('date_to', filters.date_to.toISOString());
      
      const response = await axios.get(`${API}/custodies?${params.toString()}`, {
        withCredentials: true,
        headers
      });
      setCustodies(response.data);
    } catch (error) {
      console.error('Error fetching custodies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/users`, {
        withCredentials: true,
        headers
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchCustodies();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchCustodies();
  }, [filters, activeRegion]);

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
      link.setAttribute('download', `custodias_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      occurrence_type: '',
      responsible_id: '',
      date_from: null,
      date_to: null,
    });
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

  const getStatus = (custody) => {
    if (custody.status === 'resolved') return 'resolved';
    const createdAt = new Date(custody.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff > 24) return 'expired';
    return 'pending';
  };

  const hasActiveFilters = filters.status || filters.occurrence_type || filters.responsible_id || filters.date_from || filters.date_to;

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
      <div className="space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo']">
              Histórico <span className="text-blue-400">· {activeRegion}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {custodies.length} registros encontrados em {activeRegion}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-slate-700 text-slate-300 hover:bg-slate-800 ${hasActiveFilters ? 'border-blue-500 text-blue-400' : ''}`}
              data-testid="filter-button"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="export-history-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Filtros</h3>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="filter-status">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="" className="text-slate-200">Todos</SelectItem>
                    <SelectItem value="pending" className="text-slate-200">Pendente</SelectItem>
                    <SelectItem value="resolved" className="text-slate-200">Resolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Ocorrência</Label>
                <Select 
                  value={filters.occurrence_type} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, occurrence_type: value }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="filter-occurrence">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="" className="text-slate-200">Todos</SelectItem>
                    {Object.entries(occurrenceTypes).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-slate-200">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Responsável</Label>
                <Select 
                  value={filters.responsible_id} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, responsible_id: value }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="filter-responsible">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="" className="text-slate-200">Todos</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="text-slate-200">
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-slate-950 border-slate-700 text-slate-100 hover:bg-slate-800"
                      data-testid="filter-date-from"
                    >
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
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-slate-950 border-slate-700 text-slate-100 hover:bg-slate-800"
                      data-testid="filter-date-to"
                    >
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
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="history-table">
          {custodies.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">Nenhuma custódia encontrada</p>
              {hasActiveFilters && (
                <Button 
                  variant="outline"
                  className="mt-4 border-slate-700 text-slate-300"
                  onClick={clearFilters}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-semibold">Nº Caixa</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Código</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Cliente</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden sm:table-cell">Volume</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Status</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden md:table-cell">Data/Hora</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden lg:table-cell">Responsável</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custodies.map((custody) => {
                    const status = getStatus(custody);
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
                        data-testid={`history-row-${custody.id}`}
                      >
                        <TableCell className="font-mono text-blue-400 font-semibold">
                          <div className="flex items-center gap-2">
                            <Box className="w-4 h-4" />
                            {custody.box_number || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-slate-200">{custody.shipment_code}</TableCell>
                        <TableCell className="text-slate-300">{custody.client_name}</TableCell>
                        <TableCell className="text-slate-400 hidden sm:table-cell">
                          {custody.volume_current || 1}/{custody.volume_total || 1}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusMap[status]?.class || 'status-pending'} gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusMap[status]?.label || 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 hidden md:table-cell">
                          {formatDate(custody.created_at)}
                        </TableCell>
                        <TableCell className="text-slate-400 hidden lg:table-cell">
                          {custody.responsible_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/custodia/${custody.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              data-testid={`view-history-${custody.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline">Ver</span>
                            </Button>
                          </Link>
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
