import { Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { EditorPage } from './pages/EditorPage'
import { HealthPage } from './pages/HealthPage'

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>iTECify</h1>
        <nav>
          <Link to="/editor">Editor</Link>
          <Link to="/health">Health</Link>
        </nav>
      </header>

      <main className="app-content">
        <Routes>
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
