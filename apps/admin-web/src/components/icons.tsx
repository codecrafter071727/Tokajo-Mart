import type { SVGProps } from "react";
import {
  AlertTriangle,
  Bike,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Users,
  Warehouse,
  X,
  type IconComponent,
} from "./ui/icons";

/** Short names for the icons older screens use. New code imports the named icons from ./ui/icons. */
const ICONS = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  catalog: Tag,
  banners: Megaphone,
  inventory: Boxes,
  warehouses: Warehouse,
  riders: Bike,
  customers: Users,
  team: ShieldCheck,
  logout: LogOut,
  close: X,
  plus: Plus,
  search: Search,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  inbox: Inbox,
  alert: AlertTriangle,
  check: Check,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name" | "children">) {
  const Component = ICONS[name];
  return <Component size={size} {...rest} />;
}
