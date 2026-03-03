# Regulatory Dashboard — SQL Query Reference

**Database:** `hcls`  
**Backend:** Flask (`app.py`) running on port 5123  
**Last Updated:** March 2026

---

## Database Objects In Use

### Base Tables
| Table | Purpose |
|---|---|
| `hcls.Activity_Country` | Core submissions — status, dates, region, CRL, review pathway |
| `hcls.Product_Registration` | Product info — brand name, type, sector, peak sales |
| `hcls.Submission_Risk_Features` | Risk scores, CMC readiness, GMP status, dose/stability data |

### Views
| View | Purpose |
|---|---|
| `hcls.V_Intervention_Queue` | Priority-ranked submissions needing action |
| `hcls.V_ROI_Calculator` | 30/60/90 day revenue acceleration scenarios by region/sector |

### Join Key
All three base tables join on `Actv_Id + TRIM(Ctry_Cd_Iso3)`.  
`Ctry_Cd_Iso3` is a CHAR(6) field — always use `TRIM()` or comparisons will silently fail.

---

## Queries

---

### 1. KPI Strip
**Endpoint:** `GET /api/kpis?region=&sector=&status=&days=`  
**UI Component:** KPI bar (Total Pipeline, Pending Approvals, Approved, Avg Cycle Time, CRLs)  
**Notes:**
- `days` filter applied inside CASE expressions per metric, not in WHERE clause
- Approved count and avg cycle time filter on `Helth_Auth_Init_Appr_Actl` (approval date)
- Pipeline, pending, CRL count filter on `Helth_Auth_Init_Sbmn_Actl` (submission date)
- Avg cycle time = actual days from submission to approval on approved records only

```sql
SELECT
    COUNT(*)                                                                AS total_submissions,

    -- Pipeline: sum peak sales for submissions within the time window
    SUM(CASE WHEN ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
             THEN pr.Peak_Sales_Potential ELSE 0 END) / 1000000000.0       AS total_pipeline_billions,

    -- Pending: not approved/withdrawn, submitted within window
    COUNT(CASE WHEN ac.Actv_Ctry_Sts NOT IN ('Approved','Withdrawn')
                AND ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
          THEN 1 END)                                                       AS pending_approvals,

    -- Approved: approval date falls within the time window
    COUNT(CASE WHEN ac.Actv_Ctry_Sts = 'Approved'
                AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}
          THEN 1 END)                                                       AS approved_ytd,

    -- Avg cycle time: submission-to-approval days on approved records in window
    AVG(CASE WHEN ac.Actv_Ctry_Sts = 'Approved'
              AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
              AND ac.Helth_Auth_Init_Sbmn_Actl IS NOT NULL
              AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}
         THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
         END)                                                               AS avg_cycle_time,

    -- CRL count: CRL received, submitted within window
    COUNT(CASE WHEN ac.CRL_Received_Fl = 1
                AND ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
          THEN 1 END)                                                       AS crl_count

FROM hcls.Activity_Country ac
JOIN hcls.Product_Registration pr
    ON ac.Actv_Id = pr.Actv_Id
   AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
WHERE {where_clause}
-- where_clause examples:
--   ac.Global_Region = 'United States'
--   pr.Actv_Sectr = 'Oncology'
--   ac.Actv_Ctry_Sts = 'Under Review'
```

---

### 2. Active Submissions Table
**Endpoint:** `GET /api/submissions?region=&sector=&status=&days=`  
**UI Component:** Submissions table with status pill, days bar, risk score  
**Notes:**
- Time filter uses OR logic: show if submitted within window OR approved within window
- `Days_In_Review`: for approved = submission→approval duration; for active = submission→today
- `Days_Overdue`: days past `Helth_Auth_Init_Appr_Exptd`; 0 if not yet due or approved
- `Risk_Score` drives status pill color (7+= red, 5-6 = amber, 3-4 = yellow, 1-2 = green)

