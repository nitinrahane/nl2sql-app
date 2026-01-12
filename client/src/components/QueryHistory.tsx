import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type QueryHistory as QueryHistoryType } from '../services/api';
import { Clock, Trash2, Search, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface QueryHistoryProps {
    onSelectQuery: (query: QueryHistoryType) => void;
    isOpen: boolean;
    onClose: () => void;
}

const QueryHistory: React.FC<QueryHistoryProps> = ({ onSelectQuery, isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = React.useState('');

    const { data: history, isLoading } = useQuery({
        queryKey: ['queryHistory'],
        queryFn: () => api.getHistory(),
        enabled: isOpen,
    });

    const clearMutation = useMutation({
        mutationFn: api.clearHistory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['queryHistory'] });
        },
    });

    const filteredHistory = history?.filter(h =>
        h.naturalLanguageQuery.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.sqlQuery.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-xl font-semibold text-white">Query History</h2>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>

            <div className="p-4 border-b border-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-3">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-400 text-sm">Loading history...</p>
                    </div>
                ) : filteredHistory?.length === 0 ? (
                    <div className="text-center py-10">
                        <Clock className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500">No history found</p>
                    </div>
                ) : (
                    filteredHistory?.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onSelectQuery(item)}
                            className="w-full text-left p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {item.isSuccessful ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 text-rose-400" />
                                    )}
                                    <span className="text-xs text-slate-500">
                                        {new Date(item.executedAt).toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 uppercase tracking-wider">
                                    {item.chartType}
                                </span>
                            </div>
                            <p className="text-sm text-slate-200 font-medium line-clamp-2 mb-2 group-hover:text-indigo-300 transition-colors">
                                {item.naturalLanguageQuery}
                            </p>
                            <code className="text-[11px] text-slate-500 block truncate font-mono bg-slate-900/50 p-1.5 rounded">
                                {item.sqlQuery}
                            </code>
                        </button>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <button
                    onClick={() => clearMutation.mutate()}
                    disabled={!history?.length || clearMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <Trash2 className="w-4 h-4" />
                    Clear History
                </button>
            </div>
        </div>
    );
};

export default QueryHistory;
