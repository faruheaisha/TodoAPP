import React, { StrictMode, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toast';

// Hash-based routing for multiple Tauri windows
// #focus-lock → FocusLockScreen (Pomodoro lock screen)
// #clock      → ClockScreen (time-flow scree