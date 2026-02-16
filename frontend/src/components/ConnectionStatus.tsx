import { useState, useEffect } from 'react';
import type { ConnectionStatusResponse, ConnectionStatus as Status, QRResponse } from '../types';
import { getConnectionStatus, getQR } from '../services/api';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const statusData = await getConnectionStatus();
        setStatus(statusData);

        // Fetch QR when not connected
        if (statusData.status !== 'connected') {
          const qrResponse: QRResponse = await getQR();
          setQrData(qrResponse.qr);
        } else {
          setQrData(null);
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // Poll every 5 seconds
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (connectionStatus: Status) => {
    const badges: Record<string, { class: string; text: string }> = {
      connected: { class: 'status-connected', text: 'Conectado' },
      connecting: { class: 'status-connecting', text: 'Conectando' },
      qr_ready: { class: 'status-connecting', text: 'Escanea QR' },
      disconnected: { class: 'status-disconnected', text: 'Desconectado' },
      error: { class: 'status-error', text: 'Error' },
    };
    return badges[connectionStatus] || badges.disconnected;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center py-8">
          <div className="spinner" />
          <p className="mt-4 text-gray-500">Cargando...</p>
        </div>
      );
    }

    if (!status) {
      return (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">!</div>
          <h3 className="text-lg font-semibold text-red-600">Error de Conexion</h3>
          <p className="text-gray-500">No se pudo obtener el estado del servidor</p>
        </div>
      );
    }

    // Show QR code when available (from Maytapi getQrCode)
    if ((status.status === 'qr_ready' || status.status === 'disconnected') && qrData) {
      return (
        <div className="text-center py-4">
          <div className="qr-container">
            <img
              src={`data:image/png;base64,${qrData}`}
              alt="WhatsApp QR Code"
              className="qr-image"
            />
          </div>
          <h3 className="text-lg font-semibold mt-4 mb-2">Escanea el codigo QR</h3>
          <p className="text-gray-500 text-sm mb-2">
            Abre WhatsApp en tu telefono &gt; Dispositivos vinculados &gt; Vincular dispositivo
          </p>
          <p className="text-xs text-gray-400">
            QR gestionado por Maytapi
          </p>
        </div>
      );
    }

    // Disconnected without QR
    if (status.status === 'disconnected' && !qrData) {
      return (
        <div className="flex flex-col items-center py-8">
          <div className="text-5xl text-yellow-500 mb-4">&#x25CF;</div>
          <h3 className="text-lg font-semibold mb-2">Telefono desconectado</h3>
          <p className="text-gray-500 text-sm">
            Verifica la conexion del telefono en el panel de Maytapi
          </p>
          <a
            href="https://console.maytapi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Abrir consola Maytapi
          </a>
        </div>
      );
    }

    // Connected
    if (status.status === 'connected') {
      return (
        <div className="text-center py-4">
          <div className="text-5xl text-green-500 mb-4">&#x25CF;</div>
          <h3 className="text-lg font-semibold mb-2">WhatsApp Conectado</h3>
          <p className="text-gray-500 mb-4">El bot esta activo y listo para recibir mensajes.</p>
          <div className="bg-gray-50 rounded-lg p-3 inline-block">
            <p className="text-sm text-gray-600">
              <strong>Provider:</strong> Maytapi API
            </p>
            {status.phone && (
              <p className="text-sm text-gray-600">
                <strong>Telefono:</strong> {status.phone}
              </p>
            )}
          </div>
        </div>
      );
    }

    // Default / connecting
    return (
      <div className="flex flex-col items-center py-8">
        <div className="spinner" />
        <p className="mt-4 text-gray-500">Conectando con WhatsApp...</p>
      </div>
    );
  };

  const badge = status
    ? getStatusBadge(status.status)
    : { class: 'status-connecting', text: 'Cargando' };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">W</div>
        <h2 className="text-xl font-semibold">WhatsApp</h2>
      </div>
      <div className="mb-4">
        <span className={`status-badge ${badge.class}`}>{badge.text}</span>
      </div>
      {renderContent()}
    </div>
  );
}
