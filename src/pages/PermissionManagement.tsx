import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, User, Mail, Building, Phone, FileText, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authAPI } from '@/services/api';

interface PermissionRequest {
    _id: string;
    userId: {
        name: string;
        email: string;
        department: string;
        phone?: string;
        employeeId?: string;
        designation?: string;
        profilePicture?: string;
    };
    requestType: string;
    status: 'pending' | 'approved' | 'rejected';
    requestDetails: any;
    createdAt: string;
    comments?: Array<{
        userId: { name: string };
        comment: string;
        createdAt: string;
    }>;
}

const PermissionManagement: React.FC = () => {
    const [requests, setRequests] = useState<PermissionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<PermissionRequest | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await authAPI.getPendingPermissionRequests();
            if (response.data?.success) {
                setRequests(response.data.requests);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch permission requests',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        setActionLoading(requestId);
        try {
            const response = await authAPI.approvePermissionRequest(requestId, {
                comments: comment.trim() || 'Approved'
            });

            if (response.data?.success) {
                toast({
                    title: 'Success',
                    description: 'Permission request approved successfully'
                });
                fetchRequests();
                setSelectedRequest(null);
                setComment('');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to approve request',
                variant: 'destructive'
            });
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!rejectionReason.trim()) {
            toast({
                title: 'Error',
                description: 'Please provide a rejection reason',
                variant: 'destructive'
            });
            return;
        }

        setActionLoading(requestId);
        try {
            const response = await authAPI.rejectPermissionRequest(requestId, {
                rejectionReason: rejectionReason.trim(),
                comments: comment.trim() || 'Rejected'
            });

            if (response.data?.success) {
                toast({
                    title: 'Success',
                    description: 'Permission request rejected'
                });
                fetchRequests();
                setSelectedRequest(null);
                setComment('');
                setRejectionReason('');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to reject request',
                variant: 'destructive'
            });
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
            case 'approved':
                return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
            case 'rejected':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getRoleBadge = (role: string) => {
        const colors = {
            admin: 'bg-red-500',
            principal: 'bg-purple-500',
            dean: 'bg-blue-500',
            hod: 'bg-indigo-500',
            faculty: 'bg-green-500',
            security: 'bg-orange-500',
            student: 'bg-gray-500',
            user: 'bg-slate-500'
        };

        return (
            <Badge variant="outline" className={`${colors[role as keyof typeof colors] || 'bg-gray-500'} text-white border-none`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Badge variant="outline">
                        {requests.filter(r => r.status === 'pending').length} Pending
                    </Badge>
                    <Badge variant="outline">
                        {requests.length} Total
                    </Badge>
                </div>
            </div>

            <Tabs defaultValue="pending" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="pending">
                        Pending ({requests.filter(r => r.status === 'pending').length})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                        All Requests ({requests.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4">
                    {requests.filter(r => r.status === 'pending').length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                                <p className="text-muted-foreground text-center">
                                    No pending permission requests at the moment.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {requests
                                .filter(r => r.status === 'pending')
                                .map((request) => (
                                    <Card key={request._id} className="hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={request.userId?.profilePicture} />
                                                        <AvatarFallback>
                                                            {request.userId?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h3 className="font-semibold">{request.userId?.name || 'Unknown User'}</h3>
                                                        <p className="text-sm text-muted-foreground">{request.userId?.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {getRoleBadge(request.requestDetails.role)}
                                                    {getStatusBadge(request.status)}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Building className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-sm">{request.userId?.department || 'N/A'}</span>
                                                </div>
                                                {request.userId?.employeeId && (
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-sm">{request.userId.employeeId}</span>
                                                    </div>
                                                )}
                                                {request.userId?.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-sm">{request.userId.phone}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm">
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            Review
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl">
                                                        <DialogHeader>
                                                            <DialogTitle>Review Permission Request</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <Label className="text-sm font-medium">Name</Label>
                                                                    <p className="text-sm text-muted-foreground">{request.userId?.name || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-sm font-medium">Email</Label>
                                                                    <p className="text-sm text-muted-foreground">{request.userId?.email || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-sm font-medium">Role</Label>
                                                                    <p className="text-sm text-muted-foreground">{request.requestDetails.role}</p>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-sm font-medium">Department</Label>
                                                                    <p className="text-sm text-muted-foreground">{request.userId?.department || 'N/A'}</p>
                                                                </div>
                                                                {request.userId?.employeeId && (
                                                                    <>
                                                                        <div>
                                                                            <Label className="text-sm font-medium">Employee ID</Label>
                                                                            <p className="text-sm text-muted-foreground">{request.userId.employeeId}</p>
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-sm font-medium">Designation</Label>
                                                                            <p className="text-sm text-muted-foreground">{request.userId?.designation || 'N/A'}</p>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {request.requestDetails.reason && (
                                                                <div>
                                                                    <Label className="text-sm font-medium">Reason for Registration</Label>
                                                                    <p className="text-sm text-muted-foreground mt-1">{request.requestDetails.reason}</p>
                                                                </div>
                                                            )}

                                                            <div>
                                                                <Label htmlFor="comment">Comments (Optional)</Label>
                                                                <Textarea
                                                                    id="comment"
                                                                    placeholder="Add any comments for this decision..."
                                                                    value={comment}
                                                                    onChange={(e) => setComment(e.target.value)}
                                                                />
                                                            </div>

                                                            <div className="flex gap-2 pt-4">
                                                                <Button
                                                                    onClick={() => handleApprove(request._id)}
                                                                    disabled={actionLoading === request._id}
                                                                    className="flex-1"
                                                                >
                                                                    {actionLoading === request._id ? 'Approving...' : 'Approve'}
                                                                </Button>
                                                                <Dialog>
                                                                    <DialogTrigger asChild>
                                                                        <Button
                                                                            variant="destructive"
                                                                            disabled={actionLoading === request._id}
                                                                            className="flex-1"
                                                                        >
                                                                            Reject
                                                                        </Button>
                                                                    </DialogTrigger>
                                                                    <DialogContent>
                                                                        <DialogHeader>
                                                                            <DialogTitle>Reject Permission Request</DialogTitle>
                                                                        </DialogHeader>
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                                                                                <Textarea
                                                                                    id="rejectionReason"
                                                                                    placeholder="Please provide a reason for rejection..."
                                                                                    value={rejectionReason}
                                                                                    onChange={(e) => setRejectionReason(e.target.value)}
                                                                                    required
                                                                                />
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <Button
                                                                                    variant="destructive"
                                                                                    onClick={() => handleReject(request._id)}
                                                                                    disabled={actionLoading === request._id || !rejectionReason.trim()}
                                                                                    className="flex-1"
                                                                                >
                                                                                    {actionLoading === request._id ? 'Rejecting...' : 'Confirm Rejection'}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            </div>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="all" className="space-y-4">
                    <div className="grid gap-4">
                        {requests.map((request) => (
                            <Card key={request._id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={request.userId?.profilePicture} />
                                                <AvatarFallback>
                                                    {request.userId?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-semibold">{request.userId?.name || 'Unknown User'}</h3>
                                                <p className="text-sm text-muted-foreground">{request.userId?.email || 'No email'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getRoleBadge(request.requestDetails.role)}
                                            {getStatusBadge(request.status)}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        Requested on {new Date(request.createdAt).toLocaleDateString()}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PermissionManagement;
