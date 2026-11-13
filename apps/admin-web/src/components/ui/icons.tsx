import type { SVGProps } from "react";

/**
 * Stroke icons in the Lucide style (24px grid, 2px round strokes, ISC licensed shapes), drawn inline
 * so the console ships no icon package. Each export has Lucide's name, so swapping to lucide-react
 * later is one import change.
 */
type Node =
  | ["path", string]
  | ["circle", number, number, number]
  | ["rect", number, number, number, number, number?]
  | ["line", number, number, number, number]
  | ["polyline", string];

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number | string;
  strokeWidth?: number | string;
};
export type IconComponent = (props: IconProps) => React.JSX.Element;

function make(displayName: string, nodes: Node[]): IconComponent {
  const IconSvg = ({ size = 24, strokeWidth = 2, className, ...rest }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest["aria-label"] ? undefined : true}
      className={className}
      {...rest}
    >
      {nodes.map((n, i) => {
        switch (n[0]) {
          case "path":
            return <path key={i} d={n[1]} />;
          case "circle":
            return <circle key={i} cx={n[1]} cy={n[2]} r={n[3]} />;
          case "rect":
            return <rect key={i} x={n[1]} y={n[2]} width={n[3]} height={n[4]} rx={n[5] ?? 0} />;
          case "line":
            return <line key={i} x1={n[1]} y1={n[2]} x2={n[3]} y2={n[4]} />;
          case "polyline":
            return <polyline key={i} points={n[1]} />;
        }
      })}
    </svg>
  );
  IconSvg.displayName = displayName;
  return IconSvg;
}

