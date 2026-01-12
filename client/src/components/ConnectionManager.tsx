import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type DatabaseConfig } from '../services/api';
import { Button } from './ui/button';
import { Trash2, Plus, Database } from 'lucide-react';

export function ConnectionManager() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [newConfig, setNewConfig] = useState<Partial<DatabaseConfig>>({
        name: '',
        type: 0,
        connectionString: ''
    });

    const { data: configs, isLoading } = useQuery({
        queryKey: ['configs'],
        queryFn: api.getConfigs
    });

    const createMutation = useMutation({
        mutationFn: api.createConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configs'] });
            setIsCreating(false);
            setNewConfig({ name: '', type: 0, connectionString: '' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configs'] });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newConfig.name && newConfig.connectionString) {
            createMutation.mutate(newConfig as any);
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Database Connections</h2>
                <Button onClick={() => setIsCreating(!isCreating)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                </Button>
            </div>

            {isCreating && (
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-medium mb-4">New Connection</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newConfig.name}
                                    onChange={e => setNewConfig({ ...newConfig, name: e.target.value })}
                                    placeholder="My Database"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Type</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newConfig.type}
                                    onChange={e => setNewConfig({ ...newConfig, type: parseInt(e.target.value) })}
                                >
                                    <option value={0}>SQL Server</option>
                                    <option value={1}>PostgreSQL</option>
                                    <option value={2}>MySQL</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Connection String</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={newConfig.connectionString}
                                onChange={e => setNewConfig({ ...newConfig, connectionString: e.target.value })}
                                placeholder="Server=...;Database=...;"
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending ? 'Saving...' : 'Save Connection'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configs?.map((config) => (
                    <div key={config.id} className="bg-card border rounded-lg p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="h-5 w-5 text-muted-foreground" />
                                <h3 className="font-semibold text-lg">{config.name}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                {config.type === 0 ? 'SQL Server' : config.type === 1 ? 'PostgreSQL' : 'MySQL'}
                            </p>
                            <code className="text-xs bg-muted p-2 rounded block overflow-hidden text-ellipsis whitespace-nowrap mb-4">
                                {config.connectionString}
                            </code>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteMutation.mutate(config.id)}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
