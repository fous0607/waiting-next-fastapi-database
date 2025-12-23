
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    print("Attempting to import schemas...")
    import schemas
    print("schemas imported successfully.")
    
    print("Attempting to import routers.members...")
    from routers import members
    print("routers.members imported successfully.")

except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
