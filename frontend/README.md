# NodeSet Validator Dashboard - Frontend

A modern React TypeScript frontend for the NodeSet validator monitoring dashboard, providing real-time analysis of validator performance, concentration metrics, and network health.

## Overview

This React application provides a high-performance, mobile-responsive interface that connects to a FastAPI backend. The frontend features lazy loading, modern UI components, and comprehensive validator analytics.

## Features

### 🚀 Performance
- **Lazy Loading**: Tabs load only when accessed for optimal performance
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Efficient Caching**: Smart API caching with React Query (future enhancement)

### 📊 Dashboard Tabs
- **Distribution**: Validator distribution histogram with key insights
- **Concentration**: Network decentralisation metrics (Gini coefficient, Herfindahl index)
- **Operators**: Complete operator rankings with exit data and CSV export
- **Performance**: Attestation performance analysis (7d/31d periods)
- **Proposals**: Block proposals, MEV analysis, and missed proposals tracking
- **Sync Committee**: Participation analysis and validator performance
- **Gas Analysis**: Gas limit strategies by operator (planned)
- **Client Diversity**: Consensus/execution client distribution (planned)
- **Exit Analysis**: Exit statistics and trends (planned)
- **Costs**: Cost analysis dashboard (planned)
- **Raw Data**: Direct access to JSON data (planned)

### 🎨 Modern UI
- **Glass Morphism**: Modern glass-effect design
- **Dark Theme**: Professional dark theme with accent colors
- **Interactive Charts**: Recharts-powered visualizations
- **Responsive Tables**: Sortable, searchable data tables
- **Loading States**: Smooth loading animations and error handling

## Technology Stack

- **React 19**: Latest React with concurrent features
- **TypeScript**: Full type safety and IntelliSense
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Responsive chart library
- **Axios**: HTTP client with interceptors
- **React Query**: Data fetching and caching (future)

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- FastAPI backend running on port 8000

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:3000`

### Environment Configuration

Create a `.env` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:8000
```

For remote access, use your server's IP:
```env
REACT_APP_API_URL=http://192.168.1.100:8000
```

## Development

### Available Scripts

```bash
# Development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Type checking (if configured)
npx tsc --noEmit
```

### Project Structure

```
src/
├── components/
│   ├── charts/          # Reusable chart components
│   ├── common/          # Shared UI components
│   └── tabs/            # Dashboard tab components
├── hooks/               # Custom React hooks
├── services/            # API service layer
├── types/               # TypeScript type definitions
└── App.tsx              # Main application component
```

### Adding New Tabs

1. Create component in `src/components/tabs/`
2. Add to `TabNavigation.tsx`
3. Import in `App.tsx`
4. Add API service method if needed

## API Integration

The frontend connects to the FastAPI backend via the `ApiService` class:

```typescript
// Example API call
const data = await apiService.getValidatorData();
```

### API Endpoints Used
- `/health/` - Backend health check
- `/api/data/validator-data` - Main validator data
- `/api/dashboard/concentration-metrics` - Concentration analysis
- `/api/dashboard/performance-analysis` - Performance metrics
- Additional endpoints for each dashboard feature

## Performance Optimizations

### Lazy Loading
- Tabs render only when accessed
- Prevents eager loading of all 11 tabs
- Reduces initial bundle size and load time

### Caching Strategy
- Browser caching for static assets
- API response caching (planned with React Query)
- Smart cache invalidation

### Bundle Optimization
- Code splitting by route
- Tree shaking for unused code
- Optimized production builds

## Remote Access

For remote access across networks:

1. **Configure API URL**:
   ```env
   REACT_APP_API_URL=http://YOUR_SERVER_IP:8000
   ```

2. **Start with host binding**:
   ```bash
   npm start -- --host 0.0.0.0
   ```

3. **Access from any device**:
   ```
   http://YOUR_SERVER_IP:3000
   ```

See `REMOTE_ACCESS_SETUP.md` for detailed instructions.

## Build & Deployment

### Production Build
```bash
npm run build
```

Creates optimized production build in `build/` directory.

### Deployment Options
- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **Docker**: Containerized deployment
- **Nginx**: Reverse proxy setup
- **CDN**: CloudFront, CloudFlare

## Data Requirements

The frontend expects the FastAPI backend to be running with access to:
- `nodeset_validator_tracker_cache.json`
- `validator_performance_cache.json`
- `proposals.json`
- `sync_committee_participation.json`
- `dashboard_exit_data.json`
- Additional JSON data files

## Architecture

This application follows a modern React architecture:

### Key Benefits
- **Fast Loading**: Lazy loading and optimized bundle size
- **Better UX**: Smooth transitions and loading states
- **Mobile Support**: Responsive design for all devices
- **Scalability**: Multi-user support and concurrent access
- **Modern Tech**: Latest React ecosystem and TypeScript

### Core Features
- Real-time validator analytics and performance metrics
- Interactive charts and data visualizations
- Comprehensive operator analysis and rankings
- Export capabilities for data analysis
- Professional UI with glass morphism design

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is part of the NodeSet validator monitoring system.

## Support

For issues and questions:
- Check the backend logs at `http://localhost:8000/docs`
- Verify API connectivity in browser developer tools
- Review the main project documentation for architecture details