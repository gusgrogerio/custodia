import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Calendar,
  FileText,
  Image as ImageIcon,
  Send,
  Loader2,
  History
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';

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

export default function CustodyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders, token } = useAuth();
  const [custody, setCustody] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newObservation, setNewObservation] = useState('');
  const [photoUrls, setPhotoUrls] = useState({});

  const fetchCustody = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/custodies/${id}`, {
        withCredentials: true,
        headers
      });
      setCustody(response.data);
      
      // Fetch photo URLs
      if (response.data.photos && response.data.photos.length > 0) {
        const urls = {};
        for (const photo of response.data.photos) {
          try {
            const photoResponse = await axios.get(
              `${API}/files/${photo.storage_path}`,
              {
                withCredentials: true,
                headers,
                responseType: 'blob'
              }
            );
            urls[photo.id] = URL.createObjectURL(photoResponse.data);
          } catch (e) {
            console.error('Error fetching photo:', e);
          }
        }
        setPhotoUrls(urls);
      }
    } catch (error) {
      console.error('Error fetching custody:', error);
      toast.error('Custódia não encontrada');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustody();
    
    // Cleanup blob URLs on unmount
    return () => {
      Object.values(photoUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const headers = getAuthHeaders();
      await axios.patch(`${API}/custodies/${id}`, 
        { status: newStatus },
        { withCredentials: true, headers }
      );
      await fetchCustody();
      toast.success('Status atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddObservation = async () => {
    if (!newObservation.trim()) return;
    
    setUpdating(true);
    try {
      const headers = getAuthHeaders();
      await axios.patch(`${API}/custodies/${id}`, 
        { observation: newObservation },
        { withCredentials: true, headers }
      );
      setNewObservation('');
      await fetchCustody();
      toast.success('Observação adicionada com sucesso!');
    } catch (error) {
      console.error('Error adding observation:', error);
      toast.error('Erro ao adicionar observação');
    } finally {
      setUpdating(false);
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

  const getStatus = () => {
    if (!custody) return 'pending';
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
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!custody) {
    return null;
  }

  const status = getStatus();
  const StatusIcon = statusMap[status].icon;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-slate-200"
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        </div>

        {/* Main Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-50 font-['Chivo']">
                    {custody.shipment_code}
                  </h1>
                  <p className="text-sm text-slate-400">{custody.client_name}</p>
                </div>
              </div>
            </div>
            <Badge className={`${statusMap[status].class} gap-1 self-start`}>
              <StatusIcon className="w-3 h-3" />
              {statusMap[status].label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Ocorrência</p>
                <p className="text-slate-200">{occurrenceTypes[custody.occurrence_type] || custody.occurrence_type}</p>
              </div>
            </div>
            
            {custody.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Telefone</p>
                  <p className="text-slate-200">{custody.phone}</p>
                </div>
              </div>
            )}
            
            {custody.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Endereço</p>
                  <p className="text-slate-200">{custody.address}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Registrado em</p>
                <p className="text-slate-200">{formatDate(custody.created_at)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Responsável</p>
                <p className="text-slate-200">{custody.responsible_name}</p>
              </div>
            </div>
          </div>

          {custody.observation && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Observações</p>
              <div className="bg-slate-950 rounded-lg p-4 whitespace-pre-wrap text-slate-300 text-sm">
                {custody.observation}
              </div>
            </div>
          )}
        </div>

        {/* Photos */}
        {custody.photos && custody.photos.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-50">Fotos</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {custody.photos.map((photo) => (
                <div key={photo.id} className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider capitalize">{photo.type}</p>
                  {photoUrls[photo.id] ? (
                    <img 
                      src={photoUrls[photo.id]}
                      alt={photo.type}
                      className="w-full h-48 object-cover rounded-lg border border-slate-700"
                      data-testid={`photo-${photo.type}`}
                    />
                  ) : (
                    <div className="w-full h-48 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
                    </div>
                  )}
                  <p className="text-xs text-slate-500">{formatDate(photo.uploaded_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-50">Ações</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Alterar Status</Label>
              <Select 
                value={custody.status} 
                onValueChange={handleStatusChange}
                disabled={updating}
              >
                <SelectTrigger 
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  data-testid="status-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="pending" className="text-slate-200">Pendente</SelectItem>
                  <SelectItem value="resolved" className="text-slate-200">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-400">Adicionar Observação</Label>
            <Textarea
              placeholder="Digite uma nova observação..."
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 resize-none"
              rows={3}
              data-testid="new-observation-input"
            />
            <Button 
              onClick={handleAddObservation}
              disabled={updating || !newObservation.trim()}
              className="bg-blue-600 hover:bg-blue-500"
              data-testid="add-observation-button"
            >
              {updating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Adicionar
            </Button>
          </div>
        </div>

        {/* History */}
        {custody.history && custody.history.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-50">Histórico</h2>
            </div>
            
            <div className="space-y-4">
              {custody.history.slice().reverse().map((entry, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 pb-4 border-b border-slate-800 last:border-0 last:pb-0"
                >
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200">{entry.user_name}</span>
                      <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{entry.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
