import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface RoleGuardProps {
    children: React.ReactNode;
    roles?: string[];
    permissions?: string[];
    requireAllPermissions?: boolean;
    fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
    children,
    roles = [],
    permissions = [],
    requireAllPermissions = false,
    fallback = null
}) => {
    const perms = usePermissions();

    // Check roles
    const hasRequiredRole = roles.length === 0 || roles.includes(perms.role);

    // Check permissions
    const hasRequiredPermissions = permissions.length === 0 ||
        (requireAllPermissions
            ? permissions.every(perm => perms[perm as keyof typeof perms])
            : permissions.some(perm => perms[perm as keyof typeof perms]));

    if (!hasRequiredRole || !hasRequiredPermissions) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
