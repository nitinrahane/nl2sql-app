import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, type AgentResponse, type AgentStep as AgentStepType } from '../services/api';
import { ResultsTable } from '../components/ResultsTable';
import { ChartViewer } from '../components/ChartViewer';
import { SchemaExplorer } from '../components/SchemaExplorer';
import {
    Send, Loader2, Sparkles, Table as TableIcon, BarChart3, Code2,
    Copy, Check, AlertCircle, Database, ChevronDown, Lightbulb,
    PanelRightOpen, PanelRightClose, Clock, Trash2, CheckCircle2,
    XCircle, Shield, ChevronRight, Zap, Brain, Search
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant';
    query?: string;
    agentResponse?: AgentResponse;
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

    const askMutation = useMutation({
        mutationFn: ({ question, dbId }: { question: string; dbId: number }) =>
            api.askAgent(question, dbId),
        onSuccess: (data) => {
            setMessages(prev => prev.map(m =>
                m.isLoading ? { ...m, agentResponse: data, isLoading: false } : m
            ));
        },
        onError: (error: Error) => {
            setMessages(prev => prev.map(m =>
                m.isLoading ? { ...m, error: error.message, isLoading: false } : m
            ));
        }
    });

    const handleSubmit = (text?: string) => {
        const queryText = text || query;
        if (!queryText.trim() || !selectedConfigId) return;

        const msgId = Date.now().toString();
        setMessages(prev => [
            ...prev,
            { id: msgId + '-user', type: 'user', query: queryText, timestamp: new Date() },
            { id: msgId + '-assistant', type: 'assistant', isLoading: true, timestamp: new Date() },
        ]);
        setQuery('');

        askMutation.mutate({ question: queryText, dbId: selectedConfigId });
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
                                            onClick={() => { setSelectedConfigId(c.id); setIsDbDropdownOpen(false); }}
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
                                            {c.id === selectedConfigId && <Check className="h-3.5 w-3.5 text-brand-600 ml-auto shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {messages.length > 0 && (
                            <button
                                onClick={() => setMessages([])}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <Trash2 className="h-3 w-3" /> Clear
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 rounded-md text-[10px] font-semibold uppercase tracking-wider">
                            <Zap className="h-3 w-3" /> Agentic Mode
                        </div>
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

                {/* Messages */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    {messages.length === 0 ? (
                        <EmptyState suggestions={suggestions} history={history} onSelect={handleSubmit} hasDb={!!selectedConfigId} />
                    ) : (
                        <div className="max-w-4xl mx-auto py-6 px-4 space-y-1">
                            {messages.map(msg => (
                                <AgentMessage key={msg.id} message={msg} copiedId={copiedId} onCopy={handleCopy} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
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
                                disabled={!query.trim() || !selectedConfigId || askMutation.isPending}
                                className={cn(
                                    "m-1.5 p-2 rounded-lg transition-all",
                                    query.trim() && selectedConfigId
                                        ? "bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                )}
                            >
                                {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                            Agent autonomously discovers schema, generates SQL, executes, retries on failure, and delivers insights.
                        </p>
                    </div>
                </div>
            </div>

            {isSchemaOpen && selectedConfigId && (
                <div className="w-80 border-l border-gray-200 bg-white shrink-0 animate-slide-in-right overflow-hidden">
                    <SchemaExplorer configId={selectedConfigId} onClose={() => setIsSchemaOpen(false)} />
                </div>
            )}
        </div>
    );
}

/* ---------- Empty State ---------- */
function EmptyState({ suggestions, history, onSelect, hasDb }: {
    suggestions?: string[];
    history?: { naturalLanguageQuery: string; executedAt: string }[];
    onSelect: (s: string) => void;
    hasDb: boolean;
}) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="max-w-lg text-center px-4">
                <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Brain className="h-7 w-7 text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Agentic Data Explorer</h2>
                <p className="text-sm text-gray-500 mb-2">
                    Ask a question in plain English. The AI agent will autonomously:
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-8">
                    <span className="flex items-center gap-1"><Search className="h-3 w-3 text-brand-500" /> Discover schema</span>
                    <span>→</span>
                    <span className="flex items-center gap-1"><Code2 className="h-3 w-3 text-brand-500" /> Generate SQL</span>
                    <span>→</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-brand-500" /> Execute & retry</span>
                    <span>→</span>
                    <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3 text-brand-500" /> Deliver insights</span>
                </div>

                {!hasDb && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-700">
                        <Database className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                        No database selected. <a href="/settings" className="underline font-medium">Add a connection</a> to get started.
                    </div>
                )}

                {hasDb && suggestions && suggestions.length > 0 && (
                    <div className="text-left">
                        <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Suggested Questions
                        </div>
                        <div className="space-y-2">
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => onSelect(s)}
                                    className="w-full text-left p-3 text-sm bg-white border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-all group">
                                    <span className="text-gray-700 group-hover:text-brand-700">{s}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {hasDb && (!suggestions || suggestions.length === 0) && history && history.length > 0 && (
                    <div className="text-left">
                        <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <Clock className="h-3.5 w-3.5" /> Recent Queries
                        </div>
                        <div className="space-y-2">
                            {history.slice(0, 5).map((h, i) => (
                                <button key={i} onClick={() => onSelect(h.naturalLanguageQuery)}
                                    className="w-full text-left p-3 text-sm bg-white border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-all">
                                    <span className="text-gray-700">{h.naturalLanguageQuery}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------- Agent Message Bubble ---------- */
function AgentMessage({ message, copiedId, onCopy }: {
    message: ChatMessage;
    copiedId: string | null;
    onCopy: (text: string, id: string) => void;
}) {
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [showSteps, setShowSteps] = useState(false);
    const [showMeta, setShowMeta] = useState(false);

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
                        <span>Agent is working: discovering schema → generating SQL → executing → analyzing...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (message.error && !message.agentResponse) {
        return (
            <div className="mb-4 animate-fade-in">
                <div className="bg-red-50 border border-red-200 rounded-2xl rounded-bl-md p-4 max-w-[90%]">
                    <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Agent encountered an error</p>
                            <p className="text-red-600 mt-1">{message.error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const resp = message.agentResponse;
    if (!resp) return null;

    return (
        <div className="mb-6 animate-slide-up">
            <div className="max-w-[95%] space-y-3">

                {/* Agent Steps (collapsible) */}
                {resp.steps.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                        <button onClick={() => setShowSteps(!showSteps)}
                            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                            <span className="flex items-center gap-1.5">
                                <Brain className="h-3.5 w-3.5 text-brand-500" />
                                Agent Steps ({resp.steps.length}) · {resp.metadata.toolCallCount} tool calls · {(resp.metadata.totalDurationMs / 1000).toFixed(1)}s
                            </span>
                            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showSteps && "rotate-90")} />
                        </button>
                        {showSteps && (
                            <div className="px-4 pb-3 space-y-1.5 border-t border-gray-200 pt-2 animate-fade-in">
                                {resp.steps.map((step, i) => (
                                    <StepLine key={i} step={step} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Explanation */}
                {resp.explanation && !resp.explanation.startsWith('{') && (
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md p-4 shadow-sm">
                        <p className="text-sm text-gray-700 leading-relaxed">{resp.explanation}</p>
                    </div>
                )}

                {/* Insights */}
                {resp.insights.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
                            <Lightbulb className="h-3.5 w-3.5" /> Key Insights
                        </div>
                        {resp.insights.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-amber-900">
                                <span className="text-amber-500 mt-0.5 shrink-0 text-xs">●</span>
                                <span>{insight}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* SQL Block */}
                {resp.sqlQuery && !resp.sqlQuery.startsWith('ERROR') && (
                    <div className="bg-gray-900 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Code2 className="h-3.5 w-3.5" />
                                <span>Generated SQL</span>
                                {resp.metadata.sqlAttempts > 1 && (
                                    <span className="text-amber-400">({resp.metadata.sqlAttempts} attempts — self-healed)</span>
                                )}
                            </div>
                            <button onClick={() => onCopy(resp.sqlQuery!, message.id)}
                                className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors">
                                {copiedId === message.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                        <pre className="p-4 text-sm text-gray-100 font-mono overflow-x-auto scrollbar-thin whitespace-pre-wrap">
                            {resp.sqlQuery}
                        </pre>
                    </div>
                )}

                {/* Error */}
                {resp.error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-start gap-2 text-sm text-red-700">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium">Agent could not complete the request</p>
                                <p className="text-red-600 mt-1 text-xs">{resp.error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {resp.results && resp.results.rowCount > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                            <div className="text-xs text-gray-500">
                                <span className="font-semibold text-gray-700">{resp.results.rowCount.toLocaleString()}</span> rows
                                {resp.results.isTruncated && (
                                    <span className="text-amber-600 ml-1">(truncated from {resp.results.totalRowCount.toLocaleString()})</span>
                                )}
                                <span className="mx-1.5">·</span>
                                <span>{resp.results.executionTimeMs}ms</span>
                            </div>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button onClick={() => setViewMode('table')}
                                    className={cn("flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                        viewMode === 'table' ? "bg-white shadow-sm text-gray-700" : "text-gray-500 hover:text-gray-700")}>
                                    <TableIcon className="h-3 w-3" /> Table
                                </button>
                                <button onClick={() => setViewMode('chart')}
                                    className={cn("flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                        viewMode === 'chart' ? "bg-white shadow-sm text-gray-700" : "text-gray-500 hover:text-gray-700")}>
                                    <BarChart3 className="h-3 w-3" /> Chart
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[500px] overflow-auto scrollbar-thin">
                            {viewMode === 'table' ? (
                                <ResultsTable result={resp.results} />
                            ) : (
                                <div className="p-4">
                                    <ChartViewer result={resp.results} recommendation={resp.visualization} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Metadata footer (safety checks, assumptions, limitations) */}
                {(resp.safetyChecks.length > 0 || resp.assumptions.length > 0 || resp.limitations.length > 0) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                        <button onClick={() => setShowMeta(!showMeta)}
                            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                            <span className="flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5 text-green-500" />
                                Safety & Governance
                                {resp.safetyChecks.length > 0 && (
                                    <span className="text-green-600">{resp.safetyChecks.length} check(s) passed</span>
                                )}
                            </span>
                            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showMeta && "rotate-90")} />
                        </button>
                        {showMeta && (
                            <div className="px-4 pb-3 border-t border-gray-200 pt-2 space-y-3 animate-fade-in">
                                {resp.safetyChecks.length > 0 && (
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Safety Checks</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {resp.safetyChecks.map((c, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                                                    <CheckCircle2 className="h-2.5 w-2.5" /> {c.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {resp.assumptions.length > 0 && (
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Assumptions</div>
                                        {resp.assumptions.map((a, i) => (
                                            <p key={i} className="text-[11px] text-gray-600 ml-2">• {a}</p>
                                        ))}
                                    </div>
                                )}
                                {resp.limitations.length > 0 && (
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Limitations</div>
                                        {resp.limitations.map((l, i) => (
                                            <p key={i} className="text-[11px] text-gray-600 ml-2">• {l}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------- Step Line ---------- */
function StepLine({ step }: { step: AgentStepType }) {
    const iconMap: Record<string, typeof CheckCircle2> = {
        schema_discovery: Search,
        sql_execution: Zap,
        sql_validation: Shield,
        presentation: Sparkles,
    };
    const Icon = iconMap[step.type] || Zap;

    return (
        <div className="flex items-center gap-2 text-[11px]">
            {step.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
                <XCircle className="h-3 w-3 text-red-400 shrink-0" />
            )}
            <Icon className="h-3 w-3 text-gray-400 shrink-0" />
            <span className={cn("truncate", step.success ? "text-gray-600" : "text-red-600")}>
                {step.description}
            </span>
            {step.durationMs != null && (
                <span className="text-gray-400 ml-auto shrink-0">{step.durationMs}ms</span>
            )}
        </div>
    );
}
