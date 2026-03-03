# Regulatory Dashboard

**React + Flask + Teradata**

A pharmaceutical regulatory intelligence dashboard built on Teradata VantageCloud. Tracks global drug submission timelines, approval status, revenue at risk, and intervention priorities across regions and therapeutic areas — all backed by live Teradata queries.

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+
- Teradata VantageCloud access (`hcls` database)

### 1. Clone the repo

```bash
git clone https://github.com/your-org/regulatory-dashboard.git
cd regulatory-dashboard-app
```

### 2. Start everything (recommended)

```bash
chmod +x start.sh
./start.sh
```

This installs dependencies, starts the Flask backend on port **5123** and the React frontend on port **3000**.

### 3. Or start manually

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then edit with your Teradata credentials
python app.py
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

Open **http://localhost:3000**

---

## Configuration

### `backend/.env`

```bash
TERADATA_HOST=your-teradata-host.teradata.com
TERADATA_USER=your_username
TERADATA_PASSWORD=your_password
```

The app connects to the `hcls` database. No additional database config is required — all table and view references are fully qualified (`hcls.Activity_Country`, etc.).

---

## Features

### Dashboard Panels

| Panel | Description |
|---|---|
| **Region Cards** | Clickable pipeline breakdown by region — click to filter the entire dashboard |
| **KPI Strip** | Total pipeline, pending approvals, approvals in window, avg cycle time, CRL count |
| **Active Submissions** | Full submission list with status, days in review, days overdue, risk score, and peak sales |
| **Intervention Queue** | Top 20 priority interventions from `V_Intervention_Queue`, color-coded by urgency |
| **ROI Panel** | Revenue recoverable at 30/60/90 day acceleration scenarios |

### Filters

All filters are applied globally across the KPI strip and submissions table:

| Filter | Field | Values |
|---|---|---|
| Region | `Activity_Country.Global_Region` | United States, Europe, Asia-Pacific Africa, W Hemisphere Ex-US |
| Therapeutic Area | `Product_Registration.Actv_Sectr` | Oncology, Immunology, Cardiovascular, Neurology, Rare Disease |
| Status | `Activity_Country.Actv_Ctry_Sts` | Under Review, Approved, Additional Data Required, Additional Information Requested, Pending Resubmission, Withdrawn |
| Time Range | Submission or approval date | All Time, 2 Years, 1 Year, 6 Months, 90 Days |

### Submission Detail Modal

Click any row in the submissions table to open a drill-down modal showing:
- Full submission info (protocol, product, country, agency, dates)
- Review status (days in review, days overdue, clock stop days, review pathway, risk score)
- Financial impact (peak sales for this country, daily value at stake)
- CRL status and category
- Risk & manufacturing (CMC readiness, GMP site status, dose optimization, stability data, clinical data gap)
- **Record Action** — log a follow-up, escalation, agency meeting request, CRL response, etc.
- **Export JSON** — download all submission fields as a structured JSON file

### Risk Scoring

Risk scores (1–10) are stored in `Submission_Risk_Features.Risk_Score_Overall` and calculated from:

| Component | Points |
|---|---|
| Days past expected approval (>1500d) | 6 |
| Days past expected approval (>900d) | 5 |
| Days past expected approval (>365d) | 4 |
| Days past expected approval (>180d) | 3 |
| Days past expected approval (>90d) | 2 |
| Status: Additional Data Required / Pending Resubmission | +2 |
| Status: Additional Information Requested | +1 |
| CRL received | +2 |
| CMC Readiness ≤ 3 | +1 |

**Color coding:**

| Score | Color | Meaning |
|---|---|---|
| 7–10 | 🔴 Red | Critical |
| 5–6 | 🟠 Amber | Warning |
| 3–4 | 🟡 Yellow | Moderate concern |
| 1–2 | 🟢 Green | On track |

---

## API Endpoints

All endpoints return JSON. Base URL: `http://localhost:5123/api`

### `GET /api/health`
Health check.

```json
{ "status": "healthy", "timestamp": "2026-03-02T..." }
```

---

### `GET /api/kpis`

**Query params:** `region`, `sector`, `status`, `days`

Returns KPI metrics. The `days` filter applies to submission date for pipeline/pending/CRLs and to approval date for the approved count and avg cycle time — so time windows are always meaningful regardless of when submissions were filed.

```json
{
  "totalSubmissions": 180,
  "totalPipeline": 48.8,
  "pendingApprovals": 75,
  "approvedYTD": 18,
  "avgCycleTime": 363.0,
  "crlCount": 9
}
```

---

### `GET /api/submissions`

**Query params:** `region`, `sector`, `status`, `days`

