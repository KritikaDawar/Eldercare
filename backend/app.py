import os
from datetime import datetime, date, time, timedelta, timezone
import json
import urllib.request
import urllib.error
import math
from functools import wraps
from flask import Flask, request, jsonify, send_file
from sqlalchemy.pool import NullPool
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from dotenv import load_dotenv
def send_brevo_email(to_email, subject, html_content):
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        raise RuntimeError("BREVO_API_KEY is not configured")

    payload = {
        "sender": {
            "name": "ElderCare",
            "email": "eldercarebu@gmail.com"
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }

    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json"
        },
        method="POST"
    )

    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status
load_dotenv()
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-only-change-me")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-jwt-change-me")
db_url = os.getenv("DATABASE_URL", "sqlite:///eldercare.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace(
        "postgres://", "postgresql+psycopg://", 1
    )
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

app.config["SQLALCHEMY_DATABASE_URI"] = db_url

if db_url.startswith("postgresql"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "poolclass": NullPool,
        "connect_args": {"sslmode": "require"}
    }
CORS(app, resources={r"/*": {"origins": [
    "https://eldercare-cu8d.vercel.app",
    "http://localhost:5173"
]}})
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)

class Medication(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    dosage = db.Column(db.String(80), nullable=False)
    instructions = db.Column(db.String(250), default="")
    schedule_time = db.Column(db.String(5), nullable=False)  # HH:MM, local time
    active = db.Column(db.Boolean, default=True)

class Dose(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    medication_id = db.Column(db.Integer, db.ForeignKey("medication.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    scheduled_for = db.Column(db.String(32), nullable=False)
    status = db.Column(db.String(12), default="pending")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class ReminderLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    medication_id = db.Column(
        db.Integer,
        db.ForeignKey("medication.id"),
        nullable=False
    )
    scheduled_for = db.Column(db.String(16), nullable=False)

    __table_args__ = (
        db.UniqueConstraint(
            "medication_id",
            "scheduled_for",
            name="uq_reminder_medication_schedule"
        ),
    )
class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    activity = db.Column(db.String(120), nullable=False)
    minutes = db.Column(db.Integer, nullable=False)
    activity_date = db.Column(db.String(10), nullable=False)

class Measurement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    kind = db.Column(db.String(30), nullable=False)  # blood_pressure, cholesterol, weight
    value = db.Column(db.String(80), nullable=False)
    unit = db.Column(db.String(30), nullable=False)
    recorded_at = db.Column(db.String(32), nullable=False)

class MedicalDocument(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    title = db.Column(db.String(180), nullable=False)
    category = db.Column(db.String(40), nullable=False)
    document_date = db.Column(db.String(10), nullable=False)
    notes = db.Column(db.String(500), default="")
    original_filename = db.Column(db.String(180), nullable=False)
    mime_type = db.Column(db.String(80), nullable=False)
    file_data = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class MedicalHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    entry_type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(180), nullable=False)
    details = db.Column(db.String(2000), default="")
    entry_date = db.Column(db.String(10), nullable=False)
    doctor_name = db.Column(db.String(150), default="")
    hospital_name = db.Column(db.String(150), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class MedicalExpense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    category = db.Column(db.String(40), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    expense_date = db.Column(db.String(10), nullable=False)
    description = db.Column(db.String(300), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    caregiver_email = db.Column(db.String(180), nullable=False, index=True)
    scopes = db.Column(db.String(200), nullable=False)  # medications, manage_medications, activity, health
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    revoked_at = db.Column(db.DateTime, nullable=True)


class CareActionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    caregiver_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    medication_id = db.Column(db.Integer, db.ForeignKey("medication.id"), nullable=True, index=True)
    action = db.Column(db.String(40), nullable=False)
    details = db.Column(db.String(500), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

def current_user():
    return db.session.get(User, int(get_jwt_identity()))

def fail(message, status=400):
    return jsonify({"error": message}), status

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "ElderCare API"})

@app.post("/api/auth/register")
def register():
    data = request.get_json() or {}
    name, email, password = data.get("name", "").strip(), data.get("email", "").strip().lower(), data.get("password", "")
    if not name or "@" not in email or len(password) < 8:
        return fail("Provide a name, valid email and password of at least 8 characters.")
    if User.query.filter_by(email=email).first():
        return fail("An account with this email already exists.", 409)
    user = User(name=name, email=email, password_hash=bcrypt.generate_password_hash(password).decode())
    db.session.add(user); db.session.commit()
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=12))
    return jsonify({"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}), 201

@app.post("/api/auth/login")
def login():
    data = request.get_json() or {}
    user = User.query.filter_by(email=data.get("email", "").strip().lower()).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, data.get("password", "")):
        return fail("Invalid email or password.", 401)
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=12))
    return jsonify({"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}})

@app.get("/api/me")
@jwt_required()
def me():
    u = current_user()
    return jsonify({"id": u.id, "name": u.name, "email": u.email})

def owned(model, item_id, user_id):
    item = db.session.get(model, item_id)
    return item if item and getattr(item, "user_id", None) == user_id else None
@app.post("/api/notifications/test-email")
@jwt_required()
def test_email():
    user = current_user()

    try:
        send_brevo_email(
            user.email,
            "ElderCare test email",
            "<h2>Email setup successful!</h2><p>ElderCare email notifications are connected.</p>"
        )
        return jsonify({"message": "Test email sent successfully."})

    except urllib.error.HTTPError:
        return jsonify({"error": "Brevo could not send the email. Please check your Brevo settings."}), 502

    except Exception:
        return jsonify({"error": "Unable to send the test email. Please check the backend configuration."}), 500
@app.post("/api/emergency/sos")
@jwt_required()
def emergency_sos():
    owner = current_user()
    grants = Permission.query.filter_by(owner_id=owner.id, revoked_at=None).all()
    recipients = sorted({p.caregiver_email.strip().lower() for p in grants if p.caregiver_email})
    if not recipients:
        return fail("No active caregiver contacts are linked to this account. Add a caregiver in Caregiver sharing first.", 400)

    sent = 0
    failed = 0
    alert_time = datetime.now().astimezone().strftime("%d %b %Y, %I:%M %p %Z")
    safe_name = owner.name.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe_email = owner.email.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    subject = "Emergency SOS alert from ElderCare"
    html = (
        "<h2>Emergency SOS alert</h2>"
        f"<p><b>{safe_name}</b> has triggered the SOS alert in ElderCare.</p>"
        f"<p>Account: {safe_email}<br>Time: {alert_time}</p>"
        "<p>Please contact them immediately and check whether they need help.</p>"
        "<p><b>Important:</b> This email is an alert to a caregiver. ElderCare has not contacted emergency services.</p>"
    )
    for email in recipients:
        try:
            send_brevo_email(email, subject, html)
            sent += 1
        except Exception:
            failed += 1
    return jsonify({
        "message": "SOS alert sent to linked caregiver contacts." if sent else "ElderCare could not send the SOS alert.",
        "emails_sent": sent,
        "failed": failed,
        "emergency_services_contacted": False
    }), (200 if sent else 502)


@app.route("/api/medications", methods=["GET", "POST"])
@jwt_required()
def medications():
    u = current_user()
    if request.method == "GET":
        return jsonify([{"id":m.id,"name":m.name,"dosage":m.dosage,"instructions":m.instructions,"schedule_time":m.schedule_time,"active":m.active} for m in Medication.query.filter_by(user_id=u.id).order_by(Medication.schedule_time).all()])
    d = request.get_json() or {}
    if not all(d.get(k) for k in ("name","dosage","schedule_time")):
        return fail("Name, dosage and schedule time are required.")
    if len(d["schedule_time"]) != 5 or d["schedule_time"][2] != ":":
        return fail("Schedule time must use HH:MM.")
    m = Medication(user_id=u.id, name=d["name"].strip(), dosage=d["dosage"].strip(), instructions=d.get("instructions",""), schedule_time=d["schedule_time"])
    db.session.add(m); db.session.commit()
    return jsonify({"id":m.id,"name":m.name,"dosage":m.dosage,"instructions":m.instructions,"schedule_time":m.schedule_time,"active":m.active}), 201

@app.route("/api/medications/<int:item_id>", methods=["PATCH","DELETE"])
@jwt_required()
def medication_detail(item_id):
    m = owned(Medication, item_id, current_user().id)
    if not m: return fail("Medication not found.",404)
    if request.method == "DELETE":
        Dose.query.filter_by(medication_id=m.id).delete()
        db.session.delete(m); db.session.commit(); return jsonify({"message":"Medication deleted."})
    d=request.get_json() or {}
    for k in ("name","dosage","instructions","schedule_time","active"):
        if k in d: setattr(m,k,d[k])
    db.session.commit()
    return jsonify({"id":m.id,"name":m.name,"dosage":m.dosage,"instructions":m.instructions,"schedule_time":m.schedule_time,"active":m.active})

@app.route("/api/doses", methods=["GET","POST"])
@jwt_required()
def doses():
    u=current_user()
    if request.method=="GET":
        rows=Dose.query.filter_by(user_id=u.id).order_by(Dose.scheduled_for.desc()).limit(100).all()
        return jsonify([{"id":x.id,"medication_id":x.medication_id,"medication":db.session.get(Medication,x.medication_id).name,"scheduled_for":x.scheduled_for,"status":x.status} for x in rows])
    d=request.get_json() or {}
    m=owned(Medication,d.get("medication_id"),u.id) if d.get("medication_id") else None
    if not m: return fail("Choose one of your medications.")
    status=d.get("status","pending")
    if status not in ("pending","taken","skipped","missed"): return fail("Invalid dose status.")
    x=Dose(user_id=u.id,medication_id=m.id,scheduled_for=d.get("scheduled_for",datetime.now().isoformat(timespec="minutes")),status=status)
    db.session.add(x); db.session.commit()
    return jsonify({"id":x.id,"medication_id":m.id,"medication":m.name,"scheduled_for":x.scheduled_for,"status":x.status}),201

@app.patch("/api/doses/<int:item_id>")
@jwt_required()
def dose_update(item_id):
    x=owned(Dose,item_id,current_user().id)
    if not x: return fail("Dose not found.",404)
    status=(request.get_json() or {}).get("status")
    if status not in ("taken","skipped","missed","pending"): return fail("Invalid dose status.")
    x.status=status; x.updated_at=datetime.utcnow(); db.session.commit()
    return jsonify({"id":x.id,"status":x.status})

@app.route("/api/activities", methods=["GET","POST"])
@jwt_required()
def activities():
    u=current_user()
    if request.method=="GET":
        return jsonify([{"id":x.id,"activity":x.activity,"minutes":x.minutes,"activity_date":x.activity_date} for x in Activity.query.filter_by(user_id=u.id).order_by(Activity.activity_date.desc()).all()])
    d=request.get_json() or {}
    try: minutes=int(d.get("minutes",0))
    except (TypeError,ValueError): return fail("Minutes must be a whole number.")
    if not d.get("activity") or minutes<1 or minutes>1440: return fail("Activity and minutes between 1 and 1440 are required.")
    x=Activity(user_id=u.id,activity=d["activity"],minutes=minutes,activity_date=d.get("activity_date",date.today().isoformat()))
    db.session.add(x); db.session.commit()
    return jsonify({"id":x.id,"activity":x.activity,"minutes":x.minutes,"activity_date":x.activity_date}),201

@app.route("/api/measurements", methods=["GET","POST"])
@jwt_required()
def measurements():
    u=current_user()
    if request.method=="GET":
        return jsonify([{"id":x.id,"kind":x.kind,"value":x.value,"unit":x.unit,"recorded_at":x.recorded_at} for x in Measurement.query.filter_by(user_id=u.id).order_by(Measurement.recorded_at.desc()).all()])
    d=request.get_json() or {}
    if d.get("kind") not in ("blood_pressure","cholesterol","weight") or not d.get("value") or not d.get("unit"):
        return fail("Select a supported measurement and provide value and unit.")
    x=Measurement(user_id=u.id,kind=d["kind"],value=str(d["value"]),unit=d["unit"],recorded_at=d.get("recorded_at",datetime.now().isoformat(timespec="minutes")))
    db.session.add(x); db.session.commit()
    return jsonify({"id":x.id,"kind":x.kind,"value":x.value,"unit":x.unit,"recorded_at":x.recorded_at}),201

@app.route("/api/permissions", methods=["GET","POST"])
@jwt_required()
def permissions():
    u=current_user()
    if request.method=="GET":
        return jsonify([{"id":p.id,"caregiver_email":p.caregiver_email,"scopes":p.scopes.split(","),"active":p.revoked_at is None} for p in Permission.query.filter_by(owner_id=u.id).all()])
    d=request.get_json() or {}
    email=d.get("caregiver_email","").strip().lower()
    scopes=d.get("scopes",[])
    allowed={"medications","manage_medications","activity","health","medical_records","expenses"}
    scopes=set(scopes)
    if "manage_medications" in scopes:
        scopes.add("medications")
    if "@" not in email or not scopes or not scopes.issubset(allowed): return fail("Provide caregiver email and valid sharing scopes.")
    p=Permission(owner_id=u.id,caregiver_email=email,scopes=",".join(sorted(scopes)))
    db.session.add(p); db.session.commit()
    return jsonify({"id":p.id,"caregiver_email":p.caregiver_email,"scopes":p.scopes.split(","),"active":True}),201

@app.delete("/api/permissions/<int:item_id>")
@jwt_required()
def revoke_permission(item_id):
    p=Permission.query.filter_by(id=item_id,owner_id=current_user().id).first()
    if not p: return fail("Permission not found.",404)
    p.revoked_at=datetime.utcnow(); db.session.commit()
    return jsonify({"message":"Permission revoked."})

@app.get("/api/caregiver/summary")
@jwt_required()
def caregiver_summary():
    caregiver=current_user()
    owner_email=request.args.get("owner_email","").strip().lower()
    owner=User.query.filter_by(email=owner_email).first()
    if not owner: return fail("Owner not found.",404)
    grant=Permission.query.filter_by(owner_id=owner.id,caregiver_email=caregiver.email,revoked_at=None).first()
    if not grant: return fail("No active caregiver permission for this account.",403)
    scopes=set(grant.scopes.split(","))
    out={"owner":{"name":owner.name,"email":owner.email},"shared_scopes":sorted(scopes)}
    if "medications" in scopes:
        out["medications"]=[{"id":m.id,"name":m.name,"dosage":m.dosage,"instructions":m.instructions,"schedule_time":m.schedule_time,"active":m.active} for m in Medication.query.filter_by(user_id=owner.id).order_by(Medication.schedule_time).all()]
        out["recent_doses"]=[{"id":x.id,"medication_id":x.medication_id,"medication":db.session.get(Medication,x.medication_id).name,"scheduled_for":x.scheduled_for,"status":x.status} for x in Dose.query.filter_by(user_id=owner.id).order_by(Dose.scheduled_for.desc()).limit(20).all()]
        out["can_manage_medications"]="manage_medications" in scopes
        if out["can_manage_medications"]:
            out["care_actions"]=[{"action":a.action,"details":a.details,"created_at":a.created_at.isoformat(timespec="minutes"),"caregiver":db.session.get(User,a.caregiver_id).name if db.session.get(User,a.caregiver_id) else "Caregiver"} for a in CareActionLog.query.filter_by(owner_id=owner.id).order_by(CareActionLog.created_at.desc()).limit(20).all()]
    if "activity" in scopes:
        out["activities"]=[{"activity":x.activity,"minutes":x.minutes,"activity_date":x.activity_date} for x in Activity.query.filter_by(user_id=owner.id).order_by(Activity.activity_date.desc()).limit(20).all()]
    if "health" in scopes:
        out["measurements"]=[{"kind":x.kind,"value":x.value,"unit":x.unit,"recorded_at":x.recorded_at} for x in Measurement.query.filter_by(user_id=owner.id).order_by(Measurement.recorded_at.desc()).limit(20).all()]
    if "medical_records" in scopes:
        out["medical_documents"]=[{"id":x.id,"title":x.title,"category":x.category,"document_date":x.document_date,"notes":x.notes,"original_filename":x.original_filename} for x in MedicalDocument.query.filter_by(user_id=owner.id).order_by(MedicalDocument.document_date.desc()).limit(50).all()]
        out["medical_history"]=[{"id":x.id,"entry_type":x.entry_type,"title":x.title,"details":x.details,"entry_date":x.entry_date,"doctor_name":x.doctor_name,"hospital_name":x.hospital_name} for x in MedicalHistory.query.filter_by(user_id=owner.id).order_by(MedicalHistory.entry_date.desc()).limit(50).all()]
    if "expenses" in scopes:
        out["medical_expenses"]=[{"id":x.id,"category":x.category,"amount":str(x.amount),"expense_date":x.expense_date,"description":x.description} for x in MedicalExpense.query.filter_by(user_id=owner.id).order_by(MedicalExpense.expense_date.desc()).limit(100).all()]
    return jsonify(out)

def caregiver_grant(owner_email):
    caregiver=current_user()
    owner=User.query.filter_by(email=(owner_email or "").strip().lower()).first()
    if not owner:
        return None, None, fail("Owner not found.",404)
    grant=Permission.query.filter_by(owner_id=owner.id,caregiver_email=caregiver.email,revoked_at=None).first()
    if not grant:
        return None, None, fail("No active caregiver permission for this account.",403)
    scopes=set(grant.scopes.split(","))
    if "medications" not in scopes or "manage_medications" not in scopes:
        return None, None, fail("This caregiver has view-only medication access.",403)
    return owner, caregiver, None


@app.post("/api/caregiver/medications")
@jwt_required()
def caregiver_add_medication():
    d=request.get_json() or {}
    owner, caregiver, error=caregiver_grant(d.get("owner_email"))
    if error: return error
    name=str(d.get("name","")).strip()
    dosage=str(d.get("dosage","")).strip()
    schedule_time=str(d.get("schedule_time","")).strip()
    if not name or not dosage:
        return fail("Medicine name and the prescribed dosage shown on the prescription are required.")
    try:
        datetime.strptime(schedule_time,"%H:%M")
    except ValueError:
        return fail("Reminder time must use HH:MM.")
    m=Medication(user_id=owner.id,name=name,dosage=dosage,instructions=str(d.get("instructions",""))[:250],schedule_time=schedule_time,active=True)
    db.session.add(m)
    db.session.flush()
    db.session.add(CareActionLog(owner_id=owner.id,caregiver_id=caregiver.id,medication_id=m.id,action="medication_added",details=f"Added {m.name}; recorded prescribed dosage: {m.dosage}"))
    db.session.commit()
    return jsonify({"id":m.id,"name":m.name,"dosage":m.dosage,"instructions":m.instructions,"schedule_time":m.schedule_time,"active":m.active}),201


@app.patch("/api/caregiver/medications/<int:item_id>")
@jwt_required()
def caregiver_update_medication(item_id):
    d=request.get_json() or {}
    owner, caregiver, error=caregiver_grant(d.get("owner_email"))
    if error: return error
    m=Medication.query.filter_by(id=item_id,user_id=owner.id).first()
    if not m: return fail("Medication not found.",404)
    # Caregivers can adjust reminders and instructions, but not prescribed dosage.
    if "schedule_time" in d:
        try: datetime.strptime(str(d["schedule_time"]),"%H:%M")
        except ValueError: return fail("Reminder time must use HH:MM.")
        m.schedule_time=str(d["schedule_time"])
    if "instructions" in d: m.instructions=str(d["instructions"])[:250]
    if "active" in d: m.active=bool(d["active"])
    if "name" in d: m.name=str(d["name"]).strip()[:120]
    db.session.add(CareActionLog(owner_id=owner.id,caregiver_id=caregiver.id,medication_id=m.id,action="medication_updated",details=f"Updated reminder/settings for {m.name}"))
    db.session.commit()
    return jsonify({"id":m.id,"name":m.name,"dosage":m.dosage,"instructions":m.instructions,"schedule_time":m.schedule_time,"active":m.active})


@app.post("/api/caregiver/doses")
@jwt_required()
def caregiver_log_dose():
    d=request.get_json() or {}
    owner, caregiver, error=caregiver_grant(d.get("owner_email"))
    if error: return error
    m=Medication.query.filter_by(id=d.get("medication_id"),user_id=owner.id).first()
    if not m: return fail("Medication not found.",404)
    status=d.get("status")
    if status not in ("taken","skipped","missed","pending"): return fail("Invalid dose status.")
    scheduled_for=str(d.get("scheduled_for") or datetime.now().isoformat(timespec="minutes"))[:32]
    dose=Dose(user_id=owner.id,medication_id=m.id,scheduled_for=scheduled_for,status=status)
    db.session.add(dose)
    db.session.flush()
    db.session.add(CareActionLog(owner_id=owner.id,caregiver_id=caregiver.id,medication_id=m.id,action="dose_logged",details=f"{m.name}: marked {status} for {scheduled_for}"))
    db.session.commit()
    return jsonify({"id":dose.id,"medication_id":m.id,"medication":m.name,"scheduled_for":dose.scheduled_for,"status":dose.status}),201


# Medical document uploads are stored in PostgreSQL for this MVP.
# Keep the limit small because serverless request bodies and database storage are finite.
MAX_MEDICAL_FILE_BYTES = 2 * 1024 * 1024
ALLOWED_MEDICAL_MIME_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp"
}
ALLOWED_MEDICAL_CATEGORIES = {"lab_report", "imaging", "prescription", "other"}
ALLOWED_HISTORY_TYPES = {"condition", "illness", "surgery", "allergy", "event", "other"}
ALLOWED_EXPENSE_CATEGORIES = {"consultation", "medicine", "diagnostic_test", "hospital", "treatment", "other"}


@app.route("/api/medical-documents", methods=["GET", "POST"])
@jwt_required()
def medical_documents():
    u = current_user()
    if request.method == "GET":
        rows = MedicalDocument.query.filter_by(user_id=u.id).order_by(MedicalDocument.document_date.desc()).all()
        return jsonify([{"id":x.id,"title":x.title,"category":x.category,"document_date":x.document_date,"notes":x.notes,"original_filename":x.original_filename,"mime_type":x.mime_type} for x in rows])

    upload = request.files.get("file")
    title = (request.form.get("title") or "").strip()
    category = (request.form.get("category") or "other").strip()
    document_date = (request.form.get("document_date") or date.today().isoformat()).strip()
    notes = (request.form.get("notes") or "").strip()[:500]
    if not upload or not upload.filename:
        return fail("Choose a PDF or image file to upload.")
    if not title:
        return fail("Document title is required.")
    if category not in ALLOWED_MEDICAL_CATEGORIES:
        return fail("Choose a valid document category.")
    try:
        datetime.strptime(document_date, "%Y-%m-%d")
    except ValueError:
        return fail("Document date must be a valid date.")
    mime_type = (upload.mimetype or "").lower()
    if mime_type not in ALLOWED_MEDICAL_MIME_TYPES:
        return fail("Only PDF, JPG, PNG and WEBP files are allowed.")
    file_data = upload.read(MAX_MEDICAL_FILE_BYTES + 1)
    if not file_data:
        return fail("The selected file is empty.")
    signatures = {
        "application/pdf": file_data.startswith(b"%PDF-"),
        "image/jpeg": file_data.startswith(b"\\xff\\xd8\\xff"),
        "image/png": file_data.startswith(b"\\x89PNG\\r\\n\\x1a\\n"),
        "image/webp": len(file_data) >= 12 and file_data[:4] == b"RIFF" and file_data[8:12] == b"WEBP"
    }
    if not signatures.get(mime_type, False):
        return fail("The file content does not match its selected file type.")
    if len(file_data) > MAX_MEDICAL_FILE_BYTES:
        return fail("File is too large. Please upload a file smaller than 2 MB.")
    original_filename = os.path.basename(upload.filename).replace("\x00", "")[:180]
    row = MedicalDocument(user_id=u.id, title=title[:180], category=category,
        document_date=document_date, notes=notes, original_filename=original_filename,
        mime_type=mime_type, file_data=file_data)
    db.session.add(row)
    db.session.commit()
    return jsonify({"id":row.id,"title":row.title,"category":row.category,"document_date":row.document_date,
        "notes":row.notes,"original_filename":row.original_filename,"mime_type":row.mime_type}), 201


@app.get("/api/medical-documents/<int:item_id>/download")
@jwt_required()
def download_medical_document(item_id):
    row = MedicalDocument.query.filter_by(id=item_id, user_id=current_user().id).first()
    if not row:
        return fail("Medical document not found.", 404)
    from io import BytesIO
    response = send_file(BytesIO(row.file_data), mimetype=row.mime_type,
        as_attachment=True, download_name=row.original_filename)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.delete("/api/medical-documents/<int:item_id>")
@jwt_required()
def delete_medical_document(item_id):
    row = MedicalDocument.query.filter_by(id=item_id, user_id=current_user().id).first()
    if not row:
        return fail("Medical document not found.", 404)
    db.session.delete(row)
    db.session.commit()
    return jsonify({"message":"Medical document deleted."})


@app.get("/api/caregiver/medical-documents/<int:item_id>/download")
@jwt_required()
def caregiver_download_medical_document(item_id):
    caregiver = current_user()
    owner_email = request.args.get("owner_email", "").strip().lower()
    owner = User.query.filter_by(email=owner_email).first()
    if not owner:
        return fail("Owner not found.", 404)
    grant = Permission.query.filter_by(owner_id=owner.id, caregiver_email=caregiver.email, revoked_at=None).first()
    if not grant or "medical_records" not in set(grant.scopes.split(",")):
        return fail("No active permission to view medical records.", 403)
    row = MedicalDocument.query.filter_by(id=item_id, user_id=owner.id).first()
    if not row:
        return fail("Medical document not found.", 404)
    from io import BytesIO
    response = send_file(BytesIO(row.file_data), mimetype=row.mime_type,
        as_attachment=True, download_name=row.original_filename)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.route("/api/medical-history", methods=["GET", "POST"])
@jwt_required()
def medical_history():
    u = current_user()
    if request.method == "GET":
        rows = MedicalHistory.query.filter_by(user_id=u.id).order_by(MedicalHistory.entry_date.desc()).all()
        return jsonify([{"id":x.id,"entry_type":x.entry_type,"title":x.title,"details":x.details,
            "entry_date":x.entry_date,"doctor_name":x.doctor_name,"hospital_name":x.hospital_name} for x in rows])
    d = request.get_json() or {}
    entry_type = str(d.get("entry_type","other"))
    title = str(d.get("title","")).strip()
    entry_date = str(d.get("entry_date") or date.today().isoformat())
    if entry_type not in ALLOWED_HISTORY_TYPES or not title:
        return fail("Choose a valid history type and enter a title.")
    try:
        datetime.strptime(entry_date, "%Y-%m-%d")
    except ValueError:
        return fail("Enter a valid history date.")
    row = MedicalHistory(user_id=u.id, entry_type=entry_type, title=title[:180],
        details=str(d.get("details",""))[:2000], entry_date=entry_date,
        doctor_name=str(d.get("doctor_name",""))[:150], hospital_name=str(d.get("hospital_name",""))[:150])
    db.session.add(row); db.session.commit()
    return jsonify({"id":row.id,"entry_type":row.entry_type,"title":row.title,"details":row.details,
        "entry_date":row.entry_date,"doctor_name":row.doctor_name,"hospital_name":row.hospital_name}), 201


@app.delete("/api/medical-history/<int:item_id>")
@jwt_required()
def delete_medical_history(item_id):
    row = MedicalHistory.query.filter_by(id=item_id, user_id=current_user().id).first()
    if not row: return fail("Medical history entry not found.", 404)
    db.session.delete(row); db.session.commit()
    return jsonify({"message":"Medical history entry deleted."})


@app.route("/api/medical-expenses", methods=["GET", "POST"])
@jwt_required()
def medical_expenses():
    u = current_user()
    if request.method == "GET":
        rows = MedicalExpense.query.filter_by(user_id=u.id).order_by(MedicalExpense.expense_date.desc()).all()
        return jsonify([{"id":x.id,"category":x.category,"amount":str(x.amount),"expense_date":x.expense_date,"description":x.description} for x in rows])
    d = request.get_json() or {}
    category = str(d.get("category","other"))
    description = str(d.get("description","")).strip()
    expense_date = str(d.get("expense_date") or date.today().isoformat())
    try:
        amount = float(d.get("amount", 0))
        datetime.strptime(expense_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return fail("Enter a valid amount and date.")
    if category not in ALLOWED_EXPENSE_CATEGORIES or not math.isfinite(amount) or amount <= 0 or amount > 10000000:
        return fail("Choose a valid category and enter an amount greater than zero.")
    row = MedicalExpense(user_id=u.id, category=category, amount=amount,
        expense_date=expense_date, description=description[:300])
    db.session.add(row); db.session.commit()
    return jsonify({"id":row.id,"category":row.category,"amount":str(row.amount),
        "expense_date":row.expense_date,"description":row.description}), 201


@app.delete("/api/medical-expenses/<int:item_id>")
@jwt_required()
def delete_medical_expense(item_id):
    row = MedicalExpense.query.filter_by(id=item_id, user_id=current_user().id).first()
    if not row: return fail("Medical expense not found.", 404)
    db.session.delete(row); db.session.commit()
    return jsonify({"message":"Medical expense deleted."})


@app.post("/api/notifications/run-reminders")
def run_reminders():
    secret = os.getenv("REMINDER_CRON_SECRET")
    if not secret or request.headers.get("X-Reminder-Secret") != secret:
        return jsonify({"error": "Unauthorized"}), 401

    now = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=5, minutes=30)
    window_start = now - timedelta(minutes=10)

    sent = 0
    failed = 0

    medications = Medication.query.filter_by(active=True).all()

    for med in medications:
        try:
            scheduled_time = datetime.strptime(
                med.schedule_time, "%H:%M"
            ).time()

            for day in (now.date(), (now - timedelta(days=1)).date()):
                scheduled_dt = datetime.combine(day, scheduled_time)

                if not (window_start < scheduled_dt <= now):
                    continue

                scheduled_for = scheduled_dt.strftime("%Y-%m-%d %H:%M")

                already_sent = ReminderLog.query.filter_by(
                    medication_id=med.id,
                    scheduled_for=scheduled_for
                ).first()

                if already_sent:
                    continue

                user = db.session.get(User, med.user_id)
                if not user:
                    continue

                send_brevo_email(
                    user.email,
                    "ElderCare medication reminder",
                    f"<h2>Medication reminder</h2>"
                    f"<p>It is time to take <b>{med.name}</b>.</p>"
                    f"<p>Dosage: {med.dosage}</p>"
                    f"<p>Instructions: {med.instructions or 'Follow your prescription.'}</p>"
                )

                db.session.add(ReminderLog(
                    medication_id=med.id,
                    scheduled_for=scheduled_for
                ))
                db.session.commit()
                sent += 1

        except Exception:
            db.session.rollback()
            failed += 1

    return jsonify({
        "message": "Reminder check completed.",
        "emails_sent": sent,
        "failed": failed
    })
   
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG","false").lower()=="true", port=5000)
