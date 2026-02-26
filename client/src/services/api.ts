import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 120000,
});

export interface DatabaseConfig {
    id: number;
    name: string;
    type: number;
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
    yAxisColumns: string[];
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
    data: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
    columns: string[];
    totalRowCount: number;
    isTruncated: boolean;
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

export interface TestConnectionRequest {
    type: number;
    connectionString: string;
}

export interface TestConnectionResponse {
    success: boolean;
    message: string;
    tableCount?: number;
}

export interface ColumnInfo {
    name: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    maxLength?: number;
}

export interface ForeignKeyInfo {
    column: string;
    referencedTable: string;
    referencedColumn: string;
    constraintName?: string;
}

export interface TableInfo {
    name: string;
    schema: string;
    columns: ColumnInfo[];
    foreignKeys: ForeignKeyInfo[];
    rowCount?: number;
}

export interface SchemaInfo {
    tables: TableInfo[];
    totalTableCount: number;
}

// Agent types
export interface AgentRequest {
    question: string;
    databaseConfigId: number;
}

export interface AgentStep {
    type: string;
    description: string;
    detail?: string;
    success: boolean;
    durationMs?: number;
}

export interface AgentMetadata {
    sqlAttempts: number;
    tablesDiscovered: number;
    totalDurationMs: number;
    toolCallCount: number;
}

export interface AgentResponse {
    success: boolean;
    explanation: string;
    sqlQuery?: string;
    results?: QueryResult;
    visualization?: VisualizationRecommendation;
    insights: string[];
    assumptions: string[];
    limitations: string[];
    safetyChecks: string[];
    steps: AgentStep[];
    metadata: AgentMetadata;
    error?: string;
}

export const DB_TYPE_LABELS: Record<number, string> = {
    0: 'SQL Server',
    1: 'PostgreSQL',
    2: 'MySQL',
};

export const DB_TYPE_COLORS: Record<number, string> = {
    0: 'bg-blue-100 text-blue-700',
    1: 'bg-emerald-100 text-emerald-700',
    2: 'bg-orange-100 text-orange-700',
};

export const api = {
    getConfigs: async (): Promise<DatabaseConfig[]> => {
        const response = await apiClient.get<DatabaseConfig[]>('/DatabaseConfig');
        return response.data;
    },
    createConfig: async (config: Omit<DatabaseConfig, 'id' | 'createdAt'>): Promise<DatabaseConfig> => {
        const response = await apiClient.post<DatabaseConfig>('/DatabaseConfig', config);
        return response.data;
    },
    deleteConfig: async (id: number): Promise<void> => {
        await apiClient.delete(`/DatabaseConfig/${id}`);
    },
    testConnection: async (request: TestConnectionRequest): Promise<TestConnectionResponse> => {
        const response = await apiClient.post<TestConnectionResponse>('/DatabaseConfig/test', request);
        return response.data;
    },
    testExistingConnection: async (id: number): Promise<TestConnectionResponse> => {
        const response = await apiClient.post<TestConnectionResponse>(`/DatabaseConfig/${id}/test`);
        return response.data;
    },

    getSchema: async (configId: number): Promise<SchemaInfo> => {
        const response = await apiClient.get<SchemaInfo>(`/Schema/${configId}`);
        return response.data;
    },

    generateSql: async (request: AiQueryRequest): Promise<AiQueryResponse> => {
        const response = await apiClient.post<AiQueryResponse>('/Query/generate', request);
        return response.data;
    },
    executeQuery: async (request: ExecuteQueryRequest): Promise<QueryResult> => {
        const response = await apiClient.post<QueryResult>('/Query/execute', request);
        return response.data;
    },
    getSuggestions: async (databaseConfigId: number): Promise<string[]> => {
        const response = await apiClient.post<string[]>('/Query/suggest', {
            databaseConfigId,
            naturalLanguageQuery: '',
        });
        return response.data;
    },
    getHistory: async (limit: number = 50): Promise<QueryHistory[]> => {
        const response = await apiClient.get<QueryHistory[]>(`/Query/history?limit=${limit}`);
        return response.data;
    },
    clearHistory: async (): Promise<void> => {
        await apiClient.delete('/Query/history');
    },

    // Agent
    askAgent: async (question: string, databaseConfigId: number): Promise<AgentResponse> => {
        const response = await apiClient.post<AgentResponse>('/Agent/ask', {
            question,
            databaseConfigId,
        });
        return response.data;
    },
};
