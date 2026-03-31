import os
import json
import time
import secrets
import requests
import urllib.parse
from flask import Flask, render_template, request, jsonify, session, redirect

SETTINGS_FILE     = "settings.json"
SPOTIFY_AUTH_URL  = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
REDIRECT_URI      = "http://127.0.0.1:5001/callback"

SCOPES = " ".join([
    "streaming",
    "user-read-email", "user-read-private",
    "user-library-read", "user-library-modify",
    "user-read-playback-state", "user-modify-playback-state",
    "user-read-currently-playing", "user-read-recently-played",
    "user-top-read",
    "playlist-read-private", "playlist-read-collaborative",
    "playlist-modify-public", "playlist-modify-private",
    "user-follow-read", "user-follow-modify",
])

# ─── Settings helpers ─────────────────────────────────────────────────────────

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_settings(data):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def get_or_create_secret():
    """Persistent secret key — sessions survive server restarts."""
    s = load_settings()
    if not s.get("_secret_key"):
        s["_secret_key"] = secrets.token_hex(32)
        save_settings(s)
    return s["_secret_key"]

# ─── App ──────────────────────────────────────────────────────────────────────

app = Flask(__name__)
app.secret_key = get_or_create_secret()

# ─── Token helpers ────────────────────────────────────────────────────────────

def save_tokens(access_token, refresh_token, expires_in=3600):
    """Persist tokens to disk so login survives server restarts."""
    s = load_settings()
    s["_access_token"]  = access_token
    s["_refresh_token"] = refresh_token
    s["_token_expiry"]  = int(time.time()) + expires_in - 60
    save_settings(s)

def load_tokens():
    s = load_settings()
    return s.get("_access_token"), s.get("_refresh_token"), s.get("_token_expiry", 0)

def clear_tokens():
    s = load_settings()
    for k in ["_access_token", "_refresh_token", "_token_expiry"]:
        s.pop(k, None)
    save_settings(s)

def get_valid_token():
    """Return a valid access token, auto-refreshing when needed."""
    access, refresh, expiry = load_tokens()
    if not access:
        return None, "no_token"
    if time.time() < expiry:
        return access, None
    if not refresh:
        return None, "no_refresh"
    # Refresh
    s = load_settings()
    resp = requests.post(SPOTIFY_TOKEN_URL, data={
        "grant_type":    "refresh_token",
        "refresh_token": refresh,
        "client_id":     s.get("client_id", ""),
        "client_secret": s.get("client_secret", ""),
    })
    if resp.status_code != 200:
        clear_tokens()
        return None, "refresh_failed"
    data = resp.json()
    new_access  = data["access_token"]
    new_refresh = data.get("refresh_token", refresh)
    save_tokens(new_access, new_refresh, data.get("expires_in", 3600))
    return new_access, None

# ─── Pages ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/callback")
def callback():
    code  = request.args.get("code")
    error = request.args.get("error")

    if error:
        return redirect("/?auth_error=" + error)

    if not code:
        return redirect("/?auth_error=no_code")

    s = load_settings()
    client_id     = s.get("client_id", "")
    client_secret = s.get("client_secret", "")

    if not client_id or not client_secret:
        return redirect("/?auth_error=no_credentials")

    resp = requests.post(SPOTIFY_TOKEN_URL, data={
        "grant_type":   "authorization_code",
        "code":          code,
        "redirect_uri":  REDIRECT_URI,
        "client_id":     client_id,
        "client_secret": client_secret,
    })

    if resp.status_code != 200:
        return redirect(f"/?auth_error=token_failed_{resp.status_code}")

    data = resp.json()
    save_tokens(data["access_token"], data["refresh_token"], data.get("expires_in", 3600))
    return redirect("/?logged_in=1")

# ─── Settings API ─────────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    s = load_settings()
    return jsonify({
        "client_id":  s.get("client_id", ""),
        "has_secret": bool(s.get("client_secret")),
        "configured": bool(s.get("client_id") and s.get("client_secret")),
    })

@app.route("/api/settings", methods=["POST"])
def api_post_settings():
    data = request.json or {}
    s = load_settings()
    if data.get("client_id"):
        s["client_id"] = data["client_id"].strip()
    if data.get("client_secret"):
        s["client_secret"] = data["client_secret"].strip()
    save_settings(s)
    return jsonify({"ok": True})

@app.route("/api/settings/clear", methods=["POST"])
def api_clear_settings():
    clear_tokens()
    session.clear()
    return jsonify({"ok": True})

# ─── Auth API ─────────────────────────────────────────────────────────────────

@app.route("/api/auth/login")
def api_auth_login():
    s = load_settings()
    client_id = s.get("client_id")
    if not client_id:
        return jsonify({"error": "no_client_id"}), 400

    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state

    params = {
        "client_id":     client_id,
        "response_type": "code",
        "redirect_uri":  REDIRECT_URI,
        "scope":         SCOPES,
        "state":         state,
        "show_dialog":   "false",
    }
    url = SPOTIFY_AUTH_URL + "?" + urllib.parse.urlencode(params)
    return jsonify({"url": url})

@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    clear_tokens()
    session.clear()
    return jsonify({"ok": True})

@app.route("/api/auth/status")
def api_auth_status():
    token, err = get_valid_token()
    return jsonify({"logged_in": bool(token and not err)})

@app.route("/api/auth/token")
def api_auth_token():
    token, err = get_valid_token()
    if not token:
        return jsonify({"error": err or "not_logged_in"}), 401
    return jsonify({"access_token": token})

@app.route("/api/auth/refresh", methods=["POST"])
def api_auth_refresh():
    _, refresh, _ = load_tokens()
    if not refresh:
        return jsonify({"error": "no_refresh_token"}), 401
    s = load_settings()
    resp = requests.post(SPOTIFY_TOKEN_URL, data={
        "grant_type":    "refresh_token",
        "refresh_token": refresh,
        "client_id":     s.get("client_id", ""),
        "client_secret": s.get("client_secret", ""),
    })
    if resp.status_code != 200:
        clear_tokens()
        return jsonify({"error": "refresh_failed"}), 401
    data = resp.json()
    save_tokens(data["access_token"], data.get("refresh_token", refresh), data.get("expires_in", 3600))
    return jsonify({"access_token": data["access_token"]})

# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    s = load_settings()
    has_creds = bool(s.get("client_id") and s.get("client_secret"))
    has_token = bool(s.get("_access_token"))
    print("\n" + "="*52)
    print("   myspotify — personal Spotify client")
    print("="*52)
    print(f"   Credentials : {'✓ saved' if has_creds else '✗ not set'}")
    print(f"   Login state : {'✓ already logged in' if has_token else '✗ login required'}")
    print(f"   URL         : http://127.0.0.1:5001")
    print("="*52 + "\n")
    app.run(debug=False, port=5001, host="127.0.0.1")
