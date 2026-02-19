import { useState, useEffect } from 'react';
import type { UserConfig } from '../types';
import { getUserConfigs, saveUserConfig, deleteUserConfig } from '../services/api';

interface Props {
  onAlert: (message: string, type: 'success' | 'error') => void;
  prefillNumber?: string;
  prefillName?: string;
  onPrefillConsumed?: () => void;
}

export default function UserConfigs({ onAlert, prefillNumber, prefillName, onPrefillConsumed }: Props) {
  const [configs, setConfigs] = useState<Record<string, UserConfig>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: '',
    name: '',
    custom_prompt: '',
    notes: '',
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  // Handle prefill from RecentMessages "Config" button
  useEffect(() => {
    if (prefillNumber) {
      openModal(prefillNumber, prefillName || '');
      onPrefillConsumed?.();
    }
  }, [prefillNumber]);

  const loadConfigs = async () => {
    try {
      const data = await getUserConfigs();
      setConfigs(data.configs || {});
    } catch (error) {
      console.error('Error loading user configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (number = '', name = '') => {
    setEditingNumber(null);
    setForm({ number, name, custom_prompt: '', notes: '' });
    setShowModal(true);
  };

  const handleEdit = (number: string) => {
    const cfg = configs[number];
    if (!cfg) return;
    setEditingNumber(number);
    setForm({
      number,
      name: cfg.name || '',
      custom_prompt: cfg.custom_prompt || '',
      notes: cfg.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.number.trim() || !form.custom_prompt.trim()) {
      onAlert('Numero y prompt son requeridos', 'error');
      return;
    }
    try {
      await saveUserConfig(form.number.trim(), form.name.trim(), form.custom_prompt.trim(), form.notes.trim());
      onAlert(`Config guardada para ${form.number}`, 'success');
      setShowModal(false);
      loadConfigs();
    } catch (error) {
      onAlert('Error al guardar config', 'error');
    }
  };

  const handleDelete = async (number: string) => {
    if (!confirm(`Eliminar config personalizada para ${number}?`)) return;
    try {
      await deleteUserConfig(number);
      onAlert(`Config eliminada para ${number}`, 'success');
      loadConfigs();
    } catch (error) {
      onAlert('Error al eliminar config', 'error');
    }
  };

  const entries = Object.entries(configs);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-orange-500">U</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Config por Usuario</h2>
          <p className="text-sm text-gray-500">Prompt personalizado por numero</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Agregar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="spinner" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Sin configuraciones personalizadas</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {entries.map(([number, cfg]) => (
            <div key={number} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="font-semibold text-sm">{cfg.name || 'Sin nombre'}</span>
                  <span className="text-xs text-gray-500 font-mono ml-2">{number}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-blue-500 hover:text-blue-700"
                    onClick={() => handleEdit(number)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(number)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 font-mono bg-white rounded p-2 max-h-16 overflow-y-auto">
                {cfg.custom_prompt.length > 120
                  ? cfg.custom_prompt.substring(0, 120) + '...'
                  : cfg.custom_prompt}
              </p>
              {cfg.notes && (
                <p className="text-xs text-gray-400 italic mt-1">{cfg.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">
              {editingNumber ? 'Editar Config de Usuario' : 'Agregar Config de Usuario'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numero de WhatsApp *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="5215512345678"
                  value={form.number}
                  disabled={!!editingNumber}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre (referencia)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Juan Perez"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt personalizado *
                </label>
                <textarea
                  className="textarea min-h-[150px]"
                  placeholder="Eres un asistente exclusivo para este usuario..."
                  value={form.custom_prompt}
                  onChange={(e) => setForm({ ...form, custom_prompt: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este prompt reemplaza al flow activo solo para este usuario.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Cliente VIP, darle prioridad"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
