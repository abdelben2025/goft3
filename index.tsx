import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import './index.css';

// Global focus restoration intercepts to fix Electron/iframe focus freeze after synchronous native dialogs
const originalConfirm = window.confirm;
window.confirm = (message?: string) => {
  const result = originalConfirm(message);
  setTimeout(() => {
    window.focus();
    if (document.activeElement && 'blur' in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
    document.body.focus();
  }, 50);
  return result;
};

const originalAlert = window.alert;
window.alert = (message?: any) => {
  originalAlert(message);
  setTimeout(() => {
    window.focus();
    if (document.activeElement && 'blur' in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
    document.body.focus();
  }, 50);
};

// Enable automatic text direction (RTL for Arabic, LTR for French/Latin) on all inputs and textareas dynamically
const enforceAutoDir = (element: Element | null) => {
  if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
    const inputType = (element as HTMLInputElement).type;
    // Exclude special input types that do not have text directionality
    if (!['button', 'submit', 'checkbox', 'radio', 'hidden', 'file', 'image', 'reset'].includes(inputType)) {
      if (element.getAttribute('dir') !== 'auto') {
        element.setAttribute('dir', 'auto');
      }
    }
  }
};

document.addEventListener('focusin', (e) => {
  enforceAutoDir(e.target as Element);
});

document.addEventListener('input', (e) => {
  enforceAutoDir(e.target as Element);
});

// Also scan and apply to existing elements on the screen as a proactive layer
const scanAndApplyAutoDir = () => {
  const elements = document.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]), textarea');
  elements.forEach(el => {
    if (el.getAttribute('dir') !== 'auto') {
      el.setAttribute('dir', 'auto');
    }
  });
};

// Scan on load and on any DOM change
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', scanAndApplyAutoDir);
  window.addEventListener('load', scanAndApplyAutoDir);
  // Optional lightweight observer to set on dynamically rendered inputs
  try {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        scanAndApplyAutoDir();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    // Ignore any mutation observer constraints
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);