```sql
SELECT
    ac.Actv_Id                          AS Protocol_ID,
    pr.Prod_Brnd_Nm                     AS Product,
    pr.Prod_Typ                         AS Product_Type,
    ac.Ctry_Name                        AS Country,
    ac.Ctry_Cd_Iso3                     AS Country_Code,
    ac.Global_Region,
    pr.Actv_Sectr                       AS Sector,
    ac.Regulatory_Authority,
    ac.Helth_Auth_Init_Sbmn_Actl        AS Submission_Date,
    ac.Actv_Ctry_Sts                    AS Submission_Status,
    ac.Helth_Auth_Init_Appr_Exptd       AS Expected_Approval_Date,
    ac.Helth_Auth_Init_Appr_Actl        AS Actual_Approval_Date,
    ac.CRL_Received_Fl,
    ac.CRL_Category,
    ac.Clock_Stop_Days,

    -- Days in review: actual duration for approved, elapsed for active
    CASE
        WHEN ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
            THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
        ELSE CAST((CURRENT_DATE - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
    END                                 AS Days_In_Review,

    -- Days overdue: how far past expected approval date (0 if on track or approved)
    CASE
        WHEN ac.Actv_Ctry_Sts <> 'Approved' AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
            THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
        ELSE 0
    END                                 AS Days_Overdue,

    ac.Review_Pathway,
    pr.Peak_Sales_Potential / 1000000.0 AS Peak_Sales_Millions,
    pr.Rglt_Appr_By_Ctry                AS Regulatory_Approval_Status,
    pr.Mktg_Sts_By_Ctry                 AS Marketing_Status,
    srf.Risk_Score_Overall              AS Risk_Score

FROM hcls.Activity_Country ac
JOIN hcls.Product_Registration pr
    ON ac.Actv_Id = pr.Actv_Id
   AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
LEFT JOIN hcls.Submission_Risk_Features srf
    ON ac.Actv_Id = srf.Actv_Id
   AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(srf.Ctry_Cd_Iso3)
WHERE {where_clause}
  AND (
    ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
    OR (ac.Actv_Ctry_Sts = 'Approved'
        AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days})
  )
ORDER BY pr.Peak_Sales_Potential DESC
```

---

### 3. Submission Detail (Drill-Down Modal)
**Endpoint:** `GET /api/submission-details/<actv_id>/<country_code>`  
**UI Component:** Modal popup on row click  
**Notes:**
- Both `Actv_Id` AND `Ctry_Cd_Iso3` required — same protocol exists in multiple countries
- Uses parameterized query (`?`) to prevent SQL injection
- `Helth_Auth_Init_Sbmn_Sts` used for display status (submission status field)
- SRF joined on `Actv_Id` only here (intentional — detail view pulls all risk fields)

```sql
SELECT
    ac.Actv_Id                          AS Protocol_ID,
    pr.Prod_Brnd_Nm                     AS Product,
    pr.Prod_Typ                         AS Product_Type,
    ac.Ctry_Name                        AS Country,
    ac.Ctry_Cd_Iso3                     AS Country_Code,
    ac.Global_Region,
    pr.Actv_Sectr                       AS Sector,
    ac.Regulatory_Authority,
    ac.Submission_Type,
    ac.Helth_Auth_Init_Sbmn_Actl        AS Submission_Date,
    ac.Helth_Auth_Init_Sbmn_Sts         AS Submission_Status,
    ac.Helth_Auth_Init_Appr_Exptd       AS Expected_Approval_Date,
    ac.Helth_Auth_Init_Appr_Actl        AS Actual_Approval_Date,
    ac.Clock_Stop_Days,

    CASE
        WHEN ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
            THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
        ELSE CAST((CURRENT_DATE - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
    END                                 AS Days_In_Review,

    CASE
        WHEN ac.Actv_Ctry_Sts <> 'Approved' AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
            THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
        ELSE 0
    END                                 AS Days_Overdue,

    ac.CRL_Received_Fl,
    ac.CRL_Received_Dt,
    ac.CRL_Category,
    ac.Review_Pathway,
    ac.Resubmission_Cycle,
    ac.Project_Orbis_Fl,
    ac.Parallel_Scientific_Advice_Fl,
    ac.Num_Of_Sites,
    ac.Num_Of_Subjs_Exptd,
    ac.Num_Of_Subjs_Enrld,
    pr.Peak_Sales_Potential / 1000000.0 AS Peak_Sales_Millions,
    pr.Rglt_Appr_By_Ctry                AS Regulatory_Approval_Status,
    pr.Mktg_Sts_By_Ctry                 AS Marketing_Status,
    pr.Blgc_Prod_In                     AS Is_Biologic,
    srf.Risk_Score_Overall,
    srf.CMC_Readiness_Score,
    srf.GMP_Site_Status,
    srf.Dose_Optimization_Status,
    srf.Stability_Data_Status,
    srf.Clinical_Data_Gap_Type

FROM hcls.Activity_Country ac
JOIN hcls.Product_Registration pr
    ON ac.Actv_Id = pr.Actv_Id
   AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
LEFT JOIN hcls.Submission_Risk_Features srf
    ON ac.Actv_Id = srf.Actv_Id
WHERE ac.Actv_Id = ?              -- parameterized: protocol ID
  AND TRIM(ac.Ctry_Cd_Iso3) = ?  -- parameterized: country code (trimmed)
```

