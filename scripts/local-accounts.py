"""Create persistent local test accounts. Credentials stay in ignored .local/."""
import json
from pathlib import Path
import secrets
import subprocess

path = Path(".local/test-accounts.json")
path.parent.mkdir(exist_ok=True)
if path.exists():
    accounts = json.loads(path.read_text())
else:
    accounts = [{"email": f"{role}@counterpart.test", "name": f"Local {role.title()}", "roles": [role], "password": secrets.token_urlsafe(24)}
        for role in ["builder", "counterpart", "investor", "admin"]]
    path.write_text(json.dumps(accounts, indent=2))

code = '''
import json,sys
from sqlalchemy import select
from sqlalchemy.engine import make_url
from app.config import settings
from app.db import SessionLocal
from app.models import User,AccountCredential
from app.accounts import password_hash
from app.services.common import new_id
url=make_url(settings.database_url)
assert settings.app_env == "local" and url.host in ("db","localhost","127.0.0.1") and url.database == "counterpart"
with SessionLocal() as db:
 for item in json.load(sys.stdin):
  user=db.scalar(select(User).where(User.email==item["email"]))
  if user: continue
  user=User(id=new_id("usr"),name=item["name"],email=item["email"],roles=item["roles"])
  db.add(user);db.flush()
  db.add(AccountCredential(user_id=user.id,password_hash=password_hash(item["password"])))
 db.commit()
print("Local builder, counterpart, investor and admin accounts ready.")
'''
subprocess.run(["docker", "compose", "exec", "-T", "api", "python", "-c", code], input=json.dumps(accounts), text=True, check=True)
print("Credentials saved to .local/test-accounts.json (gitignored).")
