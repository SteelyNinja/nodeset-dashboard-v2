#!/usr/bin/env python3
"""
Manual test script to validate NodeSet API endpoints
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint, params=None, description=""):
    """Test a single endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing: {endpoint}")
    print(f"Description: {description}")
    print(f"Parameters: {params}")
    print(f"{'='*60}")
    
    try:
        url = f"{BASE_URL}{endpoint}"
        response = requests.get(url, params=params, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response Type: {type(data)}")
                
                if isinstance(data, dict):
                    if "error" in data:
                        print("✓ Data availability check working - insufficient data detected")
                        print(f"  Error: {data['error']}")
                        print(f"  Message: {data['message']}")
                        print(f"  Epochs Available: {data.get('epochs_available', 'N/A')}")
                        print(f"  Epochs Requested: {data.get('epochs_requested', 'N/A')}")
                        print(f"  Data Completeness: {data.get('data_completeness_percentage', 'N/A')}%")
                        return "insufficient_data"
                    else:
                        print("✓ Successful response with data")
                        print(f"  Keys: {list(data.keys())}")
                        return "success"
                elif isinstance(data, list):
                    print(f"✓ Successful response with {len(data)} items")
                    if len(data) > 0:
                        print(f"  Sample item keys: {list(data[0].keys())}")
                        print(f"  Sample item: {json.dumps(data[0], indent=2)}")
                    return "success"
                else:
                    print(f"? Unexpected response type: {type(data)}")
                    return "unexpected"
                    
            except json.JSONDecodeError as e:
                print(f"✗ JSON decode error: {e}")
                print(f"Raw response: {response.text[:500]}")
                return "json_error"
        else:
            print(f"✗ HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            return "http_error"
            
    except requests.exceptions.RequestException as e:
        print(f"✗ Request error: {e}")
        return "request_error"

def main():
    print("🚀 NodeSet API Endpoint Testing")
    print("=" * 60)
    
    # Test server health first
    health_result = test_endpoint("/health/", description="Server health check")
    if health_result != "success":
        print("❌ Server health check failed - stopping tests")
        sys.exit(1)
    
    # Test endpoints
    endpoints = [
        {
            "endpoint": "/api/nodeset/below_threshold",
            "params": {"limit": 3},
            "description": "Below threshold validators (97% over 1 day)"
        },
        {
            "endpoint": "/api/nodeset/below_threshold/extended",
            "params": {"days": 1, "threshold": 95.0, "limit": 3},
            "description": "Below threshold extended (configurable days/threshold)"
        },
        {
            "endpoint": "/api/nodeset/theoretical_performance",
            "params": {"limit": 3},
            "description": "Theoretical performance by operator (1 day)"
        },
        {
            "endpoint": "/api/nodeset/theoretical_performance/extended",
            "params": {"days": 1, "limit": 3},
            "description": "Theoretical performance extended (configurable days)"
        }
    ]
    
    results = {}
    for endpoint_info in endpoints:
        result = test_endpoint(
            endpoint_info["endpoint"],
            endpoint_info.get("params"),
            endpoint_info["description"]
        )
        results[endpoint_info["endpoint"]] = result
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    success_count = 0
    insufficient_data_count = 0
    error_count = 0
    
    for endpoint, result in results.items():
        if result == "success":
            status = "✅ SUCCESS"
            success_count += 1
        elif result == "insufficient_data":
            status = "⚠️  INSUFFICIENT DATA (expected)"
            insufficient_data_count += 1
        else:
            status = "❌ ERROR"
            error_count += 1
        
        print(f"{endpoint}: {status}")
    
    print(f"\nResults: {success_count} success, {insufficient_data_count} insufficient data, {error_count} errors")
    
    if error_count == 0:
        print("🎉 All endpoints are working correctly!")
        print("The 'insufficient data' responses are expected given the current database state.")
    else:
        print("⚠️ Some endpoints had errors - check the output above.")

if __name__ == "__main__":
    main()