import { useState, useEffect } from 'react';
import type { ConnectionStatusResponse, ConnectionStatus as Status } from '../types';
import { getConnectionStatus } from '../services/api';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getConnectionStatus();
        setStatus(data);
      } catch (error) {
        console.error('Error fetching connection status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (connectionStatus: Status) => {
    const badges: Record<Status, { class: string; text: string }> = {
      connected: { class: 'status-connected', text: 'Conectado' },
      connecting: { class: 'status-connecting', text: 'Conectando' },
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
          <div className="text-4xl mb-4">⚠</div>
          <h3 className="text-lg font-semibold text-red-600">Error de Conexion</h3>
          <p className="text-gray-500">No se pudo obtener el estado del servidor</p>
        </div>
      );
    }

    switch (status.status) {
      case 'connected':
        return (
          <div className="text-center py-4">
            <div className="text-5xl text-green-500 mb-4">●</div>
            <h3 className="text-lg font-semibold mb-2">WhatsApp Business API Conectado</h3>
            <p className="text-gray-500 mb-4">El bot esta activo y listo para recibir mensajes.</p>
            {status.number_id && (
              <div className="bg-gray-50 rounded-lg p-3 inline-block">
                <p className="text-sm text-gray-600">
                  <strong>Provider:</strong> Meta WhatsApp Business API
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Number ID:</strong> {status.number_id}
                </p>
              </div>
            )}
          </div>
        );

      case 'connecting':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="spinner" />
            <p className="mt-4 text-gray-500">Conectando con Meta WhatsApp API...</p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-4">
            <div className="text-5xl text-red-500 mb-4">⚠</div>
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error de Conexion</h3>
            <p className="text-gray-500 mb-4">{status.error || 'Error desconocido'}</p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <strong className="text-gray-700">Verifica:</strong>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                <li>META_JWT_TOKEN esta configurado correctamente</li>
                <li>META_NUMBER_ID es valido</li>
                <li>El webhook esta configurado en Meta Developer Portal</li>
              </ul>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <div className="text-5xl text-gray-400 mb-4">○</div>
            <h3 className="text-lg font-semibold mb-2">Bot Desconectado</h3>
            <p className="text-gray-500">Verifica la configuracion del servidor.</p>
          </div>
        );
    }
  };

  const badge = status ? getStatusBadge(status.status) : { class: 'status-connecting', text: 'Cargando' };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">W</div>
        <h2 className="text-xl font-semibold">Meta WhatsApp API</h2>
      </div>
      <div className="mb-4">
        <span className={`status-badge ${badge.class}`}>{badge.text}</span>
      </div>
      {renderContent()}
    </div>
  );
}
