import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, type AiQueryResponse, type QueryResult } from '../services/api';
import { ResultsTable } from '../components/ResultsTable';
import { ChartViewer } from '../components/ChartViewer';
import { SchemaExplorer } from '../components/SchemaExplorer';
import { Send, Loader2, Sparkles, Table as TableIcon, BarChart3, Code2, Play, Copy, Check, AlertCircle, Database, ChevronDown, Lightbulb, PanelRightOpen, PanelRightClose, Clock, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant';
    query?: string;
    response?: AiQueryResponse;
    result?: QueryResult;
    error?: string;
    isLoading?: boolean;
    timestamp: Date;
}

export function HomePage() {
    const [query, setQuery] = useState('');
    const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isSchemaOpen, setIsSchemaOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: configs } = useQuery({
        queryKey: ['configs'],
        queryFn: api.getConfigs,
    });

    const selectedConfig = configs?.find(c => c.id === selectedConfigId);

    const { data: suggestions } = useQuery({
        queryKey: ['suggestions', selectedConfigId],
        queryFn: () => selectedConfigId ? api.getSuggestions(selectedConfigId) : Promise.resolve([]),
        enabled: !!selectedConfigId && messages.length === 0,
        staleTime: 5 * 60 * 1000,
    });

    const { data: history } = useQuery({
        queryKey: ['queryHistory'],
        queryFn: () => api.getHistory(20),
    });

    useEffect(() => {
        if (configs?.length && !selectedConfigId) {
            setSelectedConfigId(configs[0].id);
        }
    }, [configs, selectedConfigId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDbDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const generateMutation = useMutation({
        mutationFn: api.generateSql,
        onSuccess: (data) => {
            setMessages(prev => prev.map(m =>
                m.isLoading ? { ...m, response: data, isLoading: false } : m
            ));
            if (data.sqlQuery && !data.sqlQuery.startsWith('ERROR') && selectedConfigId) {
                executeQuery(data.sqlQuery, selectedConfigId);
            }
        },
        onError: (error: Error) => {
            setMessages(prev => prev.map(m =>
                m.isLoading ? { ...m, error: error.message, isLoading: false } : m
            ));
        }
    });

    const executeMutation = useMutation({
        mutationFn: api.executeQuery,
    });

    const executeQuery = useCallback((sql: string, configId: number) => {
        executeMutation.mutate(
            { sqlQuery: sql, databaseConfigId: configId },
            {
                onSuccess: (data) => {
                    setMessages(prev => prev.map(m =>
                        m.response?.sqlQuery === sql && !m.result ? { ...m, result: data } : m
                    ));
                },
                onError: (error: Error) => {
                    setMessages(prev => prev.map(m =>
                        m.response?.sqlQuery === sql && !m.result
                            ? { ...m, error: `Execution error: ${error.message}` }
                            : m
                    ));
                }
            }
        );
    }, [executeMutation]);

    const handleSubmit = (text?: string) => {
        const queryText = text || query;
        if (!queryText.trim() || !selectedConfigId) return;

        const msgId = Date.now().toString();
        const userMsg: ChatMessage = {
            id: msgId + '-user',
            type: 'user',
            query: queryText,
            timestamp: new Date(),
        };
        const assistantMsg: ChatMessage = {
            id: msgId + '-assistant',
            type: 'assistant',
            isLoading: true,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setQuery('');

        generateMutation.mutate({
            naturalLanguageQuery: queryText,
            databaseConfigId: selectedConfigId,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleReExecute = (msg: ChatMessage) => {
        if (msg.response?.sqlQuery && selectedConfigId) {
            setMessages(prev => prev.map(m =>
                m.id === msg.id ? { ...m, result: undefined, error: undefined } : m
            ));
            executeQuery(msg.response.sqlQuery, selectedConfigId);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <div className="h-full flex">
            <div className="flex-1 flex flex-col h-screen">
                {/* Top Bar */}
                <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDbDropdownOpen(!isDbDropdownOpen)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-all",
                                    selectedConfig
                                        ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                                        : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                                )}
                            >
                                <Database className="h-3.5 w-3.5" />
                                <span className="font-medium max-w-[160px] truncate">
                                    {selectedConfig?.name || 'Select database'}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            {isDbDropdownOpen && configs && (
                                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 animate-fade-in">
                                    {configs.length === 0 ? (
                                        <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                            No databases configured.
                                            <a href="/settings" className="text-brand-600 hover:underline block mt-1">Add one →</a>
                                        </div>
                                    ) : configs.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedConfigId(c.id);
                                                setIsDbDropdownOpen(false);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors",
                                                c.id === selectedConfigId && "bg-brand-50 text-brand-700"
                                            )}
                                        >
                                            <Database className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                            <div className="min-w-0">
                                                <div className="font-medium truncate">{c.name}</div>
                                                <div className="text-[11px] text-gray-400">
                                                    {c.type === 0 ? 'SQL Server' : c.type === 1 ? 'PostgreSQL' : 'MySQL'}
                                                </div>
                                            </div>
                                            {c.id === selectedConfigId && (
                                                <Check className="h-3.5 w-3.5 text-brand-600 ml-auto shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsSchemaOpen(!isSchemaOpen)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-all",
                                isSchemaOpen
                                    ? "border-brand-200 bg-brand-50 text-brand-700"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            {isSchemaOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                            Schema
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    {messages.length === 0 ? (
                        <EmptyState
                            suggestions={suggestions}
                            history={history}
                            onSelectSuggestion={(s) => handleSubmit(s)}
                            hasDatabase={!!selectedConfigId}
                        />
                    ) : (
                        <div className="max-w-4xl mx-auto py-6 px-4 space-y-1">
                            {messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    copiedId={copiedId}
                                    onCopy={handleCopy}
                                    onReExecute={handleReExecute}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-200 bg-white p-4 shrink-0">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative flex items-end bg-gray-50 border border-gray-200 rounded-xl focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
                            <textarea
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={selectedConfigId ? "Ask a question about your data..." : "Select a database first..."}
                                disabled={!selectedConfigId}
                                rows={1}
                                className="flex-1 bg-transparent px-4 py-3 text-sm resize-none focus:outline-none placeholder:text-gray-400 disabled:opacity-50 max-h-32"
                                style={{ minHeight: '44px' }}
                            />
                            <button
                                onClick={() => handleSubmit()}
                                disabled={!query.trim() || !selectedConfigId || generateMutation.isPending}
                                className={cn(
                                    "m-1.5 p-2 rounded-lg transition-all",
                                    query.trim() && selectedConfigId
                                        ? "bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                )}
                            >
                                {generateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                            AI generates SQL from your question. Always verify results. Press Enter to send.
                        </p>
                    </div>
                </div>
            </div>

            {/* Schema Sidebar */}
            {isSchemaOpen && selectedConfigId && (
                <div className="w-80 border-l border-gray-200 bg-white shrink-0 animate-slide-in-right overflow-hidden">
                    <SchemaExplorer configId={selectedConfigId} onClose={() => setIsSchemaOpen(false)} />
                </div>
            )}
        </div>
    );
}

function EmptyState({ suggestions, history, onSelectSuggestion, hasDatabase }: {
    suggestions?: string[];
    history?: { naturalLanguageQuery: string; executedAt: string }[];
    onSelectSuggestion: (s: string) => void;
    hasDatabase: boolean;
}) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="max-w-lg text-center px-4">
                <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Sparkles className="h-7 w-7 text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Ask anything about your data</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Type a question in plain English and I'll generate the SQL, run it, and visualize the results for you.
                </p>

                {!hasDatabase && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-700">
                        <Database className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                        No database selected. <a href="/settings" className="underline font-medium">Add a connection</a> to get started.
                    </div>
                )}

                {hasDatabase && suggestions && suggestions.length > 0 && (
                    <div className="text-left">
                        <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                            Suggested Questions
                        </div>
                        <div className="space-y-2">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSelectSuggestion(s)}
                                    className="w-full text-left p-3 text-sm bg-white border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-all group"
                                >
                                    <span className="text-gray-700 group-hover:text-brand-700">{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {hasDatabase && (!suggestions || suggestions.length === 0) && history && history.length > 0 && (
                    <div className="text-left">
                        <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <Clock className="h-3.5 w-3.5" />
                            Recent Queries
                        </div>
                        <div className="space-y-2">
                            {history.slice(0, 5).map((h, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSelectSuggestion(h.naturalLanguageQuery)}
                                    className="w-full text-left p-3 text-sm bg-white border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-all"
                                >
                                    <span className="text-gray-700">{h.naturalLanguageQuery}</span>
                                    <span className="block text-[11px] text-gray-400 mt-1">
                                        {new Date(h.executedAt).toLocaleDateString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageBubble({ message, copiedId, onCopy, onReExecute }: {
    message: ChatMessage;
    copiedId: string | null;
    onCopy: (text: string, id: string) => void;
    onReExecute: (msg: ChatMessage) => void;
}) {
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

    if (message.type === 'user') {
        return (
            <div className="flex justify-end mb-4 animate-fade-in">
                <div className="bg-brand-600 text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[80%] text-sm">
                    {message.query}
                </div>
            </div>
        );
    }

    if (message.isLoading) {
        return (
            <div className="mb-4 animate-fade-in">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md p-4 max-w-[90%] shadow-sm">
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0s' }} />
                            <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.3s' }} />
                            <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.6s' }} />
                        </div>
                        <span>Analyzing your question and generating SQL...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (message.error && !message.response) {
        return (
            <div className="mb-4 animate-fade-in">
                <div className="bg-red-50 border border-red-200 rounded-2xl rounded-bl-md p-4 max-w-[90%]">
                    <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Something went wrong</p>
                            <p className="text-red-600 mt-1">{message.error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-6 animate-slide-up">
            <div className="max-w-[95%] space-y-3">
                {/* Explanation */}
                {message.response?.explanation && (
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md p-4 shadow-sm">
                        <p className="text-sm text-gray-700 leading-relaxed">{message.response.explanation}</p>
                    </div>
                )}

                {/* SQL Block */}
                {message.response?.sqlQuery && !message.response.sqlQuery.startsWith('ERROR') && (
                    <div className="bg-gray-900 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Code2 className="h-3.5 w-3.5" />
                                <span>Generated SQL</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onCopy(message.response!.sqlQuery, message.id)}
                                    className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
                                    title="Copy SQL"
                                >
                                    {copiedId === message.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                                {!message.result && (
                                    <button
                                        onClick={() => onReExecute(message)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
                                    >
                                        <Play className="h-3 w-3" />
                                        Run
                                    </button>
                                )}
                            </div>
                        </div>
                        <pre className="p-4 text-sm text-gray-100 font-mono overflow-x-auto scrollbar-thin whitespace-pre-wrap">
                            {message.response.sqlQuery}
                        </pre>
                    </div>
                )}

                {message.response?.sqlQuery?.startsWith('ERROR') && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-start gap-2 text-sm text-red-700">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium">Query Generation Failed</p>
                                <p className="text-red-600 mt-1">{message.response.sqlQuery}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Execution Error */}
                {message.error && message.response && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-2 text-sm text-amber-700">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium">Query could not be executed</p>
                                <p className="text-amber-600 mt-1 text-xs">{message.error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {message.result && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                            <div className="text-xs text-gray-500">
                                <span className="font-semibold text-gray-700">{message.result.rowCount.toLocaleString()}</span> rows
                                {message.result.isTruncated && (
                                    <span className="text-amber-600 ml-1">(showing {message.result.rowCount.toLocaleString()} of {message.result.totalRowCount.toLocaleString()})</span>
                                )}
                                <span className="mx-1.5">·</span>
                                <span>{message.result.executionTimeMs}ms</span>
                            </div>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={cn(
                                        "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                        viewMode === 'table' ? "bg-white shadow-sm text-gray-700" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    <TableIcon className="h-3 w-3" />
                                    Table
                                </button>
                                <button
                                    onClick={() => setViewMode('chart')}
                                    className={cn(
                                        "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                        viewMode === 'chart' ? "bg-white shadow-sm text-gray-700" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    <BarChart3 className="h-3 w-3" />
                                    Chart
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[500px] overflow-auto scrollbar-thin">
                            {viewMode === 'table' ? (
                                <ResultsTable result={message.result} />
                            ) : (
                                <div className="p-4">
                                    <ChartViewer result={message.result} recommendation={message.response?.visualization} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
