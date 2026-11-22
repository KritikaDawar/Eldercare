import os
from datetime import datetime, date, time, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-only-change-me")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-jwt-change-me")
db_url = os.getenv("DATABASE_URL", "sqlite:///eldercare.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
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
    status = db.Column(db.String(12), default="pending")  # pending/taken/skipped/missed
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

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

class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    caregiver_email = db.Column(db.String(180), nullable=False, index=True)
    scopes = db.Column(db.String(200), nullable=False)  # comma-separated: medications,activity,health
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    revoked_at = db.Column(db.DateTime, nullable=True)

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
    allowed={"medications","activity","health"}
    if "@" not in email or not scopes or not set(scopes).issubset(allowed): return fail("Provide caregiver email and valid sharing scopes.")
    p=Permission(owner_id=u.id,caregiver_email=email,scopes=",".join(sorted(set(scopes))))
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
        out["medications"]=[{"name":m.name,"dosage":m.dosage,"schedule_time":m.schedule_time} for m in Medication.query.filter_by(user_id=owner.id,active=True).all()]
        out["recent_doses"]=[{"medication":db.session.get(Medication,x.medication_id).name,"scheduled_for":x.scheduled_for,"status":x.status} for x in Dose.query.filter_by(user_id=owner.id).order_by(Dose.scheduled_for.desc()).limit(20).all()]
    if "activity" in scopes:
        out["activities"]=[{"activity":x.activity,"minutes":x.minutes,"activity_date":x.activity_date} for x in Activity.query.filter_by(user_id=owner.id).order_by(Activity.activity_date.desc()).limit(20).all()]
    if "health" in scopes:
        out["measurements"]=[{"kind":x.kind,"value":x.value,"unit":x.unit,"recorded_at":x.recorded_at} for x in Measurement.query.filter_by(user_id=owner.id).order_by(Measurement.recorded_at.desc()).limit(20).all()]
    return jsonify(out)

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG","false").lower()=="true", port=5000)
