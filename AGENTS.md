# Antigravity Workspace Guidelines & Persistent Rules

## Project Attribution and Credits
Whenever project credits, README banners, release notes, or public documentation are written or modified across this and all related projects:
- **Conception**: Must be credited to the author (**Quio**). Do not state that the project was conceived by AI, unless the original concept was explicitly initiated by the AI.
- **Design**: Must be credited as a mutual/collaborative design between the author and Google Antigravity.
- **Code Implementation**: Must be credited as coded and assembled using AI with **Google Antigravity**.

### Standard Format:
> **💡 Project Credits**: Conceived by **Quio**, designed collaboratively, and coded & assembled using AI with **Google Antigravity**.

## Build & Lifecycle Rules
- **Quit Running Instances Before Building**: Always quit or terminate running instances of the app (`Kiki's Spotify Mixer`, `kiki_spotify_launcher`, `kiki_backend`) before building or installing a new version. This prevents macOS file-busy locks, ensures assets are cleanly copied, and guarantees that subsequent launches run the newly built binaries and frontend bundle without stale cache.

