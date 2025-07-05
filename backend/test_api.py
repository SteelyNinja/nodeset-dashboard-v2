#!/usr/bin/env python3
"""
Test script for FastAPI backend endpoints
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(url, description):
    """Test a single endpoint"""
    print(f"\n🧪 Testing {description}")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'success' in data:
                if data['success']:
                    print("✅ Success: API returned success=true")
                    if 'data' in data and data['data']:
                        print(f"📊 Data keys: {list(data['data'].keys())[:5]}...")
                    return True
                else:
                    print(f"❌ Failed: {data.get('message', 'Unknown error')}")
                    return False
            else:
                print("✅ Success: Valid JSON response")
                if isinstance(data, dict):
                    print(f"📊 Response keys: {list(data.keys())[:5]}...")
                return True
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection Error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ JSON Error: {e}")
        return False

def main():
    """Run all API tests"""
    print("🚀 FastAPI Backend Test Suite")
    print("=" * 50)
    
    tests = [
        # Core endpoints
        (f"{BASE_URL}/", "Root endpoint"),
        (f"{BASE_URL}/health/", "Health check"),
        (f"{BASE_URL}/health/data-files", "Data files check"),
        
        # Data endpoints
        (f"{BASE_URL}/api/data/validator-data", "Validator data"),
        (f"{BASE_URL}/api/data/proposals", "Proposals data"),
        (f"{BASE_URL}/api/data/sync-committee", "Sync committee data"),
        (f"{BASE_URL}/api/data/mev-analysis", "MEV analysis data"),
        (f"{BASE_URL}/api/data/ens-names", "ENS names data"),
        (f"{BASE_URL}/api/data/cache-info", "Cache information"),
        
        # Dashboard endpoints
        (f"{BASE_URL}/api/dashboard/concentration-metrics", "Concentration metrics"),
        (f"{BASE_URL}/api/dashboard/performance-analysis", "Performance analysis"),
        (f"{BASE_URL}/api/dashboard/gas-analysis", "Gas analysis"),
        (f"{BASE_URL}/api/dashboard/client-diversity", "Client diversity"),
        (f"{BASE_URL}/api/dashboard/top-operators", "Top operators"),
        (f"{BASE_URL}/api/dashboard/network-overview", "Network overview"),
    ]
    
    passed = 0
    total = len(tests)
    
    for url, description in tests:
        if test_endpoint(url, description):
            passed += 1
    
    print(f"\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! FastAPI backend is working correctly.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()