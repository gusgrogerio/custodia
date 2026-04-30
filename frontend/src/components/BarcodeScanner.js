import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Button } from './ui/button';
import { X, Camera, Check } from 'lucide-react';

/**
 * Barcode/QR scanner overlay using html5-qrcode.
 * Defensive against the common "Cannot stop, scanner is not running or paused"
 * error by checking the scanner state before calling stop().
 */
export default function BarcodeScanner({ open, onClose, onResult }) {
  const containerId = 'barcode-scanner-region';
  const scannerRef = useRef(null);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState(false);

  // Safe stop helper — never throws.
  const safeStopScanner = async (scanner) => {
    if (!scanner) return;
    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch (e) {
      // ignore "not running" or transition errors
    }
    try { scanner.clear(); } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let detected = false;
    let localScanner = null;

    const start = async () => {
      setError('');
      setSuccess('');
      setStarting(true);

      // Wait one frame so the container exists & has size
      await new Promise((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        setError('Falha ao montar o scanner. Tente novamente.');
        setStarting(false);
        return;
      }

      try {
        localScanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = localScanner;

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.6,
        };

        const onDetected = async (decodedText) => {
          if (detected || cancelled) return;
          detected = true;
          setSuccess(decodedText);
          await safeStopScanner(localScanner);
          if (!cancelled) {
            setTimeout(() => {
              if (!cancelled) onResultRef.current?.(decodedText);
            }, 250);
          }
        };

        try {
          await localScanner.start({ facingMode: 'environment' }, config, onDetected, () => {});
        } catch (envErr) {
          // Some devices have no environment camera — try first available
          let cams = [];
          try { cams = await Html5Qrcode.getCameras(); } catch (e) { /* ignore */ }
          if (cams && cams.length > 0) {
            await localScanner.start(cams[0].id, config, onDetected, () => {});
          } else {
            throw envErr;
          }
        }

        if (cancelled) {
          // Component unmounted while we were starting — stop immediately
          await safeStopScanner(localScanner);
        }
      } catch (e) {
        const msg = e?.message || String(e);
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setError('Permissão de câmera negada. Habilite no navegador e tente novamente.');
        } else if (msg.includes('NotFound') || msg.includes('NotReadable')) {
          setError('Nenhuma câmera disponível ou em uso por outro app.');
        } else {
          setError(`Erro ao iniciar a câmera: ${msg}`);
        }
        // eslint-disable-next-line no-console
        console.error('[BarcodeScanner] start failed:', e);
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current || localScanner;
      scannerRef.current = null;
      // Defer slightly to let any in-flight start() reach a stoppable state
      setTimeout(() => { safeStopScanner(s); }, 50);
    };
  }, [open]);

  // ESC closes overlay
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-4"
      data-testid="barcode-scanner"
    >
      <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
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
          {starting && !error && (
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
      </p>
    </div>
  );
}
