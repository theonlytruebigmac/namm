# NAMM - Not Another Meshtastic Monitor

> A modern, feature-rich web application for monitoring Meshtastic mesh networks

[![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

## Features

### Dashboard
- Real-time network statistics
- Live activity feed with SSE streaming
- Quick access to recent nodes and messages
- Customizable stat cards

### Interactive Map
- **Multiple map layers**: Street, Satellite, Terrain
- **Custom markers**: Color-coded by node role
- **Range circles**: Visualize node coverage (5-10km)
- **Signal lines**: Show connections between nodes
- **Marker clustering**: Handle dense networks gracefully
- **Detailed popups**: Node info, battery, GPS coordinates

### Network Graph
- Force-directed node layout
- Interactive zoom and pan
- Color-coded nodes by role
- Animated signal flow between nodes
- Click to select and view details

### Nodes Management
- Grid view with filtering and search
- Filter by role (Router, Client, Repeater, etc.)
- Filter by status (Online/Offline)
- Export to CSV or JSON
- Detailed node sheets with full telemetry

### Messages
- Real-time message feed
- Channel switching
- Message composition
- Timestamp formatting

### Telemetry
- **Battery trends**: Line chart over time
- **Signal quality**: Area chart with SNR/RSSI
- **Channel utilization**: Bar chart comparison
- **Node status**: Pie chart distribution

### Settings
- **Connection**: Configurable API endpoint, connection type
- **Notifications**: Browser alerts for messages, node status, low battery
- **Appearance**: Dark/light theme, compact mode
- **Map**: Default layer, labels, clustering, auto-center
- **Privacy**: Message storage, analytics, data management

### Notifications
- Browser notifications with permission management
- Web Audio API sound alerts
- Configurable triggers (messages, status, battery)
- Auto-dismiss or require interaction

## Quick Start

### Prerequisites
- Node.js 20+
- npm/yarn/pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/theonlytruebigmac/namm.git
cd namm

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.1.1 | React framework with App Router |
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **TanStack Query** | 5.90.16 | Data fetching & caching |
| **Leaflet** | 1.9.4 | Interactive maps |
| **react-force-graph** | 1.29.0 | Network visualization |
| **Recharts** | 3.6.0 | Charts and graphs |
| **Radix UI** | Latest | Accessible components |
| **Zustand** | 5.0.9 | State management |

## Project Structure

```
namm/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Dashboard
│   │   ├── map/               # Interactive map
│   │   ├── nodes/             # Node management
│   │   ├── messages/          # Message feed
│   │   ├── network/           # Network graph
│   │   ├── telemetry/         # Charts & metrics
│   │   └── settings/          # Configuration
│   ├── components/
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── map/               # Map components
│   │   ├── network/           # Graph components
│   │   ├── nodes/             # Node components
│   │   ├── telemetry/         # Chart components
│   │   ├── layout/            # Layout components
│   │   └── ui/                # Reusable UI components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── api/              # API client layer
│   │   ├── mock/             # Mock data (Phase 1)
│   │   ├── export.ts         # Data export utilities
│   │   ├── notifications.ts  # Browser notifications
│   │   └── settings.ts       # Settings management
│   └── types/                # TypeScript definitions
├── docs/                     # Documentation
└── public/                   # Static assets
```

## Features in Detail

### Real-Time Updates
- Server-Sent Events (SSE) for live data streaming
- Automatic reconnection on disconnect
- Event types: node updates, new messages, position changes
- Connection status indicator

### Data Export
- Export nodes to CSV or JSON
- Export messages with timestamps
- Network snapshot export
- Quote-escaped CSV for safety

### Responsive Design
- Mobile-first approach
- Sidebar navigation on desktop
- Bottom navigation on mobile
- Touch-optimized interactions

### Accessibility
- WCAG AA compliant
- Keyboard navigation support
- ARIA labels throughout
- Focus indicators
- Screen reader friendly

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4403
NEXT_PUBLIC_USE_REAL_API=false

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### Settings

All settings are configurable through the UI and persist in localStorage:
- **API Endpoint**: Configure your Meshtastic backend URL
- **Connection Type**: HTTP, MQTT, Serial, or BLE
- **Notifications**: Enable/disable alerts and sounds
- **Theme**: Dark or light mode
- **Compact Mode**: Dense layout for power users

## Documentation

- [Checkpoint Review](docs/CHECKPOINT_REVIEW.md) - Current project status
- [Phase 1 Implementation](docs/PHASE1_IMPLEMENTATION.md) - Initial UI setup
- [Phase 2 Integration](docs/PHASE2.md) - Backend integration guide
- [Phase 3 Visualizations](docs/PHASE3_COMPLETE.md) - Map, graph, charts
- [Phase 4 Real-Time](docs/PHASE4_REALTIME.md) - SSE and live features
- [Settings System](docs/SETTINGS_IMPLEMENTATION.md) - Settings architecture
- [Settings Integration](docs/SETTINGS_INTEGRATION.md) - Component integration
- [Development Guide](docs/CLAUDE.md) - Development guidelines

## Current Status

**Version:** 1.0.0-alpha
**Status:** Production Ready (Mock Mode)

### Completed
- [x] All 7 pages fully functional
- [x] Interactive map with layers and clustering
- [x] Network force-directed graph
- [x] Telemetry charts (4 types)
- [x] Real-time event streaming (SSE)
- [x] Browser notifications
- [x] Data export (CSV/JSON)
- [x] Settings system with persistence
- [x] Dark/light theme
- [x] Responsive mobile design
- [x] Zero TypeScript errors

### In Progress
- [ ] Real backend integration
- [ ] Unit tests with Vitest
- [ ] E2E tests
- [ ] Storybook stories

### Planned
- [ ] WebSocket support
- [ ] Message threading
- [ ] Traceroute visualization
- [ ] Custom telemetry metrics
- [ ] Bulk node operations
- [ ] Docker deployment

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Scripts

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

## Known Issues

- Browser notifications require HTTPS in production
- Safari iOS has limited notification support
- Mock data uses fixed set of 12 nodes

## Roadmap

### v1.0 (Current - Mock Mode)
- Complete UI implementation
- Mock data system
- All visualizations
- Settings and notifications

### v1.1 (Next - Real Backend)
- Real Meshtastic API integration
- WebSocket live updates
- Message history persistence
- Error handling and retry logic

### v1.2 (Future)
- Message threading
- Traceroute visualization
- Custom metrics
- Bulk operations

### v2.0 (Long Term)
- Multi-user support
- Plugin system
- Mobile app (React Native)
- Advanced analytics

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Meshtastic](https://meshtastic.org/) - The mesh network protocol
- [Next.js](https://nextjs.org/) - The React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Leaflet](https://leafletjs.com/) - Interactive maps

## Contact

- GitHub Issues: [Report a bug](https://github.com/theonlytruebigmac/namm/issues)
- Discussions: [Ask questions](https://github.com/theonlytruebigmac/namm/discussions)

---

**Built for the Meshtastic community**
