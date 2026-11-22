# ElderCare — Milestone 2 MVP

Responsive web MVP for medication routines, activity logging, health measurements and consent-based caregiver summaries.

## Technology
- Frontend: React 18 + Vite
- Backend: Python Flask REST API
- Data: SQLAlchemy; SQLite by default for easy local demonstration, PostgreSQL when `DATABASE_URL` is configured
- Authentication: demo-ready email/password registration and bearer-token sessions
- Notifications: in-app reminder simulation in this MVP. Browser push delivery is a remaining integration task.

## Run locally
Requirements: Python 3.10+, Node.js 18+.

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows; use cp on macOS/Linux
python app.py
```
API runs at http://127.0.0.1:5000. SQLite database is created automatically.

### Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally http://localhost:5173).

### PostgreSQL
Set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/eldercare` in `backend/.env`, install requirements, and ensure the database exists. SQLite is the default so the demo works without a PostgreSQL server.

## Demo workflow
1. Register an account (use fictional demo data).
2. Add a medication and schedule.
3. Mark a dose taken, skipped or missed.
4. Record an activity and health measurement.
5. Create a caregiver permission using a caregiver email and selected scopes.
6. Revoke the permission and verify it becomes inactive.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- `GET/POST /api/medications`, `PATCH/DELETE /api/medications/<id>`
- `GET/POST /api/doses`, `PATCH /api/doses/<id>`
- `GET/POST /api/activities`
- `GET/POST /api/measurements`
- `GET/POST /api/permissions`, `DELETE /api/permissions/<id>`
- `GET /api/caregiver/summary?owner_email=...` (requires active grant and matching caregiver identity)
- `GET /api/health`

## Safety and scope
ElderCare is a self-management and communication aid, not a medical device. It does not diagnose, prescribe, adjust medication, or provide emergency monitoring. Users must follow clinician instructions. Never use real patient data in a public demo. Caregiver sharing is opt-in and scope-limited.

## Validation
Run backend tests:
```bash
cd backend
python -m unittest discover -s tests -v
```
The included tests are starter automated checks; execute them locally and record actual results in the evaluation report. Do not present planned tests as passed tests.
