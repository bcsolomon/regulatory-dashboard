"""
Regulatory Dashboard FINAL
Flask backend — agentic chat with scoped Teradata tool access via MCP
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import teradatasql
from datetime import datetime
import os
import re
import json as json_lib
import base64
import requests as http_requests
from functools import wraps
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / '.env')

app = Flask(__name__)
CORS(app)

TERADATA_CONFIG = {
    'host':     os.getenv('TERADATA_HOST', 'your-teradata-host'),
    'user':     os.getenv('TERADATA_USER', 'your-username'),
    'password': os.getenv('TERADATA_PASSWORD', 'your-password'),
}

def get_teradata_connection():
    return teradatasql.connect(
        host=TERADATA_CONFIG['host'],
        user=TERADATA_CONFIG['user'],
        password=TERADATA_CONFIG['password']
    )

def execute_query(query, params=None):
    try:
        with get_teradata_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Query error: {e}")
        raise

def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function


# ============================================================
# MCP CONFIG
# ============================================================

MCP_URL      = os.getenv('MCP_URL', 'http://10.27.109.168:8001/mcp')
MCP_USER     = os.getenv('MCP_USER', os.getenv('TERADATA_USER', 'your-username'))
MCP_PASSWORD = os.getenv('MCP_PASSWORD', os.getenv('TERADATA_PASSWORD', 'your-password'))

MCP_ALLOWED_TOOLS = {
    'base_readQuery',    # primary tool — query the allowed views below
    'base_tablePreview', # preview a view's sample data when needed
}

def mcp_auth_header():
    token = base64.b64encode(f'{MCP_USER}:{MCP_PASSWORD}'.encode()).decode()
    return {
        'Authorization': f'Basic {token}',
        'Content-Type':  'application/json',
        'Accept':        'application/json',
    }

def mcp_call(tool_name: str, arguments: dict, call_id: int = 1) -> str:
    """Call a tool on the Teradata MCP server and return the result as a string."""
    payload = {
        'jsonrpc': '2.0',
        'method':  'tools/call',
        'params':  {'name': tool_name, 'arguments': arguments},
        'id':      call_id,
    }
    try:
        resp = http_requests.post(
            MCP_URL,
            headers=mcp_auth_header(),
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data    = resp.json()
        result  = data.get('result', {})
        content = result.get('content', [])
        if content:
            return '\n'.join(
                c.get('text', '') for c in content if c.get('type') == 'text'
            )
        if 'error' in data:
            return f"MCP error: {data['error']}"
        return json_lib.dumps(result, default=str)
    except Exception as e:
        return f'MCP call failed: {str(e)}'

def mcp_tool_specs() -> list:
    """Return Bedrock-compatible toolSpec list for allowed MCP tools."""
    return [
        {
            'toolSpec': {
                'name': 'base_readQuery',
                'description': (
                    'Execute a SELECT SQL query against the Teradata HCLS database. '
                    'Only query the allowed views listed in your instructions: '
                    'V_Approval_Predictions, V_Intervention_Queue, V_ROI_Calculator, '
                    'V_Critical_Delays, V_GenAI_Context, V_Portfolio_Summary, '
                    'V_Regulatory_Dashboard, V_Market_Access_Timeline, V_eCTD_Completeness. '
                    'Use exact column names from the schema provided. Always SELECT TOP N (max 50).'
                ),
                'inputSchema': {'json': {'type': 'object', 'properties': {
                    'sql': {'type': 'string', 'description': 'SELECT SQL query to execute against allowed hcls views'}
                }, 'required': ['sql']}}
            }
        },
        {
            'toolSpec': {
                'name': 'base_tablePreview',
                'description': 'Preview sample rows from an allowed hcls view to understand its data.',
                'inputSchema': {'json': {'type': 'object', 'properties': {
                    'db_name':    {'type': 'string', 'description': 'Database name — always use hcls'},
                    'table_name': {'type': 'string', 'description': 'View name from the allowed list'}
                }}}
            }
        },
    ]


# ============================================================
# HCLS SCHEMA CONTEXT
# ============================================================

HCLS_SCHEMA_CONTEXT = """
You are a pharmaceutical regulatory affairs AI advisor with access to a Teradata HCLS
database. You help regulatory operations teams understand submission risks, root causes
of delays, and recommended interventions.

You have TWO tools available:
- base_readQuery: execute a SELECT SQL query against the allowed views listed below
- base_tablePreview: preview sample rows from a view if you need to understand the data

ALLOWED VIEWS ONLY (database: hcls) — do NOT query base tables or any other objects:

hcls.V_Approval_Predictions — per-submission ML predictions joined with risk data
  Columns: Actv_Id, Prod_Brnd_Nm, Ctry_Cd_Iso3 (CHAR6-TRIM!), Ctry_Name, Global_Region,
  Actv_Sectr, Regulatory_Authority, Review_Pathway, Submission_Type, Actv_Ctry_Sts,
  Submission_Date, Expected_Approval_Date, Actual_Approval_Date, CRL_Received_Fl,
  CRL_Category, CRL_Received_Dt, Clock_Stop_Days, Resubmission_Cycle, Project_Orbis_Fl,
  Parallel_Scientific_Advice_Fl, Peak_Sales_Potential, Risk_Score_Overall,
  CMC_Readiness_Score, GMP_Site_Status, Stability_Data_Status, Tech_Transfer_Status,
  Clinical_Data_Gap_Type, Trial_Enrollment_Pct, Dose_Optimization_Status,
  RWE_Supplement_Fl, Parallel_Submission_Strategy, Est_Resubmission_Days, Days_Overdue,
  Revenue_At_Risk_USD, Module3_CMC_Complete_Fl, Module5_Clinical_Complete_Fl,
  Open_Deficiencies_Cnt, Data_Integrity_Issues_Fl, Pending_Labeling_Fl, Module3_Stability_Months

