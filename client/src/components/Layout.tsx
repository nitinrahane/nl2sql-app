import { Link, Outlet, useLocation } from 'react-router-dom';
import { Database, MessageSquare, Settings, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
    const location = useLocation();

    const navItems = [
        { href: '/', label: 'Query', icon: MessageSquare, description: 'Ask questions in plain English' },
        { href: '/settings', label: 'Connections', icon: Settings, description: 'Manage database connections' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 font-sans antialiased flex">
            <aside className="w-[260px] bg-white border-r border-gray-200 hidden md:flex flex-col">
                <div className="h-16 flex items-center px-5 border-b border-gray-200">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                            <Layers className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <span className="font-bold text-base text-gray-900 tracking-tight">DataLens</span>
                            <span className="text-brand-600 font-semibold text-xs ml-1">AI</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150",
                                    isActive
                                        ? "bg-brand-50 text-brand-700 shadow-sm"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-brand-600" : "text-gray-400")} />
                                <div>
                                    <div>{item.label}</div>
                                    {!isActive && (
                                        <div className="text-[11px] text-gray-400 font-normal">{item.description}</div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                        <Database className="h-3.5 w-3.5" />
                        <span>NL2SQL Engine v2.0</span>
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                <main className="flex-1 overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
