import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Package, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      // Lockout 423 → mais explícito; demais → mensagem genérica do backend
      setError(result.error);
      setIsLocked(result.status === 423);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Background Image Side */}
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/30341205/pexels-photo-30341205.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)'
        }}
      >
        <div className="absolute inset-0 bg-slate-950/80" />
        <div className="relative z-10 flex flex-col justify-center p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white font-['Chivo']">D1 Custódia</h1>
          </div>
          <p className="text-xl text-slate-300 max-w-md leading-relaxed">
            Sistema de gestão de custódias para operações logísticas. 
            Registre, acompanhe e gerencie suas remessas em um único lugar.
          </p>
        </div>
      </div>

      {/* Login Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-md animate-fadeIn">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white font-['Chivo']">D1 Custódia</h1>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-50 font-['Chivo']">Entrar</h2>
              <p className="text-slate-400 mt-1">Acesse sua conta para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-mail ou Usuário</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12"
                  data-testid="login-email-input"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-12 pr-10"
                    data-testid="login-password-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div 
                  className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                    isLocked
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                  data-testid="login-error"
                >
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all duration-200"
                disabled={loading}
                data-testid="login-submit-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-500 text-xs">
                Sistema fechado · Solicite acesso ao administrador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
