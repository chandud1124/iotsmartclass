import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    FileText,
    Download,
    Search,
    Filter,
    Calendar,
    User,
    Shield,
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    RefreshCw,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface AuditLog {
    id: string;
    timestamp: Date;
    type: 'success' | 'error' | 'info' | 'security' | 'admin';
    message: string;
    user: string;
    userRole: string;
    deviceId?: string;
    deviceName?: string;
    action?: string;
    ip?: string;
    details?: any;
}

const ActiveLogs: React.FC = () => {
    const { user } = useAuth();
    const { isAdmin } = usePermissions();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [userFilter, setUserFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [showDetails, setShowDetails] = useState<{ [key: string]: boolean }>({});
    const [isLoading, setIsLoading] = useState(false);

    // Load logs from backend API
    useEffect(() => {
        if (!isAdmin) return;

        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                // TODO: Replace with actual API call to fetch audit logs
                // const response = await api.get('/api/audit-logs');
                // setLogs(response.data);
                // setFilteredLogs(response.data);

                // For now, show empty state
                setLogs([]);
                setFilteredLogs([]);
            } catch (error) {
                console.error('Failed to fetch audit logs:', error);
                setLogs([]);
                setFilteredLogs([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, [isAdmin]);
    // Real-time log updates (when backend supports WebSocket)
    useEffect(() => {
        if (!isAdmin) return;

        // TODO: Implement WebSocket connection for real-time log updates
        // const socket = io();
        // socket.on('new-audit-log', (newLog) => {
        //     setLogs(prev => [newLog, ...prev.slice(0, 49)]);
        // });

        // return () => socket.disconnect();
    }, [isAdmin]);

    // Filter logs based on search and filters
    useEffect(() => {
        let filtered = logs;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(log =>
                log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.action?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Type filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter(log => log.type === typeFilter);
        }

        // User filter
        if (userFilter !== 'all') {
            filtered = filtered.filter(log => log.user === userFilter);
        }

        // Date filter
        if (dateFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();

            switch (dateFilter) {
                case 'today':
                    filterDate.setHours(0, 0, 0, 0);
                    filtered = filtered.filter(log => log.timestamp >= filterDate);
                    break;
                case 'yesterday':
                    filterDate.setDate(filterDate.getDate() - 1);
                    filterDate.setHours(0, 0, 0, 0);
                    const yesterdayEnd = new Date(filterDate);
                    yesterdayEnd.setHours(23, 59, 59, 999);
                    filtered = filtered.filter(log => log.timestamp >= filterDate && log.timestamp <= yesterdayEnd);
                    break;
                case 'week':
                    filterDate.setDate(filterDate.getDate() - 7);
                    filtered = filtered.filter(log => log.timestamp >= filterDate);
                    break;
                case 'month':
                    filterDate.setMonth(filterDate.getMonth() - 1);
                    filtered = filtered.filter(log => log.timestamp >= filterDate);
                    break;
            }
        }

        setFilteredLogs(filtered);
    }, [logs, searchTerm, typeFilter, userFilter, dateFilter]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'security': return <Shield className="w-4 h-4 text-red-600" />;
            case 'admin': return <User className="w-4 h-4 text-blue-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
            default: return <Activity className="w-4 h-4 text-gray-500" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-50 border-green-200 text-green-800';
            case 'error': return 'bg-red-50 border-red-200 text-red-800';
            case 'security': return 'bg-red-50 border-red-300 text-red-900';
            case 'admin': return 'bg-blue-50 border-blue-200 text-blue-800';
            case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
            default: return 'bg-gray-50 border-gray-200 text-gray-800';
        }
    };

    const formatTimestamp = (timestamp: Date) => {
        const now = new Date();
        const diff = now.getTime() - timestamp.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minutes ago`;
        if (hours < 24) return `${hours} hours ago`;
        if (days < 7) return `${days} days ago`;

        return timestamp.toLocaleDateString();
    };

    const exportLogs = () => {
        const exportData = {
            exportTime: new Date().toISOString(),
            exportedBy: user?.name,
            totalLogs: filteredLogs.length,
            filters: {
                searchTerm,
                typeFilter,
                userFilter,
                dateFilter
            },
            logs: filteredLogs.map(log => ({
                ...log,
                timestamp: log.timestamp.toISOString()
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const toggleDetails = (logId: string) => {
        setShowDetails(prev => ({
            ...prev,
            [logId]: !prev[logId]
        }));
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-600">You don't have permission to view audit logs.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        size="sm"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button
                        onClick={exportLogs}
                        variant="default"
                        size="sm"
                        disabled={filteredLogs.length === 0}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export Logs
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{logs.length}</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            All time records
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Security Events</CardTitle>
                        <Shield className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {logs.filter(log => log.type === 'security').length}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Critical events
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Admin Actions</CardTitle>
                        <User className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {logs.filter(log => log.type === 'admin').length}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Administrative operations
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Errors</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {logs.filter(log => log.type === 'error').length}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Failed operations
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Filters & Search
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="security">Security</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="success">Success</SelectItem>
                                <SelectItem value="error">Error</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={userFilter} onValueChange={setUserFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by user" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {[...new Set(logs.map(log => log.user))].map(user => (
                                    <SelectItem key={user} value={user}>{user}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by date" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="yesterday">Yesterday</SelectItem>
                                <SelectItem value="week">Last 7 days</SelectItem>
                                <SelectItem value="month">Last 30 days</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Showing {filteredLogs.length} of {logs.length} logs
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Activity Timeline
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" />
                            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading logs...</span>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="text-center py-8">
                            <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No logs found</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {logs.length === 0 ? 'No activity logs available yet.' : 'Try adjusting your filters.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredLogs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`border rounded-lg p-4 ${getTypeColor(log.type)}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            {getTypeIcon(log.type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium leading-relaxed text-gray-900 dark:text-gray-100">
                                                        {log.message}
                                                    </p>

                                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                                            <span className="text-gray-900 dark:text-gray-100">{log.user}</span>
                                                        </span>
                                                        <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                                            {log.userRole}
                                                        </Badge>
                                                        {log.deviceName && (
                                                            <span className="flex items-center gap-1">
                                                                <Activity className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                                                <span className="text-gray-900 dark:text-gray-100">{log.deviceName}</span>
                                                            </span>
                                                        )}
                                                        {log.action && (
                                                            <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                                {log.action.replace('_', ' ')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                        {formatTimestamp(log.timestamp)}
                                                    </span>
                                                    {log.details && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => toggleDetails(log.id)}
                                                            className="h-6 w-6 p-0"
                                                        >
                                                            {showDetails[log.id] ? (
                                                                <EyeOff className="w-3 h-3" />
                                                            ) : (
                                                                <Eye className="w-3 h-3" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {showDetails[log.id] && log.details && (
                                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                                    <h4 className="text-xs font-medium mb-2 text-gray-900 dark:text-gray-100">Details:</h4>
                                                    <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-words">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ActiveLogs;
