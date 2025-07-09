#!/usr/bin/env python3
"""
Example usage of the NodeSet API endpoints
Run this with: python3 nodeset_api_examples.py
"""

import requests
import json

# Base URL for the API (adjust as needed)
BASE_URL = "http://localhost:8000"

def test_validators_down():
    """Test the basic validators_down endpoint"""
    print("Testing /api/nodeset/validators_down")
    print("-" * 40)
    
    try:
        response = requests.get(f"{BASE_URL}/api/nodeset/validators_down")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} validators down")
            if data:
                print("Example validator:")
                print(json.dumps(data[0], indent=2))
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - make sure the server is running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_validators_down_extended():
    """Test the extended validators_down endpoint"""
    print("\nTesting /api/nodeset/validators_down/extended")
    print("-" * 40)
    
    try:
        # Test with different parameters
        params = {"epochs_back": 3, "limit": 50}
        response = requests.get(f"{BASE_URL}/api/nodeset/validators_down/extended", params=params)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} validators down for 3 consecutive epochs")
            if data:
                print("Example validator:")
                print(json.dumps(data[0], indent=2))
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - make sure the server is running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_validators_down_summary():
    """Test the summary endpoint"""
    print("\nTesting /api/nodeset/validators_down/summary")
    print("-" * 40)
    
    try:
        response = requests.get(f"{BASE_URL}/api/nodeset/validators_down/summary")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Summary statistics:")
            print(json.dumps(data, indent=2))
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - make sure the server is running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    print("NodeSet API Example Usage")
    print("=" * 50)
    print("Make sure to start the server first with:")
    print("  python3 main.py")
    print("=" * 50)
    
    # Test all endpoints
    test_validators_down()
    test_validators_down_extended()
    test_validators_down_summary()
    
    print("\n" + "=" * 50)
    print("API Documentation:")
    print("- GET /api/nodeset/validators_down")
    print("  Returns validators that missed the last 3 attestations")
    print("- GET /api/nodeset/validators_down/extended?epochs_back=N")
    print("  Returns validators that missed N consecutive attestations (2-10)")
    print("- GET /api/nodeset/validators_down/summary")
    print("  Returns summary statistics about validator downtime (3 epochs)")

if __name__ == "__main__":
    main()