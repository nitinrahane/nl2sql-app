import { Link, Outlet, useLocation } from 'react-router-dom';
import { Database, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
    const location = useLocation();

    const navItems = [
        { href: '/', label: 'Query', icon: LayoutDashboard },
        { href: '/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-background font-sans antialiased flex">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-muted/10 hidden md:block">
                <div className="h-16 flex items-center px-6 border-b">
                    <Database className="h-6 w-6 mr-2 text-primary" />
                    <span className="font-bold text-lg">NL2SQL</span>
                </div>
                <nav className="p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4 mr-3" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="h-16 border-b flex items-center px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <h1 className="text-lg font-semibold">
                        {navItems.find(i => i.href === location.pathname)?.label || 'Dashboard'}
                    </h1>
                </header>
                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
