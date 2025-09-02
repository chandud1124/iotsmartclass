
import { Home, Zap, Calendar, Users as UsersIcon, Settings as SettingsIcon, Bell, LogOut, Shield, UserCheck, User } from "lucide-react";
import Index from "./pages/Index";
import Devices from "./pages/Devices";
import Switches from "./pages/Switches";
import Master from "./pages/Master";
import Schedule from "./pages/Schedule";
import Users from "./pages/Users";
import PermissionManagement from "./pages/PermissionManagement";
import UserProfile from "./pages/UserProfile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

export const navItems = [
  // Core Operations
  {
    title: "Dashboard",
    to: "/",
    icon: <Home className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Devices",
    to: "/devices",
    icon: <Zap className="h-4 w-4" />,
    page: <Devices />,
  },
  {
    title: "Switches",
    to: "/switches",
    icon: <Zap className="h-4 w-4" />,
    page: <Switches />,
  },
  {
    title: "Master Control",
    to: "/master",
    icon: <Shield className="h-4 w-4" />,
    page: <Master />,
  },

  // Scheduling
  {
    title: "Schedule",
    to: "/schedule",
    icon: <Calendar className="h-4 w-4" />,
    page: <Schedule />,
  },

  // User Management
  {
    title: "Users",
    to: "/users",
    icon: <UsersIcon className="h-4 w-4" />,
    page: <Users />,
  },
  {
    title: "Role Management",
    to: "/roles",
    icon: <Shield className="h-4 w-4" />,
    page: <PermissionManagement />, // Reusing existing component
  },
  {
    title: "Permissions",
    to: "/permissions",
    icon: <UserCheck className="h-4 w-4" />,
    page: <PermissionManagement />,
  },
  {
    title: "Classroom Access",
    to: "/classroom-access",
    icon: <Shield className="h-4 w-4" />,
    page: <PermissionManagement />, // Reusing existing component
  },

  // Account
  {
    title: "Profile",
    to: "/profile",
    icon: <User className="h-4 w-4" />,
    page: <UserProfile />,
  },

  // System
  {
    title: "Settings",
    to: "/settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Settings />,
  },
];

// Additional nav items that might be used in header/sidebar
export const headerNavItems = [
  {
    title: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    action: "notifications",
  },
  {
    title: "Logout",
    icon: <LogOut className="h-4 w-4" />,
    action: "logout",
  },
];

// 404 page
export const notFoundPage = <NotFound />;
