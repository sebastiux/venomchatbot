import { useState, useEffect } from 'react';
import type { Flow, MenuOption } from '../types';
import { getFlows, getFlow, activateFlow, createFlow, updateFlow, deleteFlow } from '../services/api';

interface Props {
  onAlert: (message: string, type: 'success' | 'error') => void;
  onFlowChange: () => void;
}

interface FlowForm {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  flow_type: 'intelligent' | 'menu';
  welcome_message: string;
  footer_message: string;
  menu_options: MenuOption[];
}

const emptyForm: FlowForm = {
  id: '',
  name: '',
  description: '',
  system_prompt: '',
  flow_type: 'intelligent',
  welcome_message: '',
  footer_message: '',
  menu_options: [],
};

export default function FlowManager({ onAlert, onFlowChange }: Props) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [form, setForm] = useState<FlowForm>({ ...emptyForm });

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

  const openCreateModal = () => {
    setEditingFlowId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEditModal = async (flowId: string) => {
    try {
      const flow = await getFlow(flowId);
      setEditingFlowId(flowId);
      setForm({
        id: flow.id,
        name: flow.name || '',
        description: flow.description || '',
        system_prompt: flow.system_prompt || '',
        flow_type: flow.flow_type || 'intelligent',
        welcome_message: flow.welcome_message || '',
        footer_message: flow.footer_message || '',
        menu_options: flow.menu_options || [],
      });
      setShowModal(true);
    } catch (error) {
      onAlert('Error al cargar el flow', 'error');
    }
  };

  const handleSave = async () => {
    if (!form.id || !form.name || !form.system_prompt) {
      onAlert('Por favor completa ID, Nombre y System Prompt', 'error');
      return;
    }

    if (form.flow_type === 'menu') {
      if (!form.welcome_message.trim()) {
        onAlert('El mensaje de bienvenida es requerido para el modo menu', 'error');
        return;
      }
      const validOptions = form.menu_options.filter(o => o.label.trim() && o.response.trim());
      if (validOptions.length === 0) {
        onAlert('Agrega al menos una opcion al menu', 'error');
        return;
      }
    }

    try {
      const payload = {
        id: form.id,
        name: form.name,
        description: form.description,
        system_prompt: form.system_prompt,
        flow_type: form.flow_type,
        ...(form.flow_type === 'menu' ? {
          welcome_message: form.welcome_message,
          footer_message: form.footer_message || 'Escribe el numero de tu opcion',
          menu_options: form.menu_options.filter(o => o.label.trim() && o.response.trim()),
        } : {}),
      };

      if (editingFlowId) {
        await updateFlow(editingFlowId, payload);
        onAlert(`Flow "${form.name}" actualizado`, 'success');
      } else {
        await createFlow(payload);
        onAlert(`Flow "${form.name}" creado`, 'success');
      }

      setShowModal(false);
      await loadFlows();
    } catch (error) {
      console.error('Error saving flow:', error);
      onAlert('Error al guardar el flow', 'error');
    }
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm(`Eliminar el flow "${flowId}"?`)) return;

    try {
      await deleteFlow(flowId);
      await loadFlows();
      onAlert(`Flow "${flowId}" eliminado`, 'success');
    } catch (error) {
      console.error('Error deleting flow:', error);
      onAlert('Error al eliminar el flow', 'error');
    }
  };

  // Menu option helpers
  const addMenuOption = () => {
    setForm({
      ...form,
      menu_options: [...form.menu_options, { label: '', response: '' }],
    });
  };

  const updateMenuOption = (index: number, field: keyof MenuOption, value: string) => {
    const updated = [...form.menu_options];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, menu_options: updated });
  };

  const removeMenuOption = (index: number) => {
    setForm({
      ...form,
      menu_options: form.menu_options.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-purple-500">F</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Modos del Bot</h2>
          <p className="text-sm text-gray-500">Selecciona o crea un modo de operacion</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
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
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="text-xs text-blue-500 hover:text-blue-700"
                      onClick={() => openEditModal(flow.id)}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(flow.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Flow Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">
              {editingFlowId ? 'Editar Flow' : 'Crear Nuevo Flow'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID del Flow *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="mi_flow_personalizado"
                  value={form.id}
                  disabled={!!editingFlowId}
                  onChange={(e) =>
                    setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })
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
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Flow
                </label>
                <select
                  className="input"
                  value={form.flow_type}
                  onChange={(e) => {
                    const newType = e.target.value as 'intelligent' | 'menu';
                    setForm({
                      ...form,
                      flow_type: newType,
                      menu_options: newType === 'menu' && form.menu_options.length === 0
                        ? [{ label: '', response: '' }, { label: '', response: '' }]
                        : form.menu_options,
                    });
                  }}
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
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                />
              </div>

              {/* Menu Configuration */}
              {form.flow_type === 'menu' && (
                <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                  <h4 className="font-semibold text-purple-800 mb-3">Configuracion del Menu</h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mensaje de Bienvenida *
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Bienvenido! En que puedo ayudarte?"
                        value={form.welcome_message}
                        onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mensaje de Pie
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Escribe el numero de tu opcion"
                        value={form.footer_message}
                        onChange={(e) => setForm({ ...form, footer_message: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Opciones del Menu
                      </label>
                      <div className="space-y-3">
                        {form.menu_options.map((option, index) => (
                          <div key={index} className="bg-white rounded-lg p-3 border border-purple-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-purple-700">Opcion {index + 1}</span>
                              <button
                                className="text-xs text-red-500 hover:text-red-700"
                                onClick={() => removeMenuOption(index)}
                              >
                                Eliminar
                              </button>
                            </div>
                            <input
                              type="text"
                              className="input mb-2"
                              placeholder="Etiqueta (lo que ve el usuario)"
                              value={option.label}
                              onChange={(e) => updateMenuOption(index, 'label', e.target.value)}
                            />
                            <textarea
                              className="textarea min-h-[60px]"
                              placeholder="Respuesta al seleccionar esta opcion"
                              value={option.response}
                              onChange={(e) => updateMenuOption(index, 'response', e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        className="btn btn-secondary w-full mt-2"
                        onClick={addMenuOption}
                      >
                        + Agregar Opcion
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingFlowId ? 'Actualizar Flow' : 'Crear Flow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
