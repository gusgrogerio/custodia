import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from './ui/button';
import { X, Camera, Check } from 'lucide-react';

/**
 * Barcode/QR scanner overlay using html5-qrcode.
 * Calls onResult(text) when a code is detected (auto-stops camera).
 * Works on mobile and desktop (uses environment-facing camera when possible).
 */
export default function BarcodeScanner({ open, onClose, onResult }) {
  const containerId = 'barcode-scanner-region';
  const scannerRef = useRef(null);
  // Latest callback held in a ref so re-renders of the parent don't restart the camera.
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let detected = false;

    const start = async () => {
      setError('');
      setSuccess('');
      setStarting(true);

      // Wait one frame so the container is mounted with non-zero size
      await new Promise((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.6,
        };

        // Try environment-facing first; fall back to default camera if it fails.
        const onDetected = (decodedText) => {
          if (detected || cancelled) return;
          detected = true;
          setSuccess(decodedText);
          // Stop the camera, then notify parent.
          scanner.stop()
            .catch(() => {})
            .finally(() => {
              try { scanner.clear(); } catch (e) { /* ignore */ }
              setTimeout(() => {
                if (!cancelled) onResultRef.current?.(decodedText);
              }, 250);
            });
        };

        try {
          await scanner.start({ facingMode: 'environment' }, config, onDetected, () => {});
        } catch (envErr) {
          // Some desktops have no environment camera — try first available.
          const cams = await Html5Qrcode.getCameras().catch(() => []);
          if (cams && cams.length > 0) {
            await scanner.start(cams[0].id, config, onDetected, () => {});
          } else {
            throw envErr;
          }
        }
      } catch (e) {
        const msg = e?.message || String(e);
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setError('Permissão de câmera negada. Habilite no navegador.');
        } else if (msg.includes('NotFound') || msg.includes('NotReadable')) {
          setError('Nenhuma câmera disponível ou em uso por outro app.');
        } else {
          setError(`Não foi possível abrir a câmera: ${msg}`);
        }
        // Surface to console for debugging
        // eslint-disable-next-line no-console
        console.error('[BarcodeScanner] start failed:', e);
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => { try { s.clear(); } catch (e) { /* ignore */ } });
      }
    };
    // IMPORTANT: only depend on `open`, not on `onResult` (kept in ref above).
  }, [open]);

  // ESC key closes the overlay
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-4 animate-fadeIn"
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