Returns the full submission list. Time filter includes rows submitted within the window OR approved within the window (so recently approved submissions remain visible).

Key computed fields:
- `Days_In_Review` — for approved: submission→approval duration; for active: submission→today
- `Days_Overdue` — days past `Helth_Auth_Init_Appr_Exptd`; 0 if on track or approved
- `Risk_Score` — from `Submission_Risk_Features`

---

### `GET /api/submission-details/<actv_id>/<country_code>`

Drill-down for a specific protocol + country combination. Both are required because the same protocol (`Actv_Id`) exists in multiple countries.

---

### `GET /api/interventions`

Returns top 20 records from `V_Intervention_Queue` ordered by `Priority_Score`. Not filtered by dashboard filters — always shows the global priority list.

---

### `GET /api/regional-breakdown`

Returns per-region aggregates: submission count, approved count, active count, pipeline value, revenue at risk, avg risk score, and 30/60/90 day acceleration estimates. Used to populate the region cards and the "All Regions" total card.

---

### `GET /api/roi-scenarios`

**Query params:** `region`, `sector`

Returns 30/60/90 day acceleration values from `V_ROI_Calculator`. Only filters by region and sector (not status or days).

---

## Database Objects

**Database:** `hcls`

### Base Tables

| Table | Purpose |
|---|---|
| `Activity_Country` | Core submissions — status, dates, region, CRL, clock stop, review pathway |
| `Product_Registration` | Product info — brand name, type, sector, peak sales, regulatory approval status |
| `Submission_Risk_Features` | Risk scores, CMC readiness, GMP status, dose optimization, stability data |

### Views

| View | Used By |
|---|---|
| `V_Intervention_Queue` | `/api/interventions` — priority-ranked submissions needing action |
| `V_ROI_Calculator` | `/api/roi-scenarios` — 30/60/90 day revenue acceleration by region/sector |
| `V_Critical_Delays` | `/api/critical-delays` — delay driver analysis (endpoint available, not yet in UI) |
| `V_Approval_Pipeline` | `/api/approval-pipeline` — pipeline by region/sector/status (endpoint available, not yet in UI) |
| `V_Portfolio_Summary` | `/api/portfolio-summary` — sector-level rollup (endpoint available, not yet in UI) |

### Join Key

All three base tables join on `Actv_Id + TRIM(Ctry_Cd_Iso3)`.

> ⚠️ `Ctry_Cd_Iso3` is a `CHAR(6)` field — Teradata pads it with spaces. Always use `TRIM()` on both sides of the join or filters will silently drop rows.

---

## Project Structure

```
regulatory-dashboard-app/
├── start.sh                        # One-command startup script
├── queries.md                      # Full SQL query reference with comments
├── README.md
├── backend/
│   ├── app.py                      # Flask API — all endpoints and queries
│   ├── requirements.txt
│   ├── .env                        # Teradata credentials (not committed)
│   └── .env.example
└── frontend/
    ├── package.json
    └── src/
        ├── App.js                  # Root component, state, filter logic, data fetching
        ├── App.css                 # All styling
        ├── components/
        │   ├── FilterBar.js        # Region / sector / status / time range dropdowns
        │   ├── KPIStrip.js         # 5-metric KPI bar, label updates with time filter
        │   ├── RegionalBreakdown.js # Clickable region cards with pipeline bars
        │   ├── SubmissionTable.js  # Main data table — status pills, days bar, risk score
        │   ├── SubmissionModal.js  # Drill-down modal with Record Action + Export JSON
        │   ├── InterventionQueue.js # Priority intervention list
        │   └── ROIPanel.js         # 30/60/90 day acceleration bar chart
        ├── services/
        │   └── api.js              # Axios API client — all endpoint calls
        └── utils/
            └── currency.js         # formatBillions / formatMillions helpers
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Axios |
| Backend | Python 3, Flask, Flask-CORS |
| Database driver | teradatasql 17.20 |
| Database | Teradata VantageCloud (`hcls`) |
| Styling | Custom CSS (no framework) |

---

## SQL Reference

See [`queries.md`](./queries.md) for the complete SQL query reference including all 6 active queries with inline comments, the risk score formula, and common Teradata pitfalls (TRIM on CHAR fields, `<>` vs `!=`, date arithmetic).

---

## Deployment

### Development (default)
- Backend: `python app.py` → port 5123
- Frontend: `npm start` → port 3000

### Production

**Backend:**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5123 app:app
```

**Frontend:**
```bash
npm run build
# Deploy the build/ folder to any static host (Nginx, S3, Vercel, etc.)
# Set REACT_APP_API_URL env var to point to your production backend URL
```

---

**Built by Teradata Solutions Engineering**
**Powered by Teradata VantageCloud**
