"""Container entrypoint shared by the API and durable queue worker."""
import os
import subprocess
import sys

if os.environ.get("SERVICE_ROLE") == "worker":
    os.execvp(sys.executable, [sys.executable, "-m", "app.mail_worker"])
else:
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    subprocess.run([sys.executable, "-m", "app.bootstrap"], check=True)
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"])
