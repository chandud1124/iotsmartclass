import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Search,
    Filter,
    Eye,
    Edit,
    Trash2,
    Clock,
    AlertCircle,
    CheckCircle,
    XCircle,
    User,
    Calendar,
    Tag,
    Ticket
} from 'lucide-react';
import { ticketAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import CreateTicketDialog from './CreateTicketDialog';

interface Ticket {
    id: string;
    ticketId: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    createdBy: {
        name: string;
        email: string;
        role: string;
    };
    assignedTo?: {
        name: string;
        email: string;
        role: string;
    };
    department?: string;
    location?: string;
    deviceId?: string;
    tags: string[];
    resolution?: string;
    resolvedAt?: string;
    closedAt?: string;
    estimatedHours?: number;
    actualHours?: number;
    createdAt: string;
    updatedAt: string;
    daysOpen: number;
    comments: Array<{
        id: string;
        author: string;
        authorName: string;
        message: string;
        isInternal: boolean;
        createdAt: string;
    }>;
}

const TicketList: React.FC = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        category: '',
        priority: '',
        search: ''
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    });

    const loadTickets = async () => {
        try {
            setLoading(true);
            const response = await ticketAPI.getTickets({
                ...filters,
                page: pagination.page,
                limit: pagination.limit
            });
            setTickets(response.data.data);
            setPagination(response.data.pagination);
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to load tickets.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [filters, pagination.page]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-blue-100 text-blue-800';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'closed': return 'bg-gray-100 text-gray-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'low': return 'bg-gray-100 text-gray-800';
            case 'medium': return 'bg-blue-100 text-blue-800';
            case 'high': return 'bg-orange-100 text-orange-800';
            case 'urgent': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getCategoryLabel = (category: string) => {
        const categories: Record<string, string> = {
            technical_issue: 'Technical Issue',
            device_problem: 'Device Problem',
            network_issue: 'Network Issue',
            software_bug: 'Software Bug',
            feature_request: 'Feature Request',
            account_issue: 'Account Issue',
            security_concern: 'Security Concern',
            other: 'Other'
        };
        return categories[category] || category;
    };

    const handleViewDetails = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setShowDetails(true);
    };

    const handleStatusUpdate = async (ticketId: string, status: string, comment?: string) => {
        try {
            await ticketAPI.updateTicket(ticketId, { status, comment });
            toast({
                title: "Success",
                description: "Ticket status updated successfully.",
            });
            loadTickets();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to update ticket status.",
                variant: "destructive"
            });
        }
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!confirm('Are you sure you want to delete this ticket?')) return;

        try {
            await ticketAPI.deleteTicket(ticketId);
            toast({
                title: "Success",
                description: "Ticket deleted successfully.",
            });
            loadTickets();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to delete ticket.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Support Tickets</h2>
                    <p className="text-muted-foreground">Manage and track support requests</p>
                </div>
                <CreateTicketDialog onTicketCreated={loadTickets} />
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search tickets..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Status</Label>
                            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Status</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Category</Label>
                            <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Categories</SelectItem>
                                    <SelectItem value="technical_issue">Technical Issue</SelectItem>
                                    <SelectItem value="device_problem">Device Problem</SelectItem>
                                    <SelectItem value="network_issue">Network Issue</SelectItem>
                                    <SelectItem value="software_bug">Software Bug</SelectItem>
                                    <SelectItem value="feature_request">Feature Request</SelectItem>
                                    <SelectItem value="account_issue">Account Issue</SelectItem>
                                    <SelectItem value="security_concern">Security Concern</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Priority</Label>
                            <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Priorities" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Priorities</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tickets Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ticket ID</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        Loading tickets...
                                    </TableCell>
                                </TableRow>
                            ) : tickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        No tickets found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tickets.map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell className="font-mono text-sm">
                                            {ticket.ticketId}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">
                                            {ticket.title}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(ticket.status)}>
                                                {ticket.status.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getPriorityColor(ticket.priority)}>
                                                {ticket.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {getCategoryLabel(ticket.category)}
                                        </TableCell>
                                        <TableCell>
                                            {ticket.createdBy.name}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(ticket)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                {user?.role === 'admin' && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteTicket(ticket.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        disabled={pagination.page === 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center px-4">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Ticket Details Dialog */}
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ticket className="w-5 h-5" />
                            {selectedTicket?.ticketId}: {selectedTicket?.title}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedTicket && (
                        <div className="space-y-6">
                            {/* Ticket Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Status</Label>
                                    <Badge className={getStatusColor(selectedTicket.status)}>
                                        {selectedTicket.status.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <div>
                                    <Label>Priority</Label>
                                    <Badge className={getPriorityColor(selectedTicket.priority)}>
                                        {selectedTicket.priority}
                                    </Badge>
                                </div>
                                <div>
                                    <Label>Category</Label>
                                    <p>{getCategoryLabel(selectedTicket.category)}</p>
                                </div>
                                <div>
                                    <Label>Days Open</Label>
                                    <p>{selectedTicket.daysOpen} days</p>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <Label>Description</Label>
                                <p className="mt-1 p-3 bg-muted rounded-md">{selectedTicket.description}</p>
                            </div>

                            {/* Additional Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Created By</Label>
                                    <p>{selectedTicket.createdBy.name} ({selectedTicket.createdBy.email})</p>
                                </div>
                                {selectedTicket.assignedTo && (
                                    <div>
                                        <Label>Assigned To</Label>
                                        <p>{selectedTicket.assignedTo.name} ({selectedTicket.assignedTo.email})</p>
                                    </div>
                                )}
                                {selectedTicket.department && (
                                    <div>
                                        <Label>Department</Label>
                                        <p>{selectedTicket.department}</p>
                                    </div>
                                )}
                                {selectedTicket.location && (
                                    <div>
                                        <Label>Location</Label>
                                        <p>{selectedTicket.location}</p>
                                    </div>
                                )}
                            </div>

                            {/* Tags */}
                            {selectedTicket.tags.length > 0 && (
                                <div>
                                    <Label>Tags</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {selectedTicket.tags.map((tag) => (
                                            <Badge key={tag} variant="outline">
                                                <Tag className="w-3 h-3 mr-1" />
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            <div>
                                <Label>Comments</Label>
                                <div className="space-y-3 mt-2">
                                    {selectedTicket.comments.map((comment) => (
                                        <div key={comment.id} className="p-3 bg-muted rounded-md">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4" />
                                                    <span className="font-medium">{comment.authorName}</span>
                                                    {comment.isInternal && (
                                                        <Badge variant="secondary">Internal</Badge>
                                                    )}
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(comment.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="mt-2">{comment.message}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            {user?.role === 'admin' && (
                                <div className="flex gap-2 pt-4">
                                    {selectedTicket.status === 'open' && (
                                        <Button
                                            onClick={() => handleStatusUpdate(selectedTicket.id, 'in_progress')}
                                        >
                                            Start Working
                                        </Button>
                                    )}
                                    {selectedTicket.status === 'in_progress' && (
                                        <Button
                                            onClick={() => handleStatusUpdate(selectedTicket.id, 'resolved')}
                                        >
                                            Mark Resolved
                                        </Button>
                                    )}
                                    {selectedTicket.status !== 'closed' && selectedTicket.status !== 'cancelled' && (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleStatusUpdate(selectedTicket.id, 'closed')}
                                        >
                                            Close Ticket
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TicketList;
