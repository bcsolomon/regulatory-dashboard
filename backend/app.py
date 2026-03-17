"""
Regulatory Dashboard FINAL
Flask backend — agentic chat with scoped Teradata tool access
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import teradatasql
from datetime import datetime
import os
import re
import json as json_lib
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
# AGENTIC CHAT — Bedrock + scoped Teradata tool access
# ============================================================

ALLOWED_OBJECTS = {
    'hcls.activity_country',
    'hcls.product_registration',
    'hcls.submission_risk_features',
    'hcls.v_intervention_queue',
    'hcls.v_roi_calculator',
}

HCLS_SCHEMA_CONTEXT = """
You have access to the following Teradata HCLS database objects via the query_teradata tool.
Only query these objects — no others are permitted.

IMPORTANT SQL RULES:
- Always use TRIM() when comparing Ctry_Cd_Iso3 — it is CHAR(6) with trailing spaces
- All three base tables join on: Actv_Id AND TRIM(Ctry_Cd_Iso3) = TRIM(Ctry_Cd_Iso3)
- Use SELECT TOP N to limit large result sets (max 50 rows)
- Only SELECT statements are permitted — no DDL or DML

BASE TABLES:
hcls.Activity_Country — Core submissions: Actv_Id, Ctry_Cd_Iso3, Ctry_Name, Global_Region,
  Actv_Ctry_Sts (TRIM!), Helth_Auth_Init_Sbmn_Actl, Helth_Auth_Init_Appr_Exptd,
  Helth_Auth_Init_Appr_Actl, Regulatory_Authority, Review_Pathway, CRL_Received_Fl,
  CRL_Category, Clock_Stop_Days, Resubmission_Cycle, Project_Orbis_Fl

hcls.Product_Registration — Product info: Actv_Id, Ctry_Cd_Iso3, Prod_Brnd_Nm,
  Prod_Typ, Actv_Sectr (therapeutic area), Peak_Sales_Potential (USD), Blgc_Prod_In

hcls.Submission_Risk_Features — Risk data: Actv_Id, Ctry_Cd_Iso3, Risk_Score_Overall (0-10),
  CMC_Readiness_Score (0-10), GMP_Site_Status, Stability_Data_Status,
  Dose_Optimization_Status, Clinical_Data_Gap_Type, Est_Resubmission_Days

VIEWS:
hcls.V_Intervention_Queue — Priority-ranked active submissions:
  Actv_Id, Ctry_Cd_Iso3, Prod_Brnd_Nm, Actv_Sectr, Regulatory_Authority,
  Risk_Score_Overall, Priority_Score, Days_Overdue, Recommended_Action,
  CRL_Received_Fl, GMP_Site_Status, CMC_Readiness_Score, Open_Deficiencies_Cnt

hcls.V_ROI_Calculator — Revenue acceleration:
  Actv_Id, Ctry_Cd_Iso3, Global_Region, Sector, Revenue_At_Risk_USD,
  Value_30Day_Accel_USD, Value_60Day_Accel_USD, Value_90Day_Accel_USD