export const LayoutDashboard = make("LayoutDashboard", [
  ["rect", 3, 3, 7, 9, 1],
  ["rect", 14, 3, 7, 5, 1],
  ["rect", 14, 12, 7, 9, 1],
  ["rect", 3, 16, 7, 5, 1],
]);
export const ShoppingBag = make("ShoppingBag", [
  ["path", "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"],
  ["path", "M3 6h18"],
  ["path", "M16 10a4 4 0 0 1-8 0"],
]);
export const Package = make("Package", [
  [
    "path",
    "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
  ],
  ["path", "M12 22V12"],
  ["path", "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"],
  ["path", "m7.5 4.27 9 5.15"],
]);
export const PackageCheck = make("PackageCheck", [
  ["path", "m16 16 2 2 4-4"],
  [
    "path",
    "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
  ],
  ["path", "m7.5 4.27 9 5.15"],
  ["polyline", "3.29 7 12 12 20.71 7"],
  ["line", 12, 22, 12, 12],
]);
export const Boxes = make("Boxes", [
  ["rect", 2, 13, 9, 8, 1],
  ["rect", 13, 13, 9, 8, 1],
  ["rect", 7.5, 3, 9, 8, 1],
]);
export const Tag = make("Tag", [
  [
    "path",
    "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",
  ],
  ["circle", 7.5, 7.5, 0.5],
]);
export const ImageIcon = make("Image", [
  ["rect", 3, 3, 18, 18, 2],
  ["circle", 9, 9, 2],
  ["path", "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"],
]);
export const Megaphone = make("Megaphone", [
  ["path", "m3 11 18-5v12L3 14v-3z"],
  ["path", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
]);
export const Warehouse = make("Warehouse", [
  [
    "path",
    "M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z",
  ],
  ["path", "M6 18h12"],
  ["path", "M6 14h12"],
  ["rect", 6, 10, 12, 12],
]);
export const Store = make("Store", [
  ["path", "m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"],
  ["path", "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"],
  ["path", "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"],
  ["path", "M2 7h20"],
  [
    "path",
    "M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7",
  ],
]);
export const Bike = make("Bike", [
  ["circle", 18.5, 17.5, 3.5],
  ["circle", 5.5, 17.5, 3.5],
  ["circle", 15, 5, 1],
  ["path", "M12 17.5V14l-3-3 4-3 2 3h2"],
]);
export const Truck = make("Truck", [
  ["path", "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"],
  ["path", "M15 18H9"],
  ["path", "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"],
  ["circle", 17, 18, 2],
  ["circle", 7, 18, 2],
]);
export const Users = make("Users", [
  ["path", "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"],
  ["circle", 9, 7, 4],
  ["path", "M22 21v-2a4 4 0 0 0-3-3.87"],
  ["path", "M16 3.13a4 4 0 0 1 0 7.75"],
]);
export const UserCog = make("UserCog", [
  ["circle", 18, 15, 3],
  ["circle", 9, 7, 4],
  ["path", "M10 15H6a4 4 0 0 0-4 4v2"],
  ["path", "m21.7 16.4-.9-.3"],
  ["path", "m15.2 13.9-.9-.3"],
  ["path", "m16.6 18.7.3-.9"],
  ["path", "m19.1 12.2.3-.9"],
  ["path", "m19.6 18.7-.4-1"],
  ["path", "m16.8 12.3-.4-1"],
  ["path", "m14.3 16.6 1-.4"],
  ["path", "m20.7 13.8 1-.4"],
]);
export const ShieldCheck = make("ShieldCheck", [
  [
    "path",
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  ],
  ["path", "m9 12 2 2 4-4"],
]);
export const Bell = make("Bell", [
  ["path", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"],
  ["path", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
]);
export const Search = make("Search", [
  ["circle", 11, 11, 8],
  ["path", "m21 21-4.3-4.3"],
]);
export const Menu = make("Menu", [
  ["line", 4, 12, 20, 12],
  ["line", 4, 6, 20, 6],
  ["line", 4, 18, 20, 18],
]);
export const X = make("X", [
  ["path", "M18 6 6 18"],
  ["path", "m6 6 12 12"],
]);
export const Check = make("Check", [["path", "M20 6 9 17l-5-5"]]);
export const ChevronLeft = make("ChevronLeft", [["path", "m15 18-6-6 6-6"]]);
export const ChevronRight = make("ChevronRight", [["path", "m9 18 6-6-6-6"]]);
export const ChevronDown = make("ChevronDown", [["path", "m6 9 6 6 6-6"]]);
export const ChevronUp = make("ChevronUp", [["path", "m18 15-6-6-6 6"]]);
export const ChevronsUpDown = make("ChevronsUpDown", [
  ["path", "m7 15 5 5 5-5"],
  ["path", "m7 9 5-5 5 5"],
]);
export const LogOut = make("LogOut", [
  ["path", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"],
  ["polyline", "16 17 21 12 16 7"],
  ["line", 21, 12, 9, 12],
]);
export const Sun = make("Sun", [
  ["circle", 12, 12, 4],
  ["path", "M12 2v2"],
  ["path", "M12 20v2"],
  ["path", "m4.93 4.93 1.41 1.41"],
  ["path", "m17.66 17.66 1.41 1.41"],
  ["path", "M2 12h2"],
  ["path", "M20 12h2"],
  ["path", "m6.34 17.66-1.41 1.41"],
  ["path", "m19.07 4.93-1.41 1.41"],
]);
export const Moon = make("Moon", [["path", "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"]]);
export const Monitor = make("Monitor", [
  ["rect", 2, 3, 20, 14, 2],
  ["line", 8, 21, 16, 21],
  ["line", 12, 17, 12, 21],
]);
export const Loader2 = make("Loader2", [["path", "M21 12a9 9 0 1 1-6.219-8.56"]]);
export const Plus = make("Plus", [
  ["path", "M5 12h14"],
  ["path", "M12 5v14"],
]);
export const Minus = make("Minus", [["path", "M5 12h14"]]);
export const Pencil = make("Pencil", [
  [
    "path",
    "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
  ],
  ["path", "m15 5 4 4"],
]);
export const Trash2 = make("Trash2", [
  ["path", "M3 6h18"],
  ["path", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"],
  ["path", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"],
  ["line", 10, 11, 10, 17],
  ["line", 14, 11, 14, 17],
]);
export const Archive = make("Archive", [
  ["rect", 2, 3, 20, 5, 1],
  ["path", "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"],
  ["path", "M10 12h4"],
]);
export const RotateCcw = make("RotateCcw", [
  ["path", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"],
  ["path", "M3 3v5h5"],
]);
export const RefreshCw = make("RefreshCw", [
  ["path", "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"],
  ["path", "M21 3v5h-5"],
  ["path", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"],
  ["path", "M8 16H3v5"],
]);
export const AlertTriangle = make("AlertTriangle", [
  ["path", "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"],
  ["path", "M12 9v4"],
  ["path", "M12 17h.01"],
]);
export const AlertCircle = make("AlertCircle", [
  ["circle", 12, 12, 10],
  ["line", 12, 8, 12, 12],
  ["line", 12, 16, 12.01, 16],
]);
export const Info = make("Info", [
  ["circle", 12, 12, 10],
  ["path", "M12 16v-4"],
  ["path", "M12 8h.01"],
]);
export const CheckCircle2 = make("CheckCircle2", [
  ["circle", 12, 12, 10],
  ["path", "m9 12 2 2 4-4"],
]);
export const XCircle = make("XCircle", [
  ["circle", 12, 12, 10],
  ["path", "m15 9-6 6"],
  ["path", "m9 9 6 6"],
]);
export const Ban = make("Ban", [
  ["circle", 12, 12, 10],
  ["path", "m4.9 4.9 14.2 14.2"],
]);
export const Clock = make("Clock", [
  ["circle", 12, 12, 10],
  ["polyline", "12 6 12 12 16 14"],
]);
export const Timer = make("Timer", [
  ["line", 10, 2, 14, 2],
  ["line", 12, 14, 15, 11],
  ["circle", 12, 14, 8],
]);
export const History = make("History", [
  ["path", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"],
  ["path", "M3 3v5h5"],
  ["path", "M12 7v5l4 2"],
]);
export const TrendingUp = make("TrendingUp", [
  ["polyline", "22 7 13.5 15.5 8.5 10.5 2 17"],
  ["polyline", "16 7 22 7 22 13"],
]);
export const TrendingDown = make("TrendingDown", [
  ["polyline", "22 17 13.5 8.5 8.5 13.5 2 7"],
  ["polyline", "16 17 22 17 22 11"],
]);
export const IndianRupee = make("IndianRupee", [
  ["path", "M6 3h12"],
  ["path", "M6 8h12"],
  ["path", "m6 13 8.5 8"],
  ["path", "M6 13h3"],
  ["path", "M9 13c6.667 0 6.667-10 0-10"],
]);
export const Percent = make("Percent", [
  ["line", 19, 5, 5, 19],
  ["circle", 6.5, 6.5, 2.5],
  ["circle", 17.5, 17.5, 2.5],
]);
export const Receipt = make("Receipt", [
  ["path", "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"],
  ["path", "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"],
  ["path", "M12 17.5v-11"],
]);
export const Inbox = make("Inbox", [
  ["polyline", "22 12 16 12 14 15 10 15 8 12 2 12"],
  [
    "path",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  ],
]);
export const ArrowUpRight = make("ArrowUpRight", [
  ["path", "M7 7h10v10"],
  ["path", "M7 17 17 7"],
]);
export const ArrowRight = make("ArrowRight", [
  ["path", "M5 12h14"],
  ["path", "m12 5 7 7-7 7"],
]);
export const ExternalLink = make("ExternalLink", [
  ["path", "M15 3h6v6"],
  ["path", "M10 14 21 3"],
  ["path", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
]);
export const Filter = make("Filter", [["path", "M22 3H2l8 9.46V19l4 2v-8.54L22 3z"]]);
export const MoreHorizontal = make("MoreHorizontal", [
  ["circle", 12, 12, 1],
  ["circle", 19, 12, 1],
  ["circle", 5, 12, 1],
]);
export const Layers = make("Layers", [
  [
    "path",
    "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
  ],
  ["path", "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"],
  ["path", "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"],
]);
export const MapPin = make("MapPin", [
  ["path", "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"],
  ["circle", 12, 10, 3],
]);
export const Phone = make("Phone", [
  [
    "path",
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  ],
]);
export const Mail = make("Mail", [
  ["rect", 2, 4, 20, 16, 2],
  ["path", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
]);
export const KeyRound = make("KeyRound", [
  [
    "path",
    "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
  ],
  ["circle", 16.5, 7.5, 0.5],
]);
export const Eye = make("Eye", [
  [
    "path",
    "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
  ],
  ["circle", 12, 12, 3],
]);
export const EyeOff = make("EyeOff", [
  [
    "path",
    "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
  ],
  ["path", "M14.084 14.158a3 3 0 0 1-4.242-4.242"],
  [
    "path",
    "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
  ],
  ["path", "m2 2 20 20"],
]);
export const Activity = make("Activity", [
  [
    "path",
    "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",
  ],
]);
export const Zap = make("Zap", [
  [
    "path",
    "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  ],
]);
export const Star = make("Star", [
  [
    "path",
    "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
  ],
]);
export const ArrowUp = make("ArrowUp", [
  ["path", "m5 12 7-7 7 7"],
  ["path", "M12 19V5"],
]);
export const ArrowDown = make("ArrowDown", [
  ["path", "M12 5v14"],
  ["path", "m19 12-7 7-7-7"],
]);
export const Calendar = make("Calendar", [
  ["path", "M8 2v4"],
  ["path", "M16 2v4"],
  ["rect", 3, 4, 18, 18, 2],
  ["path", "M3 10h18"],
]);
export const Palette = make("Palette", [
  ["circle", 13.5, 6.5, 0.5],
  ["circle", 17.5, 10.5, 0.5],
  ["circle", 8.5, 7.5, 0.5],
  ["circle", 6.5, 12.5, 0.5],
  [
    "path",
    "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z",
  ],
]);
export const CreditCard = make("CreditCard", [
  ["rect", 2, 5, 20, 14, 2],
  ["line", 2, 10, 22, 10],
]);
export const Circle = make("Circle", [["circle", 12, 12, 10]]);

export type { Node as IconNode };
