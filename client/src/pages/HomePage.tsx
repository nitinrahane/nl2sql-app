import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, type AiQueryResponse, type QueryResult, type QueryHistory as QueryHistoryType } from '../services/api';
import { Button } from '../components/ui/button';
import { ResultsTable } from '../components/ResultsTable';
import { ChartViewer } from '../components/ChartViewer';
import { Play, Sparkles, Loader2, Code2, Table as TableIcon, BarChart3, Lightbulb, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import QueryHistory from '../components/QueryHistory';

export function HomePage() {
    const [query, setQuery] = useState('');
    const [selectedConfigId, setSelectedConfigId] = useState<number | ''>('');
    const [generatedSql, setGeneratedSql] = useState<AiQueryResponse | null>(null);
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const { data: configs } = useQuery({
        queryKey: ['configs'],
        queryFn: api.getConfigs
    });

    const generateMutation = useMutation({
        mutationFn: api.generateSql,
        onSuccess: (data) => {
            setGeneratedSql(data);
            setQueryResult(null); // Reset previous results
        }
    });

    const executeMutation = useMutation({
        mutationFn: api.executeQuery,
        onSuccess: (data) => {
            setQueryResult(data);
        }
    });

    const { data: suggestions, isFetching: isFetchingSuggestions } = useQuery({
        queryKey: ['suggestions', selectedConfigId],
        queryFn: () => selectedConfigId ? api.getSuggestions(Number(selectedConfigId)) : Promise.resolve([]),
        enabled: !!selectedConfigId
    });

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        if (query && selectedConfigId) {
            generateMutation.mutate({
                naturalLanguageQuery: query,
                databaseConfigId: Number(selectedConfigId)
            });
        }
    };

    const handleExecute = () => {
        if (generatedSql && selectedConfigId) {
            executeMutation.mutate({
                sqlQuery: generatedSql.sqlQuery,
                databaseConfigId: Number(selectedConfigId)
            });
        }
    };

    const handleSelectHistory = (item: QueryHistoryType) => {
        setQuery(item.naturalLanguageQuery);
        setSelectedConfigId(item.databaseConfigId);
        setGeneratedSql({
            sqlQuery: item.sqlQuery,
            explanation: item.explanation,
            visualization: {
                chartType: item.chartType,
                xAxisColumn: '', // These will be filled by AI if we re-generate, but for now we just show the SQL
                yAxisColumn: '',
                title: ''
            }
        });
        setQueryResult(null);
        setIsHistoryOpen(false);
    };


    return (
        <div className="max-w-6xl mx-auto space-y-8 relative">
            <QueryHistory
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                onSelectQuery={handleSelectHistory}
            />

            {/* Header with History Toggle */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">AI Data Assistant</h1>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsHistoryOpen(true)}
                    className="gap-2"
                >
                    <Clock className="h-4 w-4" />
                    History
                </Button>
            </div>

            {/* Input Section */}
            <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4">

                <div className="flex gap-4">
                    <div className="w-1/4">
                        <label className="text-sm font-medium mb-2 block">Database</label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={selectedConfigId}
                            onChange={(e) => setSelectedConfigId(Number(e.target.value))}
                        >
                            <option value="">Select Database</option>
                            {configs?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Your Question</label>
                        <form onSubmit={handleGenerate} className="flex gap-2">
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                placeholder="e.g., Show me top 10 employees by sales performance"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <Button type="submit" disabled={!selectedConfigId || !query || generateMutation.isPending}>
                                {generateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                )}
                                Generate
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Suggestions */}
                {selectedConfigId && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            <span>Suggested Questions</span>
                            {isFetchingSuggestions && <Loader2 className="h-3 w-3 animate-spin" />}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {suggestions?.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => setQuery(suggestion)}
                                    className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1 rounded-full transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                            {!isFetchingSuggestions && (!suggestions || suggestions.length === 0) && (
                                <span className="text-xs text-muted-foreground italic">No suggestions available</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Generated SQL Section */}
            {generatedSql && (
                <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold flex items-center">
                                <Code2 className="h-5 w-5 mr-2 text-primary" />
                                Generated SQL
                            </h3>
                            <p className="text-sm text-muted-foreground">{generatedSql.explanation}</p>
                        </div>
                        <Button onClick={handleExecute} disabled={executeMutation.isPending}>
                            {executeMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Play className="h-4 w-4 mr-2" />
                            )}
                            Execute Query
                        </Button>
                    </div>
                    <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
                            {generatedSql.sqlQuery}
                        </pre>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {queryResult && (
                <div className="bg-card border rounded-lg p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">Results</h3>
                            <p className="text-sm text-muted-foreground">
                                {queryResult.rowCount} rows found in {queryResult.executionTimeMs}ms
                            </p>
                        </div>
                        <div className="flex bg-muted rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('table')}
                                className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                                    viewMode === 'table' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <TableIcon className="h-4 w-4 mr-2 inline" />
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('chart')}
                                className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                                    viewMode === 'chart' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <BarChart3 className="h-4 w-4 mr-2 inline" />
                                Chart
                            </button>
                        </div>
                    </div>

                    <div className="min-h-[300px]">
                        {viewMode === 'table' ? (
                            <ResultsTable result={queryResult} />
                        ) : (
                            <ChartViewer result={queryResult} recommendation={generatedSql?.visualization} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