---

### 4. Intervention Queue
**Endpoint:** `GET /api/interventions`  
**UI Component:** Intervention queue panel (right side, no filters applied)  
**Notes:**
- Static — does not respond to dashboard filters (region/sector/status/days)
- Sorted by `Priority_Score` from the view's own ranking logic
- `Revenue_At_Risk_Millions` = `Peak_Sales_Potential / 1000000` from the view

```sql
SELECT TOP 20
    Actv_Id                             AS Protocol_ID,
    Prod_Brnd_Nm                        AS Product,
    Ctry_Cd_Iso3                        AS Country_Code,
    Actv_Sectr                          AS Sector,
    Regulatory_Authority,
    CRL_Received_Fl,
    CRL_Category,
    GMP_Site_Status,
    CMC_Readiness_Score,
    Dose_Optimization_Status,
    Open_Deficiencies_Cnt,
    Days_Overdue,
    Risk_Score_Overall                  AS Risk_Score,
    Recommended_Action,
    Priority_Score,
    Peak_Sales_Potential / 1000000.0    AS Revenue_At_Risk_Millions
FROM hcls.V_Intervention_Queue
ORDER BY Priority_Score DESC
```

---

### 5. Regional Breakdown Cards
**Endpoint:** `GET /api/regional-breakdown`  
**UI Component:** Region cards below the header (clickable filter)  
**Notes:**
- Static — does not respond to dashboard filters
- Revenue at risk = overdue peak sales (past expected approval date, not yet approved)
- Acceleration values = simple proxy: peak_sales * days / 365 (not from V_ROI_Calculator)
- Avg risk score LEFT JOINed from SRF — NULL for records with no risk entry
- TRIM required on both sides of Ctry_Cd_Iso3 join to avoid CHAR padding issues

```sql
SELECT
    ac.Global_Region,
    COUNT(*)                                                            AS submission_count,
    COUNT(CASE WHEN ac.Actv_Ctry_Sts = 'Approved' THEN 1 END)          AS approved_count,
    COUNT(CASE WHEN ac.Actv_Ctry_Sts NOT IN ('Approved','Withdrawn')
               THEN 1 END)                                             AS active_count,
    SUM(pr.Peak_Sales_Potential) / 1000000000.0                        AS pipeline_billions,

    -- Revenue at risk: overdue submissions only (past expected approval date)
    SUM(CASE WHEN ac.Actv_Ctry_Sts <> 'Approved'
              AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
              AND ac.Helth_Auth_Init_Appr_Exptd < CURRENT_DATE
         THEN pr.Peak_Sales_Potential ELSE 0 END) / 1000000.0          AS revenue_at_risk_millions,

    AVG(CAST(srf.Risk_Score_Overall AS FLOAT))                          AS avg_risk_score,

    -- Acceleration opportunity: proxy based on peak sales / 365 * days
    SUM(pr.Peak_Sales_Potential * 30.0 / 365.0) / 1000000.0           AS accel_30d_millions,
    SUM(pr.Peak_Sales_Potential * 60.0 / 365.0) / 1000000.0           AS accel_60d_millions,
    SUM(pr.Peak_Sales_Potential * 90.0 / 365.0) / 1000000.0           AS accel_90d_millions

FROM hcls.Activity_Country ac
JOIN hcls.Product_Registration pr
    ON ac.Actv_Id = pr.Actv_Id
   AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
LEFT JOIN hcls.Submission_Risk_Features srf
    ON ac.Actv_Id = srf.Actv_Id
   AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(srf.Ctry_Cd_Iso3)
GROUP BY ac.Global_Region
ORDER BY pipeline_billions DESC
```

