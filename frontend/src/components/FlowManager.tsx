import { useState, useEffect } from 'react';
import type { Flow } from '../types';
import { getFlows, activateFlow, createFlow, deleteFlow } from '../services/api';

interface Props {
  onAlert: (message: string, type: 'success' | 'error') => void;
  onFlowChange: () => void;
}

export default function FlowManager({ onAlert, onFlowChange }: Props) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlow, setNewFlow] = useState({
    id: '',
    name: '',
    description: '',
    system_prompt: '',
    flow_type: 'intelligent' as 'intelligent' | 'menu',
  });

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const data = await getFlows();
      setFlows(data.flows);
      setCurrentFlow(data.current_flow);
    } catch (error) {
      console.error('Error loading flows:', error);
      onAlert('Error al cargar los flows', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (flowId: string) => {
    try {
      await activateFlow(flowId);
      setCurrentFlow(flowId);
      onAlert(`Flow "${flowId}" activado`, 'success');
      onFlowChange();
    } catch (error) {
      console.error('Error activating flow:', error);
      onAlert('Error al activar el flow', 'error');
    }
  };

  const handleCreate = async () => {
    if (!newFlow.id || !newFlow.name || !newFlow.system_prompt) {
      onAlert('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    try {
      await createFlow(newFlow);
      setShowCreateModal(false);
      setNewFlow({
        id: '',
        name: '',
        description: '',
        system_prompt: '',
        flow_type: 'intelligent',
      });
      await loadFlows();
      onAlert(`Flow "${newFlow.name}" creado`, 'success');
    } catch (error) {
      console.error('Error creating flow:', error);
      onAlert('Error al crear el flow', 'error');
    }
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm(`¿Estas seguro de eliminar el flow "${flowId}"?`)) {
      return;
    }

    try {
      await deleteFlow(flowId);
      await loadFlows();
      onAlert(`Flow "${flowId}" eliminado`, 'success');
    } catch (error) {
      console.error('Error deleting flow:', error);
      onAlert('Error al eliminar el flow', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-purple-500">F</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Modos del Bot</h2>
          <p className="text-sm text-gray-500">Selecciona o crea un modo de operacion</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Crear Flow
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="spinner" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className={`flow-card ${currentFlow === flow.id ? 'active' : ''} ${
                flow.is_builtin ? 'builtin' : ''
              }`}
              onClick={() => handleActivate(flow.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{flow.name}</h3>
                {flow.is_builtin && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                    Predefinido
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-2">{flow.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {flow.flow_type === 'menu' ? 'Menu' : 'Inteligente'}
                </span>
                {currentFlow === flow.id && (
                  <span className="text-xs text-green-600 font-medium">Activo</span>
                )}
                {!flow.is_builtin && (
                  <button
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(flow.id);
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Flow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Crear Nuevo Flow</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID del Flow *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="mi_flow_personalizado"
                  value={newFlow.id}
                  onChange={(e) =>
                    setNewFlow({ ...newFlow, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Solo letras minusculas, numeros y guiones bajos
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Mi Flow Personalizado"
                  value={newFlow.name}
                  onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Descripcion corta del flow"
                  value={newFlow.description}
                  onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Flow
                </label>
                <select
                  className="input"
                  value={newFlow.flow_type}
                  onChange={(e) =>
                    setNewFlow({ ...newFlow, flow_type: e.target.value as 'intelligent' | 'menu' })
                  }
                >
                  <option value="intelligent">Inteligente (IA)</option>
                  <option value="menu">Menu (Opciones)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System Prompt *
                </label>
                <textarea
                  className="textarea min-h-[200px]"
                  placeholder="Instrucciones para el asistente de IA..."
                  value={newFlow.system_prompt}
                  onChange={(e) => setNewFlow({ ...newFlow, system_prompt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Crear Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
