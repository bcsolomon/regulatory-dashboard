# Changelog

## v1.0.0 — March 2026

Initial release of the Regulatory Dashboard.

### Stack
- React 18 frontend, Flask backend, Teradata VantageCloud (`hcls` database)
- Backend runs on port 5123, frontend on port 3000
- One-command startup via `start.sh`

### Dashboard
- KPI strip: total pipeline, pending approvals, approvals in time window, avg cycle time (submission→approval), CRL count
- Region cards: clickable pipeline/risk/acceleration breakdown by region — click to filter entire dashboard
- Active submissions table: all 180 rows, filterable by region, sector, status, and time range
- Intervention queue: top 20 priority interventions from `V_Intervention_Queue`
- ROI panel: 30/60/90 day revenue acceleration scenarios from `V_ROI_Calculator`

### Filters
- Region, therapeutic area, submission status, and time range
- All filters applied consistently across KPI strip and submissions table
- Time filter uses approval date for approved metrics and submission date for active metrics

### Submission Detail Modal
- Drill-down on any table row, keyed by protocol ID + country code
- Shows review timeline, financial impact, CRL status, risk and manufacturing fields
- Record Action form: log action type, owner, and notes (stored in localStorage)
- Export JSON: downloads all submission fields as a structured JSON file

### Risk Scoring
- Scores (1–10) stored in `Submission_Risk_Features.Risk_Score_Overall`
- Calculated from days overdue (primary), submission status, CRL received, and CMC readiness
- Color coded in status pill: red (7–10), amber (5–6), yellow (3–4), green (1–2)

### Data Layer
- Base tables: `Activity_Country`, `Product_Registration`, `Submission_Risk_Features`
- Views: `V_Intervention_Queue`, `V_ROI_Calculator`
- All joins use `TRIM(Ctry_Cd_Iso3)` to handle Teradata CHAR padding
- Computed columns: `Days_In_Review`, `Days_Overdue` calculated in SQL at query time

### Currency Formatting
- Shared `formatBillions` / `formatMillions` utility across all components
- Values ≥ $1B display as `$X.XB`, values < $1B display as `$XXXM`
