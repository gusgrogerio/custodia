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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Users, UserPlus, Edit3, UserX, ShieldCheck, RefreshCw, Mail, MapPin, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_LABEL = { admin: 'Administrador', operator: 'Operador' };

const emptyForm = {
  id: null,
  name: '',
  email: '',
  password: '',
  role: 'operator',
  region: 'Guarulhos',
  is_active: true,
};

export default function UserManagement() {
  const { getAuthHeaders, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchUsers = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const { data } = await axios.get(`${API}/users`, { withCredentials: true, headers });
      setUsers(data);
    } catch (e) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditing(false);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    setEditing(true);
    setForm({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'operator',
      region: u.region || 'Guarulhos',
      is_active: u.is_active !== false,
    });
    setDialogOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!editing && !form.password)) {
      toast.error('Preencha nome, e-mail e senha.');
      return;
    }
    if (form.role === 'operator' && !form.region) {
      toast.error('Operadores precisam ter uma região.');
      return;
    }
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (editing) {
        const payload = {
          name: form.name,
          role: form.role,
          region: form.role === 'operator' ? form.region : null,
          is_active: form.is_active,
        };
        if (form.password) payload.password = form.password;
        await axios.patch(`${API}/users/${form.id}`, payload, { withCredentials: true, headers });
        toast.success('Usuário atualizado!');
      } else {
        await axios.post(`${API}/users`, {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          region: form.role === 'operator' ? form.region : null,
        }, { withCredentials: true, headers });
        toast.success('Usuário criado!');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (u) => {
    if (!window.confirm(`Desativar o usuário ${u.email}?`)) return;
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/users/${u.id}`, { withCredentials: true, headers });
      toast.success('Usuário desativado.');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao desativar.');
    }
  };

  const reactivate = async (u) => {
    try {
      const headers = getAuthHeaders();
      await axios.patch(`${API}/users/${u.id}`, { is_active: true }, { withCredentials: true, headers });
      toast.success('Usuário reativado.');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao reativar.');
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo'] flex items-center gap-3">
              <Users className="w-7 h-7 text-blue-400" />
              Gestão de Usuários
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {users.length} usuário(s) · sistema de cadastro fechado
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-500"
            data-testid="new-user-button"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="users-table">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-semibold">Nome</TableHead>
                  <TableHead className="text-slate-400 font-semibold">E-mail</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Tipo</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Região</TableHead>
                  <TableHead className="text-slate-400 font-semibold">Status</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow
                    key={u.id}
                    className={`border-slate-800 ${u.is_active === false ? 'opacity-50' : 'hover:bg-slate-800/40'}`}
                    data-testid={`user-row-${u.email}`}
                  >
                    <TableCell className="font-semibold text-slate-100">
                      {u.name}
                      {u.id === me?.id && <span className="ml-2 text-xs text-blue-400">(você)</span>}
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        {u.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}>
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        {ROLE_LABEL[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {u.region ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {u.region}
                        </div>
                      ) : <span className="text-slate-600 text-sm">—</span>}
                    </TableCell>
                    <TableCell>
                      {u.is_active === false ? (
                        <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">Inativo</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(u)}
                          className="text-blue-400 hover:bg-blue-500/10"
                          data-testid={`edit-user-${u.email}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        {u.is_active === false ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reactivate(u)}
                            className="text-emerald-400 hover:bg-emerald-500/10"
                          >
                            Reativar
                          </Button>
                        ) : (
                          u.id !== me?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deactivate(u)}
                              className="text-red-400 hover:bg-red-500/10"
                              data-testid={`deactivate-user-${u.email}`}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Chivo']">
              {editing ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-slate-300">Nome completo</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-slate-950 border-slate-700 text-slate-100"
                data-testid="user-form-name"
                required
              />
            </div>
            <div>
              <Label className="text-slate-300">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-slate-950 border-slate-700 text-slate-100"
                disabled={editing}
                data-testid="user-form-email"
                required
              />
              {editing && <p className="text-xs text-slate-500 mt-1">E-mail não pode ser alterado.</p>}
            </div>
            <div>
              <Label className="text-slate-300 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                Senha {editing && '(deixe em branco para manter)'}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? '••••••' : 'Mín. 6 caracteres'}
                className="bg-slate-950 border-slate-700 text-slate-100"
                data-testid="user-form-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Tipo</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="user-form-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="operator" className="text-slate-200">Operador</SelectItem>
                    <SelectItem value="admin" className="text-slate-200">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Região</Label>
                <Select
                  value={form.region}
                  onValueChange={(v) => setForm({ ...form, region: v })}
                  disabled={form.role === 'admin'}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="user-form-region">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="Guarulhos" className="text-slate-200">Guarulhos</SelectItem>
                    <SelectItem value="São Paulo" className="text-slate-200">São Paulo</SelectItem>
                  </SelectContent>
                </Select>
                {form.role === 'admin' && (
                  <p className="text-xs text-slate-500 mt-1">Admin acessa todas as regiões.</p>
                )}
              </div>
            </div>
            {editing && (
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="user-form-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-blue-500"
                />
                <Label htmlFor="user-form-active" className="text-slate-300 cursor-pointer">
                  Usuário ativo (desmarque para bloquear acesso)
                </Label>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500"
                data-testid="user-form-submit">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : (editing ? 'Salvar' : 'Criar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
