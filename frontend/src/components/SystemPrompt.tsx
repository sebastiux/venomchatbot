import { useState, useEffect } from 'react';
import { getPrompt, updatePrompt } from '../services/api';

interface Props {
  onAlert: (message: string, type: 'success' | 'error') => void;
  refreshTrigger: number;
}

export default function SystemPrompt({ onAlert, refreshTrigger }: Props) {
  const [prompt, setPrompt] = useState('');
  const [currentFlow, setCurrentFlow] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState('');

  useEffect(() => {
    loadPrompt();
  }, [refreshTrigger]);

  const loadPrompt = async () => {
    try {
      const data = await getPrompt();
      setPrompt(data.prompt);
      setOriginalPrompt(data.prompt);
      setCurrentFlow(data.current_flow);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading prompt:', error);
      onAlert('Error al cargar el prompt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePrompt(prompt);
      setOriginalPrompt(prompt);
      setHasChanges(false);
      onAlert('Prompt actualizado correctamente', 'success');
    } catch (error) {
      console.error('Error updating prompt:', error);
      onAlert('Error al actualizar el prompt', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(originalPrompt);
    setHasChanges(false);
  };

  const handleChange = (value: string) => {
    setPrompt(value);
    setHasChanges(value !== originalPrompt);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-blue-500">P</div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">System Prompt</h2>
          <p className="text-sm text-gray-500">
            Flow activo: <span className="font-medium text-gray-700">{currentFlow}</span>
          </p>
        </div>
        {hasChanges && (
          <span className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
            Cambios sin guardar
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <textarea
            className="textarea min-h-[300px] font-mono text-sm"
            value={prompt}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Escribe las instrucciones para el asistente de IA..."
          />

          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-gray-500">
              {prompt.length} caracteres
            </p>
            <div className="flex gap-2">
              {hasChanges && (
                <button className="btn btn-secondary" onClick={handleReset}>
                  Descartar
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
