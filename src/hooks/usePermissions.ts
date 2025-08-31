import React from 'react';
import { useAuth } from '@/hooks/useAuth';

export const usePermissions = () => {
    const { user } = useAuth();

    const role = user?.role || '';
    const isApproved = (user as any)?.isApproved || false;
    const isActive = (user as any)?.isActive || false;

    // Role hierarchy
    const isAdmin = role === 'admin';
    const isPrincipal = role === 'principal';
    const isDean = role === 'dean';
    const isHOD = role === 'hod';
    const isFaculty = role === 'faculty';
    const isSecurity = role === 'security';
    const isStudent = role === 'student';

    // Permission groups
    const hasManagementAccess = isAdmin || isPrincipal || isDean || isHOD;
    const hasStaffAccess = hasManagementAccess || isFaculty || isSecurity;
    const hasFullAccess = hasManagementAccess || isAdmin;

    // Specific permissions
    const canApproveUsers = hasManagementAccess;
    const canManageDevices = hasStaffAccess;
    const canViewReports = hasManagementAccess;
    const canManageSchedule = hasStaffAccess;
    const canRequestExtensions = isFaculty;
    const canApproveExtensions = hasManagementAccess;
    const canViewSecurityAlerts = isSecurity || hasManagementAccess;
    const canManageUsers = hasManagementAccess;

    return {
        // User status
        isApproved,
        isActive,

        // Roles
        role,
        isAdmin,
        isPrincipal,
        isDean,
        isHOD,
        isFaculty,
        isSecurity,
        isStudent,

        // Permission groups
        hasManagementAccess,
        hasStaffAccess,
        hasFullAccess,

        // Specific permissions
        canApproveUsers,
        canManageDevices,
        canViewReports,
        canManageSchedule,
        canRequestExtensions,
        canApproveExtensions,
        canViewSecurityAlerts,
        canManageUsers,
    };
};
