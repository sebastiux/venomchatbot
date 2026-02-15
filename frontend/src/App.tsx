import { useState } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import Blacklist from './components/Blacklist';
import FlowManager from './components/FlowManager';
import SystemPrompt from './components/SystemPrompt';

type AlertType = 'success' | 'error' | 'info';

interface Alert {
  message: string;
  type: AlertType;
}

export default function App() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [promptRefresh, setPromptRefresh] = useState(0);

  const showAlert = (message: string, type: AlertType = 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleFlowChange = () => {
    setPromptRefresh((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Karuna Bot</h1>
                <p className="text-sm text-gray-500">Panel de Administracion</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/docs"
                target="_blank"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                API Docs
              </a>
              <a
                href="/health"
                target="_blank"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Health
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Alert */}
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <ConnectionStatus />
            <Blacklist onAlert={showAlert} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <FlowManager onAlert={showAlert} onFlowChange={handleFlowChange} />
            <SystemPrompt onAlert={showAlert} refreshTrigger={promptRefresh} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>Karuna Bot v3.1.0 - Baileys WhatsApp Web</p>
            <div className="flex gap-4">
              <a href="/privacy" className="hover:text-gray-700">
                Privacidad
              </a>
              <a href="/terms" className="hover:text-gray-700">
                Terminos
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
