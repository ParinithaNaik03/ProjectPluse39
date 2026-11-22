"""
ProjectPulse Backend Server
Flask API with SQLite Database Persistence & Google Identity Services Authentication
"""
import os
import uuid
import secrets
import mimetypes
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from dotenv import load_dotenv
import requests

import db

# Load environment variables
load_dotenv()

BASE_DIR = Path(__file__).parent.resolve()
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app, supports_credentials=True)

# Configuration
PORT = int(os.getenv("PORT", 8000))
SECRET_KEY = os.getenv("SECRET_KEY", "projectpulse_production_secret_key_2024")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
TILE_PROVIDER = os.getenv("TILE_PROVIDER", "carto_voyager")
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'doc', 'docx'}

app.config["SECRET_KEY"] = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_current_user():
    """Extracts authenticated user from session cookie or Authorization header."""
    session_id = request.cookies.get("session_id")
    if not session_id and request.headers.get("Authorization"):
        parts = request.headers.get("Authorization").split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            session_id = parts[1]
    if not session_id:
        return None
    return db.get_user_from_session(session_id)

# Initialize and seed database
db.init_db()
db.seed_sample_data()

# ===================== STATIC & UPLOADS =====================

@app.route("/")
def index():
    resp = send_from_directory(str(BASE_DIR), "index.html")
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/app.js")
def serve_appjs():
    resp = send_from_directory(str(BASE_DIR), "app.js")
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/data/projects.js")
def serve_projectsjs():
    resp = send_from_directory(str(BASE_DIR / "data"), "projects.js")
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(str(UPLOAD_DIR), filename)

# ===================== CONFIG =====================

@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify({
        "googleClientId": GOOGLE_CLIENT_ID,
        "tileProvider": TILE_PROVIDER,
        "appName": "ProjectPulse",
        "hasGoogleAuth": bool(GOOGLE_CLIENT_ID and not GOOGLE_CLIENT_ID.startswith("YOUR_"))
    })

# ===================== AUTHENTICATION =====================

@app.route("/api/auth/google", methods=["POST"])
def auth_google():
    """Verifies Google Identity Services ID token and returns session."""
    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    if not credential:
        return jsonify({"error": "Missing Google ID token credential"}), 400

    google_data = None

    # 1. Try google-auth library
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        request_adapter = google_requests.Request()
        
        # If client ID is configured, verify against it; otherwise verify signature with Google certs
        client_id = GOOGLE_CLIENT_ID if (GOOGLE_CLIENT_ID and not GOOGLE_CLIENT_ID.startswith("YOUR_")) else None
        id_info = id_token.verify_oauth2_token(credential, request_adapter, client_id)
        google_data = id_info
    except Exception as e:
        # Fallback to Google's public tokeninfo endpoint
        try:
            resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}", timeout=5)
            if resp.status_code == 200:
                google_data = resp.json()
        except Exception as e2:
            pass

    if not google_data or "email" not in google_data:
        return jsonify({"error": "Google ID token verification failed. Please try again."}), 401

    google_id = google_data.get("sub")
    email = google_data.get("email")
    name = google_data.get("name") or email.split("@")[0]
    picture = google_data.get("picture")

    # Upsert user into database
    user = db.upsert_user(google_id=google_id, name=name, email=email, avatar=picture, role="citizen")

    # Create session
    session_id = secrets.token_hex(32)
    db.create_user_session(user["id"], session_id, days=7)

    res = make_response(jsonify({"success": True, "user": user, "token": session_id}))
    res.set_cookie(
        "session_id",
        session_id,
        max_age=7*24*3600,
        httponly=True,
        samesite="Lax"
    )
    return res

@app.route("/api/auth/demo", methods=["POST"])
def auth_demo():
    """Fallback demo login to support role testing when Google OAuth is not yet configured."""
    data = request.get_json(silent=True) or {}
    role = data.get("role", "citizen")
    email = data.get("email", "").strip()

    if not email or "@" not in email:
        return jsonify({"error": "Valid email required"}), 400

    name = data.get("name") or email.split("@")[0].replace(".", " ").title()
    avatar = data.get("avatar") or name[:2].upper()

    user = db.upsert_user(google_id=None, name=name, email=email, avatar=avatar, role=role)
    session_id = secrets.token_hex(32)
    db.create_user_session(user["id"], session_id, days=7)

    res = make_response(jsonify({"success": True, "user": user, "token": session_id}))
    res.set_cookie("session_id", session_id, max_age=7*24*3600, httponly=True, samesite="Lax")
    return res

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    """Returns currently authenticated user."""
    user = get_current_user()
    if not user:
        return jsonify({"authenticated": False, "user": None}), 200
    return jsonify({"authenticated": True, "user": user})

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    """Logs out and deletes active session."""
    session_id = request.cookies.get("session_id")
    if not session_id and request.headers.get("Authorization"):
        parts = request.headers.get("Authorization").split(" ")
        if len(parts) == 2 and parts[0].lower() == "bearer":
            session_id = parts[1]
    if session_id:
        db.delete_user_session(session_id)
    res = make_response(jsonify({"success": True}))
    res.delete_cookie("session_id")
    return res

