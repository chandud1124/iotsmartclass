import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    User,
    Mail,
    Phone,
    Building,
    Calendar,
    Upload,
    Edit,
    Save,
    X,
    CheckCircle,
    AlertCircle,
    FileText,
    Shield,
    Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { authAPI } from '@/services/api';
import { format } from 'date-fns';

interface UserProfile {
    _id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    phone?: string;
    employeeId?: string;
    designation?: string;
    profilePicture?: string;
    idDocument?: string;
    registrationReason?: string;
    isActive: boolean;
    isApproved: boolean;
    registrationDate: string;
    lastLogin?: string;
    canRequestExtensions: boolean;
    canApproveExtensions: boolean;
}

const UserProfile: React.FC = () => {
    const { user: currentUser, updateProfile } = useAuth();
    const { toast } = useToast();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        designation: '',
        department: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await authAPI.getProfile();
            if (response.data?.success) {
                const userData = response.data.user;
                setProfile(userData);
                setFormData({
                    name: userData.name || '',
                    phone: userData.phone || '',
                    designation: userData.designation || '',
                    department: userData.department || ''
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load profile information',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await authAPI.updateProfile(formData);
            if (response.data?.success) {
                setProfile(prev => prev ? { ...prev, ...formData } : null);
                setEditing(false);
                toast({
                    title: 'Success',
                    description: 'Profile updated successfully'
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to update profile',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast({
                title: 'Error',
                description: 'New passwords do not match',
                variant: 'destructive'
            });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast({
                title: 'Error',
                description: 'New password must be at least 6 characters long',
                variant: 'destructive'
            });
            return;
        }

        setChangingPassword(true);
        try {
            const response = await authAPI.updateProfile({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            if (response.data?.success) {
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
                toast({
                    title: 'Success',
                    description: 'Password updated successfully'
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.message || 'Failed to update password',
                variant: 'destructive'
            });
        } finally {
            setChangingPassword(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            name: profile?.name || '',
            phone: profile?.phone || '',
            designation: profile?.designation || '',
            department: profile?.department || ''
        });
        setEditing(false);
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
            <Badge variant="outline" className={`${colors[role as keyof typeof colors]} text-white border-none`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
            </Badge>
        );
    };

    const getStatusBadge = (isActive: boolean, isApproved: boolean) => {
        if (!isApproved) {
            return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending Approval</Badge>;
        }
        if (isActive) {
            return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
        }
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Inactive</Badge>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-64">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load profile information. Please try again.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Profile</h1>
                    <p className="text-muted-foreground">Manage your account information and preferences</p>
                </div>
                <div className="flex gap-2">
                    {getStatusBadge(profile.isActive, profile.isApproved)}
                    {getRoleBadge(profile.role)}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Overview */}
                <Card className="lg:col-span-1">
                    <CardHeader className="text-center">
                        <Avatar className="w-24 h-24 mx-auto mb-4">
                            <AvatarImage src={profile.profilePicture} alt={profile.name} />
                            <AvatarFallback className="text-lg">
                                {profile.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-xl">{profile.name}</CardTitle>
                        <CardDescription>{profile.email}</CardDescription>
                        <div className="flex justify-center gap-2 mt-2">
                            {getRoleBadge(profile.role)}
                            {getStatusBadge(profile.isActive, profile.isApproved)}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-muted-foreground" />
                                <span>{profile.department}</span>
                            </div>
                            {profile.employeeId && (
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span>{profile.employeeId}</span>
                                </div>
                            )}
                            {profile.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span>{profile.phone}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>
                                    {profile.registrationDate
                                        ? format(new Date(profile.registrationDate), 'MMM dd, yyyy')
                                        : 'Not available'
                                    }
                                </span>
                            </div>
                        </div>

                        {profile.lastLogin && (
                            <div className="pt-4 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Last login: {
                                        profile.lastLogin
                                            ? format(new Date(profile.lastLogin), 'MMM dd, yyyy HH:mm')
                                            : 'Never'
                                    }
                                </p>
                            </div>
                        )}

                        <div className="pt-4 border-t space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Can request extensions</span>
                                {profile.canRequestExtensions ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Can approve extensions</span>
                                {profile.canApproveExtensions ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Profile Details */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Profile Information</CardTitle>
                                <CardDescription>Update your personal and professional details</CardDescription>
                            </div>
                            {!editing ? (
                                <Button onClick={() => setEditing(true)} size="sm">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Profile
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button onClick={handleSave} disabled={saving} size="sm">
                                        <Save className="w-4 h-4 mr-2" />
                                        {saving ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button onClick={handleCancel} variant="outline" size="sm">
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="personal" className="space-y-4">
                            <TabsList>
                                <TabsTrigger value="personal">Personal</TabsTrigger>
                                <TabsTrigger value="professional">Professional</TabsTrigger>
                                <TabsTrigger value="documents">Documents</TabsTrigger>
                                <TabsTrigger value="security">Security</TabsTrigger>
                            </TabsList>

                            <TabsContent value="personal" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name</Label>
                                        {editing ? (
                                            <Input
                                                id="name"
                                                value={formData.name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                <span>{profile.name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                            <Mail className="w-4 h-4 text-muted-foreground" />
                                            <span>{profile.email}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone Number</Label>
                                        {editing ? (
                                            <Input
                                                id="phone"
                                                value={formData.phone}
                                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="+1 (555) 123-4567"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                                <span>{profile.phone || 'Not provided'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="department">Department</Label>
                                        {editing ? (
                                            <Input
                                                id="department"
                                                value={formData.department}
                                                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                                <Building className="w-4 h-4 text-muted-foreground" />
                                                <span>{profile.department}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="professional" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {profile.employeeId && (
                                        <div className="space-y-2">
                                            <Label>Employee ID</Label>
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                <span>{profile.employeeId}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="designation">Designation</Label>
                                        {editing ? (
                                            <Input
                                                id="designation"
                                                value={formData.designation}
                                                onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                                                placeholder="Assistant Professor"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                                <Shield className="w-4 h-4 text-muted-foreground" />
                                                <span>{profile.designation || 'Not specified'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {profile.registrationReason && (
                                    <div className="space-y-2">
                                        <Label>Registration Reason</Label>
                                        <div className="p-3 border rounded-md bg-muted/50">
                                            <p className="text-sm">{profile.registrationReason}</p>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="documents" className="space-y-4">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-10 h-10">
                                                <AvatarImage src={profile.profilePicture} />
                                                <AvatarFallback>
                                                    <User className="w-4 h-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">Profile Picture</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {profile.profilePicture ? 'Uploaded' : 'Not uploaded'}
                                                </p>
                                            </div>
                                        </div>
                                        {profile.profilePicture && (
                                            <Button variant="outline" size="sm">
                                                <Upload className="w-4 h-4 mr-2" />
                                                Update
                                            </Button>
                                        )}
                                    </div>

                                    {profile.idDocument && (
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">ID Document</p>
                                                    <p className="text-sm text-muted-foreground">Uploaded</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm">
                                                <Upload className="w-4 h-4 mr-2" />
                                                Update
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="security" className="space-y-4">
                                {/* Password Change Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Change Password</CardTitle>
                                        <CardDescription>
                                            Update your password to keep your account secure
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="currentPassword">Current Password</Label>
                                                <Input
                                                    id="currentPassword"
                                                    type="password"
                                                    value={passwordData.currentPassword}
                                                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                    placeholder="Enter your current password"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="newPassword">New Password</Label>
                                                <Input
                                                    id="newPassword"
                                                    type="password"
                                                    value={passwordData.newPassword}
                                                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                                    placeholder="Enter your new password"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                                <Input
                                                    id="confirmPassword"
                                                    type="password"
                                                    value={passwordData.confirmPassword}
                                                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                    placeholder="Confirm your new password"
                                                />
                                            </div>
                                            <Button
                                                className="w-full"
                                                onClick={handlePasswordChange}
                                                disabled={changingPassword}
                                            >
                                                <Shield className="w-4 h-4 mr-2" />
                                                {changingPassword ? 'Updating...' : 'Update Password'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Account Status</Label>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(profile.isActive, profile.isApproved)}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <div className="flex items-center gap-2">
                                            {getRoleBadge(profile.role)}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Registration Date</Label>
                                        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                            <span>
                                                {profile.registrationDate
                                                    ? format(new Date(profile.registrationDate), 'PPP')
                                                    : 'Not available'
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {profile.lastLogin && (
                                        <div className="space-y-2">
                                            <Label>Last Login</Label>
                                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                                <span>
                                                    {profile.lastLogin
                                                        ? format(new Date(profile.lastLogin), 'PPP p')
                                                        : 'Never'
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UserProfile;
