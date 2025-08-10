"""
Outages API endpoints for validator monitoring data
"""
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Response Models
class OutageEvent(BaseModel):
    start: str
    end: str
    duration_seconds: int

class ValidatorOutageHistory(BaseModel):
    count: int
    last_outage: str
    total_downtime_seconds: int
    outages: List[OutageEvent]

class OutagesData(BaseModel):
    down_validators: List[str]
    down_since: Dict[str, str]
    initial_misses: Dict[str, int]
    outage_history: Dict[str, ValidatorOutageHistory]
    summary_message_id: int
    last_update: str

class WorstPerformer(BaseModel):
    validator: str
    outage_count: int
    total_downtime_seconds: int
    uptime_percentage: float

class RecentOutage(BaseModel):
    validator: str
    start: str
    end: str
    duration_seconds: int

class OutagesSummary(BaseModel):
    total_validators_with_outages: int
    total_outage_events: int
    total_downtime_hours: float
    currently_down: int
    worst_performers: List[WorstPerformer]
    recent_outages: List[RecentOutage]

router = APIRouter(prefix="/api/outages", tags=["outages"])

def find_validator_state_file() -> str:
    """Find validator_state.json in various possible locations"""
    possible_paths = [
        "json_data/validator_state.json",
        "../json_data/validator_state.json",
        "validator_state.json"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    raise FileNotFoundError("validator_state.json not found in any expected location")

def load_outages_data() -> OutagesData:
    """Load and parse validator state data"""
    try:
        file_path = find_validator_state_file()
        with open(file_path, 'r') as f:
            raw_data = json.load(f)
        
        # Parse the data into our structured format
        outage_history = {}
        for validator, history in raw_data.get('outage_history', {}).items():
            outage_history[validator] = ValidatorOutageHistory(
                count=history.get('count', 0),
                last_outage=history.get('last_outage', ''),
                total_downtime_seconds=history.get('total_downtime_seconds', 0),
                outages=[
                    OutageEvent(
                        start=outage.get('start', ''),
                        end=outage.get('end', ''),
                        duration_seconds=outage.get('duration_seconds', 0)
                    )
                    for outage in history.get('outages', [])
                ]
            )
        
        return OutagesData(
            down_validators=raw_data.get('down_validators', []),
            down_since=raw_data.get('down_since', {}),
            initial_misses=raw_data.get('initial_misses', {}),
            outage_history=outage_history,
            summary_message_id=raw_data.get('summary_message_id', 0),
            last_update=raw_data.get('last_update', '')
        )
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading outages data: {str(e)}")

def calculate_uptime_percentage(total_downtime_seconds: int, monitoring_period_days: int = 30) -> float:
    """Calculate uptime percentage based on total downtime"""
    total_seconds_in_period = monitoring_period_days * 24 * 3600
    if total_downtime_seconds >= total_seconds_in_period:
        return 0.0
    uptime_seconds = total_seconds_in_period - total_downtime_seconds
    return (uptime_seconds / total_seconds_in_period) * 100

@router.get("/data")
async def get_outages_data():
    """Get complete outages data"""
    outages_data = load_outages_data()
    return {
        "data": outages_data,
        "success": True,
        "message": "Outages data retrieved successfully"
    }

@router.get("/summary")
async def get_outages_summary():
    """Get outages summary with key metrics"""
    data = load_outages_data()
    
    # Calculate summary statistics
    total_validators_with_outages = len(data.outage_history)
    total_outage_events = sum(history.count for history in data.outage_history.values())
    total_downtime_seconds = sum(history.total_downtime_seconds for history in data.outage_history.values())
    total_downtime_hours = total_downtime_seconds / 3600
    currently_down = len(data.down_validators)
    
    # Find worst performers (all operators sorted by total downtime)
    worst_performers = []
    for validator, history in data.outage_history.items():
        uptime_percentage = calculate_uptime_percentage(history.total_downtime_seconds)
        worst_performers.append(WorstPerformer(
            validator=validator,
            outage_count=history.count,
            total_downtime_seconds=history.total_downtime_seconds,
            uptime_percentage=uptime_percentage
        ))
    
    worst_performers.sort(key=lambda x: x.total_downtime_seconds, reverse=True)
    # Return all worst performers instead of limiting to 5
    
    # Get recent outages (last 10 outage events across all validators)
    all_outages = []
    for validator, history in data.outage_history.items():
        for outage in history.outages:
            all_outages.append(RecentOutage(
                validator=validator,
                start=outage.start,
                end=outage.end,
                duration_seconds=outage.duration_seconds
            ))
    
    # Sort by start time (most recent first)
    all_outages.sort(key=lambda x: x.start, reverse=True)
    recent_outages = all_outages  # Return all outages instead of limiting to 10
    
    summary = OutagesSummary(
        total_validators_with_outages=total_validators_with_outages,
        total_outage_events=total_outage_events,
        total_downtime_hours=total_downtime_hours,
        currently_down=currently_down,
        worst_performers=worst_performers,
        recent_outages=recent_outages
    )
    
    return {
        "data": summary,
        "success": True,
        "message": "Outages summary retrieved successfully"
    }

@router.get("/validator/{validator_address}")
async def get_validator_outage_history(validator_address: str):
    """Get outage history for a specific validator"""
    data = load_outages_data()
    
    if validator_address not in data.outage_history:
        raise HTTPException(status_code=404, detail="Validator not found in outage history")
    
    history = data.outage_history[validator_address]
    uptime_percentage = calculate_uptime_percentage(history.total_downtime_seconds)
    
    return {
        "validator": validator_address,
        "outage_history": history,
        "uptime_percentage": uptime_percentage,
        "is_currently_down": validator_address in data.down_validators,
        "down_since": data.down_since.get(validator_address)
    }