# Nodeset Validator Tracker Dashboard

**⚠️ This project is in early development phase - features and APIs may change rapidly**

A modern web dashboard for monitoring NodeSet protocol validators on Stakewise. The application provides real-time analysis of validator performance, concentration metrics, proposals data, and sync committee participation.

**Architecture**: FastAPI backend + React frontend (migrated from Streamlit for improved performance and scalability)

## Features

- **Real-time Validator Monitoring**: Track validator performance and health status
- **Concentration Analysis**: Gini coefficient calculations and distribution metrics
- **Block Proposals Tracking**: Monitor proposal success rates and missed blocks
- **Sync Committee Participation**: Analyze committee participation patterns
- **MEV Analysis**: Relay breakdown and MEV performance insights
- **Client Diversity Analysis**: Monitor client distribution and gas limit strategies
- **Performance Categorization**: Health status indicators and performance metrics
- **Lazy Loading**: Tabs load on-demand for 10x performance improvement
- **Mobile Responsive**: Mobile-first design with touch-friendly controls

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Complete Setup (After Git Pull)
```bash
# Clone or pull the repository
git clone <repository-url>
cd react-dash

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Frontend setup
cd frontend
npm install
cd ..

# Verify data files exist
ls json_data/
```

## Quick Start

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate  # Activate virtual environment
./start_server.sh
# API available at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Frontend (React)
```bash
cd frontend
npm start
# Dashboard available at http://localhost:3000
```

## Architecture

### Current Stack
- **Backend**: FastAPI + Python
- **Frontend**: React + TypeScript + Tailwind CSS
- **Charts**: Recharts
- **API**: REST endpoints with auto-generated documentation
- **Caching**: TTL-based caching (15-60 minutes)

### Project Structure
```
react-dash/
├── backend/                           # FastAPI backend
│   ├── main.py                        # FastAPI app entry point
│   ├── routers/                       # API route handlers
│   │   ├── data.py                    # Data endpoints
│   │   ├── dashboard.py               # Dashboard analytics
│   │   └── health.py                  # Health checks
│   ├── models/                        # Pydantic response models
│   ├── services/                      # Business logic
│   ├── data_loader_api.py             # Data loading (migrated from Streamlit)
│   ├── analysis.py                    # Analytics calculations
│   ├── utils.py                       # Helper functions
│   └── requirements.txt               # Python dependencies
├── frontend/                          # React frontend
│   ├── src/
│   │   ├── components/                # React components
│   │   │   ├── tabs/                  # Tab components
│   │   │   ├── charts/                # Chart components
│   │   │   └── common/                # Shared components
│   │   ├── services/                  # API client
│   │   └── types/                     # TypeScript types
│   ├── package.json                   # Node.js dependencies
│   └── public/                        # Static assets
└── json_data/                         # JSON data files
    ├── nodeset_validator_tracker_cache.json
    ├── validator_performance_cache.json
    ├── proposals.json
    ├── sync_committee_participation.json
    ├── missed_proposals_cache.json
    ├── mev_analysis_results.json
    ├── dashboard_exit_data.json
    └── manual_ens_names.json
```

## Data Requirements

The application requires these JSON data files in the `json_data/` directory:

- `nodeset_validator_tracker_cache.json` - Primary validator data
- `validator_performance_cache.json` - Performance metrics
- `proposals.json` - Block proposals data
- `sync_committee_participation.json` - Sync committee data
- `missed_proposals_cache.json` - Missed proposals tracking
- `mev_analysis_results.json` - MEV analysis data
- `dashboard_exit_data.json` - Exit statistics
- `manual_ens_names.json` - Operator name mapping

**Note**: If these files are missing, the application will show errors. Contact the project maintainer for access to the current data files.

## API Endpoints

### Health Endpoints
- `GET /health/` - Basic health check
- `GET /health/data-files` - Data file availability

### Data Endpoints
- `GET /api/data/validator-data` - Main validator cache
- `GET /api/data/proposals` - Block proposals and MEV data
- `GET /api/data/sync-committee` - Sync committee participation
- `GET /api/data/missed-proposals` - Failed proposal tracking
- `GET /api/data/exit-data` - Exit statistics
- `GET /api/data/performance-data` - Performance metrics

### Dashboard Analytics
- `GET /api/dashboard/concentration-metrics` - Gini coefficient and distribution
- `GET /api/dashboard/performance-analysis` - Performance categorization
- `GET /api/dashboard/gas-analysis` - Gas limit strategies
- `GET /api/dashboard/client-diversity` - Client distribution analysis

## Dashboard Tabs

1. **Distribution** - Validator distribution histogram with key insights
2. **Concentration** - Network decentralisation metrics (Gini coefficient, Herfindahl index)
3. **Operators** - Top operators ranking and details
4. **Performance** - Validator performance analysis with 7d/31d periods
5. **Proposals** - Block proposals, MEV data, and missed proposals analysis
6. **Sync Committee** - Sync committee participation tracking
7. **Gas Analysis** - Gas limit strategies by operator
8. **Client Diversity** - Consensus/execution client distribution
9. **Exit Analysis** - Exit statistics and analysis
10. **Costs** - Cost analysis and metrics
11. **Information** - Raw data display and export

## Performance Improvements

- **10x faster loading** compared to original Streamlit version
- **Lazy loading** - Tabs load content only when accessed
- **Concurrent access** - Multiple users can access different endpoints
- **Smart caching** - TTL-based caching prevents redundant calculations
- **Mobile optimized** - Touch-friendly interface with responsive design

## Development

### Backend Development
```bash
cd backend
# Create virtual environment if not exists
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install/update dependencies
pip install -r requirements.txt

# Run development server
python main.py
# OR
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend
# Install/update dependencies
npm install

# Run development server
npm start

# Build for production
npm run build
```

### Testing
```bash
# Backend tests
cd backend
source venv/bin/activate
python test_api.py

# Frontend tests
cd frontend
npm test
```

### Troubleshooting
- **Backend won't start**: Check that virtual environment is activated and dependencies are installed
- **Frontend won't start**: Run `npm install` to ensure all dependencies are current
- **Data errors**: Verify all required JSON files exist in `json_data/` directory
- **API connection errors**: Ensure backend is running on port 8000 before starting frontend

## Local Development

The application runs locally on:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

## Dependencies

### Backend
- `fastapi` - Modern Python web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation and serialization
- `pandas` - Data manipulation
- `numpy` - Numerical calculations

### Frontend
- `react` - UI framework
- `typescript` - Type safety
- `recharts` - Chart library
- `tailwindcss` - Styling framework
- `axios` - HTTP client

## Migration Notes

This project was migrated from Streamlit to FastAPI + React architecture for:
- **Performance**: 10x improvement with lazy loading
- **Scalability**: Multi-user concurrent access
- **Maintainability**: Separation of concerns
- **User Experience**: Faster interactions and mobile responsiveness

All original business logic and data processing functions have been preserved in the FastAPI backend.

## Contributing

Please reach out first before contributing to ensure the latest working code is uploaded to GitHub and to discuss requirements.
