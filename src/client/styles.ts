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
  --lw-bg: #ffffff;
  --lw-surface: #ffffff;
  --lw-subtle: #f5f7fa;
  --lw-hover: #f2f6fc;
  --lw-hover-strong: #e8f0fc;
  --lw-border: #eceff4;
  --lw-border-strong: #d4dce7;
  --lw-text: #1d222b;
  --lw-text-2: #5b6577;
  --lw-muted: #98a2b3;
  --lw-accent: #2678f6;
  --lw-accent-hover: #1a66de;
  --lw-accent-soft: rgba(38, 120, 246, 0.11);
  --lw-accent-text: #1a62d6;
  --lw-gold: #f2b705;
  --lw-success: #219664;
  --lw-success-soft: rgba(46, 182, 125, 0.12);
  --lw-warn: #d98a00;
  --lw-warn-soft: rgba(217, 138, 0, 0.12);
  --lw-danger: #d94343;
  --lw-danger-soft: rgba(217, 67, 67, 0.11);
  --lw-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --lw-shadow-focus: 0 5px 20px rgba(15, 23, 42, 0.07), 0 0 0 1px rgba(38, 120, 246, 0.24);
  --lw-shadow-lg: 0 16px 44px rgba(15, 23, 42, 0.13), 0 0 0 1px rgba(15, 23, 42, 0.06);
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
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.lw-root[data-lw-theme="dark"] {
  color-scheme: dark;
  --lw-bg: #1b1f26;
  --lw-surface: #222731;
  --lw-subtle: #252b36;
  --lw-hover: rgba(76, 146, 255, 0.1);
  --lw-hover-strong: rgba(76, 146, 255, 0.18);
  --lw-border: rgba(255, 255, 255, 0.08);
  --lw-border-strong: rgba(255, 255, 255, 0.16);
  --lw-text: #eef1f6;
  --lw-text-2: #9ba5b7;
  --lw-muted: #687387;
  --lw-accent: #4c92ff;
  --lw-accent-hover: #64a2ff;
  --lw-accent-soft: rgba(76, 146, 255, 0.16);
  --lw-accent-text: #82b5ff;
  --lw-gold: #f5c23b;
  --lw-success: #42cc90;
  --lw-success-soft: rgba(46, 182, 125, 0.18);
  --lw-warn: #f0ab3a;
  --lw-warn-soft: rgba(240, 171, 58, 0.16);
  --lw-danger: #eb6a6a;
  --lw-danger-soft: rgba(235, 106, 106, 0.16);
  --lw-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.22);
  --lw-shadow-focus: 0 6px 24px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(76, 146, 255, 0.35);
  --lw-shadow-lg: 0 22px 54px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
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
  color: var(--lw-accent-text);
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
  background: var(--lw-accent);
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
  background: var(--lw-accent);
  border-color: var(--lw-accent);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(38, 120, 246, 0.24);
}

.lw-btn-primary:hover:not(:disabled) {
  background: var(--lw-accent-hover);
  border-color: var(--lw-accent-hover);
  opacity: 1;
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
  color: var(--lw-accent-text);
  font-weight: 600;
}

.lw-subtab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--lw-accent);
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

/* Subtle quick box (diary capture, search) — Things 3 soft elevation on focus */
.lw-capture {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 10px;
  background: var(--lw-subtle);
  border: 1px solid transparent;
  transition: background 0.18s var(--lw-ease), box-shadow 0.18s var(--lw-ease), border-color 0.18s;
}

.lw-capture:focus-within {
  background: var(--lw-surface);
  box-shadow: var(--lw-shadow-focus);
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

/* Status dropdown menu */
.lw-menu-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.lw-status-trigger {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--lw-text-2);
  height: 26px;
  padding: 0 7px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.14s, color 0.14s, border-color 0.14s;
}

.lw-status-trigger:hover,
.lw-status-trigger.open {
  background: var(--lw-hover);
  color: var(--lw-text);
}

.lw-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lw-status-dot.todo { background: #74b3ff; }
.lw-status-dot.doing { background: #e5484d; }
.lw-status-dot.pause { background: #98a2b3; }
.lw-status-dot.done { background: #2eb67d; }
.lw-status-dot.cancel { background: #98a2b3; }

.lw-menu {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  z-index: 60;
  min-width: 132px;
  padding: 4px;
  border-radius: 9px;
  background: var(--lw-surface);
  box-shadow: var(--lw-shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: lwScaleIn 0.14s var(--lw-ease);
}

.lw-menu-item {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-text);
  font-size: 13px;
  padding: 6px 9px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.12s;
}

.lw-menu-item:hover {
  background: var(--lw-hover);
}

.lw-menu-item.active {
  font-weight: 600;
}

/* Month-grouped task date history popover */
.lw-date-menu {
  left: 0;
  right: auto;
  min-width: 248px;
  padding: 6px;
}

.lw-date-menu-scroll {
  max-height: 268px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lw-date-month {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--lw-muted);
  padding: 6px 9px 3px;
}

.lw-date-month:first-child {
  padding-top: 2px;
}

.lw-date-menu-foot {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--lw-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-left: 4px;
  padding-right: 4px;
}

.lw-icon-btn:disabled {
  opacity: 0.32;
  cursor: default;
  pointer-events: none;
}

/* Clickable task duration chip */
.lw-time-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-muted);
  font-size: 12.5px;
  padding: 2px 6px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.lw-time-btn:hover {
  background: var(--lw-hover-strong);
  color: var(--lw-text);
}

/* Project-level peer mode switcher (任务 / 日志 / 反思) */
.lw-mode-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-right: 6px;
}

.lw-mode-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-muted);
  font-size: 12.5px;
  font-weight: 500;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
}

.lw-mode-tab:hover {
  color: var(--lw-text-2);
  background: var(--lw-hover);
}

.lw-mode-tab.active {
  color: var(--lw-accent-text);
  font-weight: 600;
  background: var(--lw-accent-soft);
}

.lw-bullet-slot {
  width: 17px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-muted);
  flex-shrink: 0;
}

