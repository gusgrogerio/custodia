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
  Bell,
  X,
  RotateCcw,
  Box
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

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

function MetricCard({ title, value, icon: Icon, color, subtext, onClick, active }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-slate-900 border rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 ${
        onClick ? 'cursor-pointer' : ''
      } ${active ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-slate-800 hover:border-slate-700'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{title}</p>
          <p className={`text-3xl font-black mt-2 font-['Chivo'] ${color}`}>{value}</p>
          {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-')}/10`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function AlertBanner({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3 animate-slideUp">
      {alerts.slice(0, 5).map((alert, index) => (
        <div 
          key={index}
          className={`rounded-xl p-4 flex items-start gap-3 ${
            alert.type === 'return' 
              ? 'bg-red-500/10 border border-red-500/20' 
              : 'bg-amber-500/10 border border-amber-500/20'
          }`}
          data-testid={`alert-${alert.type}-${index}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            alert.type === 'return' ? 'bg-red-500/20' : 'bg-amber-500/20'
          }`}>
            {alert.type === 'return' ? (
              <RotateCcw className="w-5 h-5 text-red-400" />
            ) : (
              <Bell className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-semibold ${
                alert.type === 'return' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {alert.type === 'return' ? 'Custódia sem retorno há 10 dias' : 'Alerta Preventivo'}
              </span>
              <Badge className="bg-slate-800 text-slate-300 text-xs">
                {alert.box_number}
              </Badge>
            </div>
            <p className="text-sm text-slate-300">{alert.message}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-slate-500">
                {alert.days_without_treatment} dias sem tratativa
              </span>
              {alert.days_until_return > 0 && (
                <span className="text-xs text-amber-400">
                  Faltam {alert.days_until_return} dias para devolução
                </span>
              )}
            </div>
          </div>
          <Link to={`/custodia/${alert.custody_id}`}>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-400 hover:text-blue-300"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { getAuthHeaders } = useAuth();
  const { activeRegion } = useRegion();
  const [stats, setStats] = useState({ total_today: 0, pending: 0, resolved: 0, expired: 0, near_return: 0, ready_for_return: 0 });
  const [custodies, setCustodies] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(null);
  const [showAlerts, setShowAlerts] = useState(true);

  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();
      const regionParam = `region=${encodeURIComponent(activeRegion)}`;
      const [statsRes, custodiesRes, alertsRes] = await Promise.all([
        axios.get(`${API}/custodies/stats?${regionParam}`, { withCredentials: true, headers }),
        axios.get(`${API}/custodies?limit=10&${regionParam}`, { withCredentials: true, headers }),
        axios.get(`${API}/custodies/alerts?${regionParam}`, { withCredentials: true, headers })
      ]);
      setStats(statsRes.data);
      setCustodies(custodiesRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFilteredCustodies = async (filterType) => {
    try {
      const headers = getAuthHeaders();
      let url = `${API}/custodies?limit=50&region=${encodeURIComponent(activeRegion)}`;
      
      if (filterType === 'near_return') {
        url += '&near_return=true';
      } else if (filterType === 'ready_for_return') {
        url += '&ready_for_return=true';
      } else if (filterType) {
        url += `&status=${filterType}`;
      }
      
      const response = await axios.get(url, { withCredentials: true, headers });
      setCustodies(response.data);
    } catch (error) {
      console.error('Error fetching filtered custodies:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    setFilter(null);
    fetchData();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegion]);

  const handleFilterClick = (filterType) => {
    if (filter === filterType) {
      setFilter(null);
      fetchData();
    } else {
      setFilter(filterType);
      fetchFilteredCustodies(filterType);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setFilter(null);
    fetchData();
  };

  const handleExport = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/custodies/export/csv`, {
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
    if (custody.status === 'ready_for_return') return 'ready_for_return';
    if (custody.is_ready_for_return) return 'ready_for_return';
    const createdAt = new Date(custody.created_at);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff > 24) return 'expired';
    return 'pending';
  };

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
              Dashboard <span className="text-blue-400">· {activeRegion}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Operação isolada — apenas dados de {activeRegion}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="export-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {showAlerts && alerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                Alertas ({alerts.length})
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAlerts(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <AlertBanner alerts={alerts} />
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4" data-testid="metrics-cards">
          <MetricCard 
            title="Total Hoje" 
            value={stats.total_today} 
            icon={Package} 
            color="text-blue-400"
            subtext="remessas registradas"
          />
          <MetricCard 
            title="Pendentes" 
            value={stats.pending} 
            icon={Clock} 
            color="text-amber-500"
            subtext="aguardando resolução"
            onClick={() => handleFilterClick('pending')}
            active={filter === 'pending'}
          />
          <MetricCard 
            title="Resolvidos" 
            value={stats.resolved} 
            icon={CheckCircle2} 
            color="text-emerald-500"
            subtext="finalizados"
            onClick={() => handleFilterClick('resolved')}
            active={filter === 'resolved'}
          />
          <MetricCard 
            title="Vencidos" 
            value={stats.expired} 
            icon={AlertTriangle} 
            color="text-orange-500"
            subtext="> 24 horas"
          />
          <MetricCard 
            title="Perto Devolução" 
            value={stats.near_return} 
            icon={Bell} 
            color="text-amber-400"
            subtext="8-9 dias"
            onClick={() => handleFilterClick('near_return')}
            active={filter === 'near_return'}
          />
          <MetricCard 
            title="Apta Devolução" 
            value={stats.ready_for_return} 
            icon={RotateCcw} 
            color="text-red-500"
            subtext="10+ dias"
            onClick={() => handleFilterClick('ready_for_return')}
            active={filter === 'ready_for_return'}
          />
        </div>

        {/* Recent Custodies Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="custodies-table">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-50 font-['Chivo']">
              {filter ? `Filtro: ${filter === 'near_return' ? 'Perto Devolução' : filter === 'ready_for_return' ? 'Apta Devolução' : filter}` : 'Últimas Remessas'}
            </h2>
            {filter && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setFilter(null); fetchData(); }}
                className="text-slate-400"
              >
                Limpar filtro
              </Button>
            )}
          </div>
          
          {custodies.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">Nenhuma custódia registrada</p>
              <Link to="/nova-custodia">
                <Button className="mt-4 bg-blue-600 hover:bg-blue-500" data-testid="new-custody-empty-button">
                  Criar Nova Custódia
                </Button>
              </Link>
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
                    <TableHead className="text-slate-400 font-semibold hidden md:table-cell">Dias s/ Trat.</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden lg:table-cell">Responsável</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custodies.map((custody) => {
                    const status = getStatus(custody);
                    const StatusIcon = statusMap[status]?.icon || Clock;
                    const isHighlighted = custody.is_near_return || custody.is_ready_for_return;
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
                        data-testid={`custody-row-${custody.id}`}
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
                        <TableCell className="hidden md:table-cell">
                          {custody.days_without_treatment !== undefined ? (
                            <div className="flex flex-col">
                              <span className={`text-sm font-medium ${
                                custody.days_without_treatment >= 10 
                                  ? 'text-red-400' 
                                  : custody.days_without_treatment >= 8 
                                    ? 'text-amber-400' 
                                    : 'text-slate-400'
                              }`}>
                                {custody.days_without_treatment} dias
                              </span>
                              {custody.days_until_return > 0 && custody.days_until_return <= 2 && (
                                <span className="text-xs text-amber-400">
                                  {custody.days_until_return}d p/ devol.
                                </span>
                              )}
                            </div>
                          ) : '-'}
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
                              data-testid={`view-custody-${custody.id}`}
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

        {/* Floating Action Button for Mobile */}
        <Link to="/nova-custodia" className="lg:hidden">
          <Button 
            className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30"
            data-testid="floating-new-custody-button"
          >
            <Package className="w-6 h-6" />
          </Button>
        </Link>
      </div>
    </Layout>
  );
}
