"""
Regulatory Dashboard Backend API
Flask server that connects to Teradata and provides REST endpoints

TERADATA SQL NOTES:
- Database: hcls
- Key views: V_Regulatory_Dashboard, V_Intervention_Queue, V_ROI_Calculator,
             V_Portfolio_Summary, V_Critical_Delays, V_Approval_Pipeline
- Key tables: Product_Registration, Activity_Country, Submission_Risk_Features
- Date arithmetic: Use CURRENT_DATE - N (not ADD_DAYS)
- Parameterized queries: Use ? for placeholders with cursor.execute(query, params)
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import teradatasql
from datetime import datetime
import os
from functools import wraps
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Teradata connection configuration
TERADATA_CONFIG = {
    'host': os.getenv('TERADATA_HOST', 'your-teradata-host'),
    'user': os.getenv('TERADATA_USER', 'your-username'),
    'password': os.getenv('TERADATA_PASSWORD', 'your-password'),
}

def get_teradata_connection():
    """Create Teradata connection"""
    try:
        conn = teradatasql.connect(
            host=TERADATA_CONFIG['host'],
            user=TERADATA_CONFIG['user'],
            password=TERADATA_CONFIG['password']
        )
        return conn
    except Exception as e:
        print(f"Error connecting to Teradata: {e}")
        raise

def execute_query(query, params=None):
    """Execute Teradata query and return results"""
    try:
        with get_teradata_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)

            columns = [desc[0] for desc in cursor.description]
            results = cursor.fetchall()

            return [dict(zip(columns, row)) for row in results]
    except Exception as e:
        print(f"Query error: {e}")
        raise

# Error handler decorator
def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function


# ============================================
# API ENDPOINTS
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})


@app.route('/api/kpis', methods=['GET'])
@handle_errors
def get_kpis():
    """
    Get top-level KPI metrics queried directly from Activity_Country +
    Product_Registration so filters work consistently for all fields.
    """
    region = request.args.get('region', 'all')
    sector = request.args.get('sector', 'all')
    status = request.args.get('status', 'all')
    days   = int(request.args.get('days', 9999))

    where_conditions = ["1=1"]
    if region != 'all':
        where_conditions.append(f"ac.Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"pr.Actv_Sectr = '{sector}'")
    if status != 'all':
        where_conditions.append(f"ac.Actv_Ctry_Sts = '{status}'")
    where_clause = " AND ".join(where_conditions)

    query = f"""
    SELECT
        COUNT(*)                                                              AS total_submissions,
        SUM(CASE WHEN ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
                 THEN pr.Peak_Sales_Potential ELSE 0 END) / 1000000000.0     AS total_pipeline_billions,
        COUNT(CASE WHEN ac.Actv_Ctry_Sts NOT IN ('Approved','Withdrawn')
                    AND ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
              THEN 1 END)                                                    AS pending_approvals,
        COUNT(CASE WHEN ac.Actv_Ctry_Sts = 'Approved'
                    AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                    AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}
               THEN 1 END)                                                   AS approved_ytd,
        AVG(CASE WHEN ac.Actv_Ctry_Sts = 'Approved'
                  AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                  AND ac.Helth_Auth_Init_Sbmn_Actl IS NOT NULL
                  AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}
             THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
             END)                                                             AS avg_cycle_time,
        COUNT(CASE WHEN ac.CRL_Received_Fl = 1
                    AND ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
               THEN 1 END)                                                   AS crl_count
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    WHERE {where_clause}
    """

    results = execute_query(query)
    if results:
        kpi = results[0]
        return jsonify({
            'totalSubmissions': int(kpi['total_submissions'] or 0),
            'totalPipeline':    round(float(kpi['total_pipeline_billions'] or 0), 1),
            'pendingApprovals': int(kpi['pending_approvals'] or 0),
            'approvedYTD':      int(kpi['approved_ytd'] or 0),
            'avgCycleTime':     round(float(kpi['avg_cycle_time'] or 0), 0),
            'crlCount':         int(kpi['crl_count'] or 0),
        })

    return jsonify({'error': 'No data found'}), 404


@app.route('/api/submissions', methods=['GET'])
@handle_errors
def get_submissions():
    """
    Get submission list with filtering.
    Sources: Activity_Country JOIN Product_Registration on Actv_Id / Prod_Id
    """
    region = request.args.get('region', 'all')
    sector = request.args.get('sector', 'all')
    status = request.args.get('status', 'all')
    days = int(request.args.get('days', 9999))  # default = all time

    where_conditions = ["1=1"]
    if region != 'all':
        where_conditions.append(f"ac.Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"pr.Actv_Sectr = '{sector}'")
    if status != 'all':
        where_conditions.append(f"ac.Actv_Ctry_Sts = '{status}'")
    # Time filter: active submissions submitted within window OR approved within window
    where_conditions.append(
        f"(ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}"
        f" OR (ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}))"
    )

    where_clause = " AND ".join(where_conditions)

    query = f"""
    SELECT
        ac.Actv_Id                       AS Protocol_ID,
        pr.Prod_Brnd_Nm                  AS Product,
        pr.Prod_Typ                      AS Product_Type,
        ac.Ctry_Name                     AS Country,
        ac.Ctry_Cd_Iso3                  AS Country_Code,
        ac.Global_Region,
        pr.Actv_Sectr                    AS Sector,
        ac.Regulatory_Authority,
        ac.Helth_Auth_Init_Sbmn_Actl     AS Submission_Date,
        ac.Actv_Ctry_Sts                 AS Submission_Status,
        ac.Helth_Auth_Init_Appr_Exptd    AS Expected_Approval_Date,
        ac.Helth_Auth_Init_Appr_Actl     AS Actual_Approval_Date,
        ac.CRL_Received_Fl,
        ac.CRL_Category,
        ac.Clock_Stop_Days,
        CASE
            WHEN ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
            ELSE CAST((CURRENT_DATE - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
        END AS Days_In_Review,
        CASE
            WHEN ac.Actv_Ctry_Sts <> 'Approved' AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
            ELSE 0
        END AS Days_Overdue,
        ac.Review_Pathway,
        pr.Peak_Sales_Potential / 1000000.0 AS Peak_Sales_Millions,
        pr.Rglt_Appr_By_Ctry             AS Regulatory_Approval_Status,
        pr.Mktg_Sts_By_Ctry              AS Marketing_Status,
        srf.Risk_Score_Overall           AS Risk_Score
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Submission_Risk_Features srf
        ON ac.Actv_Id = srf.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(srf.Ctry_Cd_Iso3)
    WHERE {where_clause}
    ORDER BY pr.Peak_Sales_Potential DESC
    """

    results = execute_query(query)
    return jsonify({'submissions': results})


@app.route('/api/interventions', methods=['GET'])
@handle_errors
def get_interventions():
    """
    Get prioritized intervention queue from V_Intervention_Queue.
    """
    query = """
    SELECT TOP 20
        Actv_Id                          AS Protocol_ID,
        Prod_Brnd_Nm                     AS Product,
        Ctry_Cd_Iso3                     AS Country_Code,
        Actv_Sectr                       AS Sector,
        Regulatory_Authority,
        CRL_Received_Fl,
        CRL_Category,
        GMP_Site_Status,
        CMC_Readiness_Score,
        Dose_Optimization_Status,
        Open_Deficiencies_Cnt,
        Days_Overdue,
        Risk_Score_Overall               AS Risk_Score,
        Recommended_Action,
        Priority_Score,
        Peak_Sales_Potential / 1000000.0 AS Revenue_At_Risk_Millions
    FROM hcls.V_Intervention_Queue
    ORDER BY Priority_Score DESC
    """
    results = execute_query(query)
    return jsonify({'interventions': results})


@app.route('/api/regional-breakdown', methods=['GET'])
@handle_errors
def get_regional_breakdown():
    """
    Get pipeline and risk by region directly from Activity_Country +
    Product_Registration so counts match the submissions table.
    """
    query = """
    SELECT
        ac.Global_Region,
        COUNT(*)                                                          AS submission_count,
        COUNT(CASE WHEN ac.Actv_Ctry_Sts = 'Approved' THEN 1 END)        AS approved_count,
        COUNT(CASE WHEN ac.Actv_Ctry_Sts NOT IN ('Approved','Withdrawn') THEN 1 END) AS active_count,
        SUM(pr.Peak_Sales_Potential) / 1000000000.0                      AS pipeline_billions,
        SUM(CASE WHEN ac.Actv_Ctry_Sts <> 'Approved'
                  AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                  AND ac.Helth_Auth_Init_Appr_Exptd < CURRENT_DATE
             THEN pr.Peak_Sales_Potential ELSE 0 END) / 1000000.0        AS revenue_at_risk_millions,
        AVG(CAST(srf.Risk_Score_Overall AS FLOAT))                        AS avg_risk_score,
        SUM(pr.Peak_Sales_Potential * 30.0 / 365.0) / 1000000.0         AS accel_30d_millions,
        SUM(pr.Peak_Sales_Potential * 60.0 / 365.0) / 1000000.0         AS accel_60d_millions,
        SUM(pr.Peak_Sales_Potential * 90.0 / 365.0) / 1000000.0         AS accel_90d_millions
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Submission_Risk_Features srf
        ON ac.Actv_Id = srf.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(srf.Ctry_Cd_Iso3)
    GROUP BY ac.Global_Region
    ORDER BY pipeline_billions DESC
    """
    results = execute_query(query)
    return jsonify({'regions': results})


@app.route('/api/roi-scenarios', methods=['GET'])
@handle_errors
def get_roi_scenarios():
    """
    Get ROI acceleration scenarios from V_ROI_Calculator.
    Supports optional region/sector filters.
    """
    region = request.args.get('region', 'all')
    sector = request.args.get('sector', 'all')

    where_conditions = ["Revenue_At_Risk_USD > 0"]
    if region != 'all':
        where_conditions.append(f"Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"Sector = '{sector}'")
    where_clause = " AND ".join(where_conditions)

    query = f"""
    SELECT
        SUM(Value_30Day_Accel_USD) / 1000000.0  AS accel_30d_millions,
        SUM(Value_60Day_Accel_USD) / 1000000.0  AS accel_60d_millions,
        SUM(Value_90Day_Accel_USD) / 1000000.0  AS accel_90d_millions,
        SUM(Revenue_At_Risk_USD) / 1000000.0    AS total_revenue_at_risk_millions,
        SUM(CRL_Revenue_Impact_USD) / 1000000.0 AS crl_revenue_impact_millions
    FROM hcls.V_ROI_Calculator
    WHERE {where_clause}
    """

    results = execute_query(query)
    if results:
        r = results[0]
        return jsonify({
            'accel30Days': round(float(r['accel_30d_millions'] or 0), 1),
            'accel60Days': round(float(r['accel_60d_millions'] or 0), 1),
            'accel90Days': round(float(r['accel_90d_millions'] or 0), 1),
            'totalRevenueAtRisk': round(float(r['total_revenue_at_risk_millions'] or 0), 1),
            'crlRevenueImpact': round(float(r['crl_revenue_impact_millions'] or 0), 1),
        })

    return jsonify({'error': 'No data'}), 404


@app.route('/api/submission-details/<actv_id>/<country_code>', methods=['GET'])
@handle_errors
def get_submission_details(actv_id, country_code):
    """
    Get detailed information for a specific submission (drill-down).
    Joins Activity_Country + Product_Registration + Submission_Risk_Features.
    """
    query = """
    SELECT
        ac.Actv_Id                       AS Protocol_ID,
        pr.Prod_Brnd_Nm                  AS Product,
        pr.Prod_Typ                      AS Product_Type,
        ac.Ctry_Name                     AS Country,
        ac.Ctry_Cd_Iso3                  AS Country_Code,
        ac.Global_Region,
        pr.Actv_Sectr                    AS Sector,
        ac.Regulatory_Authority,
        ac.Submission_Type,
        ac.Helth_Auth_Init_Sbmn_Actl     AS Submission_Date,
        ac.Helth_Auth_Init_Sbmn_Sts      AS Submission_Status,
        ac.Helth_Auth_Init_Appr_Exptd    AS Expected_Approval_Date,
        ac.Helth_Auth_Init_Appr_Actl     AS Actual_Approval_Date,
        ac.Clock_Stop_Days,
        CASE
            WHEN ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
            ELSE CAST((CURRENT_DATE - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
        END AS Days_In_Review,
        CASE
            WHEN ac.Actv_Ctry_Sts <> 'Approved' AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
            ELSE 0
        END AS Days_Overdue,
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
        pr.Rglt_Appr_By_Ctry             AS Regulatory_Approval_Status,
        pr.Mktg_Sts_By_Ctry              AS Marketing_Status,
        pr.Blgc_Prod_In                  AS Is_Biologic,
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
    WHERE ac.Actv_Id = ?
    AND TRIM(ac.Ctry_Cd_Iso3) = ?
    """

    results = execute_query(query, (actv_id, country_code.strip()))

    if results:
        return jsonify({'submission': results[0]})

    return jsonify({'error': 'Submission not found'}), 404


@app.route('/api/critical-delays', methods=['GET'])
@handle_errors
def get_critical_delays():
    """
    Get critical delayed submissions from V_Critical_Delays.
    """
    query = """
    SELECT
        Actv_Id                          AS Protocol_ID,
        Prod_Brnd_Nm                     AS Product,
        Ctry_Name                        AS Country,
        Ctry_Cd_Iso3                     AS Country_Code,
        Actv_Sectr                       AS Sector,
        Regulatory_Authority,
        Actv_Ctry_Sts                    AS Status,
        Days_Overdue,
        Risk_Score_Overall               AS Risk_Score,
        Primary_Delay_Driver,
        CRL_Received_Fl,
        CRL_Category,
        GMP_Site_Status,
        CMC_Readiness_Score,
        Clock_Stop_Days,
        Open_Deficiencies_Cnt,
        Resubmission_Cycle,
        Review_Pathway,
        Module3_CMC_Complete_Fl,
        Module5_Clinical_Complete_Fl,
        Dose_Optimization_Status,
        Stability_Data_Status,
        Clinical_Data_Gap_Type,
        Peak_Sales_Potential / 1000000.0 AS Peak_Sales_Millions
    FROM hcls.V_Critical_Delays
    ORDER BY Days_Overdue DESC, Risk_Score_Overall DESC
    """
    results = execute_query(query)
    return jsonify({'criticalDelays': results})


@app.route('/api/approval-pipeline', methods=['GET'])
@handle_errors
def get_approval_pipeline():
    """
    Get pipeline breakdown by region/sector/status from V_Approval_Pipeline.
    """
    region = request.args.get('region', 'all')
    sector = request.args.get('sector', 'all')

    where_conditions = ["1=1"]
    if region != 'all':
        where_conditions.append(f"Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"Sector = '{sector}'")
    where_clause = " AND ".join(where_conditions)

    query = f"""
    SELECT
        Global_Region,
        Sector,
        Regulatory_Authority,
        Review_Pathway,
        Status,
        Submission_Count,
        CRL_Count,
        Avg_Clock_Stop_Days,
        Pipeline_Value_USD / 1000000.0  AS Pipeline_Value_Millions
    FROM hcls.V_Approval_Pipeline
    WHERE {where_clause}
    ORDER BY Pipeline_Value_USD DESC
    """
    results = execute_query(query)
    return jsonify({'pipeline': results})


@app.route('/api/portfolio-summary', methods=['GET'])
@handle_errors
def get_portfolio_summary():
    """
    Get portfolio summary by sector from V_Portfolio_Summary.
    """
    query = """
    SELECT
        Sector,
        Protocols,
        Total_Submissions,
        Approved,
        CRLs_Received,
        High_Risk,
        Orbis_Submissions,
        Avg_CMC_Readiness,
        Avg_Enrollment_Pct,
        Total_Pipeline_USD / 1000000000.0 AS Pipeline_Billions
    FROM hcls.V_Portfolio_Summary
    ORDER BY Total_Pipeline_USD DESC
    """
    results = execute_query(query)
    return jsonify({'portfolio': results})


if __name__ == '__main__':
    # Development server
    app.run(debug=True, host='0.0.0.0', port=5123)
