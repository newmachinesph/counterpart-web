"""Run compensation and recovery regressions against isolated PostgreSQL.

Requires Docker and the counterpart-web-api image. Never touches production.
"""
import subprocess
from pathlib import Path

if __name__ == "__main__":
    root=Path(__file__).resolve().parents[1]
    command=['docker','compose','-f','docker-compose.qa.yml','run','--rm','-v',
        f'{(root / "apps/api").as_posix()}:/app','api','pytest','-q',
        'tests/test_api_lifecycle.py','tests/test_api_permissions.py',
        'tests/test_account_recovery.py','tests/test_transactions.py']
    raise SystemExit(subprocess.call(command,cwd=root))
