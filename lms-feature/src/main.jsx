import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { primeVoices } from './canvas/tts.js'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import '@xyflow/react/dist/style.css'
import App from './App.jsx'
import './index.css'

primeVoices()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
