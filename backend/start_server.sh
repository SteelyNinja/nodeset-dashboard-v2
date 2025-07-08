#!/bin/bash
# FastAPI Backend Startup Script

echo "🚀 Starting NodeSet FastAPI Backend..."
echo "==========================================="

# Activate virtual environment
source venv/bin/activate

# Check if requirements are installed
echo "📦 Checking dependencies..."
pip list | grep -E "(fastapi|uvicorn|pydantic)" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Dependencies are installed"
else
    echo "❌ Dependencies missing. Installing..."
    pip install -r requirements.txt
fi

# Handle environment configuration
if [ "$1" = "production" ]; then
    echo "🚀 Starting in PRODUCTION mode..."
    export ENVIRONMENT=production
    if [ -f ".env.production" ]; then
        cp .env.production .env
    else
        echo "⚠️  .env.production not found, using current .env"
    fi
elif [ "$1" = "local" ]; then
    echo "🧪 Starting in LOCAL mode..."
    export ENVIRONMENT=local
else
    echo "🧪 Starting in LOCAL mode (default)..."
    export ENVIRONMENT=local
fi

# Show current configuration
echo "Environment: ${ENVIRONMENT:-local}"
if [ -f ".env" ]; then
    echo "ClickHouse Host: $(grep CLICKHOUSE_HOST .env | cut -d'=' -f2)"
    echo "ClickHouse Enabled: $(grep CLICKHOUSE_ENABLED .env | cut -d'=' -f2)"
fi

# Check data files
echo "📄 Checking data files..."
check_file_exists() {
    local filename=$1
    local locations=(
        "./$filename"
        "./json_data/$filename"
        "./data/$filename"
        "../$filename"
        "../json_data/$filename"
    )
    
    for location in "${locations[@]}"; do
        if [ -f "$location" ]; then
            return 0
        fi
    done
    return 1
}

data_files=(
    "nodeset_validator_tracker_cache.json"
    "validator_performance_cache.json"
    "proposals.json"
    "sync_committee_participation.json"
    "mev_analysis_results.json"
    "missed_proposals_cache.json"
    "dashboard_exit_data.json"
    "manual_ens_names.json"
)

missing_files=()
for file in "${data_files[@]}"; do
    if ! check_file_exists "$file"; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All data files found"
else
    echo "⚠️  Missing data files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    echo "   (API will return 404 for missing data)"
fi

echo ""
echo "🌐 Starting FastAPI server..."
echo "   API Documentation: http://localhost:8000/docs"
echo "   Health Check: http://localhost:8000/health/"
echo "   Root Endpoint: http://localhost:8000/"
echo "   ClickHouse Health: http://localhost:8000/api/attestations/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 main.py