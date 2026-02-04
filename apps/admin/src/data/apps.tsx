import {
  BookOpen,
  CreditCard,
  Figma,
  FileText,
  GitBranch,
  Github,
  Mail,
  MessageCircle,
  MessageSquare,
  Package,
  Phone,
  Trello,
  Users,
  Video,
} from "lucide-react";

export type App = {
  name: string;
  logo: React.ReactElement;
  connected: boolean;
  desc: string;
};

export const apps: App[] = [
  {
    name: "Telegram",
    logo: <MessageCircle className="h-8 w-8" />,
    connected: false,
    desc: "Connect with Telegram for real-time communication.",
  },
  {
    name: "Notion",
    logo: <FileText className="h-8 w-8" />,
    connected: true,
    desc: "Effortlessly sync Notion pages for seamless collaboration.",
  },
  {
    name: "Figma",
    logo: <Figma className="h-8 w-8" />,
    connected: true,
    desc: "View and collaborate on Figma designs in one place.",
  },
  {
    name: "Trello",
    logo: <Trello className="h-8 w-8" />,
    connected: false,
    desc: "Sync Trello cards for streamlined project management.",
  },
  {
    name: "Slack",
    logo: <MessageSquare className="h-8 w-8" />,
    connected: false,
    desc: "Integrate Slack for efficient team communication",
  },
  {
    name: "Zoom",
    logo: <Video className="h-8 w-8" />,
    connected: true,
    desc: "Host Zoom meetings directly from the dashboard.",
  },
  {
    name: "Stripe",
    logo: <CreditCard className="h-8 w-8" />,
    connected: false,
    desc: "Easily manage Stripe transactions and payments.",
  },
  {
    name: "Gmail",
    logo: <Mail className="h-8 w-8" />,
    connected: true,
    desc: "Access and manage Gmail messages effortlessly.",
  },
  {
    name: "Medium",
    logo: <BookOpen className="h-8 w-8" />,
    connected: false,
    desc: "Explore and share Medium stories on your dashboard.",
  },
  {
    name: "Skype",
    logo: <Phone className="h-8 w-8" />,
    connected: false,
    desc: "Connect with Skype contacts seamlessly.",
  },
  {
    name: "Docker",
    logo: <Package className="h-8 w-8" />,
    connected: false,
    desc: "Effortlessly manage Docker containers on your dashboard.",
  },
  {
    name: "GitHub",
    logo: <Github className="h-8 w-8" />,
    connected: false,
    desc: "Streamline code management with GitHub integration.",
  },
  {
    name: "GitLab",
    logo: <GitBranch className="h-8 w-8" />,
    connected: false,
    desc: "Efficiently manage code projects with GitLab integration.",
  },
  {
    name: "Discord",
    logo: <Users className="h-8 w-8" />,
    connected: false,
    desc: "Connect with Discord for seamless team communication.",
  },
  {
    name: "WhatsApp",
    logo: <MessageCircle className="h-8 w-8" />,
    connected: false,
    desc: "Easily integrate WhatsApp for direct messaging.",
  },
];