---

### 6. ROI Acceleration Panel
**Endpoint:** `GET /api/roi-scenarios?region=&sector=`  
**UI Component:** ROI bar chart (30/60/90 day revenue scenarios)  
**Notes:**
- Filters by region and sector only (no status or days filter)
- Sourced from `V_ROI_Calculator` view — uses view's own acceleration calculation
- `Revenue_At_Risk_USD > 0` base filter excludes approved/on-track submissions

```sql
SELECT
    SUM(Value_30Day_Accel_USD) / 1000000.0      AS accel_30d_millions,
    SUM(Value_60Day_Accel_USD) / 1000000.0      AS accel_60d_millions,
    SUM(Value_90Day_Accel_USD) / 1000000.0      AS accel_90d_millions,
    SUM(Revenue_At_Risk_USD) / 1000000.0        AS total_revenue_at_risk_millions,
    SUM(CRL_Revenue_Impact_USD) / 1000000.0     AS crl_revenue_impact_millions
FROM hcls.V_ROI_Calculator
WHERE Revenue_At_Risk_USD > 0
-- Optional filters appended dynamically:
--   AND Global_Region = '{region}'
--   AND Sector = '{sector}'
```

---

## Risk Score Formula

Risk scores stored in `hcls.Submission_Risk_Features.Risk_Score_Overall` (BYTEINT, 1–10).  
Recalculated via UPDATE using this logic:

```sql
-- Days overdue component (1–6 points)
CASE
    WHEN ac.Actv_Ctry_Sts IN ('Approved','Withdrawn')                         THEN 0
    WHEN ac.Helth_Auth_Init_Appr_Exptd IS NULL                                THEN 1
    WHEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER) > 1500 THEN 6
    WHEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER) > 900  THEN 5
    WHEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER) > 365  THEN 4
    WHEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER) > 180  THEN 3
    WHEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER) > 90   THEN 2
    ELSE 1
END
-- Status component (0–2 points)
+ CASE
    WHEN ac.Actv_Ctry_Sts IN ('Additional Data Required',
                               'Pending Resubmission Review') THEN 2
    WHEN ac.Actv_Ctry_Sts = 'Additional Information Requested' THEN 1
    ELSE 0
  END
-- CRL received (0–2 points)
+ CASE WHEN ac.CRL_Received_Fl = 1 THEN 2 ELSE 0 END
-- Low CMC readiness (0–1 point)
+ CASE WHEN srf.CMC_Readiness_Score <= 3 THEN 1 ELSE 0 END
-- Capped at 1–10
```

**Score interpretation:**
| Score | Color | Meaning |
|---|---|---|
| 7–10 | 🔴 Red | Critical — severely overdue + problematic status |
| 5–6 | 🟠 Amber | Warning — overdue or high-risk factors |
| 3–4 | 🟡 Yellow | Moderate concern |
| 1–2 | 🟢 Green | On track or recently approved |

---

## Common Pitfalls

- **TRIM on Ctry_Cd_Iso3** — it's CHAR(6), always pads with spaces. Without TRIM the join silently drops rows when filters are applied.
- **`!=` not supported** — use `<>` for not-equal in Teradata SQL.
- **No inline comments in UPDATE** — `--` comments inside a correlated subquery UPDATE cause syntax errors.
- **Date arithmetic** — use `CURRENT_DATE - N` (integer days). Use `ADD_MONTHS()` for month-based arithmetic.
- **`CAST` for date diff** — Teradata date subtraction returns an interval type; always `CAST(... AS INTEGER)`.
