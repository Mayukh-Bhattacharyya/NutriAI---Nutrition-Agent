import os
from pathlib import Path
from dotenv import load_dotenv

# Define path
base_dir = Path(__file__).resolve().parent
env_path = base_dir / ".env"

print(f"1. Looking for .env file at: {env_path}")
print(f"2. Does the file actually exist there? {env_path.exists()}")

# Load it
load_dotenv(dotenv_path=env_path)

print(f"3. Key reading test: '{os.getenv('IBM_API_KEY')}'")
