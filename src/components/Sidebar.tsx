
import React, { useState, useEffect } from 'react';
import {
  Home,
  Cpu,
  ToggleLeft,
  Calendar,
  Users,
  Settings,
  Shield,
  ChevronRight,
  ChevronLeft,
  Power,
  User,
  UserCheck,
  FileText,
  Activity
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useDevices } from '@/hooks/useDevices';
import { scheduleAPI } from '@/services/api';
import api from '@/services/api';
import { useGlobalLoading } from '@/hooks/useGlobalLoading';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

const navigationSections = [
  {
    title: 'Core Operations',
    items: [
      { name: 'Dashboard', icon: Home, href: '/', current: false },
      { name: 'Devices', icon: Cpu, href: '/devices', current: false, requiresPermission: 'canManageDevices' },
      { name: 'Switches', icon: ToggleLeft, href: '/switches', current: false, requiresPermission: 'canManageDevices' },
      { name: 'Master Control', icon: Power, href: '/master', current: false, requiresPermission: 'canManageDevices' },
    ]
  },
  {
    title: 'Scheduling',
    items: [
      { name: 'Schedule', icon: Calendar, href: '/schedule', current: false, requiresPermission: 'canManageSchedule' },
    ]
  },
  {
    title: 'User Management',
    items: [
      { name: 'Users', icon: Users, href: '/users', current: false, requiresPermission: 'canManageUsers' },
      { name: 'Role Management', icon: Shield, href: '/roles', current: false, requiresPermission: 'canManageUsers' },
      { name: 'Permissions', icon: UserCheck, href: '/permissions', current: false, requiresPermission: 'canApproveUsers' },
      { name: 'Classroom Access', icon: Shield, href: '/classroom-access', current: false, requiresPermission: 'canApproveUsers' },
    ]
  },
  {
    title: 'Account',
    items: [
      { name: 'Profile', icon: User, href: '/profile', current: false },
    ]
  },
  {
    title: 'Administration',
    items: [
      { name: 'Active Logs', icon: FileText, href: '/logs', current: false, adminOnly: true },
    ],
    adminOnly: true
  }
];

interface SidebarProps {
  className?: string;
  onNavigateClose?: () => void; // for mobile sheet close
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onNavigateClose }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAdmin, hasManagementAccess } = usePermissions();
  const { refreshDevices } = useDevices();
  const { start, stop } = useGlobalLoading();
  const [navLock, setNavLock] = useState(false);
  const debounceRef = React.useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const deviceRelated = new Set(['/', '/devices', '/switches', '/master']);
  // Future: add schedule/users background prefetch similarly without blocking

  const handleNavigation = (href: string) => {
    if (navLock) return;
    setNavLock(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNavLock(false), 400);
    if (deviceRelated.has(href)) {
      const token = start('nav');
      refreshDevices({ background: true }).finally(() => stop(token));
    }
    navigate(href);
    if (onNavigateClose) onNavigateClose();
  };

  return (
    <div className={cn(
      "glass flex flex-col transition-all duration-300 h-screen relative z-20 min-w-16 box-border opacity-100 visible rounded-r-lg",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Logo/Brand */}
      <div className="p-2 flex-shrink-0 h-16 relative z-10 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg truncate">IoT Control</h1>
              <p className="text-xs text-muted-foreground truncate">College Automation</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-h-0 relative z-10 glass">
        {navigationSections.map((section, sectionIndex) => {
          // Filter items based on permissions
          const visibleItems = section.items.filter((item: any) => {
            if (item.adminOnly && !isAdmin) {
              return false;
            }
            if (item.requiresPermission) {
              const perms = usePermissions();
              return perms[item.requiresPermission as keyof typeof perms];
            }
            return true;
          });

          // Skip section if no visible items or section is admin-only and user is not admin
          if (visibleItems.length === 0 || (section.adminOnly && !isAdmin)) return null;

          return (
            <div key={section.title} className="space-y-1">
              {/* Section Header */}
              {!collapsed && (
                <div className="px-2 py-1 min-h-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {section.title}
                  </h3>
                </div>
              )}

              {/* Section Items */}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrentPage = location.pathname === item.href;

                  return (
                    <Button
                      key={item.name}
                      variant={isCurrentPage ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 h-9 px-3 text-left overflow-hidden",
                        isCurrentPage && "bg-primary text-primary-foreground shadow-lg",
                        collapsed && "px-3 justify-center"
                      )}
                      onClick={() => handleNavigation(item.href)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="text-sm truncate">{item.name}</span>}
                    </Button>
                  );
                })}
              </div>

              {/* Section Divider (except for last section) */}
              {sectionIndex < navigationSections.length - 1 && (
                <div className="mx-2" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 flex-shrink-0 relative z-10 glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center h-8 hover:bg-primary/10 hover:text-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