hcls.V_Intervention_Queue — priority-ranked active submissions needing action
  Columns: Actv_Id, Prod_Brnd_Nm, Ctry_Cd_Iso3, Regulatory_Authority, Actv_Sectr,
  Peak_Sales_Potential, Risk_Score_Overall, CRL_Received_Fl, CRL_Category, GMP_Site_Status,
  CMC_Readiness_Score, Dose_Optimization_Status, Open_Deficiencies_Cnt, Days_Overdue,
  Priority_Score, Recommended_Action

hcls.V_ROI_Calculator — revenue at risk and acceleration scenarios (aggregated by sector/region)
  Columns: Sector, Global_Region, Regulatory_Authority, Active_Submissions,
  Total_Peak_Sales_USD, Revenue_At_Risk_USD, Value_30Day_Accel_USD, Value_60Day_Accel_USD,
  Value_90Day_Accel_USD, CRL_Revenue_Impact_USD, Avg_Risk_Score

hcls.V_Critical_Delays — submissions critically overdue with delay root cause
  Columns: Actv_Id, Prod_Brnd_Nm, Ctry_Cd_Iso3, Ctry_Name, Regulatory_Authority,
  Actv_Sectr, Actv_Ctry_Sts, Review_Pathway, CRL_Received_Fl, CRL_Category,
  Clock_Stop_Days, Resubmission_Cycle, Peak_Sales_Potential, Days_Overdue,
  Risk_Score_Overall, GMP_Site_Status, CMC_Readiness_Score, Stability_Data_Status,
  Clinical_Data_Gap_Type, Dose_Optimization_Status, Open_Deficiencies_Cnt,
  Module3_CMC_Complete_Fl, Module5_Clinical_Complete_Fl, Primary_Delay_Driver

hcls.V_GenAI_Context — rich pre-assembled context per submission for AI analysis
  Columns: Actv_Id, Product_Name, Country, Region, Health_Authority, Regulatory_Authority,
  Current_Status, Review_Pathway, Therapeutic_Area, Peak_Sales_USD, Peak_Sales_M,
  Submission_Date, Expected_Approval_Date, Actual_Approval_Date, Days_In_Review,
  Days_Overdue, Clock_Stop_Days, CRL_Received_Fl, CRL_Category, Predicted_Outcome,
  Predicted_Outcome_Code, Confidence_Pct, Prob_Approved_Pct, Prob_Delayed_Pct,
  Prob_CRL_Pct, Prob_Withdrawn_Pct, Model_Version, Scored_Date, CMC_Completeness,
  Clinical_Completeness, Stability_Completeness, Avg_Completeness, Num_Info_Requests,
  Num_Clock_Stops, Open_GMP_Findings, Total_GMP_Findings, Risk_Factors, Is_At_Risk,
  Is_CRL_Watch

hcls.V_Portfolio_Summary — portfolio KPIs aggregated by therapeutic sector
  Columns: Sector, Protocols, Total_Submissions, Approved, CRLs_Received, High_Risk,
  Orbis_Submissions, Total_Pipeline_USD, Avg_CMC_Readiness, Avg_Enrollment_Pct

hcls.V_Regulatory_Dashboard — single-row portfolio-level KPI summary
  Columns: Total_Protocols, Total_Submissions, Total_Pipeline_Value_USD, Approved_Count,
  Active_Count, Withdrawn_Count, CRL_Count, Clock_Stop_Count, High_Risk_Submissions,
  GMP_Critical_Count, Optimus_Remediation_Count, Avg_Days_In_Review

hcls.V_Market_Access_Timeline — multi-authority submission/approval timelines per product
  Columns: Actv_Id, Prod_Brnd_Nm, Actv_Sectr, Prod_Typ, FDA_Submission_Date,
  FDA_Approval_Date, FDA_Pathway, FDA_CRL_Fl, EMA_Submission_Date, EMA_Approval_Date,
  EMA_Pathway, PMDA_Submission_Date, PMDA_Approval_Date, NMPA_Submission_Date,
  NMPA_Approval_Date

hcls.V_eCTD_Completeness — eCTD module completeness per submission
  Columns: Actv_Id, Prod_Brnd_Nm, Ctry_Cd_Iso3, Regulatory_Authority, Actv_Sectr,
  eCTD_Version, Module1_Admin_Complete_Fl, Module2_Overview_Complete_Fl,
  Module3_CMC_Complete_Fl, Module3_Stability_Months, Module4_Nonclinical_Complete_Fl,
  Module5_Clinical_Complete_Fl, Open_Deficiencies_Cnt, Data_Integrity_Issues_Fl,
  Pending_Labeling_Fl, Last_Major_Sequence_Dt, Modules_Complete, Submission_Readiness

