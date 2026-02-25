import { useState, useMemo } from 'react';
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { QueryResult } from '../services/api';

interface ResultsTableProps {
    result: QueryResult;
}

type SortDirection = 'asc' | 'desc' | null;

export function ResultsTable({ result }: ResultsTableProps) {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [page, setPage] = useState(0);
    const pageSize = 100;

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            if (sortDirection === 'asc') setSortDirection('desc');
            else if (sortDirection === 'desc') { setSortColumn(null); setSortDirection(null); }
            else setSortDirection('asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setPage(0);
    };

    const sortedData = useMemo(() => {
        if (!sortColumn || !sortDirection) return result.data;
        return [...result.data].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
            if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }
            const strA = String(aVal);
            const strB = String(bVal);
            return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });
    }, [result.data, sortColumn, sortDirection]);

    const totalPages = Math.ceil(sortedData.length / pageSize);
    const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

    if (!result.data || result.data.length === 0) {
        return <div className="text-center py-12 text-sm text-gray-400">No results returned</div>;
    }

    const exportCsv = () => {
        const headers = result.columns.join(',');
        const rows = result.data.map(row =>
            result.columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return '';
                const s = String(val);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            }).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `query_results_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportJson = () => {
        const json = JSON.stringify(result.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `query_results_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const formatCellValue = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') return val.toLocaleString();
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        return String(val);
    };

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="w-10 px-3 py-2 text-left text-gray-400 font-medium border-b border-gray-200">#</th>
                            {result.columns.map(col => (
                                <th
                                    key={col}
                                    className="px-3 py-2 text-left font-medium border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                                    onClick={() => handleSort(col)}
                                >
                                    <div className="flex items-center gap-1 text-gray-600">
                                        <span>{col}</span>
                                        {sortColumn === col ? (
                                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 text-brand-600" /> : <ArrowDown className="h-3 w-3 text-brand-600" />
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-gray-300" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pagedData.map((row, i) => (
                            <tr key={page * pageSize + i} className="hover:bg-brand-50/30 transition-colors">
                                <td className="px-3 py-1.5 text-gray-400 font-mono">{page * pageSize + i + 1}</td>
                                {result.columns.map(col => {
                                    const val = row[col];
                                    const isNull = val === null || val === undefined;
                                    return (
                                        <td key={col} className="px-3 py-1.5 whitespace-nowrap max-w-[300px] truncate">
                                            {isNull ? (
                                                <span className="text-gray-300 italic">null</span>
                                            ) : (
                                                <span className="text-gray-700">{formatCellValue(val)}</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportCsv}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                    >
                        <Download className="h-3 w-3" />
                        CSV
                    </button>
                    <button
                        onClick={exportJson}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                    >
                        <Download className="h-3 w-3" />
                        JSON
                    </button>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-2 py-0.5 rounded hover:bg-gray-200 disabled:opacity-30"
                        >
                            ← Prev
                        </button>
                        <span>Page {page + 1} of {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-2 py-0.5 rounded hover:bg-gray-200 disabled:opacity-30"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
