const STYLE_ID = 'dsh-life-wiki-styles-v2'

const CSS = `
@keyframes lwFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes lwSlideInRight {
  from { transform: translateX(28px); opacity: 0.7; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes lwScaleIn {
  from { transform: translateY(8px) scale(0.985); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes lwCheckPop {
  0% { transform: scale(0.84); }
  55% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.lw-root {
  --lw-bg: #fcfcfb;
  --lw-surface: #ffffff;
  --lw-subtle: #f4f4f2;
  --lw-hover: rgba(24, 24, 27, 0.045);
  --lw-hover-strong: rgba(24, 24, 27, 0.08);
  --lw-border: rgba(24, 24, 27, 0.085);
  --lw-border-strong: rgba(24, 24, 27, 0.16);
  --lw-text: #18181b;
  --lw-text-2: #52525b;
  --lw-muted: #9898a0;
  --lw-accent: #1f6a52;
  --lw-accent-hover: #185743;
  --lw-accent-soft: rgba(31, 106, 82, 0.09);
  --lw-accent-text: #1a5c47;
  --lw-warn: #b46917;
  --lw-warn-soft: rgba(180, 105, 23, 0.1);
  --lw-danger: #c43b3b;
  --lw-danger-soft: rgba(196, 59, 59, 0.1);
  --lw-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --lw-shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.14), 0 0 0 1px var(--lw-border);
  --lw-ease: cubic-bezier(0.16, 1, 0.3, 1);

  box-sizing: border-box;
  color-scheme: light;
  height: 100%;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--lw-bg);
  color: var(--lw-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.lw-root[data-lw-theme="dark"] {
  color-scheme: dark;
  --lw-bg: #131314;
  --lw-surface: #1a1a1c;
  --lw-subtle: #202023;
  --lw-hover: rgba(255, 255, 255, 0.055);
  --lw-hover-strong: rgba(255, 255, 255, 0.1);
  --lw-border: rgba(255, 255, 255, 0.085);
  --lw-border-strong: rgba(255, 255, 255, 0.16);
  --lw-text: #f1f1f3;
  --lw-text-2: #a5a5ae;
  --lw-muted: #6e6e77;
  --lw-accent: #45a887;
  --lw-accent-hover: #56ba99;
  --lw-accent-soft: rgba(69, 168, 135, 0.14);
  --lw-accent-text: #7cd0b3;
  --lw-warn: #e09f4e;
  --lw-warn-soft: rgba(224, 159, 78, 0.14);
  --lw-danger: #e26d6d;
  --lw-danger-soft: rgba(226, 109, 109, 0.14);
  --lw-shadow-sm: none;
  --lw-shadow-lg: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--lw-border);
}

.lw-root *, .lw-root *::before, .lw-root *::after {
  box-sizing: border-box;
}

/* Header */
.lw-header {
  flex: 0 0 auto;
  height: 52px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  border-bottom: 1px solid var(--lw-border);
  background: var(--lw-bg);
}

.lw-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.lw-brand-name {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--lw-text);
  white-space: nowrap;
}

.lw-brand-sep {
  color: var(--lw-border-strong);
  font-size: 13px;
}

.lw-vault-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-muted);
  font-size: 13px;
  padding: 3px 7px;
  border-radius: 6px;
  cursor: pointer;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.lw-vault-btn:hover {
  background: var(--lw-hover);
  color: var(--lw-text);
}

.lw-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.lw-nav-item {
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-muted);
  font-size: 13.5px;
  font-weight: 500;
  padding: 0 13px;
  height: 100%;
  cursor: pointer;
  transition: color 0.15s;
  white-space: nowrap;
}

.lw-nav-item:hover {
  color: var(--lw-text-2);
}

.lw-nav-item.active {
  color: var(--lw-text);
  font-weight: 600;
}

.lw-nav-item.active::after {
  content: '';
  position: absolute;
  left: 11px;
  right: 11px;
  bottom: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--lw-text);
}

.lw-header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

/* Minimal icon & text buttons */
.lw-icon-btn {
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-text-2);
  height: 32px;
  min-width: 32px;
  padding: 0 8px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
  white-space: nowrap;
}

.lw-icon-btn:hover:not(:disabled) {
  background: var(--lw-hover);
  color: var(--lw-text);
}

.lw-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lw-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lw-accent);
  display: inline-block;
}

.lw-num {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--lw-accent-text);
  background: var(--lw-accent-soft);
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  border-radius: 999px;
}

.lw-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 13px;
  border-radius: 7px;
  border: 1px solid var(--lw-border-strong);
  background: var(--lw-surface);
  color: var(--lw-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.14s, border-color 0.14s, opacity 0.14s;
}

.lw-btn:hover:not(:disabled) {
  background: var(--lw-subtle);
}

.lw-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lw-btn-primary {
  background: var(--lw-text);
  border-color: var(--lw-text);
  color: var(--lw-bg);
}

.lw-btn-primary:hover:not(:disabled) {
  opacity: 0.88;
  background: var(--lw-text);
}

.lw-btn-accent {
  background: var(--lw-accent);
  border-color: var(--lw-accent);
  color: #ffffff;
}

.lw-btn-accent:hover:not(:disabled) {
  background: var(--lw-accent-hover);
  border-color: var(--lw-accent-hover);
}

.lw-btn-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--lw-text-2);
}

.lw-btn-ghost:hover:not(:disabled) {
  background: var(--lw-hover);
  color: var(--lw-text);
}

.lw-btn-danger {
  border-color: transparent;
  background: var(--lw-danger-soft);
  color: var(--lw-danger);
}

.lw-btn-danger:hover:not(:disabled) {
  filter: brightness(0.95);
}

.lw-btn-sm {
  height: 27px;
  padding: 0 10px;
  font-size: 12.5px;
  border-radius: 6px;
}

/* Inputs */
.lw-input, .lw-textarea, .lw-select {
  width: 100%;
  padding: 7px 11px;
  border-radius: 7px;
  border: 1px solid var(--lw-border-strong);
  background: var(--lw-surface);
  color: var(--lw-text);
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.14s, background 0.14s;
}

.lw-input:focus, .lw-textarea:focus, .lw-select:focus {
  border-color: var(--lw-text-2);
}

.lw-input::placeholder, .lw-textarea::placeholder {
  color: var(--lw-muted);
}

.lw-textarea {
  resize: vertical;
  min-height: 74px;
  line-height: 1.65;
}

.lw-inline-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--lw-text);
  font-size: 14px;
  font-family: inherit;
  padding: 6px 0;
  outline: none;
}

.lw-inline-input::placeholder {
  color: var(--lw-muted);
}

.lw-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Main scroll container */
.lw-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 28px 64px;
}

.lw-canvas {
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lw-canvas-wide {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* Typography & Layout helpers */
.lw-page-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.lw-h1 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.025em;
  margin: 0;
  color: var(--lw-text);
}

.lw-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--lw-border);
}

.lw-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lw-text);
  margin: 0;
}

.lw-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lw-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.lw-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lw-muted {
  color: var(--lw-muted);
  font-size: 12.5px;
}

.lw-meta {
  color: var(--lw-text-2);
  font-size: 12.5px;
}

/* Sub-tabs (clean underline) */
.lw-subtabs {
  display: flex;
  align-items: center;
  gap: 18px;
  border-bottom: 1px solid var(--lw-border);
}

.lw-subtab {
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-muted);
  font-size: 13.5px;
  font-weight: 500;
  padding: 0 2px 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: color 0.14s;
}

.lw-subtab:hover {
  color: var(--lw-text-2);
}

.lw-subtab.active {
  color: var(--lw-text);
  font-weight: 600;
}

.lw-subtab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1.5px;
  background: var(--lw-text);
}

/* Custom silky checkbox */
.lw-check {
  appearance: none;
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  margin-top: 2px;
  border-radius: 5px;
  border: 1.5px solid var(--lw-border-strong);
  background: transparent;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s var(--lw-ease), border-color 0.15s, transform 0.12s;
}

.lw-check:hover {
  border-color: var(--lw-accent);
}

.lw-check.checked {
  background: var(--lw-accent);
  border-color: var(--lw-accent);
  animation: lwCheckPop 0.22s var(--lw-ease);
}

/* Clean list rows */
.lw-list {
  display: flex;
  flex-direction: column;
}

.lw-item-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 9px 10px;
  margin: 0 -10px;
  border-radius: 8px;
  transition: background 0.13s;
}

.lw-item-row:hover {
  background: var(--lw-hover);
}

.lw-item-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--lw-text);
  word-break: break-word;
  transition: color 0.15s;
}

.lw-item-done {
  color: var(--lw-muted);
  text-decoration: line-through;
}

.lw-hover-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.14s;
}

.lw-item-row:hover .lw-hover-actions,
.lw-project-row:hover .lw-hover-actions,
.lw-section-head:hover .lw-hover-actions,
.lw-diary-entry:hover .lw-hover-actions,
.lw-hover-actions:focus-within {
  opacity: 1;
}

@media (hover: none) {
  .lw-hover-actions {
    opacity: 1;
  }
}

/* Project clean row */
.lw-project-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 12px;
  margin: 0 -12px;
  border-bottom: 1px solid var(--lw-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.14s;
}

.lw-project-row:hover {
  background: var(--lw-hover);
}

.lw-project-row:last-child {
  border-bottom-color: transparent;
}

/* Minimal Tag */
.lw-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lw-text-2);
  background: var(--lw-subtle);
  padding: 1px 7px;
  border-radius: 5px;
  white-space: nowrap;
}

.lw-tag-accent {
  background: var(--lw-accent-soft);
  color: var(--lw-accent-text);
}

.lw-tag-warn {
  background: var(--lw-warn-soft);
  color: var(--lw-warn);
}

/* Subtle quick box (diary capture, search) */
.lw-capture {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--lw-subtle);
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.lw-capture:focus-within {
  background: var(--lw-surface);
  border-color: var(--lw-border-strong);
}

/* Editorial card (used sparingly) */
.lw-surface-box {
  background: var(--lw-surface);
  border: 1px solid var(--lw-border);
  border-radius: 10px;
  padding: 16px 18px;
}

/* Progress micro bar */
.lw-bar {
  width: 64px;
  height: 4px;
  border-radius: 99px;
  background: var(--lw-subtle);
  overflow: hidden;
}

.lw-bar-fill {
  height: 100%;
  background: var(--lw-accent);
  border-radius: 99px;
  transition: width 0.22s var(--lw-ease);
}

/* Review 2-column */
.lw-review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

@media (max-width: 820px) {
  .lw-header {
    grid-template-columns: auto 1fr auto;
    padding: 0 14px;
  }
  .lw-review-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .lw-main {
    padding: 18px 16px 48px;
  }
}

/* Drawers & Modals */
.lw-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(12, 12, 14, 0.34);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  animation: lwFadeIn 0.15s ease-out;
}

.lw-backdrop-center {
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.lw-drawer {
  width: min(600px, 94vw);
  height: 100%;
  background: var(--lw-surface);
  box-shadow: var(--lw-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lwSlideInRight 0.2s var(--lw-ease);
}

.lw-drawer-sm {
  width: min(440px, 94vw);
}

.lw-modal {
  width: min(480px, 94vw);
  max-height: 86vh;
  background: var(--lw-surface);
  border-radius: 12px;
  box-shadow: var(--lw-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lwScaleIn 0.18s var(--lw-ease);
}

.lw-panel-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--lw-border);
}

.lw-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px;
}

.lw-panel-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--lw-border);
}

/* Duration popover */
.lw-popover-row {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--lw-surface);
  border: 1px solid var(--lw-border-strong);
  border-radius: 7px;
  padding: 2px 4px;
  box-shadow: var(--lw-shadow-sm);
}

.lw-pop-chip {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-text-2);
  font-size: 11.5px;
  padding: 2px 6px;
  border-radius: 5px;
  cursor: pointer;
}

.lw-pop-chip:hover {
  background: var(--lw-hover-strong);
  color: var(--lw-text);
}

/* Diary photos */
.lw-photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.lw-photo-thumb {
  width: 104px;
  height: 104px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--lw-border);
  cursor: zoom-in;
  transition: transform 0.15s;
}

.lw-photo-thumb:hover {
  transform: scale(1.02);
}

/* Markdown viewer */
.lw-md {
  color: var(--lw-text);
  line-height: 1.75;
  font-size: 14.5px;
}
.lw-md h1 { font-size: 20px; font-weight: 650; margin: 14px 0 8px; letter-spacing: -0.02em; }
.lw-md h2 { font-size: 16px; font-weight: 600; margin: 18px 0 8px; }
.lw-md h3 { font-size: 14.5px; font-weight: 600; margin: 12px 0 4px; }
.lw-md p { margin: 6px 0; }
.lw-md ul, .lw-md ol { margin: 6px 0; padding-left: 20px; }
.lw-md li { margin: 3px 0; }
.lw-md blockquote {
  margin: 10px 0;
  padding: 4px 12px;
  border-left: 2px solid var(--lw-border-strong);
  color: var(--lw-text-2);
}
.lw-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--lw-subtle);
}
.lw-md pre {
  margin: 10px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--lw-subtle);
  overflow-x: auto;
}
.lw-md pre code { padding: 0; background: transparent; }
.lw-md img {
  max-width: 100%;
  max-height: 360px;
  border-radius: 8px;
  border: 1px solid var(--lw-border);
  margin: 8px 0;
  display: block;
}
.lw-md a {
  color: var(--lw-accent-text);
  text-decoration: none;
  border-bottom: 1px solid var(--lw-accent-soft);
}
.lw-md a:hover { border-bottom-color: var(--lw-accent-text); }

/* Onboarding */
.lw-onboard-wrap {
  flex: 1 1 auto;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 20px;
}

.lw-onboard-card {
  width: min(500px, 100%);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Directory browser */
.lw-dir-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--lw-border);
  border-radius: 8px;
}

.lw-dir-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--lw-border);
  cursor: pointer;
  font-size: 13.5px;
  transition: background 0.12s;
}

.lw-dir-row:last-child { border-bottom: none; }
.lw-dir-row:hover { background: var(--lw-hover); }

/* Empty state */
.lw-empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--lw-muted);
  font-size: 13.5px;
}

/* Toast (quiet) */
.lw-toast {
  position: fixed;
  bottom: 20px;
  right: 22px;
  z-index: 120;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--lw-text);
  color: var(--lw-bg);
  font-size: 13px;
  box-shadow: var(--lw-shadow-lg);
  animation: lwScaleIn 0.16s var(--lw-ease);
}

.lw-toast-err {
  background: var(--lw-danger);
  color: #ffffff;
}

.lw-divider {
  height: 1px;
  background: var(--lw-border);
}

.lw-field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--lw-text-2);
  margin-bottom: 5px;
}
`

export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  const old = document.getElementById('dsh-life-wiki-styles')
  if (old) old.remove()
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.setAttribute('data-plugin', 'dsh-life-wiki')
  style.textContent = CSS
  document.head.appendChild(style)
}
