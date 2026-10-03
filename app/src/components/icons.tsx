// Lucide icon paths (lucide.dev), inlined so the app needs no icon package.
import type { ReactNode } from 'react';

function Icon({ size = 22, width = 2, cap = 'round', children }: { size?: number; width?: number; cap?: 'round' | 'square'; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
      strokeLinecap={cap} strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const ArrowLeft = () => <Icon><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></Icon>;
export const X = () => <Icon><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
export const Plus = () => <Icon size={28} width={2.5} cap="square"><path d="M5 12h14" /><path d="M12 5v14" /></Icon>;
export const House = () => (
  <Icon>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
);
export const List = () => <Icon><path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13" /></Icon>;
export const Chart = () => <Icon><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></Icon>;
export const Target = () => <Icon><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Icon>;
export const ImagePlus = () => (
  <Icon size={20} width={1.75}>
    <path d="M16 5h6" /><path d="M19 2v6" />
    <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /><circle cx="9" cy="9" r="2" />
  </Icon>
);
export const Gear = () => (
  <Icon>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const ChevronRight = () => <Icon size={20}><path d="m9 18 6-6-6-6" /></Icon>;
export const XSmall = () => <Icon size={20}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
export const MessageCircle = () => <Icon><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></Icon>;
export const ChevronDown = () => <Icon size={20}><path d="m6 9 6 6 6-6" /></Icon>;
export const LinkIcon = ({ size = 16 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);
export const Info = () => <Icon size={16}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Icon>;
export const Send = () => <Icon><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon>;
export const Timer = () => <Icon><line x1="10" x2="14" y1="2" y2="2" /><line x1="12" x2="15" y1="14" y2="11" /><circle cx="12" cy="14" r="8" /></Icon>;
export const Search = () => <Icon size={18}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>;
