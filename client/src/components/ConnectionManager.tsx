import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, DB_TYPE_LABELS, DB_TYPE_COLORS, type DatabaseConfig, type TestConnectionResponse } from '../services/api';
import { Button } from './ui/button';
import { Trash2, Plus, Database, CheckCircle2, XCircle, Loader2, Plug, RefreshCw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export function ConnectionManager() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [newConfig, setNewConfig] = useState({ name: '', type: 0, connectionString: '' });
    const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
    const [showConnStr, setShowConnStr] = useState<Record<number, boolean>>({});
    const [connectionStatuses, setConnectionStatuses] = useState<Record<number, TestConnectionResponse | 'loading'>>({});

    const { data: configs, isLoading } = useQuery({
        queryKey: ['configs'],
        queryFn: api.getConfigs,
    });

    const createMutation = useMutation({
        mutationFn: api.createConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configs'] });
            setIsCreating(false);
            setNewConfig({ name: '', type: 0, connectionString: '' });
            setTestResult(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configs'] });
        },
    });

    const testMutation = useMutation({
        mutationFn: api.testConnection,
        onSuccess: (data) => setTestResult(data),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newConfig.name && newConfig.connectionString) {
            createMutation.mutate(newConfig);
        }
    };

    const handleTestNew = () => {
        if (newConfig.connectionString) {
            setTestResult(null);
            testMutation.mutate({
                type: newConfig.type,
                connectionString: newConfig.connectionString,
            });
        }
    };

    const handleTestExisting = async (config: DatabaseConfig) => {
        setConnectionStatuses(prev => ({ ...prev, [config.id]: 'loading' }));
        try {
            const result = await api.testExistingConnection(config.id);
            setConnectionStatuses(prev => ({ ...prev, [config.id]: result }));
        } catch {
            setConnectionStatuses(prev => ({
                ...prev,
                [config.id]: { success: false, message: 'Test failed' },
            }));
        }
    };

    const maskConnectionString = (connStr: string) => {
        return connStr.replace(/(password|pwd)\s*=\s*[^;]+/gi, '$1=••••••');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Database Connections</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Connect your databases to start querying with natural language</p>
                </div>
                <Button
                    onClick={() => setIsCreating(!isCreating)}
                    className="bg-brand-600 hover:bg-brand-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                </Button>
            </div>

            {isCreating && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-slide-up">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">New Connection</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700">Connection Name</label>
                                <input
                                    className="flex h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300"
                                    value={newConfig.name}
                                    onChange={e => setNewConfig({ ...newConfig, name: e.target.value })}
                                    placeholder="Production DB"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700">Database Type</label>
                                <select
                                    className="flex h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300"
                                    value={newConfig.type}
                                    onChange={e => setNewConfig({ ...newConfig, type: parseInt(e.target.value) })}
                                >
                                    <option value={0}>SQL Server</option>
                                    <option value={1}>PostgreSQL</option>
                                    <option value={2}>MySQL</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Connection String</label>
                            <input
                                className="flex h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300"
                                value={newConfig.connectionString}
                                onChange={e => setNewConfig({ ...newConfig, connectionString: e.target.value })}
                                placeholder={
                                    newConfig.type === 0 ? "Server=...;Database=...;User Id=...;Password=...;" :
                                    newConfig.type === 1 ? "Host=...;Database=...;Username=...;Password=...;" :
                                    "Server=...;Database=...;User=...;Password=...;"
                                }
                                required
                            />
                        </div>

                        {testResult && (
                            <div className={cn(
                                "flex items-center gap-2 p-3 rounded-lg text-sm",
                                testResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                            )}>
                                {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                <span>{testResult.message}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2">
                            <button
                                type="button"
                                onClick={handleTestNew}
                                disabled={!newConfig.connectionString || testMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {testMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                                Test Connection
                            </button>
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setTestResult(null); }}>Cancel</Button>
                                <Button type="submit" disabled={createMutation.isPending} className="bg-brand-600 hover:bg-brand-700">
                                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Save Connection
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {(!configs || configs.length === 0) && !isCreating && (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
                    <Database className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-medium text-gray-700 mb-1">No connections yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Add your first database to start exploring data with AI</p>
                    <Button onClick={() => setIsCreating(true)} className="bg-brand-600 hover:bg-brand-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Connection
                    </Button>
                </div>
            )}

            <div className="space-y-3">
                {configs?.map((config) => {
                    const status = connectionStatuses[config.id];
                    const isVisible = showConnStr[config.id];

                    return (
                        <div key={config.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center mt-0.5">
                                        <Database className="h-4.5 w-4.5 text-brand-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{config.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", DB_TYPE_COLORS[config.type])}>
                                                {DB_TYPE_LABELS[config.type]}
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                Added {new Date(config.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleTestExisting(config)}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                                    >
                                        {status === 'loading' ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3 w-3" />
                                        )}
                                        Test
                                    </button>
                                    <button
                                        onClick={() => deleteMutation.mutate(config.id)}
                                        disabled={deleteMutation.isPending}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                                <code className="flex-1 text-[11px] bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-md font-mono text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {isVisible ? config.connectionString : maskConnectionString(config.connectionString)}
                                </code>
                                <button
                                    onClick={() => setShowConnStr(prev => ({ ...prev, [config.id]: !prev[config.id] }))}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                >
                                    {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>

                            {status && status !== 'loading' && (
                                <div className={cn(
                                    "mt-3 flex items-center gap-2 text-xs p-2 rounded-md",
                                    status.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                )}>
                                    {status.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                    <span>{status.message}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
