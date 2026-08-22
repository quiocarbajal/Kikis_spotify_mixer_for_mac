#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "🎵 Building Kiki's Spotify Mixer for macOS..."

# 1. Generate AppIcon.icns from Icon.jpeg
if [ -f "Icon.jpeg" ]; then
    echo "🎨 Generating AppIcon.icns from Icon.jpeg..."
    TMP_ICONSET="/tmp/kiki_icon.iconset"
    rm -rf "$TMP_ICONSET"
    mkdir -p "$TMP_ICONSET"
    sips -s format png -z 16 16     Icon.jpeg --out "$TMP_ICONSET/icon_16x16.png" >/dev/null 2>&1
    sips -s format png -z 32 32     Icon.jpeg --out "$TMP_ICONSET/icon_16x16@2x.png" >/dev/null 2>&1
    sips -s format png -z 32 32     Icon.jpeg --out "$TMP_ICONSET/icon_32x32.png" >/dev/null 2>&1
    sips -s format png -z 64 64     Icon.jpeg --out "$TMP_ICONSET/icon_32x32@2x.png" >/dev/null 2>&1
    sips -s format png -z 128 128   Icon.jpeg --out "$TMP_ICONSET/icon_128x128.png" >/dev/null 2>&1
    sips -s format png -z 256 256   Icon.jpeg --out "$TMP_ICONSET/icon_128x128@2x.png" >/dev/null 2>&1
    sips -s format png -z 256 256   Icon.jpeg --out "$TMP_ICONSET/icon_256x256.png" >/dev/null 2>&1
    sips -s format png -z 512 512   Icon.jpeg --out "$TMP_ICONSET/icon_256x256@2x.png" >/dev/null 2>&1
    sips -s format png -z 512 512   Icon.jpeg --out "$TMP_ICONSET/icon_512x512.png" >/dev/null 2>&1
    sips -s format png -z 1024 1024 Icon.jpeg --out "$TMP_ICONSET/icon_512x512@2x.png" >/dev/null 2>&1
    iconutil -c icns "$TMP_ICONSET" -o app_icon.icns
    rm -rf "$TMP_ICONSET"
    cp Icon.jpeg frontend/icon.jpeg
fi

# 2. Compile Swift native launcher
echo "🔨 Compiling native macOS launcher binary..."
mkdir -p mac_app
swiftc mac_app/main.swift -o mac_app/kiki_spotify_launcher -framework Cocoa -framework WebKit

# 3. Create .app bundle
APP_DIR="Kiki's Spotify Mixer.app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp mac_app/kiki_spotify_launcher "$APP_DIR/Contents/MacOS/kiki_spotify_launcher"
chmod +x "$APP_DIR/Contents/MacOS/kiki_spotify_launcher"
cp app_icon.icns "$APP_DIR/Contents/Resources/AppIcon.icns"
cp -R backend "$APP_DIR/Contents/Resources/backend"
cp -R frontend "$APP_DIR/Contents/Resources/frontend"
cp requirements.txt "$APP_DIR/Contents/Resources/requirements.txt"
cp .env.example "$APP_DIR/Contents/Resources/.env.example"
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

cat << 'EOF' > "$APP_DIR/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>kiki_spotify_launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.kiki.spotifymixer</string>
    <key>CFBundleName</key>
    <string>Kiki's Spotify Mixer</string>
    <key>CFBundleDisplayName</key>
    <string>Kiki's Spotify Mixer</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon.icns</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
</dict>
</plist>
EOF

# 4. Install to User's Applications folder (No admin rights required)
USER_APPS="$HOME/Applications"
mkdir -p "$USER_APPS"

echo "📦 Installing to $USER_APPS/Kiki's Spotify Mixer.app..."
rm -rf "$USER_APPS/$APP_DIR"
cp -R "$APP_DIR" "$USER_APPS/$APP_DIR"

# Also update /Applications if writable
if [ -w "/Applications" ]; then
    rm -rf "/Applications/$APP_DIR" 2>/dev/null || true
    cp -R "$APP_DIR" "/Applications/$APP_DIR" 2>/dev/null || true
fi

# Clean up local build directory copy
rm -rf "$APP_DIR"

echo "✅ Done! Installed successfully into $USER_APPS/Kiki's Spotify Mixer.app"
echo "🚀 You can now launch 'Kiki'\''s Spotify Mixer' from Spotlight (Cmd+Space), Launchpad, or ~/Applications."
