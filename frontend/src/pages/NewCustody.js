import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { 
  Package, 
  Camera, 
  Upload, 
  X, 
  Loader2,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const occurrenceTypes = [
  { value: 'desconhecido_no_local', label: 'Desconhecido no local' },
  { value: 'numero_nao_localizado', label: 'Número não localizado' },
  { value: 'endereco_nao_localizado', label: 'Endereço não localizado' },
  { value: 'mudou_se', label: 'Mudou-se' },
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'recusado', label: 'Recusado' },
  { value: 'entrega_reagendada', label: 'Entrega reagendada' },
  { value: 'outro', label: 'Outro' },
];

function PhotoUpload({ label, photoType, photo, setPhoto, onUpload, uploading }) {
  const inputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto({ file, preview: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    setPhoto(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-slate-300">{label}</Label>
      {photo?.preview ? (
        <div className="relative">
          <img 
            src={photo.preview} 
            alt={label}
            className="w-full h-40 object-cover rounded-lg border border-slate-700"
          />
          {photo.uploaded ? (
            <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : uploading === photoType ? (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-lg">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <button 
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div 
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/50 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors h-40"
        >
          <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
            <Camera className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">Clique para tirar foto ou selecionar</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        data-testid={`photo-input-${photoType}`}
      />
    </div>
  );
}

export default function NewCustody() {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [createdCustody, setCreatedCustody] = useState(null);
  
  const [formData, setFormData] = useState({
    shipment_code: '',
    client_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    region: '',
    occurrence_type: '',
    observation: '',
    volume_current: 1,
    volume_total: 1,
  });

  const [photos, setPhotos] = useState({
    etiqueta: null,
    caixa: null,
    adicional: null,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const uploadPhoto = async (custodyId, photoType, file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = getAuthHeaders();
    await axios.post(
      `${API}/custodies/${custodyId}/photos?photo_type=${photoType}`,
      formData,
      { 
        withCredentials: true, 
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.shipment_code || !formData.client_name || !formData.occurrence_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!formData.region) {
      toast.error('Selecione a Região (São Paulo ou Guarulhos)');
      return;
    }

    setLoading(true);

    try {
      const headers = getAuthHeaders();
      
      // Create custody
      const response = await axios.post(`${API}/custodies`, formData, {
        withCredentials: true,
        headers
      });
      
      const custodyId = response.data.id;
      setCreatedCustody(response.data);

      // Upload photos
      for (const [type, photo] of Object.entries(photos)) {
        if (photo?.file) {
          setUploading(type);
          await uploadPhoto(custodyId, type, photo.file);
          setPhotos(prev => ({
            ...prev,
            [type]: { ...prev[type], uploaded: true }
          }));
        }
      }

      toast.success('Custódia criada com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating custody:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar custódia');
    } finally {
      setLoading(false);
      setUploading(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fadeIn">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo']">Nova Custódia</h1>
          <p className="text-slate-400 text-sm mt-1">Registre uma nova ocorrência de remessa</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
              <Package className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-50">Dados da Remessa</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipment_code" className="text-slate-300">
                  Código da Remessa <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="shipment_code"
                  placeholder="Ex: REM123456"
                  value={formData.shipment_code}
                  onChange={(e) => handleChange('shipment_code', e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="shipment-code-input"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_name" className="text-slate-300">
                  Nome do Cliente <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="client_name"
                  placeholder="Nome completo"
                  value={formData.client_name}
                  onChange={(e) => handleChange('client_name', e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="client-name-input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="phone-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region" className="text-slate-300">
                  Região <span className="text-red-400">*</span>
                </Label>
                <Select 
                  value={formData.region} 
                  onValueChange={(value) => handleChange('region', value)}
                >
                  <SelectTrigger 
                    className="bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                    data-testid="region-select"
                  >
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 z-50">
                    <SelectItem value="São Paulo" className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                      São Paulo
                    </SelectItem>
                    <SelectItem value="Guarulhos" className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                      Guarulhos
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occurrence_type" className="text-slate-300">
                Tipo de Ocorrência <span className="text-red-400">*</span>
              </Label>
              <Select 
                value={formData.occurrence_type} 
                onValueChange={(value) => handleChange('occurrence_type', value)}
              >
                <SelectTrigger 
                  className="bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500"
                  data-testid="occurrence-type-select"
                >
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 z-50">
                  {occurrenceTypes.map((type) => (
                    <SelectItem 
                      key={type.value} 
                      value={type.value}
                      className="text-slate-200 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-slate-300">Endereço</Label>
              <Input
                id="address"
                placeholder="Endereço completo"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                data-testid="address-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-slate-300">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Cidade"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="city-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-slate-300">Estado (UF)</Label>
                <Input
                  id="state"
                  placeholder="SP"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="state-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volume_current" className="text-slate-300">Volume Atual</Label>
                <Input
                  id="volume_current"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={formData.volume_current}
                  onChange={(e) => handleChange('volume_current', parseInt(e.target.value) || 1)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="volume-current-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume_total" className="text-slate-300">Total de Volumes</Label>
                <Input
                  id="volume_total"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={formData.volume_total}
                  onChange={(e) => handleChange('volume_total', parseInt(e.target.value) || 1)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500"
                  data-testid="volume-total-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observation" className="text-slate-300">Observação</Label>
              <Textarea
                id="observation"
                placeholder="Detalhes adicionais sobre a ocorrência..."
                value={formData.observation}
                onChange={(e) => handleChange('observation', e.target.value)}
                rows={3}
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 resize-none"
                data-testid="observation-input"
              />
            </div>
          </div>

          {/* Photos Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
              <ImageIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-50">Fotos</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PhotoUpload
                label="Foto da Etiqueta"
                photoType="etiqueta"
                photo={photos.etiqueta}
                setPhoto={(photo) => setPhotos(prev => ({ ...prev, etiqueta: photo }))}
                uploading={uploading}
              />
              <PhotoUpload
                label="Foto da Caixa"
                photoType="caixa"
                photo={photos.caixa}
                setPhoto={(photo) => setPhotos(prev => ({ ...prev, caixa: photo }))}
                uploading={uploading}
              />
              <PhotoUpload
                label="Foto Adicional"
                photoType="adicional"
                photo={photos.adicional}
                setPhoto={(photo) => setPhotos(prev => ({ ...prev, adicional: photo }))}
                uploading={uploading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="cancel-button"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              data-testid="submit-custody-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Salvar Custódia
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
