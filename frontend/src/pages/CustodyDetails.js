import React, { useState, useEffect, useRef } from 'react';
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
  History,
  Box,
  Printer,
  RotateCcw,
  Bell,
  Trash2,
  Pencil,
  Maximize2,
  Download,
  X
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

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

// Label component for printing
function LabelPreview({ labelData, onPrint }) {
  const labelRef = useRef(null);

  const handlePrint = () => {
    const printContent = labelRef.current;
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta - ${labelData.box_number}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              margin: 0;
            }
            .label {
              border: 2px solid #000;
              padding: 20px;
              max-width: 350px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
              margin-bottom: 15px;
            }
            .box-number {
              font-size: 28px;
              font-weight: bold;
              margin: 0;
            }
            .volume {
              font-size: 18px;
              color: #666;
              margin-top: 5px;
            }
            .info {
              margin-bottom: 15px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 14px;
            }
            .info-label {
              font-weight: bold;
              color: #333;
            }
            .qr-container {
              text-align: center;
              padding-top: 15px;
              border-top: 2px solid #000;
            }
            .qr-container svg {
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div 
        ref={labelRef}
        className="bg-white text-black p-6 rounded-lg border-2 border-black max-w-sm mx-auto"
      >
        <div className="label">
          <div className="header text-center border-b-2 border-black pb-4 mb-4">
            <p className="box-number text-3xl font-black">{labelData.box_number}</p>
            <p className="volume text-lg text-gray-600 mt-1">Volume: {labelData.volume}</p>
          </div>
          
          <div className="info space-y-3 mb-4">
            <div className="info-row flex justify-between text-sm">
              <span className="info-label font-bold">Código:</span>
              <span className="font-mono">{labelData.shipment_code}</span>
            </div>
            <div className="info-row flex justify-between text-sm">
              <span className="info-label font-bold">Cliente:</span>
              <span>{labelData.client_name}</span>
            </div>
            <div className="info-row flex justify-between text-sm">
              <span className="info-label font-bold">Data:</span>
              <span>{formatDate(labelData.created_at)}</span>
            </div>
          </div>
          
          <div className="qr-container text-center border-t-2 border-black pt-4">
            <QRCodeSVG 
              value={labelData.qr_data || labelData.box_number} 
              size={120}
              level="M"
            />
            <p className="text-xs mt-2 text-gray-500">{labelData.box_number}</p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir Etiqueta
        </Button>
      </div>
    </div>
  );
}

