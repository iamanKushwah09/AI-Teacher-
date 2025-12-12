export interface AudioVisualizerProps {
  isActive: boolean;
  mode: 'listening' | 'speaking' | 'idle';
  volume: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

// Blob type required by the GenAI Live API instructions
export interface PcmBlob {
  data: string;
  mimeType: string;
}

export interface UserProgress {
  difficulty: string;
  stars: number;
  completedTopics: string[];
}