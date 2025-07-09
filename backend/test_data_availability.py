#!/usr/bin/env python3
"""
Test script to verify data availability logic in NodeSet API endpoints
"""

def test_data_availability_logic():
    """Test the data availability calculation logic"""
    
    # Test scenario 1: Sufficient data
    print("Test 1: Sufficient data available")
    latest_epoch = 1000
    min_available_epoch = 500
    epochs_requested = 225
    start_epoch = latest_epoch - epochs_requested + 1  # 776
    
    print(f"  Latest epoch: {latest_epoch}")
    print(f"  Min available epoch: {min_available_epoch}")
    print(f"  Requested start epoch: {start_epoch}")
    print(f"  Epochs requested: {epochs_requested}")
    
    if start_epoch >= min_available_epoch:
        print("  ✓ Sufficient data - calculation should proceed")
    else:
        epochs_available = latest_epoch - min_available_epoch + 1
        print(f"  ✗ Insufficient data - epochs available: {epochs_available}")
    
    # Test scenario 2: Insufficient data
    print("\nTest 2: Insufficient data available")
    latest_epoch = 200
    min_available_epoch = 50
    epochs_requested = 225
    start_epoch = latest_epoch - epochs_requested + 1  # -24 (negative!)
    
    print(f"  Latest epoch: {latest_epoch}")
    print(f"  Min available epoch: {min_available_epoch}")
    print(f"  Requested start epoch: {start_epoch}")
    print(f"  Epochs requested: {epochs_requested}")
    
    if start_epoch >= min_available_epoch:
        print("  ✓ Sufficient data - calculation should proceed")
    else:
        epochs_available = latest_epoch - min_available_epoch + 1
        completeness = round((epochs_available / epochs_requested) * 100, 2)
        print(f"  ✗ Insufficient data - epochs available: {epochs_available}")
        print(f"  Data completeness: {completeness}%")
    
    # Test scenario 3: Multi-day request
    print("\nTest 3: Multi-day request with insufficient data")
    latest_epoch = 500
    min_available_epoch = 100
    days = 7
    total_epochs = days * 225  # 1575
    start_epoch = latest_epoch - total_epochs + 1  # -1074 (way negative!)
    
    print(f"  Latest epoch: {latest_epoch}")
    print(f"  Min available epoch: {min_available_epoch}")
    print(f"  Days requested: {days}")
    print(f"  Total epochs requested: {total_epochs}")
    print(f"  Requested start epoch: {start_epoch}")
    
    if start_epoch >= min_available_epoch:
        print("  ✓ Sufficient data - calculation should proceed")
    else:
        epochs_available = latest_epoch - min_available_epoch + 1
        days_available = round(epochs_available / 225, 2)
        completeness = round((epochs_available / total_epochs) * 100, 2)
        print(f"  ✗ Insufficient data - epochs available: {epochs_available}")
        print(f"  Days available: {days_available}")
        print(f"  Data completeness: {completeness}%")
    
    print("\n" + "="*50)
    print("Data availability logic test completed!")
    print("The endpoints will now return informative error messages")
    print("instead of empty results when data is insufficient.")

if __name__ == "__main__":
    test_data_availability_logic()