JOIN KEY: Actv_Id AND TRIM(Ctry_Cd_Iso3) = TRIM(Ctry_Cd_Iso3) for all tables
"""


def validate_sql(sql: str):
    """Returns (is_valid, reason). Only allows SELECT on ALLOWED_OBJECTS."""
    sql_upper = sql.upper().strip()
    blocked = ['INSERT','UPDATE','DELETE','DROP','CREATE','ALTER','TRUNCATE','MERGE','EXEC','EXECUTE','GRANT','REVOKE','CALL']
    for kw in blocked:
        if re.search(rf'\b{kw}\b', sql_upper):
            return False, f'Blocked keyword: {kw}'
    if not sql_upper.lstrip().startswith('SELECT'):
        return False, 'Only SELECT statements permitted'
    for obj in re.findall(r'hcls\.\w+', sql, re.IGNORECASE):
        if obj.lower() not in ALLOWED_OBJECTS:
            return False, f'Object not allowed: {obj}'
    return True, 'OK'


def extract_text(blocks):
    """Extract text strings from Bedrock content blocks (handles both tagged union and typed formats)."""
    parts = []
    for b in blocks:
        if isinstance(b, dict):
            t = b.get('text', '')
            if t:
                parts.append(t)
        elif hasattr(b, 'text') and b.text:
            parts.append(b.text)
    return parts


def to_bedrock_block(b):
    """
    Convert a Bedrock response content block to the tagged union request format.

    Bedrock response can return blocks as:
      {'type': 'text', 'text': '...'}              → text
      {'text': '...'}                              → text (no type key)
      {'toolUse': {'toolUseId':..,'name':..}}      → tool use (tagged union already)
      {'type': 'tool_use', 'id':..,'name':..}      → tool use (older format)

    Bedrock request requires tagged union:
      {'text': '...'}
      {'toolUse': {'toolUseId': ..., 'name': ..., 'input': ...}}
    """
    if not isinstance(b, dict):
        return None

    # Already in tagged union toolUse format
    if 'toolUse' in b:
        return b

    # Older type-based tool_use format → convert to tagged union
    if b.get('type') == 'tool_use':
        return {
            'toolUse': {
                'toolUseId': b.get('id', ''),
                'name':      b.get('name', ''),
                'input':     b.get('input', {}),
            }
        }

    # Text block (with or without 'type' key)
    t = b.get('text', '')
    if t:
        return {'text': t}

    return None


@app.route('/api/chat', methods=['POST'])
@handle_errors
def chat():
    """
    Agentic chat — Bedrock converse with query_teradata tool.
    Runs an agentic loop: call Bedrock → if tool_use, validate+execute SQL,
    return tool_result, repeat → return final text when end_turn.
    """
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
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )

    tools = [{
        'toolSpec': {
            'name': 'query_teradata',
            'description': (
                'Execute a SELECT query against the Teradata HCLS database. '
                'Use to compare submissions, calculate stats, or answer questions '
                'beyond the initial context. Only allowed objects: '
                'hcls.Activity_Country, hcls.Product_Registration, '
                'hcls.Submission_Risk_Features, hcls.V_Intervention_Queue, '
                'hcls.V_ROI_Calculator. Always TRIM() Ctry_Cd_Iso3.'
            ),
            'inputSchema': {
                'json': {
                    'type': 'object',
                    'properties': {
                        'sql':       {'type': 'string', 'description': 'SELECT SQL to execute'},
                        'rationale': {'type': 'string', 'description': 'Why this query is needed'}
                    },
                    'required': ['sql', 'rationale']
                }
            }
        }
    }]

    full_system = f"{system_prompt}\n\n{HCLS_SCHEMA_CONTEXT}"

    # Build conversation history — strict user/assistant alternation, no empty content
    raw = []
    for m in messages:
        role    = m.get('role', '')
        content = str(m.get('content', '') or '').strip()
        if role not in ('user', 'assistant') or not content:
            continue
        raw.append({'role': role, 'content': content})

    # Merge consecutive same-role messages
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

    # Agentic loop — follows AWS documentation pattern exactly:
    # https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use-inference-call.html
    # Key: append response['output']['message'] DIRECTLY — it is already in the correct format
    try:
        for iteration in range(1, 6):
            response     = client.converse(
                modelId=model_id,
                system=[{'text': full_system}],
                messages=bedrock_messages,
                toolConfig={'tools': tools},
                inferenceConfig={'maxTokens': 2000, 'temperature': 0.2}
            )
            stop_reason    = response.get('stopReason', '')
            output_message = response['output']['message']   # already correct format
            content_blocks = output_message.get('content', [])

            # Append the raw response message directly — per AWS docs
            bedrock_messages.append(output_message)

            # Done — return text response
            if stop_reason == 'end_turn':
                return jsonify({'response': '\n'.join(extract_text(content_blocks)) or 'No response received.'})

            # Tool call requested
            if stop_reason == 'tool_use':
                tool_results = []

                for block in content_blocks:
                    if not isinstance(block, dict) or 'toolUse' not in block:
                        continue

                    tu          = block['toolUse']
                    tool_use_id = tu.get('toolUseId', '')
                    tool_name   = tu.get('name', '')
                    tool_input  = tu.get('input', {})

                    if tool_name != 'query_teradata':
                        tool_results.append({'toolResult': {'toolUseId': tool_use_id, 'content': [{'text': f'Unknown tool: {tool_name}'}]}})
                        continue

                    sql       = tool_input.get('sql', '').strip()
                    rationale = tool_input.get('rationale', '')
                    print(f'[TOOL #{iteration}] {rationale}')
                    print(f'[TOOL #{iteration}] SQL: {sql}')

                    is_valid, reason = validate_sql(sql)
                    if not is_valid:
                        print(f'[TOOL #{iteration}] BLOCKED: {reason}')
                        result_text = f'Query blocked: {reason}. Only SELECT on allowed HCLS objects permitted.'
                    else:
                        try:
                            rows = execute_query(sql)
                            result_text = f'Query returned {len(rows)} row(s):\n{json_lib.dumps(rows[:50], default=str)}' if rows else 'Query returned no rows.'
                            print(f'[TOOL #{iteration}] Returned {len(rows)} rows')
                        except Exception as qe:
                            result_text = f'Query execution error: {str(qe)}'
                            print(f'[TOOL #{iteration}] ERROR: {qe}')

                    tool_results.append({'toolResult': {'toolUseId': tool_use_id, 'content': [{'text': result_text}]}})

                # Append tool results as user message — per AWS docs
                bedrock_messages.append({'role': 'user', 'content': tool_results})
                continue

            # Unexpected stop reason
            return jsonify({'response': '\n'.join(extract_text(content_blocks)) or f'Stopped: {stop_reason}'})

        return jsonify({'response': 'Analysis required too many steps. Please try a more specific question.'})

    except ClientError as e:
        err = e.response['Error']
        print(f"Bedrock error: {err['Code']} — {err['Message']}")
        return jsonify({'error': f"Bedrock error: {err['Code']}", 'detail': err['Message']}), 502


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
