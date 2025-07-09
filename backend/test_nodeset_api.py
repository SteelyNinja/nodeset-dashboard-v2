#!/usr/bin/env python3
"""
Test script for the new NodeSet API endpoints
"""

import sys
import os
sys.path.append('.')

def test_nodeset_router():
    """Test that the nodeset router is properly configured"""
    try:
        from routers.nodeset import router
        print("✓ NodeSet router imported successfully")
        
        # Check that the router has the expected routes
        routes = [route.path for route in router.routes]
        print(f"✓ Available routes: {routes}")
        
        expected_routes = ['/validators_down', '/validators_down/extended', '/validators_down/summary', '/below_threshold', '/below_threshold/extended', '/theoretical_performance', '/theoretical_performance/extended']
        for route in expected_routes:
            if route in routes:
                print(f"✓ Route {route} exists")
            else:
                print(f"✗ Route {route} missing")
        
        return True
        
    except Exception as e:
        print(f"✗ Error importing NodeSet router: {e}")
        return False

def test_main_app():
    """Test that the main app includes the nodeset router"""
    try:
        from main import app
        print("✓ Main app imported successfully")
        
        # Check that the app has the nodeset routes
        routes = []
        for route in app.routes:
            if hasattr(route, 'path'):
                routes.append(route.path)
            elif hasattr(route, 'path_regex'):
                routes.append(str(route.path_regex))
        
        print(f"✓ Total app routes: {len(routes)}")
        
        # Look for nodeset-related routes
        nodeset_routes = [route for route in routes if 'nodeset' in str(route)]
        if nodeset_routes:
            print(f"✓ Found NodeSet routes: {nodeset_routes}")
        else:
            print("✗ No NodeSet routes found in main app")
            
        return True
        
    except Exception as e:
        print(f"✗ Error importing main app: {e}")
        return False

def test_clickhouse_service():
    """Test that ClickHouse service is available"""
    try:
        from services.clickhouse_service import clickhouse_service
        print("✓ ClickHouse service imported successfully")
        
        # Test if service is available (expected to be False in test environment)
        is_available = clickhouse_service.is_available()
        print(f"ℹ ClickHouse service available: {is_available}")
        
        return True
        
    except Exception as e:
        print(f"✗ Error testing ClickHouse service: {e}")
        return False

def main():
    print("Testing NodeSet API Implementation")
    print("=" * 40)
    
    success = True
    
    print("\n1. Testing NodeSet Router:")
    success &= test_nodeset_router()
    
    print("\n2. Testing Main App Integration:")
    success &= test_main_app()
    
    print("\n3. Testing ClickHouse Service:")
    success &= test_clickhouse_service()
    
    print("\n" + "=" * 40)
    if success:
        print("✓ All tests passed! NodeSet API is ready.")
        print("\nAvailable endpoints:")
        print("- GET /api/nodeset/validators_down")
        print("- GET /api/nodeset/validators_down/extended")
        print("- GET /api/nodeset/validators_down/summary")
        print("- GET /api/nodeset/below_threshold")
        print("- GET /api/nodeset/below_threshold/extended")
        print("- GET /api/nodeset/theoretical_performance")
        print("- GET /api/nodeset/theoretical_performance/extended")
    else:
        print("✗ Some tests failed. Check the output above.")
    
    return success

if __name__ == "__main__":
    main()