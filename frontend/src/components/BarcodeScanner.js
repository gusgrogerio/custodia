import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from './ui/button';
import { X, Camera, RotateCcw, Check } from 'lucide-react';

/**
 * Barcode/QR scanner overlay using html5-qrcode.
 * Calls onResult(text) when a code is detected (auto-stops camera).
 * Works on mobile and desktop (uses environment-facing camera when possible).
 */
export default function BarcodeScanner({ open, onClose, onResult }) {
  const containerId = 'barcode-scanner-region';
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let stopped = false;
    const start = async () => {
      setError('');
      setSuccess('');
      setStarting(true);
      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.6,
          },
          (decodedText) => {
            if (stopped) return;
            stopped = true;
            setSuccess(decodedText);
            // brief flash before closing
            setTimeout(async () => {
              try { await scanner.stop(); await scanner.clear(); } catch (e) { /* ignore */ }
              onResult?.(decodedText);
            }, 350);
          },
          () => { /* ignore per-frame failures */ }
        );
      } catch (e) {
        setError(
          e?.message?.includes('NotAllowed')
            ? 'Permissão de câmera negada. Habilite no navegador.'
            : 'Não foi possível abrir a câmera. Verifique permissões e dispositivos.'
        );
      } finally {
        setStarting(false);
      }
    };

    start();

    return () => {
      stopped = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear?.());
        scannerRef.current = null;
      }
    };
  }, [open, onResult]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-4 animate-fadeIn"
      data-testid="barcode-scanner"
    >
      <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Scanner</p>
            <p className="text-sm font-semibold">Aponte para o código de barras</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="outline"
          size="sm"
          className="bg-slate-900/70 border-slate-600 text-slate-100 hover:bg-slate-800"
          data-testid="scanner-close"
        >
          <X className="w-4 h-4 mr-2" />
          Fechar
        </Button>
      </div>

      <div className="w-full max-w-2xl">
        <div
          id={containerId}
          className="w-full rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-2xl shadow-blue-500/10 bg-slate-950"
          style={{ minHeight: 320 }}
        />
        <div className="text-center mt-4">
          {starting && (
            <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
              <Camera className="w-4 h-4 animate-pulse" />
              Iniciando câmera...
            </p>
          )}
          {success && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg p-3 text-emerald-300 text-sm flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Código detectado: <span className="font-mono font-bold">{success}</span>
            </div>
          )}
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-500">
        Câmera traseira preferida · Suporta QR Code, EAN, Code 128 e mais
        <br />
        <kbd className="text-slate-400">Esc</kbd> ou clique em "Fechar" para sair
      </p>
    </div>
  );
}
