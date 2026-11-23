const STYLE_ID = 'dsh-life-wiki-styles'

const CSS = `
.lw-root {
  --lw-bg: #f8f7f4;
  --lw-surface: #ffffff;
  --lw-surface-2: #f2f0eb;
  --lw-surface-hover: #eceae3;
  --lw-border: #e5e2da;
  --lw-border-strong: #d4cfc4;
  --lw-text: #1c1917;
  --lw-text-2: #57534e;
  --lw-muted: #8a837b;
  --lw-accent: #2c6e58;
  --lw-accent-hover: #225846;
  --lw-accent-soft: #e6f2ed;
  --lw-accent-text: #1d513f;
  --lw-warn: #a66316;
  --lw-warn-soft: #fdf3e4;
  --lw-danger: #b83737;
  --lw-danger-soft: #fceceb;
  --lw-info: #2d5c8f;
  --lw-info-soft: #eaf1f8;
  --lw-shadow: 0 1px 2px rgba(28, 25, 23, 0.05), 0 4px 14px rgba(28, 25, 23, 0.04);
  --lw-shadow-lg: 0 12px 40px rgba(20, 18, 15, 0.16);
  --lw-radius: 10px;
  --lw-radius-sm: 7px;

  box-sizing: border-box;
  height: 100%;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--lw-bg);
  color: var(--lw-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  overflow: hidden;
}

.lw-root[data-lw-theme="dark"] {
  --lw-bg: #141413;
  --lw-surface: #1d1d1b;
  --lw-surface-2: #252522;
  --lw-surface-hover: #2e2e2a;
  --lw-border: #2e2d29;
  --lw-border-strong: #403e38;
  --lw-text: #eceae4;
  --lw-text-2: #b4b0a6;
  --lw-muted: #837f76;
  --lw-accent: #4ea585;
  --lw-accent-hover: #62b797;
  --lw-accent-soft: rgba(78, 165, 133, 0.16);
  --lw-accent-text: #8cd4b9;
  --lw-warn: #e0a04f;
  --lw-warn-soft: rgba(224, 160, 79, 0.15);
  --lw-danger: #e26d6d;
  --lw-danger-soft: rgba(226, 109, 109, 0.15);
  --lw-info: #78ace2;
  --lw-info-soft: rgba(120, 172, 226, 0.15);
  --lw-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  --lw-shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.lw-root *, .lw-root *::before, .lw-root *::after {
  box-sizing: border-box;
}

/* Header */
.lw-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  background: var(--lw-surface);
  border-bottom: 1px solid var(--lw-border);
  flex-wrap: wrap;
}

.lw-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.lw-brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--lw-text);
  white-space: nowrap;
}

.lw-vault-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 170px;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--lw-surface-2);
  border: 1px solid var(--lw-border);
  color: var(--lw-text-2);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lw-vault-pill:hover {
  background: var(--lw-surface-hover);
}

.lw-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--lw-surface-2);
  padding: 3px;
  border-radius: 9px;
  border: 1px solid var(--lw-border);
}

.lw-nav-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-text-2);
  font-size: 13px;
  font-weight: 500;
  padding: 5px 13px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
  white-space: nowrap;
}

.lw-nav-btn:hover {
  color: var(--lw-text);
  background: var(--lw-surface-hover);
}

.lw-nav-btn.active {
  background: var(--lw-surface);
  color: var(--lw-text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.lw-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

/* Buttons & Inputs */
.lw-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--lw-radius-sm);
  border: 1px solid var(--lw-border);
  background: var(--lw-surface);
  color: var(--lw-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.14s, border-color 0.14s, opacity 0.14s;
}

.lw-btn:hover:not(:disabled) {
  background: var(--lw-surface-hover);
  border-color: var(--lw-border-strong);
}

.lw-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lw-btn-primary {
  background: var(--lw-accent);
  border-color: var(--lw-accent);
  color: #ffffff;
}

.lw-btn-primary:hover:not(:disabled) {
  background: var(--lw-accent-hover);
  border-color: var(--lw-accent-hover);
}

.lw-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--lw-text-2);
}

.lw-btn-ghost:hover:not(:disabled) {
  background: var(--lw-surface-2);
  color: var(--lw-text);
  border-color: transparent;
}

.lw-btn-danger {
  color: var(--lw-danger);
  border-color: transparent;
  background: var(--lw-danger-soft);
}

.lw-btn-danger:hover:not(:disabled) {
  filter: brightness(0.96);
}

.lw-btn-sm {
  padding: 4px 9px;
  font-size: 12px;
}

.lw-input, .lw-select, .lw-textarea {
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--lw-radius-sm);
  border: 1px solid var(--lw-border);
  background: var(--lw-surface);
  color: var(--lw-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.14s;
}

.lw-input:focus, .lw-select:focus, .lw-textarea:focus {
  border-color: var(--lw-accent);
}

.lw-textarea {
  resize: vertical;
  min-height: 76px;
  line-height: 1.6;
}

.lw-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Main scroll area */
.lw-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 40px;
}

.lw-container {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Cards & layout */
.lw-card {
  background: var(--lw-surface);
  border: 1px solid var(--lw-border);
  border-radius: var(--lw-radius);
  padding: 16px 18px;
  box-shadow: var(--lw-shadow);
}

.lw-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.lw-card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--lw-text);
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

.lw-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.lw-grid-review {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 860px) {
  .lw-grid-2, .lw-grid-review {
    grid-template-columns: minmax(0, 1fr);
  }
  .lw-main {
    padding: 14px;
  }
}

/* Badges & Pills */
.lw-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  background: var(--lw-surface-2);
  color: var(--lw-text-2);
  border: 1px solid var(--lw-border);
}

.lw-badge-accent {
  background: var(--lw-accent-soft);
  color: var(--lw-accent-text);
  border-color: transparent;
}

.lw-badge-warn {
  background: var(--lw-warn-soft);
  color: var(--lw-warn);
  border-color: transparent;
}

.lw-badge-danger {
  background: var(--lw-danger-soft);
  color: var(--lw-danger);
  border-color: transparent;
}

.lw-badge-info {
  background: var(--lw-info-soft);
  color: var(--lw-info);
  border-color: transparent;
}

.lw-count-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--lw-accent);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
}

/* Banner & Alerts */
.lw-banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--lw-radius-sm);
  border: 1px solid var(--lw-border);
  background: var(--lw-surface-2);
  font-size: 13px;
}

.lw-banner-warn {
  background: var(--lw-warn-soft);
  border-color: transparent;
  color: var(--lw-warn);
}

.lw-banner-accent {
  background: var(--lw-accent-soft);
  border-color: transparent;
  color: var(--lw-accent-text);
}

/* Segmented sub-nav */
.lw-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: var(--lw-surface-2);
  border: 1px solid var(--lw-border);
  border-radius: 9px;
  flex-wrap: wrap;
}

.lw-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--lw-text-2);
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 7px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.lw-tab:hover {
  color: var(--lw-text);
}

.lw-tab.active {
  background: var(--lw-surface);
  color: var(--lw-text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* Task rows */
.lw-task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lw-task-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 6px 8px;
  border-radius: var(--lw-radius-sm);
  transition: background 0.12s;
}

.lw-task-item:hover {
  background: var(--lw-surface-2);
}

.lw-task-item input[type="checkbox"] {
  margin-top: 3px;
  width: 15px;
  height: 15px;
  accent-color: var(--lw-accent);
  cursor: pointer;
  flex-shrink: 0;
}

.lw-task-text {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}

.lw-task-done {
  text-decoration: line-through;
  color: var(--lw-muted);
}

/* Progress bar */
.lw-progress {
  height: 6px;
  width: 100%;
  border-radius: 999px;
  background: var(--lw-surface-2);
  overflow: hidden;
}

.lw-progress-fill {
  height: 100%;
  background: var(--lw-accent);
  border-radius: 999px;
  transition: width 0.2s ease;
}

/* Drawer & Modal */
.lw-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(15, 14, 12, 0.42);
  display: flex;
  justify-content: flex-end;
}

.lw-backdrop-center {
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.lw-drawer {
  width: min(640px, 94vw);
  height: 100%;
  background: var(--lw-surface);
  border-left: 1px solid var(--lw-border);
  box-shadow: var(--lw-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lw-drawer-sm {
  width: min(460px, 94vw);
}

.lw-modal {
  width: min(560px, 94vw);
  max-height: 88vh;
  background: var(--lw-surface);
  border: 1px solid var(--lw-border);
  border-radius: 12px;
  box-shadow: var(--lw-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lw-panel-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--lw-border);
}

.lw-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
}

.lw-panel-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--lw-border);
  background: var(--lw-bg);
}

/* Markdown viewer */
.lw-md {
  color: var(--lw-text);
  line-height: 1.7;
  font-size: 14px;
}

.lw-md h1 { font-size: 20px; font-weight: 700; margin: 14px 0 8px; }
.lw-md h2 { font-size: 16px; font-weight: 600; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--lw-border); }
.lw-md h3 { font-size: 14.5px; font-weight: 600; margin: 12px 0 4px; }
.lw-md p { margin: 6px 0; }
.lw-md ul, .lw-md ol { margin: 6px 0; padding-left: 20px; }
.lw-md li { margin: 3px 0; }
.lw-md blockquote {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--lw-accent);
  background: var(--lw-surface-2);
  color: var(--lw-text-2);
  border-radius: 0 6px 6px 0;
}
.lw-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--lw-surface-2);
}
.lw-md pre {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 7px;
  background: var(--lw-surface-2);
  overflow-x: auto;
}
.lw-md pre code {
  padding: 0;
  background: transparent;
}
.lw-md img {
  max-width: 100%;
  max-height: 360px;
  border-radius: 8px;
  border: 1px solid var(--lw-border);
  margin: 6px 0;
  display: block;
}
.lw-md a {
  color: var(--lw-accent-text);
  text-decoration: underline;
}

/* Onboarding */
.lw-onboard-wrap {
  flex: 1 1 auto;
  overflow-y: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px 60px;
}

.lw-onboard-card {
  width: min(640px, 100%);
  background: var(--lw-surface);
  border: 1px solid var(--lw-border);
  border-radius: 14px;
  padding: 28px 30px;
  box-shadow: var(--lw-shadow);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.lw-tree-box {
  background: var(--lw-surface-2);
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: var(--lw-text-2);
  line-height: 1.75;
}

/* Diary photos */
.lw-photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.lw-photo-thumb {
  width: 112px;
  height: 112px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--lw-border);
  cursor: pointer;
}

/* Toast */
.lw-toast {
  position: fixed;
  bottom: 20px;
  right: 22px;
  z-index: 120;
  padding: 9px 15px;
  border-radius: 8px;
  background: var(--lw-text);
  color: var(--lw-bg);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--lw-shadow-lg);
  max-width: 380px;
}

.lw-toast-err {
  background: var(--lw-danger);
  color: #ffffff;
}

.lw-muted {
  color: var(--lw-muted);
  font-size: 12.5px;
}

.lw-empty {
  text-align: center;
  padding: 36px 20px;
  color: var(--lw-muted);
  background: var(--lw-surface);
  border: 1px dashed var(--lw-border-strong);
  border-radius: var(--lw-radius);
}

.lw-divider {
  height: 1px;
  background: var(--lw-border);
  margin: 8px 0;
}

.lw-dir-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--lw-border);
  border-radius: 8px;
  background: var(--lw-bg);
}

.lw-dir-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--lw-border);
  cursor: pointer;
  font-size: 13px;
}

.lw-dir-row:last-child {
  border-bottom: none;
}

.lw-dir-row:hover {
  background: var(--lw-surface-hover);
}
`

export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.setAttribute('data-plugin', 'dsh-life-wiki')
  style.textContent = CSS
  document.head.appendChild(style)
}