export default function CustodyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders, token } = useAuth();
  const [custody, setCustody] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [newObservation, setNewObservation] = useState('');
  const [photoUrls, setPhotoUrls] = useState({});
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [labelData, setLabelData] = useState(null);

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

  const handleDownloadPhoto = (photo) => {
    const url = photoUrls[photo.id];
    if (!url) {
      toast.error('Foto ainda carregando, tente novamente.');
      return;
    }
    const ext = (photo.original_filename?.split('.').pop()) || 'jpg';
    const fileName = `${custody.box_number || 'foto'}-${photo.type}.${ext}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ESC closes lightbox
  useEffect(() => {
    if (!lightboxPhoto) return undefined;
    const handler = (e) => { if (e.key === 'Escape') setLightboxPhoto(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxPhoto]);

  const openEdit = () => {
    setEditForm({
      shipment_code: custody.shipment_code || '',
      client_name: custody.client_name || '',
      phone: custody.phone || '',
      address: custody.address || '',
      city: custody.city || '',
      state: custody.state || '',
      region: custody.region || 'Guarulhos',
      occurrence_type: custody.occurrence_type || 'outro',
      observation: custody.observation || '',
      volume_current: custody.volume_current || 1,
      volume_total: custody.volume_total || 1,
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e) => {
    e?.preventDefault();
    if (!editForm.shipment_code || !editForm.client_name) {
      toast.error('Código da remessa e nome do cliente são obrigatórios.');
      return;
    }
    if (Number(editForm.volume_current) > Number(editForm.volume_total)) {
      toast.error('Volume atual não pode ser maior que o total.');
      return;
    }
    setEditSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = {
        ...editForm,
        volume_current: Number(editForm.volume_current),
        volume_total: Number(editForm.volume_total),
      };
      const { data } = await axios.put(`${API}/custodies/${id}`, payload, {
        withCredentials: true,
        headers
      });
      setCustody(data);
      setEditOpen(false);
      toast.success('Remessa atualizada com sucesso.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar alterações.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!custody) return;
    const label = custody.box_number || custody.shipment_code || 'esta custódia';
    if (!window.confirm(`Apagar ${label}? Esta ação NÃO pode ser desfeita e removerá também as fotos associadas.`)) {
      return;
    }
    setDeleting(true);
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/custodies/${id}`, { withCredentials: true, headers });
      toast.success('Custódia apagada com sucesso.');
      navigate('/central');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao apagar custódia.');
    } finally {
      setDeleting(false);
    }
  };

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

  const handleGenerateLabel = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/custodies/${id}/label`, {
        withCredentials: true,
        headers
      });
      setLabelData(response.data);
      setShowLabelDialog(true);
    } catch (error) {
      console.error('Error generating label:', error);
      toast.error('Erro ao gerar etiqueta');
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
    if (custody.status === 'ready_for_return' || custody.is_ready_for_return) return 'ready_for_return';
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
  const StatusIcon = statusMap[status]?.icon || Clock;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openEdit}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
              data-testid="edit-custody-button"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar Remessa
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateLabel}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="generate-label-button"
            >
              <Printer className="w-4 h-4 mr-2" />
              Gerar Etiqueta
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              data-testid="delete-custody-button"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Apagar
            </Button>
          </div>
        </div>

        {/* Alert Banner */}
        {(custody.is_near_return || custody.is_ready_for_return) && (
          <div className={`rounded-xl p-4 flex items-start gap-3 ${
            custody.is_ready_for_return 
              ? 'bg-red-500/10 border border-red-500/20' 
              : 'bg-amber-500/10 border border-amber-500/20'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              custody.is_ready_for_return ? 'bg-red-500/20' : 'bg-amber-500/20'
            }`}>
              {custody.is_ready_for_return ? (
                <RotateCcw className="w-5 h-5 text-red-400" />
              ) : (
                <Bell className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <span className={`text-sm font-semibold ${
                custody.is_ready_for_return ? 'text-red-400' : 'text-amber-400'
              }`}>
                {custody.is_ready_for_return 
                  ? 'Custódia sem retorno há 10+ dias - Apta para devolução' 
                  : `Alerta: ${custody.days_without_treatment} dias sem tratativa`}
              </span>
              {custody.days_until_return > 0 && (
                <p className="text-sm text-slate-400 mt-1">
                  Faltam {custody.days_until_return} dias para poder devolver
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Box className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-black text-blue-400 font-mono">
                    {custody.box_number || 'N/A'}
                  </p>
                  <p className="text-sm text-slate-400">
                    Volume: {custody.volume_current || 1}/{custody.volume_total || 1}
                  </p>
                </div>
              </div>
            </div>
            <Badge className={`${statusMap[status]?.class || 'status-pending'} gap-1 self-start`}>
              <StatusIcon className="w-3 h-3" />
              {statusMap[status]?.label || 'Pendente'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Package className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Código Remessa</p>
                <p className="text-slate-200 font-mono">{custody.shipment_code}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Cliente</p>
                <p className="text-slate-200">{custody.client_name}</p>
              </div>
            </div>

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

            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Dias sem Tratativa</p>
                <p className={`font-semibold ${
                  custody.days_without_treatment >= 10 
                    ? 'text-red-400' 
                    : custody.days_without_treatment >= 8 
                      ? 'text-amber-400' 
                      : 'text-slate-200'
                }`}>
                  {custody.days_without_treatment || 0} dias
                </p>
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
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="block w-full group relative overflow-hidden rounded-lg border border-slate-700 hover:border-blue-500 transition-colors"
                      data-testid={`open-photo-${photo.type}`}
                      title="Clique para ampliar"
                    >
                      <img
                        src={photoUrls[photo.id]}
                        alt={photo.type}
                        className="w-full h-48 object-cover transition-transform group-hover:scale-[1.02]"
                        data-testid={`photo-${photo.type}`}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white rounded-full p-2.5 shadow-lg">
                          <Maximize2 className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full h-48 bg-slate-950 rounded-lg border border-slate-700 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 truncate">{formatDate(photo.uploaded_at)}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!photoUrls[photo.id]}
                        onClick={() => setLightboxPhoto(photo)}
                        className="h-7 px-2 text-blue-400 hover:bg-blue-500/10"
                        data-testid={`view-photo-${photo.type}`}
                      >
                        <Maximize2 className="w-3.5 h-3.5 mr-1" />
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!photoUrls[photo.id]}
                        onClick={() => handleDownloadPhoto(photo)}
                        className="h-7 px-2 text-slate-300 hover:bg-slate-800"
                        data-testid={`download-photo-${photo.type}`}
                        title="Baixar foto"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
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
                  <SelectItem value="ready_for_return" className="text-slate-200">Apta para Devolução</SelectItem>
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.user_id === 'system' ? 'bg-amber-500/20' : 'bg-slate-800'
                  }`}>
                    {entry.user_id === 'system' ? (
                      <Bell className="w-4 h-4 text-amber-400" />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${
                        entry.user_id === 'system' ? 'text-amber-400' : 'text-slate-200'
                      }`}>
                        {entry.user_name}
                      </span>
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

      {/* Label Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-50">Etiqueta da Caixa</DialogTitle>
          </DialogHeader>
          {labelData && <LabelPreview labelData={labelData} />}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Chivo'] flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-400" />
              Editar Remessa
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Atualize os dados da custódia. Caixa, data de criação e fotos não são alteráveis aqui.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Código da Remessa *</Label>
                  <Input
                    value={editForm.shipment_code}
                    onChange={(e) => setEditForm({ ...editForm, shipment_code: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="edit-shipment-code"
                    required
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Cliente *</Label>
                  <Input
                    value={editForm.client_name}
                    onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="edit-client-name"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Telefone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="edit-phone"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Tipo de Ocorrência</Label>
                  <Select
                    value={editForm.occurrence_type}
                    onValueChange={(v) => setEditForm({ ...editForm, occurrence_type: v })}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="edit-occurrence">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {Object.entries(occurrenceTypes).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-slate-200">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Endereço</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  data-testid="edit-address"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-2">
                  <Label className="text-slate-300">Cidade</Label>
                  <Input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="edit-city"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">UF</Label>
                  <Input
                    value={editForm.state}
                    maxLength={2}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value.toUpperCase() })}
                    className="bg-slate-950 border-slate-700 text-slate-100 uppercase"
                    data-testid="edit-state"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-slate-300">Região *</Label>
                  <Select
                    value={editForm.region}
                    onValueChange={(v) => setEditForm({ ...editForm, region: v })}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="edit-region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="Guarulhos" className="text-slate-200">Guarulhos</SelectItem>
                      <SelectItem value="São Paulo" className="text-slate-200">São Paulo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Volume Atual</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.volume_current}
                    onChange={(e) => setEditForm({ ...editForm, volume_current: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="edit-volume-current"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Volume Total</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.volume_total}
                    onChange={(e) => setEditForm({ ...editForm, volume_total: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="edit-volume-total"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Observação</Label>
                <Textarea
                  value={editForm.observation}
                  onChange={(e) => setEditForm({ ...editForm, observation: e.target.value })}
                  rows={3}
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  data-testid="edit-observation"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Esta edição substitui o texto. Para registrar uma nova tratativa sem perder o histórico,
                  use a seção "Adicionar Observação" da página.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  Cancelar
                </Button>
                <Button type="submit" disabled={editSaving} className="bg-blue-600 hover:bg-blue-500"
                  data-testid="edit-custody-submit">
                  {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {/* Photo Lightbox */}
      {lightboxPhoto && photoUrls[lightboxPhoto.id] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setLightboxPhoto(null)}
          data-testid="photo-lightbox"
        >
          {/* Top bar */}
          <div
            className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white">
              <p className="text-xs uppercase tracking-wider text-slate-400">{lightboxPhoto.type}</p>
              <p className="text-sm font-semibold">
                {custody.box_number} · {formatDate(lightboxPhoto.uploaded_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadPhoto(lightboxPhoto)}
                className="bg-slate-900/70 border-slate-600 text-slate-100 hover:bg-slate-800"
                data-testid="lightbox-download"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLightboxPhoto(null)}
                className="bg-slate-900/70 border-slate-600 text-slate-100 hover:bg-slate-800"
                data-testid="lightbox-close"
              >
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
            </div>
          </div>

          <img
            src={photoUrls[lightboxPhoto.id]}
            alt={lightboxPhoto.type}
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
}
