import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { authAPI } from '@/services/api';

interface RolePermissions {
    canRequestExtensions: boolean;
    canApproveExtensions: boolean;
    canManageUsers: boolean;
    canViewReports: boolean;
    canControlDevices: boolean;
    canAccessSecurity: boolean;
}

interface Role {
    value: string;
    label: string;
    description: string;
    permissions: RolePermissions;
    isSystemRole?: boolean;
}

const defaultRoles: Role[] = [
    {
        value: 'admin',
        label: 'Administrator',
        description: 'Full system access, user management, and approval permissions',
        isSystemRole: true,
        permissions: {
            canRequestExtensions: true,
            canApproveExtensions: true,
            canManageUsers: true,
            canViewReports: true,
            canControlDevices: true,
            canAccessSecurity: true
        }
    },
    {
        value: 'principal',
        label: 'Principal',
        description: 'School-wide oversight and approval permissions',
        permissions: {
            canRequestExtensions: true,
            canApproveExtensions: true,
            canManageUsers: false,
            canViewReports: true,
            canControlDevices: true,
            canAccessSecurity: true
        }
    },
    {
        value: 'dean',
        label: 'Dean',
        description: 'Faculty oversight and departmental approval permissions',
        permissions: {
            canRequestExtensions: true,
            canApproveExtensions: true,
            canManageUsers: false,
            canViewReports: true,
            canControlDevices: true,
            canAccessSecurity: false
        }
    },
    {
        value: 'hod',
        label: 'Head of Department',
        description: 'Department oversight and approval permissions',
        permissions: {
            canRequestExtensions: true,
            canApproveExtensions: true,
            canManageUsers: false,
            canViewReports: false,
            canControlDevices: true,
            canAccessSecurity: false
        }
    },
    {
        value: 'faculty',
        label: 'Faculty/Teacher',
        description: 'Can control devices and request class extensions',
        permissions: {
            canRequestExtensions: true,
            canApproveExtensions: false,
            canManageUsers: false,
            canViewReports: false,
            canControlDevices: true,
            canAccessSecurity: false
        }
    },
    {
        value: 'security',
        label: 'Security Personnel',
        description: 'Security monitoring and access control',
        permissions: {
            canRequestExtensions: false,
            canApproveExtensions: false,
            canManageUsers: false,
            canViewReports: false,
            canControlDevices: false,
            canAccessSecurity: true
        }
    },
    {
        value: 'student',
        label: 'Student',
        description: 'Access to basic classroom devices and schedules',
        permissions: {
            canRequestExtensions: false,
            canApproveExtensions: false,
            canManageUsers: false,
            canViewReports: false,
            canControlDevices: false,
            canAccessSecurity: false
        }
    },
    {
        value: 'user',
        label: 'General Staff',
        description: 'Limited access to system features',
        permissions: {
            canRequestExtensions: false,
            canApproveExtensions: false,
            canManageUsers: false,
            canViewReports: false,
            canControlDevices: false,
            canAccessSecurity: false
        }
    }
];

const RoleManagement: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>(defaultRoles);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchRolePermissions();
    }, []);

    const fetchRolePermissions = async () => {
        setLoading(true);
        try {
            // In a real implementation, this would fetch from the backend
            // For now, we'll use the default roles
            setRoles(defaultRoles);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load role permissions',
                variant: 'destructive'
            });
        }
        setLoading(false);
    };

    const updateRolePermission = (roleValue: string, permission: keyof RolePermissions, value: boolean) => {
        setRoles(prevRoles =>
            prevRoles.map(role =>
                role.value === roleValue
                    ? { ...role, permissions: { ...role.permissions, [permission]: value } }
                    : role
            )
        );
    };

    const saveRolePermissions = async () => {
        setSaving(true);
        try {
            // In a real implementation, this would save to the backend
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            toast({
                title: 'Success',
                description: 'Role permissions updated successfully',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save role permissions',
                variant: 'destructive'
            });
        }
        setSaving(false);
    };

    const resetToDefaults = () => {
        setRoles(defaultRoles);
        toast({
            title: 'Reset',
            description: 'Role permissions reset to defaults',
        });
    };

    const permissionLabels: Record<keyof RolePermissions, string> = {
        canRequestExtensions: 'Request Class Extensions',
        canApproveExtensions: 'Approve Class Extensions',
        canManageUsers: 'Manage Users',
        canViewReports: 'View Reports',
        canControlDevices: 'Control Devices',
        canAccessSecurity: 'Access Security Features'
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Button variant="outline" onClick={resetToDefaults}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset to Defaults
                    </Button>
                    <Button onClick={saveRolePermissions} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Changes to role permissions will affect all users with the corresponding role.
                    System roles (marked with a lock) cannot be modified.
                </AlertDescription>
            </Alert>

            <div className="grid gap-6">
                {roles.map((role) => (
                    <Card key={role.value} className="relative">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {role.label}
                                        {role.isSystemRole && <Badge variant="secondary">System</Badge>}
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {role.description}
                                    </p>
                                </div>
                                <Badge variant={role.isSystemRole ? 'destructive' : 'default'}>
                                    {role.value.toUpperCase()}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(role.permissions).map(([permission, enabled]) => (
                                    <div key={permission} className="flex items-center justify-between p-3 border rounded-lg">
                                        <Label htmlFor={`${role.value}-${permission}`} className="text-sm font-medium cursor-pointer">
                                            {permissionLabels[permission as keyof RolePermissions]}
                                        </Label>
                                        <Switch
                                            id={`${role.value}-${permission}`}
                                            checked={enabled}
                                            onCheckedChange={(checked) =>
                                                updateRolePermission(role.value, permission as keyof RolePermissions, checked)
                                            }
                                            disabled={role.isSystemRole && permission === 'canManageUsers'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default RoleManagement;
