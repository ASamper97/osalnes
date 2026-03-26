import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const WEB_BASE = import.meta.env.VITE_WEB_URL || 'https://osalnes.pages.dev';

interface QrModalProps {
  slug: string;
  name: string;
  onClose: () => void;
}

export function QrModal({ slug, name, onClose }: QrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url] = useState(`${WEB_BASE}/es/recurso/${slug}`);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 280,
        margin: 2,
        color: { dark: '#1a5276', light: '#ffffff' },
      });
    }
  }, [url]);

  function handleDownload() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `qr-${slug}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win || !canvasRef.current) return;
    const imgSrc = canvasRef.current.toDataURL('image/png');
    win.document.write(`
      <html><head><title>QR - ${name}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: 'Source Sans 3', sans-serif; }
        img { width: 300px; height: 300px; }
        h2 { margin: 1.5rem 0 0.25rem; font-size: 1.3rem; color: #1a5276; }
        p { color: #566573; font-size: 0.85rem; margin: 0; }
        .url { font-size: 0.75rem; color: #999; margin-top: 1rem; word-break: break-all; max-width: 320px; text-align: center; }
        .brand { margin-top: 2rem; font-size: 0.7rem; color: #aaa; }
      </style></head><body>
        <img src="${imgSrc}" />
        <h2>${name}</h2>
        <p>O Salnes — Destino Turistico Intelixente</p>
        <div class="url">${url}</div>
        <div class="brand">Mancomunidade de O Salnes</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal__close" onClick={onClose}>✕</button>

        <h3 className="qr-modal__title">Codigo QR</h3>
        <p className="qr-modal__name">{name}</p>

        <div className="qr-modal__canvas">
          <canvas ref={canvasRef} />
        </div>

        <p className="qr-modal__url">{url}</p>

        <div className="qr-modal__actions">
          <button className="btn btn-primary" onClick={handleDownload}>Descargar PNG</button>
          <button className="btn btn-outline" onClick={handlePrint}>Imprimir</button>
        </div>
      </div>
    </div>
  );
}
