import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import type { QueryResult, VisualizationRecommendation } from '../services/api';

interface ChartViewerProps {
    result: QueryResult;
    recommendation?: VisualizationRecommendation;
}

export function ChartViewer({ result, recommendation }: ChartViewerProps) {
    const chartConfig = useMemo(() => {
        if (!result.data.length) return null;

        // Use AI recommendation if available and valid
        if (recommendation && recommendation.chartType !== 'Table') {
            const yColumns = Array.isArray(recommendation.yAxisColumn)
                ? recommendation.yAxisColumn
                : [recommendation.yAxisColumn];

            // Validate columns exist
            const hasX = result.columns.includes(recommendation.xAxisColumn);
            const hasY = yColumns.every(col => result.columns.includes(col));

            if (hasX && hasY) {
                return {
                    xAxis: recommendation.xAxisColumn,
                    series: yColumns,
                    type: recommendation.chartType.toLowerCase() === 'bar' ? 'bar' : 'line',
                    title: recommendation.title
                };
            }
        }

        // Fallback to heuristic detection
        // 1. Find a string column for X-axis (category)
        // 2. Find numeric columns for Y-axis (values)

        const stringCols = result.columns.filter(col =>
            typeof result.data[0][col] === 'string' || result.data[0][col] instanceof Date
        );

        const numCols = result.columns.filter(col =>
            typeof result.data[0][col] === 'number'
        );

        if (stringCols.length > 0 && numCols.length > 0) {
            return {
                xAxis: stringCols[0],
                series: numCols,
                type: numCols.length > 1 ? 'line' : 'bar'
            };
        }

        return null;
    }, [result]);

    if (!chartConfig) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                Cannot auto-detect chart visualization for this data
            </div>
        );
    }

    return (
        <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                {chartConfig.type === 'bar' ? (
                    <BarChart data={result.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey={chartConfig.xAxis} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        {chartConfig.series.map((key) => (
                            <Bar key={key} dataKey={key} fill={`hsl(var(--primary))`} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                ) : (
                    <LineChart data={result.data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey={chartConfig.xAxis} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        {chartConfig.series.map((key) => (
                            <Line key={key} type="monotone" dataKey={key} stroke={`hsl(var(--primary))`} strokeWidth={2} />
                        ))}
                    </LineChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}