.lw-bullet-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lw-border-strong);
}

.lw-bullet-dot.reflection {
  background: var(--lw-accent);
}

/* Restrained Things 3 single-char priority badges (only 高 carries accent tint) */
.lw-prio-btn {
  appearance: none;
  border: 1px solid transparent;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.lw-prio-btn.high {
  background: rgba(229, 72, 77, 0.10);
  color: #d6393f;
  font-weight: 600;
}

.lw-prio-btn.high:hover {
  background: rgba(229, 72, 77, 0.16);
}

.lw-prio-btn.medium {
  background: var(--lw-subtle);
  color: var(--lw-text-2);
}

.lw-prio-btn.medium:hover {
  background: var(--lw-hover-strong);
  color: var(--lw-text);
}

.lw-prio-btn.low {
  background: transparent;
  color: var(--lw-muted);
}

.lw-prio-btn.low:hover {
  background: var(--lw-subtle);
  color: var(--lw-text-2);
}

.lw-root[data-lw-theme="dark"] .lw-prio-btn.high {
  background: rgba(242, 99, 104, 0.18);
  color: #ff8589;
}

.lw-prio-picker {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 7px;
  background: var(--lw-surface);
  box-shadow: var(--lw-shadow-lg);
}

.lw-prio-picker .lw-prio-btn.low {
  background: var(--lw-subtle);
}

/* Continuous underline tab bar with right action */
.lw-tabs-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--lw-border);
}

.lw-tabs-bar .lw-subtabs {
  border-bottom: none;
}

.lw-tabs-bar-right {
  padding-bottom: 7px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Inline project metadata strip (Things 3 calm row) */
.lw-meta-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lw-chip-btn {
  appearance: none;
  border: none;
  background: var(--lw-subtle);
  color: var(--lw-text-2);
  height: 27px;
  padding: 0 9px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
}

.lw-chip-btn:hover {
  background: var(--lw-hover-strong);
  color: var(--lw-text);
}

.lw-chip-btn.overdue {
  background: var(--lw-danger-soft);
  color: var(--lw-danger);
}

.lw-goal-edit {
  width: calc(100% + 16px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--lw-text-2);
  font-size: 14px;
  line-height: 1.65;
  font-family: inherit;
  padding: 5px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  resize: none;
  overflow: hidden;
  outline: none;
  transition: background 0.14s, border-color 0.14s, box-shadow 0.14s;
}

.lw-goal-edit:hover {
  background: var(--lw-subtle);
}

.lw-goal-edit:focus {
  background: var(--lw-surface);
  color: var(--lw-text);
  box-shadow: var(--lw-shadow-focus);
}

/* Idea full-page evaluation editorial form */
.lw-idea-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lw-idea-q {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--lw-muted);
  margin-bottom: 2px;
}

.lw-idea-field {
  width: calc(100% + 16px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--lw-text);
  font-size: 14px;
  line-height: 1.65;
  font-family: inherit;
  padding: 5px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  resize: none;
  overflow: hidden;
  outline: none;
  transition: background 0.14s, box-shadow 0.14s;
}

.lw-idea-field::placeholder {
  color: var(--lw-muted);
  opacity: 0.7;
}

.lw-idea-field:hover {
  background: var(--lw-subtle);
}

.lw-idea-field:focus {
  background: var(--lw-surface);
  box-shadow: var(--lw-shadow-focus);
}

.lw-verdict-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-muted);
  font-size: 12.5px;
  font-weight: 500;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
}

.lw-verdict-btn:hover {
  background: var(--lw-hover);
  color: var(--lw-text-2);
}

.lw-verdict-btn.active-go {
  background: var(--lw-success-soft);
  color: var(--lw-success);
  font-weight: 600;
}

.lw-verdict-btn.active-think {
  background: var(--lw-accent-soft);
  color: var(--lw-accent-text);
  font-weight: 600;
}

.lw-verdict-btn.active-no {
  background: var(--lw-danger-soft);
  color: var(--lw-danger);
  font-weight: 600;
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
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    style.setAttribute('data-plugin', 'dsh-life-wiki')
    document.head.appendChild(style)
  }
  if (style.textContent !== CSS) {
    style.textContent = CSS
  }
}
