import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Clock, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '@/services/api';

interface ClassroomAccess {
    _id: string;
    classroom: string;
    user: {
        _id: string;
        name: string;
        email: string;
        role: string;
    };
    permissions: {
        canControlDevices: boolean;
        canViewSensors: boolean;
        canModifySchedule: boolean;
        canAccessAfterHours: boolean;
        canOverrideSecurity: boolean;
    };
    timeRestrictions: {
        enabled: boolean;
        allowedDays: string[];
        startTime: string;
        endTime: string;
    };
    grantedBy: {
        name: string;
        email: string;
    };
    grantedAt: string;
    expiresAt?: string;
    isActive: boolean;
}

export const ClassroomAccessManager: React.FC = () => {
    const { hasManagementAccess } = usePermissions();
    const { isAuthenticated, user } = useAuth();
    const [accessRecords, setAccessRecords] = useState<ClassroomAccess[]>([]);
    const [classrooms, setClassrooms] = useState<string[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [granting, setGranting] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);

    // Form state for granting access
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedClassroom, setSelectedClassroom] = useState('');
    const [permissions, setPermissions] = useState({
        canControlDevices: true,
        canViewSensors: true,
        canModifySchedule: false,
        canAccessAfterHours: false,
        canOverrideSecurity: false,
    });
    const [timeRestrictions, setTimeRestrictions] = useState({
        enabled: false,
        allowedDays: [] as string[],
        startTime: '',
        endTime: '',
    });
    const [expiresAt, setExpiresAt] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Loading classroom access data...');

            // Check if user is authenticated
            if (!isAuthenticated) {
                setError('You must be logged in to access this feature.');
                return;
            }

            const [classroomsRes, usersRes, accessRes] = await Promise.all([
                api.get('/classroom/summary'),
                api.get('/users'),
                api.get('/classroom/all')
            ]);

            console.log('Classrooms response:', classroomsRes.data);
            console.log('Users response:', usersRes.data);
            console.log('Access records response:', accessRes.data);

            setClassrooms(classroomsRes.data.data.map((c: any) => c.classroom));
            setUsers(usersRes.data.data.filter((u: any) => u.isActive));
            setAccessRecords(accessRes.data.data);

            console.log('Filtered users:', usersRes.data.data.filter((u: any) => u.isActive));
            console.log('Access records loaded:', accessRes.data.data);
        } catch (error: any) {
            console.error('Error loading data:', error);
            setError(error.response?.data?.message || 'Failed to load data. Please try again.');
            setUsers([]);
            setClassrooms([]);
            setAccessRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantAccess = async () => {
        if (!selectedUser || !selectedClassroom) return;

        try {
            setGranting(true);
            await api.post('/classroom/grant', {
                userId: selectedUser,
                classroom: selectedClassroom,
                permissions,
                timeRestrictions,
                expiresAt: expiresAt || undefined,
                reason,
            });

            // Reset form
            setSelectedUser('');
            setSelectedClassroom('');
            setPermissions({
                canControlDevices: true,
                canViewSensors: true,
                canModifySchedule: false,
                canAccessAfterHours: false,
                canOverrideSecurity: false,
            });
            setTimeRestrictions({
                enabled: false,
                allowedDays: [],
                startTime: '',
                endTime: '',
            });
            setExpiresAt('');
            setReason('');

            // Reload data
            loadData();
        } catch (error) {
            console.error('Error granting access:', error);
        } finally {
            setGranting(false);
        }
    };

    const handleRevokeAccess = async (accessId: string) => {
        try {
            setRevoking(accessId);
            await api.delete(`/classroom/${accessId}`);
            loadData();
        } catch (error) {
            console.error('Error revoking access:', error);
        } finally {
            setRevoking(null);
        }
    };

    const toggleDay = (day: string) => {
        setTimeRestrictions(prev => ({
            ...prev,
            allowedDays: prev.allowedDays.includes(day)
                ? prev.allowedDays.filter(d => d !== day)
                : [...prev.allowedDays, day]
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-2">Loading classroom access data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={loading}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-primary" />
                    <div>
                        <p className="text-muted-foreground">You must be logged in to access this feature. Please log in and try again.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <RoleGuard roles={['admin', 'principal', 'dean', 'hod', 'faculty']}>
            <div className="space-y-6">
                {/* Grant Access Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Grant Classroom Access
                        </CardTitle>
                        <CardDescription>
                            Grant specific users access to classrooms with customizable permissions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={(e) => { e.preventDefault(); handleGrantAccess(); }} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="user-select">User</Label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger id="user-select">
                                            <SelectValue placeholder="Select user" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.length === 0 ? (
                                                <div className="p-2 text-sm text-muted-foreground">
                                                    No users available. {isAuthenticated ? 'Try refreshing the page.' : 'Please log in.'}
                                                </div>
                                            ) : (
                                                users.map(user => (
                                                    <SelectItem key={user._id} value={user._id}>
                                                        {user.name} ({user.email}) - {user.role}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="classroom-select">Classroom</Label>
                                    <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                                        <SelectTrigger id="classroom-select">
                                            <SelectValue placeholder="Select classroom" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classrooms.length === 0 ? (
                                                <div className="p-2 text-sm text-muted-foreground">
                                                    No classrooms available. Try refreshing the page.
                                                </div>
                                            ) : (
                                                classrooms.map(classroom => (
                                                    <SelectItem key={classroom} value={classroom}>
                                                        {classroom}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Permissions */}
                            <div>
                                <Label id="permissions-label" className="text-base font-medium">Permissions</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2" role="group" aria-labelledby="permissions-label">
                                    {Object.entries(permissions).map(([key, value]) => (
                                        <div key={key} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`permission-${key}`}
                                                checked={value}
                                                onCheckedChange={(checked) =>
                                                    setPermissions(prev => ({ ...prev, [key]: checked }))
                                                }
                                            />
                                            <Label htmlFor={`permission-${key}`} className="text-sm">
                                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Time Restrictions */}
                            <div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="time-restrictions-enabled"
                                        checked={timeRestrictions.enabled}
                                        onCheckedChange={(checked: boolean) =>
                                            setTimeRestrictions(prev => ({ ...prev, enabled: checked }))
                                        }
                                    />
                                    <Label htmlFor="time-restrictions-enabled" className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Enable Time Restrictions
                                    </Label>
                                </div>

                                {timeRestrictions.enabled && (
                                    <div className="mt-4 space-y-4 p-4 border rounded-lg" role="group" aria-labelledby="time-restrictions-enabled">
                                        <div>
                                            <Label htmlFor="allowed-days">Allowed Days</Label>
                                            <div className="flex flex-wrap gap-2 mt-2" id="allowed-days" role="group" aria-labelledby="allowed-days">
                                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                                                    <Button
                                                        key={day}
                                                        variant={timeRestrictions.allowedDays.includes(day) ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleDay(day)}
                                                        aria-pressed={timeRestrictions.allowedDays.includes(day)}
                                                    >
                                                        {day.charAt(0).toUpperCase() + day.slice(1)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="startTime">Start Time</Label>
                                                <Input
                                                    id="startTime"
                                                    type="time"
                                                    value={timeRestrictions.startTime}
                                                    onChange={(e) => setTimeRestrictions(prev => ({ ...prev, startTime: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="endTime">End Time</Label>
                                                <Input
                                                    id="endTime"
                                                    type="time"
                                                    value={timeRestrictions.endTime}
                                                    onChange={(e) => setTimeRestrictions(prev => ({ ...prev, endTime: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Expiration and Reason */}
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <legend className="sr-only">Access Configuration</legend>
                                <div>
                                    <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                                    <Input
                                        id="expiresAt"
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                        aria-describedby="expires-help"
                                    />
                                    <div id="expires-help" className="sr-only">
                                        Optional expiration date for the access permission
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="reason">Reason</Label>
                                    <Input
                                        id="reason"
                                        placeholder="Reason for granting access"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        aria-describedby="reason-help"
                                        required
                                    />
                                    <div id="reason-help" className="sr-only">
                                        Required reason for granting classroom access
                                    </div>
                                </div>
                            </fieldset>

                            <Button
                                type="submit"
                                disabled={granting || !selectedUser || !selectedClassroom}
                                className="w-full"
                            >
                                {granting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Granting Access...
                                    </>
                                ) : (
                                    'Grant Access'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Current Access Records */}
                <Card>
                    <CardHeader>
                        <CardTitle>Current Access Records</CardTitle>
                        <CardDescription>
                            Active classroom access permissions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {accessRecords.length === 0 ? (
                            <Alert>
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription>No active access records found.</AlertDescription>
                            </Alert>
                        ) : (
                            <div className="space-y-4" role="list" aria-label="Current classroom access records">
                                {accessRecords.map(record => (
                                    <div key={record._id} className="border rounded-lg p-4" role="listitem">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-medium">{record.classroom}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {record.user.name} ({record.user.email})
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Granted by {record.grantedBy.name} on {new Date(record.grantedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Badge variant={record.isActive ? "default" : "secondary"}>
                                                    {record.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleRevokeAccess(record._id)}
                                                    disabled={revoking === record._id}
                                                    aria-label={`Revoke access for ${record.user.name} to ${record.classroom}`}
                                                >
                                                    {revoking === record._id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        'Revoke'
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <div className="flex flex-wrap gap-1" role="list" aria-label="Granted permissions">
                                                {Object.entries(record.permissions).map(([key, value]) =>
                                                    value ? (
                                                        <Badge key={key} variant="outline" className="text-xs" role="listitem">
                                                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                        </Badge>
                                                    ) : null
                                                )}
                                            </div>
                                        </div>

                                        {record.timeRestrictions?.enabled && (
                                            <div className="mt-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                                                <Clock className="w-4 h-4 inline mr-1" aria-hidden="true" />
                                                {record.timeRestrictions.allowedDays.join(', ')}: {record.timeRestrictions.startTime} - {record.timeRestrictions.endTime}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Debug Information */}
                {process.env.NODE_ENV === 'development' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Debug Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm space-y-2">
                                <div><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</div>
                                <div><strong>User Role:</strong> {user?.role || 'None'}</div>
                                <div><strong>Users Loaded:</strong> {users.length}</div>
                                <div><strong>Classrooms Loaded:</strong> {classrooms.length}</div>
                                <div><strong>Access Records Loaded:</strong> {accessRecords.length}</div>
                                <div><strong>Selected User:</strong> {selectedUser || 'None'}</div>
                                <div><strong>Selected Classroom:</strong> {selectedClassroom || 'None'}</div>
                                <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
                                {error && <div><strong>Error:</strong> {error}</div>}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </RoleGuard>
    );
};