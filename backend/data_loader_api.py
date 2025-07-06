"""
Data loader functions for FastAPI backend
Converted from Streamlit version - removes @st.cache_data decorators and Streamlit dependencies
"""

import json
import os
import base64
from datetime import datetime
from typing import Tuple, Optional, Dict, Any
from functools import lru_cache

# Configuration constants (copied from config.py)
CACHE_FILES = [
    './nodeset_validator_tracker_cache.json',
    './json_data/nodeset_validator_tracker_cache.json',
    './data/nodeset_validator_tracker_cache.json',
    '../nodeset_validator_tracker_cache.json',
    '../json_data/nodeset_validator_tracker_cache.json'
]

PROPOSALS_FILES = [
    './proposals.json',
    './json_data/proposals.json',
    './data/proposals.json',
    '../proposals.json',
    '../json_data/proposals.json'
]

MEV_FILES = [
    './mev_analysis_results.json',
    './json_data/mev_analysis_results.json',
    './data/mev_analysis_results.json',
    '../mev_analysis_results.json',
    '../json_data/mev_analysis_results.json'
]

MISSED_PROPOSALS_FILES = [
    './missed_proposals_cache.json',
    './json_data/missed_proposals_cache.json',
    './data/missed_proposals_cache.json',
    '../missed_proposals_cache.json',
    '../json_data/missed_proposals_cache.json'
]

SYNC_COMMITTEE_FILES = [
    './sync_committee_participation.json',
    './json_data/sync_committee_participation.json',
    './data/sync_committee_participation.json',
    '../sync_committee_participation.json',
    '../json_data/sync_committee_participation.json'
]

EXIT_DATA_FILES = [
    './dashboard_exit_data.json',
    './json_data/dashboard_exit_data.json',
    './data/dashboard_exit_data.json',
    '../dashboard_exit_data.json',
    '../json_data/dashboard_exit_data.json'
]

VALIDATOR_PERFORMANCE_FILES = [
    './validator_performance_cache.json',
    './json_data/validator_performance_cache.json',
    './data/validator_performance_cache.json',
    '../validator_performance_cache.json',
    '../json_data/validator_performance_cache.json'
]

ENS_NAMES_FILES = [
    './manual_ens_names.json',
    './json_data/manual_ens_names.json',
    './data/manual_ens_names.json',
    '../manual_ens_names.json',
    '../json_data/manual_ens_names.json'
]

DARK_LOGO_PATH = '../Nodeset_dark_mode.png'
LIGHT_LOGO_PATH = '../Nodeset_light_mode.png'

# Cache with TTL simulation using timestamps and file modification times
_cache = {}
_cache_timestamps = {}
_file_mod_times = {}

def _get_file_mod_time(filepath: str) -> float:
    """Get file modification time, return 0 if file doesn't exist"""
    try:
        return os.path.getmtime(filepath) if os.path.exists(filepath) else 0
    except OSError:
        return 0

def _are_files_newer_than_cache(key: str, file_paths: list) -> bool:
    """Check if any source files are newer than cached data"""
    if key not in _file_mod_times:
        return True  # No cached file times, assume files are newer
    
    cached_file_times = _file_mod_times[key]
    
    for filepath in file_paths:
        current_mod_time = _get_file_mod_time(filepath)
        cached_mod_time = cached_file_times.get(filepath, 0)
        
        if current_mod_time > cached_mod_time:
            return True  # At least one file is newer
    
    return False

def _is_cache_valid(key: str, ttl: int, file_paths: list = None) -> bool:
    """Check if cached data is still valid (both TTL and file modification times)"""
    if key not in _cache_timestamps:
        return False
    
    # Check TTL first
    age = datetime.now().timestamp() - _cache_timestamps[key]
    if age >= ttl:
        return False
    
    # Check if source files are newer than cache
    if file_paths and _are_files_newer_than_cache(key, file_paths):
        return False
    
    return True

def _get_cached_or_load(key: str, loader_func, ttl: int = 900, file_paths: list = None):
    """Get cached data or load fresh data with file modification time checking"""
    # Check if we need to reload due to TTL or file changes
    cache_valid = key in _cache and _is_cache_valid(key, ttl, file_paths)
    
    if cache_valid:
        return _cache[key]
    
    # Determine reason for reload (for logging)
    reload_reason = "initial_load"
    if key in _cache:
        if file_paths and _are_files_newer_than_cache(key, file_paths):
            reload_reason = "file_modified"
        else:
            reload_reason = "ttl_expired"
    
    # Load fresh data
    result = loader_func()
    _cache[key] = result
    _cache_timestamps[key] = datetime.now().timestamp()
    
    # Store current file modification times
    if file_paths:
        _file_mod_times[key] = {filepath: _get_file_mod_time(filepath) for filepath in file_paths}
        
    # Log the reload
    if reload_reason == "file_modified":
        print(f"🔄 Auto-reloaded {key} data due to file modification")
    elif reload_reason == "ttl_expired":
        print(f"🕒 Reloaded {key} data due to TTL expiration ({ttl}s)")
    
    return result

