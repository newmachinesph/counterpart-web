"""Render ignored Northflank service definitions from the operator's .env."""
import json
from pathlib import Path

values = dict(line.split("=", 1) for line in Path(".env").read_text().splitlines() if "=" in line and not line.startswith("#"))
env = {key: values.get(key, "") for key in ["ABLY_API_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "QSTASH_URL", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "DIDIT_API_KEY", "DIDIT_WORKFLOW_ID", "DIDIT_WEBHOOK_SECRET"]}
env.update(APP_ENV="production", DATABASE_URL=values["PRODUCTION_DATABASE_URL"], WEB_URL="https://counterpart.ph",
    PUBLIC_API_URL="https://api.counterpart.ph", CORS_ORIGINS="https://counterpart.ph,https://www.counterpart.ph",
    S3_ENDPOINT_URL=values["R2_ENDPOINT_URL"], S3_ACCESS_KEY_ID=values["R2_ACCESS_KEY_ID"],
    S3_SECRET_ACCESS_KEY=values["R2_SECRET_ACCESS_KEY"], S3_BUCKET="counterpart", S3_REGION="auto",
    S3_PUBLIC_URL=values["R2_PUBLIC_URL"], VERIFICATION_ENABLED="false",
    QSTASH_CALLBACK_URL=values.get("QSTASH_CALLBACK_URL") or "https://api.counterpart.ph/webhooks/qstash/maintenance")
for key in ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_STARTTLS", "SMTP_FROM"]:
    env[key] = values["PRODUCTION_" + key]
Path(".local").mkdir(exist_ok=True)
for role in ["api", "worker"]:
    data = {"name": role, "billing": {"deploymentPlan": "nf-compute-20"},
        "deployment": {"instances": 1}, "buildSource": "git",
        "vcsData": {"projectUrl": "https://github.com/sumnora/counterpart-web", "projectType": "github", "accountLogin": "sumnora", "projectBranch": "main"},
        "buildSettings": {"dockerfile": {"buildEngine": "buildkit", "dockerFilePath": "/apps/api/Dockerfile", "dockerWorkDir": "/apps/api"}},
        "runtimeEnvironment": {**env, "SERVICE_ROLE": role},
        "ports": [{"name": "http", "internalPort": 8000, "public": True, "protocol": "HTTP"}] if role == "api" else []}
    if role == "api":
        data["healthChecks"] = [{"protocol": "HTTP", "type": "readinessProbe", "path": "/health", "port": 8000,
            "initialDelaySeconds": 10, "periodSeconds": 10, "timeoutSeconds": 5, "failureThreshold": 5, "successThreshold": 1}]
    Path(f".local/northflank-{role}.json").write_text(json.dumps(data))
Path(".local/production.env").write_text("\n".join(f"{key}={value}" for key, value in env.items()) + "\n")
print("Deployment definitions prepared in .local; credentials excluded from source control.")
