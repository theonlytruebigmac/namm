# CLAUDE.md - NAMM Development Guidelines

**Project**: NAMM - Not Another Meshtastic Monitor
**Last Updated**: January 2026
**Status**: Phase 1 - Frontend Development with Mock Data

---

## Quick Reference

### Commands
```bash
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
npm run test         # Run tests
npm run storybook    # Component development (if configured)
```

### Key Files
- `src/app/` - Next.js App Router pages
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/lib/mock/` - Mock data for demo mode
- `src/lib/api/` - API client (uses mock in Phase 1)
- `src/types/` - TypeScript type definitions
- `src/stores/` - Zustand state stores

---

## Development Rules

### General
1. **TypeScript strict mode** - No `any` types, no ignoring errors
2. **Mobile-first** - Always design for mobile first, then enhance for desktop
3. **Component isolation** - Components should be self-contained and reusable
4. **Mock data** - All API calls must work with mock data in Phase 1
5. **Accessibility** - All interactive elements need keyboard support and ARIA labels

### Code Style
```typescript
// ✅ Good - Descriptive names, proper typing
interface NodeCardProps {
  node: Node;
  onSelect: (nodeId: string) => void;
  isSelected?: boolean;
}

// ❌ Bad - Vague names, missing types
interface Props {
  data: any;
  onClick: Function;
}
```

### Component Guidelines
1. **Use Server Components** by default (no 'use client' unless needed)
2. **Add 'use client'** only for:
   - Interactive elements (onClick, onChange, etc.)
   - Browser APIs (localStorage, window, etc.)
   - React hooks (useState, useEffect, etc.)
   - Third-party client libraries (Leaflet, react-force-graph)
3. **Colocate files** - Keep related files together
4. **Export named** - Use named exports, not default exports

### Styling Rules
1. **Tailwind only** - No inline styles or CSS modules
2. **Use cn() helper** - For conditional classes
3. **Respect design tokens** - Use Catppuccin colors from theme
4. **Mobile breakpoints**:
   - Default: Mobile styles
   - `md:` - Tablet and up
   - `lg:` - Desktop and up

### State Management
1. **Server state** → TanStack Query (useQuery, useMutation)
2. **Client UI state** → Zustand stores
3. **Form state** → React Hook Form
4. **URL state** → Next.js searchParams

---

## Architecture Patterns

### API Layer (Phase 1 - Mock Mode)
```typescript
// lib/api/nodes.ts
import { mockNodes } from '@/lib/mock/nodes';

export async function getNodes(): Promise<Node[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockNodes;
}

export async function getNode(id: string): Promise<Node | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockNodes.find(n => n.id === id) || null;
}
```

### Hooks Pattern
```typescript
// hooks/useNodes.ts
import { useQuery } from '@tanstack/react-query';
import { getNodes } from '@/lib/api/nodes';

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    refetchInterval: 30000, // Poll every 30s
  });
}
```

### Component Pattern
```typescript
// components/nodes/NodeCard.tsx
'use client';

import { Card } from '@/components/ui/card';
import { type Node } from '@/types/node';
import { cn } from '@/lib/utils';

interface NodeCardProps {
  node: Node;
  isSelected?: boolean;
  onSelect?: (node: Node) => void;
}

export function NodeCard({ node, isSelected, onSelect }: NodeCardProps) {
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-colors',
        'hover:bg-accent',
        isSelected && 'border-primary bg-accent'
      )}
      onClick={() => onSelect?.(node)}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-mono">{node.shortName}</span>
        <span className="text-muted-foreground">{node.longName}</span>
      </div>
    </Card>
  );
}
```

---

## Responsive Design Checklist

Before marking any component complete:

- [ ] Works on iPhone SE (320px width)
- [ ] Works on iPhone 14 (390px width)
- [ ] Works on iPad (768px width)
- [ ] Works on laptop (1024px width)
- [ ] Works on desktop (1440px width)
- [ ] Touch targets are at least 44x44px
- [ ] Text is readable without zooming
- [ ] No horizontal scrolling on mobile
- [ ] Bottom nav is visible on mobile
- [ ] Sidebar collapses correctly

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `NodeCard.tsx` |
| Hooks | camelCase with `use` prefix | `useNodes.ts` |
| Utils | camelCase | `formatTime.ts` |
| Types | PascalCase | `Node.ts` or in `types/` |
| Constants | SCREAMING_SNAKE_CASE | `API_ENDPOINTS.ts` |
| Mock data | camelCase | `mockNodes.ts` |

---

## Type Definitions

### Core Types (Must be defined in `/src/types/`)

```typescript
// types/node.ts
export interface Node {
  id: string;                    // e.g., "!abcd1234"
  nodeNum: number;               // Numeric ID
  shortName: string;             // 4-char display name
  longName: string;              // Full node name
  hwModel: string;               // Hardware model
  role: NodeRole;                // Device role
  batteryLevel?: number;         // 0-100
  voltage?: number;              // Battery voltage
  snr?: number;                  // Signal-to-noise ratio
  rssi?: number;                 // Signal strength
  lastHeard: number;             // Unix timestamp ms
  position?: Position;           // GPS coordinates
  hopsAway?: number;             // Network distance
  isMobile?: boolean;            // Detected mobility
  isFavorite?: boolean;          // User favorite
}

