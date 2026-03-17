# Regulatory Dashboard FINAL

Pharmaceutical regulatory intelligence dashboard. React frontend + Flask backend,
powered by Teradata HCLS database and AWS Bedrock (Claude) for AI-assisted intervention analysis.

## Architecture

- **Frontend**: React (CRA) served by Nginx on port 8083
- **Backend**: Flask + Gunicorn on port 5130 (internal only, not exposed)
- **Database**: Teradata HCLS (47 tables)
- **AI**: AWS Bedrock — Claude Sonnet via agentic chat loop with scoped Teradata tool access

## Docker Deployment (recommended)

### Prerequisites
- Docker + Docker Compose
- A `backend/.env` file with credentials (see below — never commit this)

### Setup

```bash
# Clone the repo
git clone https://github.com/bcsolomon/regulatory-dashboard
cd regulatory-dashboard

# Create your .env from the example
cp backend/.env.example backend/.env
# Edit backend/.env with real credentials

# Build and start
docker-compose up --build -d

# Check status
docker-compose ps
curl http://localhost:8083/api/health
```

Dashboard available at: `http://your-host:8083`

### Managing containers

```bash
docker-compose down             # stop all containers
docker-compose up -d            # start (no rebuild)
docker-compose build backend    # rebuild backend only
docker-compose build frontend   # rebuild frontend only
docker-compose logs -f          # tail all logs
docker-compose logs -f backend  # tail backend only
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in all values:

```
TERADATA_HOST=your-teradata-host
TERADATA_USER=your-username
TERADATA_PASSWORD=your-password
FLASK_ENV=production
FLASK_DEBUG=False
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-5-20250929-v1:0
```

**Never commit `backend/.env`** — it is in `.gitignore`. Copy it to the VM manually:

```bash
scp backend/.env user@your-vm-ip:~/regulatory-dashboard/backend/.env
```

## Key Features

- KPI strip with ML outcome distribution and model confidence
- Protocol card view — per-submission ML predicted outcomes (4-class)
- Intervention queue with AI-assisted chat (Bedrock agentic loop + scoped Teradata tool access)
- Regional breakdown and ROI acceleration scenarios
- Model transparency card (accuracy, feature importances)

## HCLS Tables Used

| Table | Purpose |
|---|---|
| `Activity_Country` | Core submission records |
| `Product_Registration` | Product and pipeline data |
| `Submission_Risk_Features` | Risk scores and CMC/GMP status |
| `Submission_Predictions` | ML outcome scores (4-class) |
| `V_Approval_Predictions` | Enriched predictions view |
| `V_Intervention_Queue` | Priority-ranked active submissions |
| `V_ROI_Calculator` | Revenue acceleration scenarios |
| `ML_Model_Registry` | Model metadata and accuracy |
| `Feature_Importance` | Feature importance by model version |
| `V_GenAI_Context` | Pre-assembled context for AI chat |

## Notes

- Docker images are built for `linux/amd64`. If building on Apple Silicon (M1/M2/M3),
  the build will use emulation — this is expected and necessary for Teradata driver compatibility.
- The `backend/.env` is loaded at container runtime via `env_file` in `docker-compose.yml`.
  To update credentials on a running VM, edit `.env` and run `docker-compose up -d` (no rebuild needed).
