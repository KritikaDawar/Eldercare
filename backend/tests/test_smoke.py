import unittest
from app import app, db

class SmokeTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"
        with app.app_context():
            db.drop_all()
            db.create_all()
        self.client = app.test_client()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def test_health_endpoint(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json["status"], "ok")

    def test_registration_validation(self):
        r = self.client.post("/api/auth/register", json={"name":"Test","email":"bad","password":"123"})
        self.assertEqual(r.status_code, 400)

if __name__ == "__main__":
    unittest.main()
