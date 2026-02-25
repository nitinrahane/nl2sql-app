import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import type { QueryResult, VisualizationRecommendation } from '../services/api';

interface ChartViewerProps {
    result: QueryResult;
    recommendation?: VisualizationRecommendation;
}

const CHART_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export function ChartViewer({ result, recommendation }: ChartViewerProps) {
    const chartConfig = useMemo(() => {
        if (!result.data.length) return null;

        if (recommendation && recommendation.chartType && recommendation.chartType !== 'Table') {
            const yColumns = recommendation.yAxisColumns && recommendation.yAxisColumns.length > 0
                ? recommendation.yAxisColumns
                : [];

            const hasX = recommendation.xAxisColumn && result.columns.includes(recommendation.xAxisColumn);
            const hasY = yColumns.length > 0 && yColumns.every(col => result.columns.includes(col));

            if (hasX && hasY) {
                return {
                    xAxis: recommendation.xAxisColumn,
                    series: yColumns,
                    type: recommendation.chartType.toLowerCase() as 'bar' | 'line' | 'pie' | 'area',
                    title: recommendation.title
                };
            }
        }

        const firstRow = result.data[0];
        const stringCols = result.columns.filter(col =>
            typeof firstRow[col] === 'string' || firstRow[col] instanceof Date
        );
        const numCols = result.columns.filter(col =>
            typeof firstRow[col] === 'number'
        );

        if (stringCols.length > 0 && numCols.length > 0) {
            const uniqueValues = new Set(result.data.map(row => row[stringCols[0]])).size;
            let type: 'bar' | 'line' | 'pie' | 'area' = 'bar';

            if (uniqueValues <= 8 && numCols.length === 1 && result.data.length <= 10) {
                type = 'pie';
            } else if (result.data.length > 10 || numCols.length > 1) {
                type = 'line';
            }

            return {
                xAxis: stringCols[0],
                series: numCols.slice(0, 5),
                type,
            };
        }

        return null;
    }, [result, recommendation]);

    if (!chartConfig) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <BarChart className="h-8 w-8 mb-2 text-gray-300" />
                <p className="text-sm">Unable to auto-detect chart type for this data.</p>
                <p className="text-xs text-gray-400 mt-1">Try viewing as a table instead.</p>
            </div>
        );
    }

    const chartData = result.data.map(row => {
        const item: Record<string, unknown> = {};
        item[chartConfig.xAxis] = row[chartConfig.xAxis];
        chartConfig.series.forEach(s => {
            item[s] = typeof row[s] === 'number' ? row[s] : parseFloat(String(row[s])) || 0;
        });
        return item;
    });

    if (chartConfig.type === 'pie') {
        const pieData = chartData.map((item, i) => ({
            name: String(item[chartConfig.xAxis] ?? `Item ${i + 1}`),
            value: Number(item[chartConfig.series[0]] ?? 0),
        }));

        return (
            <div className="h-[350px] w-full">
                {chartConfig.title && (
                    <p className="text-sm font-medium text-gray-700 text-center mb-2">{chartConfig.title}</p>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            innerRadius={60}
                            paddingAngle={2}
                            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                            labelLine={true}
                        >
                            {pieData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => typeof value === 'number' ? value.toLocaleString() : String(value)}
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                fontSize: '12px',
                            }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: '12px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }

    const tooltipStyle = {
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontSize: '12px',
    };

    if (chartConfig.type === 'area') {
        return (
            <div className="h-[350px] w-full">
                {chartConfig.title && (
                    <p className="text-sm font-medium text-gray-700 text-center mb-2">{chartConfig.title}</p>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey={chartConfig.xAxis} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {chartConfig.series.map((key, i) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                fillOpacity={0.15}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (chartConfig.type === 'line') {
        return (
            <div className="h-[350px] w-full">
                {chartConfig.title && (
                    <p className="text-sm font-medium text-gray-700 text-center mb-2">{chartConfig.title}</p>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey={chartConfig.xAxis} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {chartConfig.series.map((key, i) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                                activeDot={{ r: 5 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="h-[350px] w-full">
            {chartConfig.title && (
                <p className="text-sm font-medium text-gray-700 text-center mb-2">{chartConfig.title}</p>
            )}
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey={chartConfig.xAxis} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {chartConfig.series.map((key, i) => (
                        <Bar
                            key={key}
                            dataKey={key}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={60}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
