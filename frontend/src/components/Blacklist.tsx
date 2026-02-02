import { useState, useEffect } from 'react';
import { getBlacklist, addToBlacklist, removeFromBlacklist } from '../services/api';

interface Props {
  onAlert: (message: string, type: 'success' | 'error') => void;
}

export default function Blacklist({ onAlert }: Props) {
  const [numbers, setNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlacklist();
  }, []);

  const loadBlacklist = async () => {
    try {
      const data = await getBlacklist();
      setNumbers(data.blacklist);
    } catch (error) {
      console.error('Error loading blacklist:', error);
      onAlert('Error al cargar la lista negra', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newNumber.trim()) {
      onAlert('Ingresa un numero de telefono', 'error');
      return;
    }

    try {
      const data = await addToBlacklist(newNumber.trim());
      setNumbers(data.blacklist);
      setNewNumber('');
      onAlert(`Numero ${newNumber} agregado a la lista negra`, 'success');
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      onAlert('Error al agregar el numero', 'error');
    }
  };

  const handleRemove = async (number: string) => {
    try {
      const data = await removeFromBlacklist(number);
      setNumbers(data.blacklist);
      onAlert(`Numero ${number} removido de la lista negra`, 'success');
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      onAlert('Error al remover el numero', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon bg-red-500">B</div>
        <div>
          <h2 className="text-xl font-semibold">Lista Negra</h2>
          <p className="text-sm text-gray-500">{numbers.length} numeros bloqueados</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="input flex-1"
          placeholder="Numero de telefono (ej: 5215512345678)"
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-danger" onClick={handleAdd}>
          Bloquear
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="spinner" />
        </div>
      ) : numbers.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No hay numeros en la lista negra</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {numbers.map((number) => (
            <div
              key={number}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2"
            >
              <span className="font-mono">{number}</span>
              <button
                className="text-red-500 hover:text-red-700 text-sm"
                onClick={() => handleRemove(number)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
