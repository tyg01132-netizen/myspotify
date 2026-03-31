import os, json, time, secrets, threading, webbrowser, requests, urllib.parse
from flask import Flask, render_template, request, jsonify, session, redirect

VERSION           = "2.5.2"
GITHUB_REPO       = "tyg01132-netizen/myspotify"
SETTINGS_FILE     = "settings.json"
SPOTIFY_AUTH_URL  = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
REDIRECT_URI      = "http://myspotify/callback"
REDIRECT_FALLBACK = "http://127.0.0.1:5001/callback"

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

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE) as f: return json.load(f)
        except: pass
    return {}

def save_settings(data):
    with open(SETTINGS_FILE, "w") as f: json.dump(data, f, indent=2)

def get_or_create_secret():
    s = load_settings()
    if not s.get("_secret_key"):
        s["_secret_key"] = secrets.token_hex(32)
        save_settings(s)
    return s["_secret_key"]

app = Flask(__name__)
app.secret_key = get_or_create_secret()

def save_tokens(access, refresh, expires_in=3600):
    s = load_settings()
    s["_access_token"] = access
    s["_refresh_token"] = refresh
    s["_token_expiry"] = int(time.time()) + expires_in - 60
    save_settings(s)

def load_tokens():
    s = load_settings()
    return s.get("_access_token"), s.get("_refresh_token"), s.get("_token_expiry", 0)

def clear_tokens():
    s = load_settings()
    for k in ["_access_token", "_refresh_token", "_token_expiry"]: s.pop(k, None)
    save_settings(s)

def get_valid_token():
    access, refresh, expiry = load_tokens()
    if not access: return None, "no_token"
    if time.time() < expiry: return access, None
    if not refresh: return None, "no_refresh"
    s = load_settings()
    resp = requests.post(SPOTIFY_TOKEN_URL, data={
        "grant_type": "refresh_token", "refresh_token": refresh,
        "client_id": s.get("client_id",""), "client_secret": s.get("client_secret",""),
    })
    if resp.status_code != 200: clear_tokens(); return None, "refresh_failed"
    d = resp.json()
    save_tokens(d["access_token"], d.get("refresh_token", refresh), d.get("expires_in", 3600))
    return d["access_token"], None

# Update checker
_latest_version = None
_update_url = None

def check_for_update():
    global _latest_version, _update_url
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
            headers={"User-Agent": "myspotify"}, timeout=5
        )
        if resp.status_code == 200:
            d = resp.json()
            _latest_version = d.get("tag_name","").lstrip("v")
            _update_url = d.get("html_url","")
            for asset in d.get("assets",[]):
                if asset["name"].endswith(".exe"):
                    _update_url = asset["browser_download_url"]; break
    except: pass

def get_redirect_uri():
    try:
        import socket
        if socket.gethostbyname("myspotify") == "127.0.0.1": return REDIRECT_URI
    except: pass
    return REDIRECT_FALLBACK

# Routes
@app.route("/")
def index(): return render_template("index.html")

@app.route("/callback")
def callback():
    code = request.args.get("code")
    error = request.args.get("error")
    if error: return redirect("/?auth_error=" + error)
    if not code: return redirect("/?auth_error=no_code")
    s = load_settings()
    resp = requests.post(SPOTIFY_TOKEN_URL, data={
        "grant_type": "authorization_code", "code": code,
        "redirect_uri": get_redirect_uri(),
        "client_id": s.get("client_id",""), "client_secret": s.get("client_secret",""),
    })
    if resp.status_code != 200: return redirect(f"/?auth_error=token_failed_{resp.status_code}")
    d = resp.json()
    save_tokens(d["access_token"], d["refresh_token"], d.get("expires_in", 3600))
    return redirect("/?logged_in=1")

@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    s = load_settings()
    return jsonify({"client_id": s.get("client_id",""), "has_secret": bool(s.get("client_secret")), "configured": bool(s.get("client_id") and s.get("client_secret"))})

@app.route("/api/settings", methods=["POST"])
def api_post_settings():
    d = request.json or {}; s = load_settings()
    if d.get("client_id"): s["client_id"] = d["client_id"].strip()
    if d.get("client_secret"): s["client_secret"] = d["client_secret"].strip()
    save_settings(s); return jsonify({"ok": True})

@app.route("/api/auth/login")
def api_auth_login():
    s = load_settings(); cid = s.get("client_id")
    if not cid: return jsonify({"error": "no_client_id"}), 400
    state = secrets.token_urlsafe(16); session["oauth_state"] = state
    params = {"client_id": cid, "response_type": "code", "redirect_uri": get_redirect_uri(), "scope": SCOPES, "state": state, "show_dialog": "false"}
    return jsonify({"url": SPOTIFY_AUTH_URL + "?" + urllib.parse.urlencode(params)})

@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout(): clear_tokens(); session.clear(); return jsonify({"ok": True})

@app.route("/api/auth/status")
def api_auth_status(): t, e = get_valid_token(); return jsonify({"logged_in": bool(t and not e)})

@app.route("/api/auth/token")
def api_auth_token():
    t, e = get_valid_token()
    if not t: return jsonify({"error": e or "not_logged_in"}), 401
    return jsonify({"access_token": t})

@app.route("/api/auth/refresh", methods=["POST"])
def api_auth_refresh():
    _, refresh, _ = load_tokens()
    if not refresh: return jsonify({"error": "no_refresh_token"}), 401
    s = load_settings()
    resp = requests.post(SPOTIFY_TOKEN_URL, data={"grant_type": "refresh_token", "refresh_token": refresh, "client_id": s.get("client_id",""), "client_secret": s.get("client_secret","")})
    if resp.status_code != 200: clear_tokens(); return jsonify({"error": "refresh_failed"}), 401
    d = resp.json(); save_tokens(d["access_token"], d.get("refresh_token", refresh), d.get("expires_in", 3600))
    return jsonify({"access_token": d["access_token"]})

@app.route("/api/version")
def api_version():
    return jsonify({"current": VERSION, "latest": _latest_version, "update_url": _update_url, "has_update": bool(_latest_version and _latest_version != VERSION)})

if __name__ == "__main__":
    s = load_settings()
    print(f"\n{'='*52}\n   myspotify musican® — v{VERSION}\n{'='*52}")
    print(f"   Credentials : {'✓ saved' if s.get('client_id') else '✗ not set'}")
    print(f"   Login       : {'✓ logged in' if s.get('_access_token') else '○ login required'}")
    print(f"   URL         : http://myspotify  (or http://127.0.0.1:5001)")
    print(f"{'='*52}\n   Press Ctrl+C to stop\n")

    threading.Thread(target=check_for_update, daemon=True).start()

    def open_browser():
        time.sleep(1.2)
        try:
            import socket
            if socket.gethostbyname("myspotify") == "127.0.0.1": webbrowser.open("http://myspotify"); return
        except: pass
        webbrowser.open("http://127.0.0.1:5001")
    threading.Thread(target=open_browser, daemon=True).start()

    app.run(debug=False, port=5001, host="127.0.0.1")
