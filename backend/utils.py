"""
Utility functions for the NodeSet Validator Dashboard backend
"""

def format_operator_display_plain(address: str, ens_names: dict) -> str:
    """
    Format operator address for plain text display with ENS name if available
    
    Args:
        address: Ethereum address
        ens_names: Dictionary mapping addresses to ENS names
        
    Returns:
        Formatted operator display string
    """
    if not address:
        return "Unknown"
    
    # Check if we have an ENS name for this address
    ens_name = ens_names.get(address)
    
    if ens_name and ens_name != address:
        # Return ENS name with shortened address
        return f"{ens_name} ({address[:8]}...{address[-6:]})"
    else:
        # Return shortened address only
        return f"{address[:8]}...{address[-6:]}"

def get_performance_category(performance: float) -> str:
    """
    Categorize validator performance based on percentage
    
    Args:
        performance: Performance percentage (0-100)
        
    Returns:
        Performance category string
    """
    if performance >= 99.5:
        return "Excellent"
    elif performance >= 98.5:
        return "Good"
    elif performance >= 97.0:
        return "Average"
    else:
        return "Poor"