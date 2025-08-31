import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Bell,
    CheckCircle,
    AlertCircle,
    Info,
    Clock,
    Trash2,
    Settings,
    UserCheck,
    Shield,
    Calendar,
    FileText,
    X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authAPI } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    isRead: boolean;
    createdAt: string;
    relatedEntity?: {
        model: string;
        id: string;
    };
    actions?: Array<{
        label: string;
        action: string;
        url?: string;
    }>;
}

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
    isOpen,
    onClose,
    className = ''
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
            fetchUnreadCount();
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await authAPI.getNotifications();
            if (response.data?.success) {
                setNotifications(response.data.notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await authAPI.getUnreadNotificationCount();
            if (response.data?.success) {
                setUnreadCount(response.data.count);
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await authAPI.markNotificationAsRead(notificationId);
            setNotifications(prev =>
                prev.map(notif =>
                    notif._id === notificationId
                        ? { ...notif, isRead: true }
                        : notif
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            // Mark all unread notifications as read
            const unreadNotifications = notifications.filter(n => !n.isRead);
            for (const notification of unreadNotifications) {
                await authAPI.markNotificationAsRead(notification._id);
            }

            setNotifications(prev =>
                prev.map(notif => ({ ...notif, isRead: true }))
            );
            setUnreadCount(0);

            toast({
                title: 'Success',
                description: 'All notifications marked as read'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to mark notifications as read',
                variant: 'destructive'
            });
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'security_alert':
            case 'unauthorized_access':
                return <Shield className="w-4 h-4 text-red-500" />;
            case 'extension_request':
            case 'permission_request':
                return <UserCheck className="w-4 h-4 text-blue-500" />;
            case 'schedule_conflict':
                return <Calendar className="w-4 h-4 text-orange-500" />;
            case 'system_maintenance':
                return <Settings className="w-4 h-4 text-yellow-500" />;
            case 'extension_approved':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'extension_rejected':
                return <X className="w-4 h-4 text-red-500" />;
            case 'account_approved':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'account_rejected':
                return <X className="w-4 h-4 text-red-500" />;
            default:
                return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getPriorityBadge = (priority: string) => {
        const colors = {
            low: 'bg-gray-500',
            medium: 'bg-blue-500',
            high: 'bg-orange-500',
            urgent: 'bg-red-500'
        };

        return (
            <Badge
                variant="outline"
                className={`${colors[priority as keyof typeof colors]} text-white border-none text-xs`}
            >
                {priority.toUpperCase()}
            </Badge>
        );
    };

    const unreadNotifications = notifications.filter(n => !n.isRead);
    const readNotifications = notifications.filter(n => n.isRead);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 ${className}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="absolute right-4 top-16 w-96 max-h-[80vh] bg-background border rounded-lg shadow-lg">
                <Card className="border-0 shadow-none">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                <CardTitle className="text-lg">Notifications</CardTitle>
                                {unreadCount > 0 && (
                                    <Badge variant="destructive" className="ml-2">
                                        {unreadCount}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={markAllAsRead}
                                        className="text-xs"
                                    >
                                        Mark all read
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <Tabs defaultValue="all" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mx-4 mb-2">
                                <TabsTrigger value="all" className="text-xs">
                                    All ({notifications.length})
                                </TabsTrigger>
                                <TabsTrigger value="unread" className="text-xs">
                                    Unread ({unreadCount})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="all" className="mt-0">
                                <ScrollArea className="h-96">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                                            <h3 className="text-sm font-medium mb-2">No notifications</h3>
                                            <p className="text-xs text-muted-foreground">
                                                You're all caught up!
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {notifications.map((notification, index) => (
                                                <div key={notification._id}>
                                                    <div
                                                        className={cn(
                                                            "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                                                            !notification.isRead && "bg-blue-50/50"
                                                        )}
                                                        onClick={() => !notification.isRead && markAsRead(notification._id)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-shrink-0 mt-0.5">
                                                                {getNotificationIcon(notification.type)}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-sm font-medium truncate">
                                                                        {notification.title}
                                                                    </h4>
                                                                    {getPriorityBadge(notification.priority)}
                                                                    {!notification.isRead && (
                                                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                                                    )}
                                                                </div>

                                                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                                                    {notification.message}
                                                                </p>

                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                                    </span>

                                                                    {notification.actions && notification.actions.length > 0 && (
                                                                        <div className="flex gap-1">
                                                                            {notification.actions.map((action, actionIndex) => (
                                                                                <Button
                                                                                    key={actionIndex}
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="text-xs h-6 px-2"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        // Handle action click
                                                                                        if (action.url) {
                                                                                            window.location.href = action.url;
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {action.label}
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {index < notifications.length - 1 && <Separator />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="unread" className="mt-0">
                                <ScrollArea className="h-96">
                                    {unreadNotifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                                            <h3 className="text-sm font-medium mb-2">All caught up!</h3>
                                            <p className="text-xs text-muted-foreground">
                                                No unread notifications
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {unreadNotifications.map((notification, index) => (
                                                <div key={notification._id}>
                                                    <div
                                                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                                                        onClick={() => markAsRead(notification._id)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-shrink-0 mt-0.5">
                                                                {getNotificationIcon(notification.type)}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-sm font-medium truncate">
                                                                        {notification.title}
                                                                    </h4>
                                                                    {getPriorityBadge(notification.priority)}
                                                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                                                </div>

                                                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                                                    {notification.message}
                                                                </p>

                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                                    </span>

                                                                    {notification.actions && notification.actions.length > 0 && (
                                                                        <div className="flex gap-1">
                                                                            {notification.actions.map((action, actionIndex) => (
                                                                                <Button
                                                                                    key={actionIndex}
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="text-xs h-6 px-2"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (action.url) {
                                                                                            window.location.href = action.url;
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {action.label}
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {index < unreadNotifications.length - 1 && <Separator />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default NotificationsPanel;
