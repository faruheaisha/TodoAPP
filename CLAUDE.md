# TodoApp — Desktop Todo Application

A minimalist, Anthropic-style todo desktop application for Windows 11, built with Tauri v2 + React + TypeScript.

## Tech Stack

- **Backend**: Tauri v2 (Rust) — lightweight desktop runtime
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **State**: Zustand (with persist middleware)
- **Database**: SQLite via `@tauri-apps/plugin-sql`
- **i18n**: i18next (Chinese + English)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Font**: Inter Variable (Anthropic-style typography)
- **PDF Export**: @react-pdf/renderer
- **Date Handling**: date-fns

## Features

- Two todo types: Quick (no deadline) and Long-term (with deadline)
- Anthropic-inspired design (coral accent + cream/dark backgrounds)
- Light / Dark theme toggle
- Chinese / English language switch
- Windows startup prompt (configurable delay)
- Deadline reminder notifications
- Global hotkey (default: Ctrl+Shift+T)
- Data backup/restore (JSON)
- Export to JSON, CSV, PDF
- System tray integration
- Window state persistence

## Prerequisites

- **Node.js** ≥ 18
- **Rust** ≥ 1.77 (install from https://www.rust-lang.org/tools/install)
- **WebView2** runtime (built into Windows 10/11)

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
src/                    # React frontend
├── components/         # UI components
├── store/              # Zustand stores
├── lib/                # Utilities (PDF, CSV, Tauri IPC)
├── i18n/               # Language files
└── styles/             # Global CSS + theme variables

src-tauri/              # Rust backend
├── src/                # Rust source code
│   ├── main.rs         # Entry point
│   └── lib.rs          # Tauri commands + plugin setup
├── capabilities/       # Permission config
└── tauri.conf.json     # Tauri configuration
```

## Tauri Plugins Used

| Plugin | Purpose |
|--------|---------|
| `@tauri-apps/plugin-autostart` | Register Windows startup entry |
| `@tauri-apps/plugin-notification` | Toast notifications (startup prompt, deadline alerts) |
| `@tauri-apps/plugin-sql` | SQLite database for todo persistence |
| `@tauri-apps/plugin-store` | User preference storage |
| `@tauri-apps/plugin-dialog` | File/folder picker dialogs |
| `@tauri-apps/plugin-fs` | File system access for export/backup |
| `@tauri-apps/plugin-global-shortcut` | Custom global hotkey |
| `@tauri-apps/plugin-window-state` | Remember window position/size |

## Color Palette

| Variable | Light | Dark |
|----------|-------|------|
| Background | `#FAF9F7` (cream) | `#1A1814` (charcoal) |
| Card | `#FFFFFF` | `#262420` |
| Accent | `#D97757` (coral) | `#D97757` |
| Text Primary | `#1A1814` | `#FAF9F7` |
| Text Secondary | `#5C5A57` | `#8C8A87` |
| Border | `#E5E3DF` | `#33312E` |

## License

MIT
