import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

export interface DatabaseConfig {
  id: number;
  name: string;
  type: number; // 0: SqlServer, 1: PostgreSql, 2: MySql
  connectionString: string;
  createdAt: string;
}

export interface AiQueryRequest {
  naturalLanguageQuery: string;
  databaseConfigId: number;
}

export interface VisualizationRecommendation {
  chartType: string;
  xAxisColumn: string;
  yAxisColumn: string | string[];
  title: string;
}

export interface AiQueryResponse {
  sqlQuery: string;
  explanation: string;
  visualization: VisualizationRecommendation;
}

export interface ExecuteQueryRequest {
  sqlQuery: string;
  databaseConfigId: number;
}

export interface QueryResult {
  data: any[];
  rowCount: number;
  executionTimeMs: number;
  columns: string[];
}

export interface QueryHistory {
  id: number;
  naturalLanguageQuery: string;
  sqlQuery: string;
  explanation: string;
  chartType: string;
  executedAt: string;
  databaseConfigId: number;
  isSuccessful: boolean;
  errorMessage?: string;
}


export const api = {
  // Configs
  getConfigs: async () => {
    const response = await axios.get<DatabaseConfig[]>(`${API_URL}/DatabaseConfig`);
    return response.data;
  },
  createConfig: async (config: Omit<DatabaseConfig, 'id' | 'createdAt'>) => {
    const response = await axios.post<DatabaseConfig>(`${API_URL}/DatabaseConfig`, config);
    return response.data;
  },
  deleteConfig: async (id: number) => {
    await axios.delete(`${API_URL}/DatabaseConfig/${id}`);
  },

  // Query
  generateSql: async (request: AiQueryRequest) => {
    const response = await axios.post<AiQueryResponse>(`${API_URL}/Query/generate`, request);
    return response.data;
  },
  executeQuery: async (request: ExecuteQueryRequest) => {
    const response = await axios.post<QueryResult>(`${API_URL}/Query/execute`, request);
    return response.data;
  },
  getSuggestions: async (databaseConfigId: number) => {
    const response = await axios.post<string[]>(`${API_URL}/Query/suggest`, databaseConfigId, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  },
  getHistory: async (limit: number = 50) => {
    const response = await axios.get<QueryHistory[]>(`${API_URL}/Query/history?limit=${limit}`);
    return response.data;
  },
  clearHistory: async () => {
    await axios.delete(`${API_URL}/Query/history`);
  }
};

