import React from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  User,
  Mail,
  Shield,
  Loader2
} from 'lucide-react';
import { Badge } from '../components/ui/badge';

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-50 font-['Chivo']">Perfil</h1>
          <p className="text-slate-400 text-sm mt-1">Suas informações de conta</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-800">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-50">{user.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  className={user.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-slate-950 rounded-lg">
              <Mail className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">E-mail / Usuário</p>
                <p className="text-slate-200">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-950 rounded-lg">
              <User className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Nome</p>
                <p className="text-slate-200">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-950 rounded-lg">
              <Shield className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Função</p>
                <p className="text-slate-200">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-50 mb-4">Sobre o Sistema</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Versão</span>
              <span className="text-slate-200">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Sistema</span>
              <span className="text-slate-200">D1 Custódia</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Ambiente</span>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Produção</Badge>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
