import type {
  ConnectionStatusResponse,
  BlacklistResponse,
  FlowListResponse,
  Flow,
  PromptResponse,
  HealthResponse,
  MenuOption,
} from '../types';

// API base URL - uses environment variable in production, empty string for same-origin in dev
const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper function for API calls
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Connection Status
export async function getConnectionStatus(): Promise<ConnectionStatusResponse> {
  return fetchApi<ConnectionStatusResponse>('/api/connection-status');
}

// Health Check
export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>('/health');
}

// Blacklist
export async function getBlacklist(): Promise<BlacklistResponse> {
  return fetchApi<BlacklistResponse>('/api/blacklist');
}

export async function addToBlacklist(number: string): Promise<BlacklistResponse> {
  return fetchApi<BlacklistResponse>('/api/blacklist/add', {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

export async function removeFromBlacklist(number: string): Promise<BlacklistResponse> {
  return fetchApi<BlacklistResponse>('/api/blacklist/remove', {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

// Flows
export async function getFlows(): Promise<FlowListResponse> {
  return fetchApi<FlowListResponse>('/api/flows');
}

export async function getFlow(flowId: string): Promise<Flow> {
  return fetchApi<Flow>(`/api/flows/${flowId}`);
}

export async function activateFlow(flowId: string): Promise<void> {
  await fetchApi('/api/flow/activate', {
    method: 'POST',
    body: JSON.stringify({ flow_id: flowId }),
  });
}

export async function createFlow(flow: {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  flow_type: 'intelligent' | 'menu';
  welcome_message?: string;
  footer_message?: string;
  menu_options?: MenuOption[];
}): Promise<void> {
  await fetchApi('/api/flows', {
    method: 'POST',
    body: JSON.stringify(flow),
  });
}

export async function updateFlow(
  flowId: string,
  flow: Partial<Flow>
): Promise<void> {
  await fetchApi(`/api/flows/${flowId}`, {
    method: 'PUT',
    body: JSON.stringify(flow),
  });
}

export async function deleteFlow(flowId: string): Promise<void> {
  await fetchApi(`/api/flows/${flowId}`, {
    method: 'DELETE',
  });
}

// System Prompt
export async function getPrompt(): Promise<PromptResponse> {
  return fetchApi<PromptResponse>('/api/prompt');
}

export async function updatePrompt(prompt: string): Promise<void> {
  await fetchApi('/api/prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}
