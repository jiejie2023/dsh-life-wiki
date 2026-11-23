import React from 'react'
import { createRoot } from 'react-dom/client'
import { LifeWikiApp } from './App.tsx'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<LifeWikiApp />)
}
