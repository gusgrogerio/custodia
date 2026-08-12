import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';

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
      setError(result.error);
      setIsLocked(result.status === 423);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      <div
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/30341205/pexels-photo-30341205.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)'
        }}
      >
        <div className="absolute inset-0 bg-slate-950/85" />
        <div className="relative z-10 flex flex-col justify-center p-12 xl:p-16">
          <div className="inline-flex w-fit bg-white rounded-2xl p-4 mb-7 shadow-2xl shadow-black/20">
            <img
              src="/logo-d1-custodia.svg"
              alt="D1 Custódia"
              className="w-48 xl:w-56 h-auto"
            />
          </div>
          <p className="text-xl text-slate-300 max-w-md leading-relaxed">
            Sistema de gestão de custódias para operações logísticas.
            Registre, acompanhe e gerencie suas remessas em um único lugar.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-md animate-fadeIn">
          <div className="lg:hidden flex flex-col items-center justify-center mb-8">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-xl shadow-black/20">
              <img src="/logo-d1-custodia.svg" alt="D1 Custódia" className="w-40 h-auto" />
            </div>
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
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
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

            <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Sistema seguro · Acesso restrito.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
