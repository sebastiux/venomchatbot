// Connection Status Types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionStatusResponse {
  status: ConnectionStatus;
  provider: string;
  error: string | null;
  number_id: string | null;
  timestamp: string;
}

// Blacklist Types
export interface BlacklistResponse {
  blacklist: string[];
  count: number;
}

// Flow Types
export interface MenuOption {
  number: number;
  text: string;
  response: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_builtin: boolean;
  flow_type: 'intelligent' | 'menu';
  welcome_message?: string;
  footer_message?: string;
  menu_options?: MenuOption[];
}

export interface FlowListResponse {
  flows: Flow[];
  current_flow: string;
}

// Prompt Types
export interface PromptResponse {
  prompt: string;
  current_flow: string;
}

// Health Types
export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}