def clear_cache():
    """Manually clear all cached data"""
    global _cache, _cache_timestamps, _file_mod_times
    _cache.clear()
    _cache_timestamps.clear()
    _file_mod_times.clear()
    print("🗑️ Manually cleared all cached data")

def load_validator_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load validator data from cache file"""
    def _load():
        for cache_file in CACHE_FILES:
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r') as f:
                        cache = json.load(f)
                    
                    # Add last_updated timestamp based on file modification time
                    # to ensure cache timestamp reflects when data was actually updated
                    if 'last_updated' not in cache:
                        file_mod_time = os.path.getmtime(cache_file)
                        cache['last_updated'] = datetime.fromtimestamp(file_mod_time).isoformat() + '+00:00'
                    
                    return cache, cache_file
                except Exception as e:
                    print(f"⚠ Error loading {cache_file}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("validator_data", _load, 900, CACHE_FILES)

def load_proposals_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load proposals data from JSON file"""
    def _load():
        for proposals_file in PROPOSALS_FILES:
            if os.path.exists(proposals_file):
                try:
                    with open(proposals_file, 'r') as f:
                        data = json.load(f)
                    return data, proposals_file
                except Exception as e:
                    print(f"⚠ Error loading {proposals_file}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("proposals_data", _load, 900, PROPOSALS_FILES)

def load_missed_proposals_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load missed proposals data from JSON file"""
    def _load():
        for path in MISSED_PROPOSALS_FILES:
            try:
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        data = json.load(f)
                    return data, path
            except Exception as e:
                print(f"⚠ Error loading {path}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("missed_proposals_data", _load, 900, MISSED_PROPOSALS_FILES)

def load_mev_analysis_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load MEV analysis data from JSON file"""
    def _load():
        for mev_file in MEV_FILES:
            if os.path.exists(mev_file):
                try:
                    with open(mev_file, 'r') as f:
                        data = json.load(f)
                    return data, mev_file
                except Exception as e:
                    print(f"⚠ Error loading {mev_file}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("mev_analysis_data", _load, 900, MEV_FILES)

def load_sync_committee_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load sync committee data from JSON file"""
    def _load():
        for path in SYNC_COMMITTEE_FILES:
            try:
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        data = json.load(f)
                    return data, path
            except Exception as e:
                print(f"⚠ Error loading {path}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("sync_committee_data", _load, 1800, SYNC_COMMITTEE_FILES)

def load_exit_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load exit data from JSON file"""
    def _load():
        for path in EXIT_DATA_FILES:
            try:
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        data = json.load(f)
                    return data, path
            except Exception as e:
                print(f"⚠ Error loading {path}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("exit_data", _load, 1800, EXIT_DATA_FILES)

def load_validator_performance_data() -> Tuple[Optional[Dict], Optional[str]]:
    """Load validator performance data from JSON file"""
    def _load():
        for path in VALIDATOR_PERFORMANCE_FILES:
            try:
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        data = json.load(f)
                    
                    # Update last_updated to reflect file modification time
                    # This ensures the cache timestamp reflects when data was actually updated
                    file_mod_time = os.path.getmtime(path)
                    data['last_updated'] = datetime.fromtimestamp(file_mod_time).isoformat() + '+00:00'
                    
                    return data, path
            except Exception as e:
                print(f"⚠ Error loading {path}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("validator_performance_data", _load, 1800, VALIDATOR_PERFORMANCE_FILES)

def load_ens_names() -> Tuple[Optional[Dict], Optional[str]]:
    """Load ENS names from JSON file"""
    def _load():
        for path in ENS_NAMES_FILES:
            try:
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        data = json.load(f)
                    return data, path
            except Exception as e:
                print(f"⚠ Error loading {path}: {str(e)}")
        return None, None
    
    return _get_cached_or_load("ens_names", _load, 3600, ENS_NAMES_FILES)

def get_logo_base64(dark_mode: bool = False) -> Optional[str]:
    """Get logo as base64 string"""
    def _load():
        logo_path = DARK_LOGO_PATH if dark_mode else LIGHT_LOGO_PATH
        
        if os.path.exists(logo_path):
            try:
                with open(logo_path, 'rb') as f:
                    return base64.b64encode(f.read()).decode()
            except Exception as e:
                print(f"⚠ Error loading logo {logo_path}: {str(e)}")
        return None
    
    cache_key = f"logo_{'dark' if dark_mode else 'light'}"
    return _get_cached_or_load(cache_key, _load, 3600)

def clear_cache():
    """Clear all cached data"""
    global _cache, _cache_timestamps
    _cache.clear()
    _cache_timestamps.clear()

def get_cache_info() -> Dict[str, Any]:
    """Get cache information"""
    return {
        "cached_items": list(_cache.keys()),
        "cache_timestamps": _cache_timestamps,
        "cache_size": len(_cache)
    }