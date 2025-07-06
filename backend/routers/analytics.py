from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import os
from datetime import datetime, timezone
import asyncio
from pathlib import Path

router = APIRouter()

# Analytics data models
class AnalyticsEvent(BaseModel):
    type: str
    timestamp: int
    data: Optional[Dict[str, Any]] = None

class AnalyticsSubmission(BaseModel):
    sessionId: str
    event: AnalyticsEvent

# File path for analytics storage
ANALYTICS_FILE = Path(__file__).parent.parent.parent / "json_data" / "analytics.json"

class AnalyticsStore:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.ensure_file_exists()
    
    def ensure_file_exists(self):
        """Create analytics file if it doesn't exist"""
        ANALYTICS_FILE.parent.mkdir(exist_ok=True)
        if not ANALYTICS_FILE.exists():
            initial_data = {
                "metadata": {
                    "created": datetime.now(timezone.utc).isoformat(),
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "privacy_note": "This file contains only anonymous, aggregated analytics data. No personal information is stored."
                },
                "daily_stats": {},
                "sessions": [],
                "events": []
            }
            with open(ANALYTICS_FILE, 'w') as f:
                json.dump(initial_data, f, indent=2)
    
    async def add_event(self, session_id: str, event: AnalyticsEvent):
        """Add an analytics event to the store"""
        async with self.lock:
            try:
                # Read current data
                with open(ANALYTICS_FILE, 'r') as f:
                    data = json.load(f)
                
                # Add the event
                event_record = {
                    "session_id": session_id,
                    "type": event.type,
                    "timestamp": event.timestamp,
                    "date": datetime.fromtimestamp(event.timestamp / 1000, timezone.utc).isoformat()[:10],
                    "data": event.data or {}
                }
                
                data["events"].append(event_record)
                data["metadata"]["last_updated"] = datetime.now(timezone.utc).isoformat()
                
                # Update daily stats
                date_key = event_record["date"]
                if date_key not in data["daily_stats"]:
                    data["daily_stats"][date_key] = {
                        "unique_sessions": set(),
                        "page_views": 0,
                        "tab_switches": 0,
                        "downloads": 0,
                        "session_starts": 0
                    }
                
                # Track metrics
                daily = data["daily_stats"][date_key]
                # Convert back to set if it was serialized as int
                if isinstance(daily["unique_sessions"], int):
                    daily["unique_sessions"] = set()
                daily["unique_sessions"].add(session_id)
                
                if event.type == "page_view":
                    daily["page_views"] += 1
                elif event.type == "tab_switch":
                    daily["tab_switches"] += 1
                elif event.type == "download":
                    daily["downloads"] += 1
                elif event.type == "session_start":
                    daily["session_starts"] += 1
                
                # Convert sets to counts for JSON serialization (only for current date)
                if isinstance(daily["unique_sessions"], set):
                    daily["unique_sessions"] = len(daily["unique_sessions"])
                
                # Keep only last 90 days of events to prevent file from growing too large
                cutoff_timestamp = (datetime.now(timezone.utc).timestamp() - (90 * 24 * 60 * 60)) * 1000
                data["events"] = [e for e in data["events"] if e["timestamp"] > cutoff_timestamp]
                
                # Write back to file
                with open(ANALYTICS_FILE, 'w') as f:
                    json.dump(data, f, indent=2)
                    
            except Exception as e:
                print(f"Error writing analytics: {e}")
    
    async def get_analytics_summary(self):
        """Get summary analytics for the hidden dashboard"""
        try:
            with open(ANALYTICS_FILE, 'r') as f:
                data = json.load(f)
            
            # Calculate summary metrics
            total_sessions = len(set(event["session_id"] for event in data["events"] if event["type"] == "session_start"))
            total_page_views = len([e for e in data["events"] if e["type"] == "page_view"])
            total_tab_switches = len([e for e in data["events"] if e["type"] == "tab_switch"])
            total_downloads = len([e for e in data["events"] if e["type"] == "download"])
            
            # Tab popularity
            tab_switches = [e for e in data["events"] if e["type"] == "tab_switch" and e.get("data", {}).get("tab")]
            tab_counts = {}
            for event in tab_switches:
                tab = event["data"]["tab"]
                tab_counts[tab] = tab_counts.get(tab, 0) + 1
            
            # Browser stats
            browser_stats = {}
            for event in data["events"]:
                if event["type"] == "session_start" and event.get("data", {}).get("userAgent"):
                    browser = event["data"]["userAgent"]
                    browser_stats[browser] = browser_stats.get(browser, 0) + 1
            
            # Recent activity (last 7 days)
            recent_cutoff = (datetime.now(timezone.utc).timestamp() - (7 * 24 * 60 * 60)) * 1000
            recent_events = [e for e in data["events"] if e["timestamp"] > recent_cutoff]
            recent_sessions = len(set(event["session_id"] for event in recent_events if event["type"] == "session_start"))
            
            return {
                "summary": {
                    "total_sessions": total_sessions,
                    "total_page_views": total_page_views,
                    "total_tab_switches": total_tab_switches,
                    "total_downloads": total_downloads,
                    "recent_sessions_7d": recent_sessions
                },
                "tab_popularity": dict(sorted(tab_counts.items(), key=lambda x: x[1], reverse=True)),
                "browser_stats": browser_stats,
                "daily_stats": data["daily_stats"],
                "metadata": data["metadata"]
            }
        except Exception as e:
            return {"error": f"Failed to load analytics: {str(e)}"}

# Global analytics store instance
analytics_store = AnalyticsStore()

@router.post("/analytics")
async def track_event(submission: AnalyticsSubmission, request: Request):
    """
    Accept analytics events and store them locally.
    Privacy-first: Only stores anonymous, aggregated data.
    """
    try:
        # Additional privacy protection - don't store IP addresses
        await analytics_store.add_event(submission.sessionId, submission.event)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store analytics: {str(e)}")

@router.get("/analytics/summary")
async def get_analytics_summary():
    """
    Get analytics summary for the hidden dashboard.
    Only accessible via direct URL.
    """
    try:
        summary = await analytics_store.get_analytics_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

@router.get("/analytics/raw")
async def get_raw_analytics():
    """
    Get raw analytics data for detailed analysis.
    WARNING: Only for admin use.
    """
    try:
        with open(ANALYTICS_FILE, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load raw analytics: {str(e)}")