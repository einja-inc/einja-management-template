import type { NavGroupType } from "@repo/admin-ui/layout";
import {
  AlertTriangle,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Users,
} from "lucide-react";

export const navGroups: NavGroupType[] = [
  {
    title: "General",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Tasks",
        url: "/dashboard/tasks",
        icon: ListChecks,
      },
      {
        title: "Apps",
        url: "/dashboard/apps",
        icon: Package,
      },
      {
        title: "Chats",
        url: "/dashboard/chats",
        icon: MessageSquare,
        badge: "5",
      },
      {
        title: "Users",
        url: "/dashboard/users",
        icon: Users,
      },
    ],
  },
  {
    title: "Other",
    items: [
      {
        title: "Settings",
        icon: Settings,
        items: [
          {
            title: "Profile",
            url: "/dashboard/settings/profile",
          },
          {
            title: "Account",
            url: "/dashboard/settings/account",
          },
          {
            title: "Appearance",
            url: "/dashboard/settings/appearance",
          },
          {
            title: "Notifications",
            url: "/dashboard/settings/notifications",
          },
          {
            title: "Display",
            url: "/dashboard/settings/display",
          },
        ],
      },
      {
        title: "Help Center",
        url: "/dashboard/help-center",
        icon: HelpCircle,
      },
    ],
  },
  {
    title: "Pages",
    items: [
      {
        title: "Auth",
        icon: Shield,
        items: [
          {
            title: "Sign In",
            url: "/sign-in",
          },
          {
            title: "Sign Up",
            url: "/sign-up",
          },
          {
            title: "Forgot Password",
            url: "/forgot-password",
          },
          {
            title: "OTP",
            url: "/otp",
          },
        ],
      },
      {
        title: "Errors",
        icon: AlertTriangle,
        items: [
          {
            title: "401",
            url: "/401",
          },
          {
            title: "403",
            url: "/403",
          },
          {
            title: "500",
            url: "/500",
          },
          {
            title: "Maintenance",
            url: "/maintenance",
          },
        ],
      },
    ],
  },
];
