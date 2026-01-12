import { Download } from 'lucide-react';
import { Button } from './ui/button';
import type { QueryResult } from '../services/api';

interface ResultsTableProps {
    result: QueryResult;
}

export function ResultsTable({ result }: ResultsTableProps) {
    if (!result.data || result.data.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">No results found</div>;
    }

    const exportToCsv = () => {
        const headers = result.columns.join(',');
        const rows = result.data.map(row =>
            result.columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return '';
                const s = val.toString();
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            }).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `query_results_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={exportToCsv} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>
            <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium">
                        <tr>
                            {result.columns.map((col) => (
                                <th key={col} className="h-10 px-4 align-middle border-b">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {result.data.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/50 border-b last:border-0">
                                {result.columns.map((col) => (
                                    <td key={`${i}-${col}`} className="p-4 align-middle">
                                        {row[col]?.toString() ?? <span className="text-muted-foreground italic">null</span>}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

