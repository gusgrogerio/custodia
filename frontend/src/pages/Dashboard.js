import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Eye,
  RefreshCw,
  Download
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

function MetricCard({ title, value, icon: Icon, color, subtext }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5">
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

export default function Dashboard() {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState({ total_today: 0, pending: 0, resolved: 0, expired: 0 });
  const [custodies, setCustodies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();
      const [statsRes, custodiesRes] = await Promise.all([
        axios.get(`${API}/custodies/stats`, { withCredentials: true, headers }),
        axios.get(`${API}/custodies?limit=10`, { withCredentials: true, headers })
      ]);
      setStats(statsRes.data);
      setCustodies(custodiesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
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
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo']">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Visão geral das custódias</p>
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

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="metrics-cards">
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
          />
          <MetricCard 
            title="Resolvidos" 
            value={stats.resolved} 
            icon={CheckCircle2} 
            color="text-emerald-500"
            subtext="finalizados"
          />
          <MetricCard 
            title="Vencidos" 
            value={stats.expired} 
            icon={AlertTriangle} 
            color="text-red-500"
            subtext="> 24 horas"
          />
        </div>

        {/* Recent Custodies Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="custodies-table">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-slate-50 font-['Chivo']">Últimas Remessas</h2>
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
                    <TableHead className="text-slate-400 font-semibold">Código</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Cliente</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden sm:table-cell">Ocorrência</TableHead>
                    <TableHead className="text-slate-400 font-semibold">Status</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden md:table-cell">Data/Hora</TableHead>
                    <TableHead className="text-slate-400 font-semibold hidden lg:table-cell">Responsável</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custodies.map((custody) => {
                    const status = getStatus(custody);
                    const StatusIcon = statusMap[status].icon;
                    return (
                      <TableRow 
                        key={custody.id} 
                        className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                        data-testid={`custody-row-${custody.id}`}
                      >
                        <TableCell className="font-mono text-slate-200">{custody.shipment_code}</TableCell>
                        <TableCell className="text-slate-300">{custody.client_name}</TableCell>
                        <TableCell className="text-slate-400 hidden sm:table-cell">
                          {occurrenceTypes[custody.occurrence_type] || custody.occurrence_type}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusMap[status].class} gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusMap[status].label}
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
