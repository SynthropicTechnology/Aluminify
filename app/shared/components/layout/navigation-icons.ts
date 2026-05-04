import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  MessageSquare,
  LayoutDashboard,
  BookOpen,
  Circle,
  Clock,
  Library,
  Layers,
  Bot,
  School,
  BrainCircuit,
  User,
  Users,
  Settings,
  FolderOpen,
  DollarSign,
  GraduationCap,
  UserCog,
  MoreHorizontal,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Shared icon mapping used by both desktop sidebar and mobile bottom navigation.
 * Maps icon name strings (from module-visibility API) to Lucide components.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  Calendar,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  MessageSquare,
  Clock,
  Library,
  Layers,
  Bot,
  School,
  BrainCircuit,
  User,
  Users,
  Settings,
  FolderOpen,
  DollarSign,
  GraduationCap,
  UserCog,
  MoreHorizontal,
}

/**
 * Get icon component from icon name string.
 * Falls back to Circle if icon not found in the map.
 */
export function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Circle
}