export type NodeRole =
  | 'CLIENT'
  | 'CLIENT_MUTE'
  | 'ROUTER'
  | 'ROUTER_CLIENT'
  | 'REPEATER'
  | 'TRACKER'
  | 'SENSOR'
  | 'TAK'
  | 'CLIENT_HIDDEN'
  | 'LOST_AND_FOUND'
  | 'TAK_TRACKER';

export interface Position {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
}

// types/message.ts
export interface Message {
  id: string;
  fromNode: string;              // Node ID
  toNode: string;                // Node ID or 'broadcast'
  text: string;
  channel: number;               // Channel index
  timestamp: number;             // Unix timestamp ms
  reactions?: Reaction[];
  replyTo?: string;              // Message ID being replied to
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
}

export interface Reaction {
  emoji: string;
  fromNodes: string[];           // Node IDs who reacted
}

// types/channel.ts
export interface Channel {
  index: number;                 // 0-7
  name: string;
  psk?: string;                  // Base64 encoded
  isEncrypted: boolean;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
  unreadCount?: number;
}

// types/telemetry.ts
export interface TelemetryData {
  timestamp: number;
  nodeId: string;
  type: TelemetryType;
  value: number;
}

export type TelemetryType =
  | 'batteryLevel'
  | 'voltage'
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'channelUtilization'
  | 'airUtilTx';
```

---

## Mock Data Requirements

All mock data should:
1. Be realistic (based on actual Meshtastic networks)
2. Include edge cases (offline nodes, empty channels, etc.)
3. Support filtering and pagination
4. Be easily extensible
5. Have timestamps that make sense (recent activity)

### Mock Data Location
```
src/lib/mock/
├── nodes.ts           # 20-50 sample nodes
├── messages.ts        # 100+ sample messages
├── channels.ts        # 8 channels (0-7)
├── telemetry.ts       # Historical telemetry data
├── traceroutes.ts     # Sample traceroute paths
└── index.ts           # Export all mocks
```

---

## Performance Guidelines

1. **Images**: Use Next.js `<Image>` with proper sizing
2. **Lists**: Virtualize lists with >50 items (react-virtual)
3. **Maps**: Lazy load Leaflet (dynamic import with SSR disabled)
4. **Graphs**: Limit nodes displayed, use canvas rendering
5. **Animations**: Use `transform` and `opacity` only
6. **Bundle**: Keep main bundle <200KB gzipped

---

## Testing Strategy

### Unit Tests (Vitest)
- Test utility functions
- Test custom hooks with react-testing-library
- Test Zustand stores

### Component Tests
- Test critical user flows
- Test responsive behavior
- Test loading and error states

### E2E Tests (Playwright - Phase 2)
- Test complete user journeys
- Test across different viewports
- Test with mock API

---

## Common Pitfalls to Avoid

1. **Don't** use `window` or `document` without checking for SSR
2. **Don't** use `index` as React key for dynamic lists
3. **Don't** mutate state directly (especially in Zustand)
4. **Don't** forget to handle loading/error states
5. **Don't** hardcode colors - use Tailwind theme
6. **Don't** forget mobile testing
7. **Don't** use synchronous localStorage in render

---

## Reference: Catppuccin Mocha Theme

```css
/* Primary colors */
--rosewater: #f5e0dc;
--flamingo: #f2cdcd;
--pink: #f5c2e7;
--mauve: #cba6f7;      /* Primary accent */
--red: #f38ba8;
--maroon: #eba0ac;
--peach: #fab387;
--yellow: #f9e2af;
--green: #a6e3a1;      /* Success */
--teal: #94e2d5;
--sky: #89dceb;
--sapphire: #74c7ec;
--blue: #89b4fa;       /* Links */
--lavender: #b4befe;

/* Base colors */
--text: #cdd6f4;
--subtext1: #bac2de;
--subtext0: #a6adc8;
--overlay2: #9399b2;
--overlay1: #7f849c;
--overlay0: #6c7086;
--surface2: #585b70;
--surface1: #45475a;
--surface0: #313244;
--base: #1e1e2e;       /* Background */
--mantle: #181825;
--crust: #11111b;
```

---

## Need Help?

1. Check this document first
2. Review existing similar components
3. Check the project plan: `NAMM_PROJECT_PLAN.md`
4. Look at meshmonitor/stridetastic for feature reference

---

*Remember: Phase 1 is frontend-only with mock data. All features should work completely without a real backend.*
