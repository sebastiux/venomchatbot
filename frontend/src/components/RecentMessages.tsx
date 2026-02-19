import { useState, useEffect, useRef } from 'react';
import type { RecentMessage } from '../types';
import { getRecentMessages, addToBlacklist } from '../services/api';

interface Props {
  onAlert: (message: string, type: 'success' | 'error') => void;
  onBlacklistChange?: () => void;
  onConfigUser?: (number: string, name: string) => void;
}

export default function RecentMessages({ onAlert, onBlacklistChange, onConfigUser }: Props) {
  const [messages, setMessages] = useState<RecentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMessages();
    intervalRef.current = setInterval(loadMessages, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const loadMessages = async () => {
    try {
      const data = await getRecentMessages(50);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async (number: string) => {
    if (!confirm(`Bloquear el numero ${number}?`)) return;
    try {
      await addToBlacklist(number);
      onAlert(`Numero ${number} bloqueado`, 'success');
      onBlacklistChange?.();
      loadMessages();
    } catch (error) {
      onAlert('Error al bloquear', 'error');
    }
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-blue-500">R</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Mensajes Recientes</h2>
          <p className="text-sm text-gray-500">{messages.length} mensajes - Auto-refresh: 10s</p>
        </div>
        <button className="btn btn-secondary text-sm" onClick={loadMessages}>
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="spinner" />
        </div>
      ) : messages.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No hay mensajes recientes</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {getInitials(msg.name || msg.from)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{msg.name || msg.from}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-600 break-words mt-0.5">
                  {msg.text.length > 150 ? msg.text.substring(0, 150) + '...' : msg.text}
                </p>
                <span className="text-xs text-gray-400 font-mono">{msg.from}</span>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {onConfigUser && (
                  <button
                    className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                    onClick={() => onConfigUser(msg.from, msg.name || '')}
                    title="Configurar usuario"
                  >
                    Config
                  </button>
                )}
                <button
                  className="text-xs px-2 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                  onClick={() => handleBlock(msg.from)}
                  title="Bloquear numero"
                >
                  Bloquear
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
