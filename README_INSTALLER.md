# Building the myspotify Installer

## Prerequisites
1. **Inno Setup 6** — download free from https://jrsoftware.org/isinfo.php
2. **Python 3.11+** — must be installed on your build machine

## Steps to build the installer

1. Make sure you're in the `spotify-client` folder
2. Convert `icon.svg` to `icon.ico` (use https://convertio.co or similar)
   - Place the result at `static/icon.ico`
3. Open Inno Setup
4. File → Open → select `myspotify.iss`
5. Click **Build → Compile** (or press F9)
6. The installer appears in the `dist/` folder as `myspotify-setup-2.5.2.exe`

## Releasing a new version

1. Update `VERSION` in `app.py`
2. Update `MyAppVersion` in `myspotify.iss`
3. Build the installer
4. Go to GitHub → Releases → "Draft a new release"
5. Tag: `v2.5.2` (match the version number)
6. Upload the `.exe` file from `dist/`
7. Publish the release

The app will automatically detect the new version and prompt users to update.

## How auto-update works

When myspotify starts, it silently checks:
`https://api.github.com/repos/tyg01132-netizen/myspotify/releases/latest`

If the `tag_name` is newer than the current VERSION, the browser shows a popup:
"Update available! Click to download v2.5.3"

Clicking it downloads the new installer. The user runs it — done.