IMPORTANT SQL RULES:
- Use SELECT TOP N — max 50 rows
- TRIM(Ctry_Cd_Iso3) when filtering — it is CHAR(6) with trailing spaces
- Only SELECT statements — no DDL or DML
- Use exact column names from the lists above — do not guess

DOMAIN CONTEXT:
- CRL: FDA cannot approve as filed. Resets review clock. CMC=manufacturing, Facility=GMP.
- CMC_Readiness_Score: 1-3 HIGH RISK, 4-6 MODERATE, 7-10 LOW RISK
- GMP_Site_Status 'Warning Letter Active' = approval very unlikely, 12-24 months to resolve
- OAI (Official Action Indicated) = blocks approval immediately
- Clock_Stop_Days >90 = fundamental dossier deficiencies
- Priority_Score >100 = CRITICAL escalation required
- Confidence_Pct >70 = high confidence ML prediction
- FDA standard review = 12 months. Priority = 6 months.
- EMA centralized = 210 active review days excluding clock stops.

Be specific, concise, and actionable. Use actual column values from query results.
Suggest concrete next steps with owners and timeframes.
Format responses in plain text without markdown headers.
"""


# ============================================================
# HEALTH
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'version': 'FINAL', 'timestamp': datetime.now().isoformat()})


# ============================================================
# KPIs
# ============================================================

@app.route('/api/kpis', methods=['GET'])
@handle_errors
def get_kpis():
    region        = request.args.get('region', 'all')
    sector        = request.args.get('sector', 'all')
    days          = int(request.args.get('days', 9999))
    hide_approved = request.args.get('hideApproved', 'false').lower() == 'true'

    where_conditions = ["1=1"]
    if region != 'all':
        where_conditions.append(f"ac.Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"pr.Actv_Sectr = '{sector}'")
    if hide_approved:
        where_conditions.append("TRIM(ac.Actv_Ctry_Sts) NOT IN ('Approved', 'Withdrawn', 'Refused')")
    where_clause = " AND ".join(where_conditions)

    query = f"""
    SELECT
        COUNT(*)                                                                AS total_submissions,
        SUM(pr.Peak_Sales_Potential) / 1000000000.0                           AS total_pipeline_billions,
        COUNT(CASE WHEN TRIM(ac.Actv_Ctry_Sts) NOT IN ('Approved','Withdrawn')
                    AND ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}
              THEN 1 END)                                                      AS pending_approvals,
        COUNT(CASE WHEN TRIM(ac.Actv_Ctry_Sts) = 'Approved'
                    AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}
               THEN 1 END)                                                     AS approved_ytd,
        AVG(CASE WHEN TRIM(ac.Actv_Ctry_Sts) = 'Approved'
                  AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                  AND ac.Helth_Auth_Init_Sbmn_Actl IS NOT NULL
             THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
             END)                                                               AS avg_cycle_time,
        COUNT(CASE WHEN ac.CRL_Received_Fl = 1 THEN 1 END)                    AS crl_count
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    WHERE {where_clause}
    """

    ml_query = """
    SELECT
        COUNT(CASE WHEN Predicted_Outcome = 'Approved_On_Schedule' THEN 1 END) AS pred_approved,
        COUNT(CASE WHEN Predicted_Outcome = 'Delayed'              THEN 1 END) AS pred_delayed,
        COUNT(CASE WHEN Predicted_Outcome = 'CRL_Received'         THEN 1 END) AS pred_crl,
        COUNT(CASE WHEN Predicted_Outcome = 'Withdrawn'            THEN 1 END) AS pred_withdrawn,
        AVG(CAST(Confidence AS FLOAT))                                          AS avg_confidence
    FROM hcls.Submission_Predictions
    WHERE Model_Version = (SELECT MAX(Model_Version) FROM hcls.ML_Model_Registry)
    """

    results    = execute_query(query)
    ml_results = execute_query(ml_query)

    if results:
        kpi = results[0]
        ml  = ml_results[0] if ml_results else {}
        return jsonify({
            'totalSubmissions': int(kpi['total_submissions'] or 0),
            'totalPipeline':    round(float(kpi['total_pipeline_billions'] or 0), 1),
            'pendingApprovals': int(kpi['pending_approvals'] or 0),
            'approvedYTD':      int(kpi['approved_ytd'] or 0),
            'avgCycleTime':     round(float(kpi['avg_cycle_time'] or 0), 0),
            'crlCount':         int(kpi['crl_count'] or 0),
            'mlPredApproved':   int(ml.get('pred_approved') or 0),
            'mlPredDelayed':    int(ml.get('pred_delayed') or 0),
            'mlPredCRL':        int(ml.get('pred_crl') or 0),
            'mlPredWithdrawn':  int(ml.get('pred_withdrawn') or 0),
            'mlAvgConfidence':  round(float(ml.get('avg_confidence') or 0) * 100, 1),
        })

    return jsonify({'error': 'No data found'}), 404


# ============================================================
# PROTOCOL CARDS
# ============================================================

@app.route('/api/protocol-cards', methods=['GET'])
@handle_errors
def get_protocol_cards():
    region        = request.args.get('region', 'all')
    sector        = request.args.get('sector', 'all')
    outcome       = request.args.get('outcome', 'all')
    hide_approved = request.args.get('hideApproved', 'false').lower() == 'true'

    where_conditions = ["1=1"]
    if region != 'all':
        where_conditions.append(f"vap.Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"vap.Actv_Sectr = '{sector}'")
    if hide_approved:
        where_conditions.append("TRIM(vap.Actv_Ctry_Sts) NOT IN ('Approved', 'Withdrawn', 'Refused')")
    where_clause = " AND ".join(where_conditions)

    pred_filter = f"AND sp.Predicted_Outcome = '{outcome}'" if outcome != 'all' else ""

    query = f"""
    SELECT
        vap.Actv_Id,
        vap.Prod_Brnd_Nm                         AS Product,
        vap.Ctry_Name,
        vap.Ctry_Cd_Iso3,
        vap.Global_Region,
        vap.Actv_Sectr                           AS Sector,
        vap.Regulatory_Authority,
        vap.Actv_Ctry_Sts                        AS Actual_Status,
        vap.Days_Overdue,
        vap.Revenue_At_Risk_USD / 1000000.0      AS Revenue_At_Risk_Millions,
        vap.CMC_Readiness_Score,
        vap.GMP_Site_Status,
        vap.Stability_Data_Status,
        vap.Clinical_Data_Gap_Type,
        vap.Open_Deficiencies_Cnt,
        vap.Expected_Approval_Date,
        vap.Actual_Approval_Date,
        vap.Submission_Date,
        vap.Review_Pathway,
        vap.Peak_Sales_Potential / 1000000.0     AS Peak_Sales_Millions,
        sp.Predicted_Outcome,
        sp.Actual_Outcome                        AS ML_Actual_Outcome,
        sp.Predicted_Outcome_Code,
        sp.Confidence,
        sp.Prob_Approved,
        sp.Prob_Delayed,
        sp.Prob_CRL,
        sp.Prob_Withdrawn,
        sp.Model_Version
    FROM hcls.V_Approval_Predictions vap
    LEFT JOIN hcls.Submission_Predictions sp
        ON vap.Actv_Id = sp.Actv_Id
       AND TRIM(vap.Ctry_Cd_Iso3) = TRIM(sp.Ctry_Cd_Iso3)
    WHERE {where_clause} {pred_filter}
    ORDER BY sp.Confidence DESC, vap.Revenue_At_Risk_USD DESC
    """

    return jsonify({'cards': execute_query(query)})


# ============================================================
# SUBMISSIONS
# ============================================================

@app.route('/api/submissions', methods=['GET'])
@handle_errors
def get_submissions():
    region  = request.args.get('region', 'all')
    sector  = request.args.get('sector', 'all')
    outcome = request.args.get('outcome', 'all')
    days    = int(request.args.get('days', 9999))

    where_conditions = ["1=1"]
    if region != 'all':
        where_conditions.append(f"ac.Global_Region = '{region}'")
    if sector != 'all':
        where_conditions.append(f"pr.Actv_Sectr = '{sector}'")
    where_conditions.append(
        f"(ac.Helth_Auth_Init_Sbmn_Actl >= CURRENT_DATE - {days}"
        f" OR (ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl >= CURRENT_DATE - {days}))"
    )
    where_clause  = " AND ".join(where_conditions)
    pred_filter   = f"AND sp.Predicted_Outcome = '{outcome}'" if outcome != 'all' else ""

    query = f"""
    SELECT
        ac.Actv_Id                                AS Protocol_ID,
        pr.Prod_Brnd_Nm                           AS Product,
        pr.Prod_Typ                               AS Product_Type,
        ac.Ctry_Name                              AS Country,
        ac.Ctry_Cd_Iso3                           AS Country_Code,
        ac.Global_Region,
        pr.Actv_Sectr                             AS Sector,
        ac.Regulatory_Authority,
        ac.Helth_Auth_Init_Sbmn_Actl              AS Submission_Date,
        CASE
            WHEN sp.Predicted_Outcome IS NOT NULL THEN sp.Predicted_Outcome
            WHEN ac.Actv_Ctry_Sts = 'Approved'   THEN 'Approved_On_Schedule'
            WHEN ac.Actv_Ctry_Sts = 'Withdrawn'  THEN 'Withdrawn'
            WHEN ac.CRL_Received_Fl = 1           THEN 'CRL_Received'
            WHEN ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                 AND CURRENT_DATE > ac.Helth_Auth_Init_Appr_Exptd THEN 'Delayed'
            ELSE 'Approved_On_Schedule'
        END                                       AS Outcome_Class,
        ac.Actv_Ctry_Sts                          AS Raw_Status,
        ac.Helth_Auth_Init_Appr_Exptd             AS Expected_Approval_Date,
        ac.Helth_Auth_Init_Appr_Actl              AS Actual_Approval_Date,
        ac.CRL_Received_Fl,
        CASE
            WHEN ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
                THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
            ELSE CAST((CURRENT_DATE - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
        END                                       AS Days_In_Review,
        CASE
            WHEN ac.Actv_Ctry_Sts <> 'Approved' AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
            ELSE 0
        END                                       AS Days_Overdue,
        ac.Review_Pathway,
        pr.Peak_Sales_Potential / 1000000.0       AS Peak_Sales_Millions,
        srf.Risk_Score_Overall                    AS Risk_Score,
        sp.Predicted_Outcome,
        sp.Confidence,
        sp.Prob_Approved,
        sp.Prob_Delayed,
        sp.Prob_CRL,
        sp.Prob_Withdrawn
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Submission_Risk_Features srf
        ON ac.Actv_Id = srf.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(srf.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Submission_Predictions sp
        ON ac.Actv_Id = sp.Actv_Id
       AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(sp.Ctry_Cd_Iso3)
    WHERE {where_clause} {pred_filter}
    ORDER BY srf.Risk_Score_Overall DESC, pr.Peak_Sales_Potential DESC
    """

    return jsonify({'submissions': execute_query(query)})


# ============================================================
# PREDICTIONS
# ============================================================

@app.route('/api/predictions', methods=['GET'])
@handle_errors
def get_predictions():
    outcome = request.args.get('outcome', 'all')
    where   = f"Predicted_Outcome = '{outcome}'" if outcome != 'all' else "1=1"

    query = f"""
    SELECT sp.Actv_Id, sp.Ctry_Cd_Iso3, sp.Predicted_Outcome, sp.Predicted_Outcome_Code,
           sp.Confidence, sp.Prob_Approved, sp.Prob_Delayed, sp.Prob_CRL, sp.Prob_Withdrawn,
           sp.Actual_Outcome, sp.Scored_Date, sp.Model_Version,
           pr.Prod_Brnd_Nm AS Product, ac.Ctry_Name, ac.Global_Region, pr.Actv_Sectr AS Sector
    FROM hcls.Submission_Predictions sp
    LEFT JOIN hcls.Activity_Country ac
        ON sp.Actv_Id = ac.Actv_Id AND TRIM(sp.Ctry_Cd_Iso3) = TRIM(ac.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Product_Registration pr
        ON sp.Actv_Id = pr.Actv_Id AND TRIM(sp.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    WHERE {where}
    ORDER BY sp.Confidence DESC
    """

    return jsonify({'predictions': execute_query(query)})


# ============================================================
# MODEL METADATA
# ============================================================

@app.route('/api/model-metadata', methods=['GET'])
@handle_errors
def get_model_metadata():
    models   = execute_query("SELECT Model_Version, Model_Type, Test_Accuracy, Trained_Date, Num_Features, Train_Rows, Feature_List, Notes FROM hcls.ML_Model_Registry ORDER BY Trained_Date DESC")
    features = execute_query("SELECT fi.Feature_Name, fi.Importance, fi.Importance_Rank, fi.Model_Version FROM hcls.Feature_Importance fi WHERE fi.Model_Version = (SELECT MAX(Model_Version) FROM hcls.ML_Model_Registry) ORDER BY fi.Importance_Rank ASC")

    return jsonify({'models': models, 'features': features, 'currentModel': models[0] if models else None})


# ============================================================
# AGENTIC CHAT — Bedrock + Teradata MCP server (views only)
# ============================================================

def extract_text(blocks):
    parts = []
    for b in blocks:
        if isinstance(b, dict):
            t = b.get('text', '')
            if t:
                parts.append(t)
        elif hasattr(b, 'text') and b.text:
            parts.append(b.text)
    return parts


@app.route('/api/chat', methods=['POST'])
@handle_errors
def chat():
    import boto3
    from botocore.exceptions import ClientError

    body          = request.get_json()
    system_prompt = body.get('system', '')
    messages      = body.get('messages', [])

    model_id   = os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-sonnet-4-5-20250929-v1:0')
    aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')

    client = boto3.client(
        'bedrock-runtime',
        region_name=aws_region,
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    )

    full_system = f"{system_prompt}\n\n{HCLS_SCHEMA_CONTEXT}"

    raw = []
    for m in messages:
        role    = m.get('role', '')
        content = str(m.get('content', '') or '').strip()
        if role not in ('user', 'assistant') or not content:
            continue
        raw.append({'role': role, 'content': content})

    merged = []
    for m in raw:
        if merged and merged[-1]['role'] == m['role']:
            merged[-1]['content'] += '\n' + m['content']
        else:
            merged.append(dict(m))

    if not merged:
        return jsonify({'error': 'No messages provided'}), 400
    if merged[0]['role'] != 'user':
        merged.insert(0, {'role': 'user', 'content': 'Please help me analyze this submission.'})

    bedrock_messages = [
        {'role': m['role'], 'content': [{'text': m['content']}]}
        for m in merged
    ]

    tools = mcp_tool_specs()

    try:
        for iteration in range(1, 11):
            response       = client.converse(
                modelId=model_id,
                system=[{'text': full_system}],
                messages=bedrock_messages,
                toolConfig={'tools': tools},
                inferenceConfig={'maxTokens': 2000, 'temperature': 0.2}
            )
            stop_reason    = response.get('stopReason', '')
            output_message = response['output']['message']
            content_blocks = output_message.get('content', [])
            bedrock_messages.append(output_message)

            if stop_reason == 'end_turn':
                return jsonify({'response': '\n'.join(extract_text(content_blocks)) or 'No response received.'})

            if stop_reason == 'tool_use':
                tool_results = []

                for block in content_blocks:
                    if not isinstance(block, dict) or 'toolUse' not in block:
                        continue

                    tu          = block['toolUse']
                    tool_use_id = tu.get('toolUseId', '')
                    tool_name   = tu.get('name', '')
                    tool_input  = tu.get('input', {})

                    if tool_name not in MCP_ALLOWED_TOOLS:
                        print(f'[MCP #{iteration}] BLOCKED tool: {tool_name}', flush=True)
                        result_text = f'Tool {tool_name} is not permitted. Use only base_readQuery or base_tablePreview.'
                    else:
                        print(f'[MCP #{iteration}] {tool_name} {json_lib.dumps(tool_input)}', flush=True)
                        result_text = mcp_call(tool_name, tool_input, call_id=iteration)
                        print(f'[MCP #{iteration}] result length: {len(result_text)} chars', flush=True)

                    tool_results.append({
                        'toolResult': {
                            'toolUseId': tool_use_id,
                            'content':   [{'text': result_text}]
                        }
                    })

                bedrock_messages.append({'role': 'user', 'content': tool_results})
                continue

            return jsonify({'response': '\n'.join(extract_text(content_blocks)) or f'Stopped: {stop_reason}'})

        return jsonify({'response': 'Analysis required too many steps. Please try a more specific question.'})

    except ClientError as e:
        err = e.response['Error']
        print(f'[BEDROCK ERROR] {err["Code"]} — {err["Message"]}', flush=True)
        return jsonify({'error': f'Bedrock error: {err["Code"]}', 'detail': err['Message']}), 502


# ============================================================
# INTERVENTION CHAT CONTEXT
# ============================================================

@app.route('/api/intervention-chat-context/<actv_id>/<country_code>', methods=['GET'])
@handle_errors
def get_intervention_chat_context(actv_id, country_code):
    ctx  = execute_query("SELECT * FROM hcls.V_GenAI_Context WHERE Actv_Id = ? AND TRIM(Country) = ?", (actv_id, country_code.strip()))
    pred = execute_query("SELECT Predicted_Outcome, Confidence, Prob_Approved, Prob_Delayed, Prob_CRL, Prob_Withdrawn FROM hcls.Submission_Predictions WHERE Actv_Id = ? AND TRIM(Ctry_Cd_Iso3) = ?", (actv_id, country_code.strip()))
    return jsonify({'context': ctx[0] if ctx else None, 'prediction': pred[0] if pred else None})


# ============================================================
# INTERVENTION QUEUE
# ============================================================

@app.route('/api/interventions', methods=['GET'])
@handle_errors
def get_interventions():
    query = """
    SELECT TOP 25
        ac.Actv_Id                                          AS Protocol_ID,
        pr.Prod_Brnd_Nm                                     AS Product,
        TRIM(ac.Ctry_Cd_Iso3)                               AS Country_Code,
        ac.Ctry_Name,
        pr.Actv_Sectr                                       AS Sector,
        ac.Regulatory_Authority,
        TRIM(ac.Actv_Ctry_Sts)                              AS Status,
        ac.CRL_Received_Fl,
        ac.CRL_Category,
        ac.Resubmission_Cycle,
        ac.Clock_Stop_Days,
        rf.GMP_Site_Status,
        rf.CMC_Readiness_Score,
        rf.Dose_Optimization_Status,
        rf.Stability_Data_Status,
        rf.Clinical_Data_Gap_Type,
        em.Open_Deficiencies_Cnt,
        CASE
            WHEN ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                 AND CURRENT_DATE > ac.Helth_Auth_Init_Appr_Exptd
            THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
            ELSE 0
        END                                                 AS Days_Overdue,
        rf.Risk_Score_Overall                               AS Risk_Score,
        pr.Peak_Sales_Potential / 1000000.0                 AS Revenue_At_Risk_Millions,
        (rf.Risk_Score_Overall * 10)
        + CAST(pr.Peak_Sales_Potential / 1000000000.0 * 5 AS INTEGER)
        + CASE WHEN CURRENT_DATE > ac.Helth_Auth_Init_Appr_Exptd THEN 15 ELSE 0 END
        + CASE WHEN ac.CRL_Received_Fl = 1 THEN 20 ELSE 0 END
        + CASE WHEN sp.Predicted_Outcome IN ('CRL_Received','Withdrawn') THEN 10 ELSE 0 END
        + COALESCE(ac.Resubmission_Cycle * 5, 0)            AS Priority_Score,
        CASE
            WHEN rf.GMP_Site_Status = 'OAI (Official Action Indicated)' THEN 'URGENT: Engage FDA/site - OAI blocks approval'
            WHEN ac.CRL_Received_Fl = 1 AND ac.Resubmission_Cycle >= 2 THEN 'ESCALATE: 2nd CRL cycle - consider Type A meeting'
            WHEN ac.CRL_Received_Fl = 1 AND ac.CRL_Category LIKE 'CMC%' THEN 'CMC Response Team: analytical revalidation package'
            WHEN ac.CRL_Received_Fl = 1 AND ac.CRL_Category = 'Facility Inspection' THEN 'Quality: CAPA plan + reinspection preparation'
            WHEN rf.Dose_Optimization_Status = 'Remediation Required' THEN 'Clinical: Project Optimus dose justification memo'
            WHEN em.Open_Deficiencies_Cnt >= 5 THEN 'RA: Deficiency response package required'
            WHEN rf.GMP_Site_Status = 'Warning Letter Active' THEN 'Quality: Warning letter remediation plan'
            WHEN rf.Stability_Data_Status = 'Gaps Identified' THEN 'CMC: Accelerated stability study required'
            WHEN ac.Clock_Stop_Days > 60 AND TRIM(ac.Actv_Ctry_Sts) = 'Additional Information Requested' THEN 'RA: Prepare clock-restart response package'
            WHEN rf.Clinical_Data_Gap_Type = 'Bridging Study Required' THEN 'Clinical: Design ethnic bridging study'
            WHEN sp.Predicted_Outcome = 'CRL_Received' AND sp.Confidence >= 0.6 THEN 'RA: High CRL probability - pre-emptive response strategy'
            WHEN sp.Predicted_Outcome = 'Withdrawn' AND sp.Confidence >= 0.5 THEN 'RA: Withdrawal risk - escalate to senior management'
            ELSE 'Monitor: Standard follow-up with agency'
        END                                                 AS Recommended_Action,
        sp.Predicted_Outcome,
        sp.Confidence,
        sp.Prob_Approved,
        sp.Prob_Delayed,
        sp.Prob_CRL,
        sp.Prob_Withdrawn
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id AND ac.Ctry_Cd_Iso3 = pr.Ctry_Cd_Iso3
    JOIN hcls.Submission_Risk_Features rf
        ON ac.Actv_Id = rf.Actv_Id AND ac.Ctry_Cd_Iso3 = rf.Ctry_Cd_Iso3
    JOIN hcls.eCTD_Module_Status em
        ON ac.Actv_Id = em.Actv_Id AND ac.Ctry_Cd_Iso3 = em.Ctry_Cd_Iso3
    LEFT JOIN hcls.Submission_Predictions sp
        ON ac.Actv_Id = sp.Actv_Id AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(sp.Ctry_Cd_Iso3)
    WHERE TRIM(ac.Actv_Ctry_Sts) NOT IN ('Approved', 'Withdrawn', 'Refused')
      AND ac.Helth_Auth_Init_Appr_Actl IS NULL
    ORDER BY Priority_Score DESC
    """
    return jsonify({'interventions': execute_query(query)})


# ============================================================
# REGIONAL BREAKDOWN
# ============================================================

@app.route('/api/regional-breakdown', methods=['GET'])
@handle_errors
def get_regional_breakdown():
    sector        = request.args.get('sector', 'all')
    hide_approved = request.args.get('hideApproved', 'false').lower() == 'true'

    where_conditions = ['1=1']
    if sector != 'all':
        where_conditions.append(f"pr.Actv_Sectr = '{sector}'")
    if hide_approved:
        where_conditions.append("TRIM(ac.Actv_Ctry_Sts) NOT IN ('Approved', 'Withdrawn', 'Refused')")
    where_clause = ' AND '.join(where_conditions)

    query = f"""
    SELECT
        ac.Global_Region,
        COUNT(*)                                                              AS submission_count,
        COUNT(CASE WHEN TRIM(ac.Actv_Ctry_Sts) = 'Approved' THEN 1 END)     AS approved_count,
        COUNT(CASE WHEN TRIM(ac.Actv_Ctry_Sts) NOT IN ('Approved','Withdrawn','Refused') THEN 1 END) AS active_count,
        SUM(pr.Peak_Sales_Potential) / 1000000000.0                          AS pipeline_billions,
        SUM(CASE WHEN TRIM(ac.Actv_Ctry_Sts) NOT IN ('Approved','Withdrawn','Refused')
                  AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
                  AND ac.Helth_Auth_Init_Appr_Exptd < CURRENT_DATE
             THEN pr.Peak_Sales_Potential ELSE 0 END) / 1000000.0            AS revenue_at_risk_millions,
        AVG(CAST(srf.Risk_Score_Overall AS FLOAT))                           AS avg_risk_score,
        SUM(pr.Peak_Sales_Potential * 90.0 / 365.0) / 1000000.0             AS accel_90d_millions
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Submission_Risk_Features srf
        ON ac.Actv_Id = srf.Actv_Id AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(srf.Ctry_Cd_Iso3)
    WHERE {where_clause}
    GROUP BY ac.Global_Region
    ORDER BY pipeline_billions DESC
    """
    return jsonify({'regions': execute_query(query)})


# ============================================================
# ROI SCENARIOS
# ============================================================

@app.route('/api/roi-scenarios', methods=['GET'])
@handle_errors
def get_roi_scenarios():
    results = execute_query("""
    SELECT SUM(Value_30Day_Accel_USD)/1000000.0 AS accel_30d_millions,
           SUM(Value_60Day_Accel_USD)/1000000.0 AS accel_60d_millions,
           SUM(Value_90Day_Accel_USD)/1000000.0 AS accel_90d_millions,
           SUM(Revenue_At_Risk_USD)/1000000.0   AS total_revenue_at_risk_millions,
           SUM(CRL_Revenue_Impact_USD)/1000000.0 AS crl_revenue_impact_millions
    FROM hcls.V_ROI_Calculator WHERE Revenue_At_Risk_USD > 0
    """)
    if results:
        r = results[0]
        return jsonify({
            'accel30Days':        round(float(r['accel_30d_millions'] or 0), 1),
            'accel60Days':        round(float(r['accel_60d_millions'] or 0), 1),
            'accel90Days':        round(float(r['accel_90d_millions'] or 0), 1),
            'totalRevenueAtRisk': round(float(r['total_revenue_at_risk_millions'] or 0), 1),
            'crlRevenueImpact':   round(float(r['crl_revenue_impact_millions'] or 0), 1),
        })
    return jsonify({'error': 'No data'}), 404


# ============================================================
# SUBMISSION DETAILS
# ============================================================

@app.route('/api/submission-details/<actv_id>/<country_code>', methods=['GET'])
@handle_errors
def get_submission_details(actv_id, country_code):
    query = """
    SELECT
        ac.Actv_Id AS Protocol_ID, pr.Prod_Brnd_Nm AS Product, pr.Prod_Typ AS Product_Type,
        ac.Ctry_Name AS Country, ac.Ctry_Cd_Iso3 AS Country_Code, ac.Global_Region,
        pr.Actv_Sectr AS Sector, ac.Regulatory_Authority, ac.Submission_Type,
        ac.Helth_Auth_Init_Sbmn_Actl AS Submission_Date,
        TRIM(ac.Actv_Ctry_Sts) AS Submission_Status,
        ac.Helth_Auth_Init_Appr_Exptd AS Expected_Approval_Date,
        ac.Helth_Auth_Init_Appr_Actl  AS Actual_Approval_Date,
        ac.Clock_Stop_Days,
        CASE WHEN ac.Actv_Ctry_Sts = 'Approved' AND ac.Helth_Auth_Init_Appr_Actl IS NOT NULL
             THEN CAST((ac.Helth_Auth_Init_Appr_Actl - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
             ELSE CAST((CURRENT_DATE - ac.Helth_Auth_Init_Sbmn_Actl) AS INTEGER)
        END AS Days_In_Review,
        CASE WHEN ac.Actv_Ctry_Sts <> 'Approved' AND ac.Helth_Auth_Init_Appr_Exptd IS NOT NULL
             THEN CAST((CURRENT_DATE - ac.Helth_Auth_Init_Appr_Exptd) AS INTEGER)
             ELSE 0
        END AS Days_Overdue,
        ac.CRL_Received_Fl, ac.CRL_Received_Dt, ac.CRL_Category,
        ac.Review_Pathway, ac.Resubmission_Cycle, ac.Project_Orbis_Fl, ac.Parallel_Scientific_Advice_Fl,
        pr.Peak_Sales_Potential / 1000000.0 AS Peak_Sales_Millions,
        srf.Risk_Score_Overall, srf.CMC_Readiness_Score, srf.GMP_Site_Status,
        srf.Dose_Optimization_Status, srf.Stability_Data_Status, srf.Clinical_Data_Gap_Type,
        sp.Predicted_Outcome, sp.Confidence, sp.Prob_Approved, sp.Prob_Delayed, sp.Prob_CRL, sp.Prob_Withdrawn
    FROM hcls.Activity_Country ac
    JOIN hcls.Product_Registration pr
        ON ac.Actv_Id = pr.Actv_Id AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(pr.Ctry_Cd_Iso3)
    LEFT JOIN hcls.Submission_Risk_Features srf
        ON ac.Actv_Id = srf.Actv_Id
    LEFT JOIN hcls.Submission_Predictions sp
        ON ac.Actv_Id = sp.Actv_Id AND TRIM(ac.Ctry_Cd_Iso3) = TRIM(sp.Ctry_Cd_Iso3)
    WHERE ac.Actv_Id = ? AND TRIM(ac.Ctry_Cd_Iso3) = ?
    """
    results = execute_query(query, (actv_id, country_code.strip()))
    if results:
        return jsonify({'submission': results[0]})
    return jsonify({'error': 'Submission not found'}), 404


# ============================================================
# MISC ENDPOINTS
# ============================================================

@app.route('/api/critical-delays', methods=['GET'])
@handle_errors
def get_critical_delays():
    results = execute_query("""
    SELECT Actv_Id AS Protocol_ID, Prod_Brnd_Nm AS Product, Ctry_Name AS Country,
           Ctry_Cd_Iso3 AS Country_Code, Actv_Sectr AS Sector, Regulatory_Authority,
           Actv_Ctry_Sts AS Status, Days_Overdue, Risk_Score_Overall AS Risk_Score,
           Primary_Delay_Driver, CRL_Received_Fl, CRL_Category, GMP_Site_Status,
           CMC_Readiness_Score, Clock_Stop_Days, Open_Deficiencies_Cnt,
           Resubmission_Cycle, Review_Pathway, Peak_Sales_Potential/1000000.0 AS Peak_Sales_Millions
    FROM hcls.V_Critical_Delays
    ORDER BY Days_Overdue DESC, Risk_Score_Overall DESC
    """)
    return jsonify({'criticalDelays': results})


@app.route('/api/portfolio-summary', methods=['GET'])
@handle_errors
def get_portfolio_summary():
    results = execute_query("""
    SELECT Sector, Protocols, Total_Submissions, Approved, CRLs_Received, High_Risk,
           Orbis_Submissions, Avg_CMC_Readiness, Avg_Enrollment_Pct,
           Total_Pipeline_USD/1000000000.0 AS Pipeline_Billions
    FROM hcls.V_Portfolio_Summary ORDER BY Total_Pipeline_USD DESC
    """)
    return jsonify({'portfolio': results})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5130)
