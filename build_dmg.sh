#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

VERSION="0.0.1"
DMG_NAME="Kikis_Spotify_Mixer_v${VERSION}.dmg"
APP_NAME="Kiki's Spotify Mixer.app"
STAGING_DIR="$DIR/.dmg_staging"

echo "🎵 Step 1: Building macOS Application Bundle..."
./install_mac_app.sh

echo "📦 Step 2: Preparing DMG Staging Area..."
rm -rf "$STAGING_DIR" "$DMG_NAME"
mkdir -p "$STAGING_DIR"

# Copy the compiled .app into the staging directory
if [ -d "$APP_NAME" ]; then
    cp -R "$APP_NAME" "$STAGING_DIR/"
elif [ -d "$HOME/Applications/$APP_NAME" ]; then
    cp -R "$HOME/Applications/$APP_NAME" "$STAGING_DIR/"
elif [ -d "/Applications/$APP_NAME" ]; then
    cp -R "/Applications/$APP_NAME" "$STAGING_DIR/"
else
    echo "❌ Error: Could not locate $APP_NAME"
    exit 1
fi

# Create the standard macOS /Applications drag-and-drop symlink
ln -s /Applications "$STAGING_DIR/Applications" 2>/dev/null || true

echo "💿 Step 3: Generating Compressed Disk Image ($DMG_NAME)..."
rm -f "$DIR/$DMG_NAME"
hdiutil create -volname "Kiki's Spotify Mixer" \
               -srcfolder "$STAGING_DIR" \
               -ov \
               -format UDZO \
               "$DIR/$DMG_NAME"

rm -rf "$STAGING_DIR"

echo "=================================================================="
echo "🎉 SUCCESS! Created installer: $DIR/$DMG_NAME"
echo "👉 You can now share this .dmg file with anyone."
echo "=================================================================="
