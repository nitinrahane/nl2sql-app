import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type TableInfo } from '../services/api';
import { ChevronRight, ChevronDown, Table, Key, Link2, Search, Loader2, X, Database } from 'lucide-react';
import { cn } from '../lib/utils';

interface SchemaExplorerProps {
    configId: number;
    onClose: () => void;
}

export function SchemaExplorer({ configId, onClose }: SchemaExplorerProps) {
    const [search, setSearch] = useState('');
    const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

    const { data: schema, isLoading, error } = useQuery({
        queryKey: ['schema', configId],
        queryFn: () => api.getSchema(configId),
        staleTime: 5 * 60 * 1000,
    });

    const toggleTable = (tableName: string) => {
        setExpandedTables(prev => {
            const next = new Set(prev);
            if (next.has(tableName)) {
                next.delete(tableName);
            } else {
                next.add(tableName);
            }
            return next;
        });
    };

    const filteredTables = schema?.tables.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.columns.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
    ) ?? [];

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-brand-600" />
                    <h3 className="font-semibold text-sm text-gray-900">Schema Explorer</h3>
                </div>
                <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="px-3 py-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search tables & columns..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-300 focus:border-brand-300"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                    </div>
                )}
                {error && (
                    <div className="p-4 text-xs text-red-600">
                        Failed to load schema. Make sure the database connection is active.
                    </div>
                )}
                {schema && (
                    <div className="py-1">
                        <div className="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                            {filteredTables.length} of {schema.totalTableCount} tables
                        </div>
                        {filteredTables.map(table => (
                            <TableNode
                                key={`${table.schema}.${table.name}`}
                                table={table}
                                isExpanded={expandedTables.has(`${table.schema}.${table.name}`)}
                                onToggle={() => toggleTable(`${table.schema}.${table.name}`)}
                                searchTerm={search}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TableNode({ table, isExpanded, onToggle, searchTerm }: {
    table: TableInfo;
    isExpanded: boolean;
    onToggle: () => void;
    searchTerm: string;
}) {
    return (
        <div>
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors group"
            >
                {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                ) : (
                    <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                )}
                <Table className="h-3 w-3 text-brand-500 shrink-0" />
                <span className="font-medium text-gray-700 truncate">
                    {table.schema !== 'dbo' && table.schema !== 'public' && (
                        <span className="text-gray-400">{table.schema}.</span>
                    )}
                    <HighlightText text={table.name} highlight={searchTerm} />
                </span>
                <span className="text-[10px] text-gray-400 ml-auto shrink-0">{table.columns.length} cols</span>
            </button>
            {isExpanded && (
                <div className="ml-5 border-l border-gray-100 animate-fade-in">
                    {table.columns.map(col => (
                        <div key={col.name} className="flex items-center gap-1.5 px-3 py-1 text-[11px] hover:bg-gray-50">
                            {col.isPrimaryKey ? (
                                <Key className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                            ) : (
                                <div className="w-2.5 h-2.5 shrink-0" />
                            )}
                            <span className={cn(
                                "truncate",
                                col.isPrimaryKey ? "font-semibold text-gray-800" : "text-gray-600"
                            )}>
                                <HighlightText text={col.name} highlight={searchTerm} />
                            </span>
                            <span className="text-gray-400 ml-auto text-[10px] shrink-0">
                                {col.dataType}
                                {col.maxLength && col.maxLength > 0 && `(${col.maxLength})`}
                            </span>
                            {!col.isNullable && (
                                <span className="text-[9px] text-gray-400 shrink-0">NN</span>
                            )}
                        </div>
                    ))}
                    {table.foreignKeys.length > 0 && (
                        <div className="mt-1 border-t border-gray-100 pt-1">
                            {table.foreignKeys.map((fk, i) => (
                                <div key={i} className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-gray-400">
                                    <Link2 className="h-2.5 w-2.5 text-blue-400 shrink-0" />
                                    <span className="truncate">{fk.column} → {fk.referencedTable}.{fk.referencedColumn}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
    if (!highlight.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <span className="bg-amber-200 text-amber-900 rounded-sm px-0.5">{text.slice(idx, idx + highlight.length)}</span>
            {text.slice(idx + highlight.length)}
        </>
    );
}