# ===================== PROJECTS API =====================

@app.route("/api/projects", methods=["GET"])
def get_projects():
    projects = db.get_all_projects()
    return jsonify(projects)

@app.route("/api/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    p = db.get_project_by_id(project_id)
    if not p:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(p)

@app.route("/api/projects", methods=["POST"])
def create_new_project():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("category"):
        return jsonify({"error": "Project name and category are required"}), 400
    created = db.create_project(data)
    return jsonify(created), 201

@app.route("/api/projects/<project_id>", methods=["PUT"])
def update_existing_project(project_id):
    data = request.get_json() or {}
    updated = db.update_project(project_id, data)
    return jsonify(updated)

@app.route("/api/projects/<project_id>", methods=["DELETE"])
def delete_existing_project(project_id):
    db.delete_project(project_id)
    return jsonify({"success": True, "id": project_id})

# ===================== CITIZEN REPORTS API =====================

@app.route("/api/reports", methods=["GET"])
def get_reports():
    user = get_current_user()
    reports = db.get_all_reports(
        user_id=user["id"] if user else None,
        role=user["role"] if user else "citizen"
    )
    return jsonify(reports)

@app.route("/api/reports", methods=["POST"])
def create_report():
    user = get_current_user()
    data = request.get_json() or {}
    if not data.get("title") or not data.get("description"):
        return jsonify({"error": "Title and description are required"}), 400

    user_id = user["id"] if user else None
    user_name = user["name"] if user else (data.get("submittedBy") or "Citizen")

    report = db.create_citizen_report(data, user_id=user_id, user_name=user_name)
    return jsonify(report), 201

@app.route("/api/reports/<report_id>/status", methods=["PUT"])
def update_report_status_endpoint(report_id):
    user = get_current_user()
    if user and user.get("role") != "admin":
        return jsonify({"error": "Admin authorization required to update report status"}), 403
    data = request.get_json() or {}
    status = data.get("status")
    if not status:
        return jsonify({"error": "Status is required"}), 400
    actor = user["name"] if user else "Admin"
    db.update_report_status(report_id, status, actor_name=actor)
    return jsonify({"success": True, "id": report_id, "status": status})

@app.route("/api/reports/<report_id>/remarks", methods=["POST"])
def save_report_remark_endpoint(report_id):
    user = get_current_user()
    if user and user.get("role") != "admin":
        return jsonify({"error": "Admin authorization required to add remarks"}), 403
    data = request.get_json() or {}
    remark = data.get("internalRemarks", "")
    db.add_report_remark(report_id, remark)
    return jsonify({"success": True, "id": report_id, "internalRemarks": remark})

# ===================== USERS & NOTIFICATIONS =====================

@app.route("/api/users", methods=["GET"])
def get_users_list():
    users = db.get_all_users()
    return jsonify(users)

@app.route("/api/notifications", methods=["GET"])
def get_notifications_list():
    notifications = db.get_all_notifications()
    return jsonify(notifications)

# ===================== FILE UPLOADS =====================

@app.route("/api/upload", methods=["POST"])
def upload_file():
    user = get_current_user()
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400
    file = request.files["file"]
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        original_name = file.filename
        ext = original_name.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}_{int(secrets.randbelow(100000))}.{ext}"
        save_path = UPLOAD_DIR / unique_filename
        file.save(str(save_path))

        file_size = os.path.getsize(str(save_path))
        mime_type, _ = mimetypes.guess_type(str(save_path))
        mime_type = mime_type or "application/octet-stream"
        file_url = f"/uploads/{unique_filename}"

        entity_type = request.form.get("entityType")
        entity_id = request.form.get("entityId")
        user_id = user["id"] if user else None

        file_id = db.save_uploaded_file(
            filename=unique_filename,
            original_name=original_name,
            file_path=str(save_path),
            file_url=file_url,
            file_size=file_size,
            mime_type=mime_type,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id
        )

        return jsonify({
            "success": True,
            "id": file_id,
            "filename": unique_filename,
            "originalName": original_name,
            "fileUrl": file_url,
            "size": file_size,
            "mimeType": mime_type
        })
    else:
        return jsonify({"error": "File type not permitted"}), 400

# ===================== MAIN =====================

if __name__ == "__main__":
    print(f"🚀 ProjectPulse Backend Server starting on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
