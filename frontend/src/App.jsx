import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './styles.css'

const api = axios.create({ baseURL: 'http://localhost:8000/api' })
const AUTH_STORAGE_KEY = 'resume_matching_auth_user'

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginEmail, setLoginEmail] = useState('admin@example.com')
  const [loginPassword, setLoginPassword] = useState('password')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [authTab, setAuthTab] = useState('login')
  const [userRole, setUserRole] = useState('recruiter')
  const [currentUserName, setCurrentUserName] = useState('')
  const [isBlockedView, setIsBlockedView] = useState(false)
  const [systemUsers, setSystemUsers] = useState([])
  const [toast, setToast] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [matches, setMatches] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateText, setCandidateText] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [jobReqs, setJobReqs] = useState('Python::mandatory\nDjango::preferred\nAWS::preferred')
  const [loading, setLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [driveName, setDriveName] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [activity, setActivity] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editExp, setEditExp] = useState('')
  const [editRawText, setEditRawText] = useState('')
  const [candidateAnalysis, setCandidateAnalysis] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [editingJob, setEditingJob] = useState(null)
  const [editJobTitle, setEditJobTitle] = useState('')
  const [editJobCompany, setEditJobCompany] = useState('')
  const [editJobLocation, setEditJobLocation] = useState('')
  const [editJobSeniority, setEditJobSeniority] = useState('')
  const [editJobDescription, setEditJobDescription] = useState('')
  const [previousPage, setPreviousPage] = useState('candidates')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analysisCandidateId, setAnalysisCandidateId] = useState('')
  const [jobDetailId, setJobDetailId] = useState('')
  const [comparisonCandidateA, setComparisonCandidateA] = useState('')
  const [comparisonCandidateB, setComparisonCandidateB] = useState('')
  const [selectedOutreachMatchId, setSelectedOutreachMatchId] = useState('')
  const [outreachDraft, setOutreachDraft] = useState('')
  const [reportCandidateId, setReportCandidateId] = useState('')
  const [adminScoringMode, setAdminScoringMode] = useState('llm_with_fallback')
  const [adminAtsProvider, setAdminAtsProvider] = useState('Greenhouse')
  const [adminUsers, setAdminUsers] = useState('admin@example.com')

  const uploadedTodayCount = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const freshCandidates = candidates.filter((c) => c.created_at && (now - new Date(c.created_at).getTime()) <= oneDayMs).length
    const freshJobs = jobs.filter((j) => j.created_at && (now - new Date(j.created_at).getTime()) <= oneDayMs).length
    return freshCandidates + freshJobs
  }, [candidates, jobs])

  const topCandidatesByScore = useMemo(() => {
    const byCandidate = new Map()
    matches.forEach((m) => {
      const prev = byCandidate.get(m.candidate_id)
      if (!prev || m.total_score_percent > prev.score) {
        byCandidate.set(m.candidate_id, { score: m.total_score_percent, match_level: m.match_level })
      }
    })
    return Array.from(byCandidate.entries())
      .map(([candidateId, data]) => {
        const c = candidates.find((item) => item.id === candidateId)
        return { candidateId, candidateName: c?.full_name || `Candidate #${candidateId}`, ...data }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [matches, candidates])

  const jobsWithMostCandidates = useMemo(() => {
    const counts = new Map()
    matches.forEach((m) => counts.set(m.job_id, (counts.get(m.job_id) || 0) + 1))
    return Array.from(counts.entries())
      .map(([jobId, count]) => {
        const j = jobs.find((item) => item.id === jobId)
        return { jobId, jobTitle: j?.title || `Job #${jobId}`, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [matches, jobs])

  const refresh = async () => {
    const [c, j, m, d] = await Promise.all([
      api.get('/candidates'),
      api.get('/jobs'),
      api.get('/matches'),
      api.get('/dashboard'),
    ])
    setCandidates(c.data)
    setJobs(j.data)
    setMatches(m.data)
    setDashboard(d.data)
  }

  const loadSystemUsers = async () => {
    try {
      const res = await api.get('/auth/users')
      setSystemUsers(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load users')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (!parsed?.email || !parsed?.role) return
      setCurrentUserName(parsed.full_name || 'User')
      setUserRole(parsed.role)
      setIsAuthenticated(true)
    } catch (e) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  const parsedReqs = useMemo(() => {
    return jobReqs
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [requirement_text, requirement_type] = line.split('::')
        return { requirement_text, requirement_type: requirement_type || 'preferred' }
      })
  }, [jobReqs])

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => c.full_name?.toLowerCase().includes(q) || c.current_title?.toLowerCase().includes(q))
  }, [candidates, query])

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((j) => j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q))
  }, [jobs, query])

  const selectedJobMatches = useMemo(() => {
    if (!selectedJob) return []
    return matches.filter((m) => m.job_id === selectedJob.id)
  }, [matches, selectedJob])

  const addActivity = (text) => {
    setActivity((prev) => [text, ...prev].slice(0, 8))
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const createCandidate = async () => {
    if (!candidateName || !candidateText) return
    try {
      setError('')
      setLoading(true)
      await api.post('/candidates', {
        full_name: candidateName,
        raw_text: candidateText,
        years_of_experience: 0,
      })
      setCandidateName('')
      setCandidateText('')
      await refresh()
      addActivity(`Candidate "${candidateName}" created manually`)
      showToast('Candidate created successfully')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create candidate')
    } finally {
      setLoading(false)
    }
  }

  const uploadCandidateFile = async () => {
    if (!candidateName || !uploadFile) return
    try {
      setError('')
      setLoading(true)
      const formData = new FormData()
      formData.append('full_name', candidateName)
      formData.append('file', uploadFile)
      await api.post('/candidates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!event.total) return
          setUploadProgress(Math.round((event.loaded / event.total) * 100))
        },
      })
      setUploadFile(null)
      setUploadProgress(0)
      await refresh()
      addActivity(`Candidate "${candidateName}" uploaded from file`)
      showToast('CV uploaded and candidate created')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to upload CV file')
    } finally {
      setLoading(false)
    }
  }

  const uploadFromDrive = async () => {
    if (!driveName || !driveUrl) return
    try {
      setError('')
      setLoading(true)
      const formData = new FormData()
      formData.append('full_name', driveName)
      formData.append('drive_url', driveUrl)
      await api.post('/candidates/upload-drive', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDriveName('')
      setDriveUrl('')
      await refresh()
      addActivity(`Candidate "${driveName}" imported from Google Drive`)
      showToast('Candidate imported from Google Drive')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to import from Google Drive')
    } finally {
      setLoading(false)
    }
  }

  const createJob = async () => {
    if (!jobTitle || !jobDesc) return
    try {
      setError('')
      setLoading(true)
      await api.post('/jobs', {
        title: jobTitle,
        description_text: jobDesc,
        requirements: parsedReqs,
      })
      setJobTitle('')
      setJobDesc('')
      await refresh()
      addActivity(`Job "${jobTitle}" created`)
      showToast('Job saved successfully')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create job')
    } finally {
      setLoading(false)
    }
  }

  const viewCandidate = async (candidateId) => {
    try {
      setError('')
      const [candidateRes, analysisRes] = await Promise.all([
        api.get(`/candidates/${candidateId}`),
        api.get(`/candidates/${candidateId}/analysis`),
      ])
      setSelectedCandidate(candidateRes.data)
      setCandidateAnalysis(analysisRes.data)
      setEditingCandidate(null)
      setPreviousPage(activePage)
      setActivePage('candidate-analysis')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load candidate')
    }
  }

  const startEditCandidate = async (candidateId) => {
    try {
      setError('')
      const res = await api.get(`/candidates/${candidateId}`)
      const candidate = res.data
      setEditingCandidate(candidate.id)
      setEditName(candidate.full_name || '')
      setEditTitle(candidate.current_title || '')
      setEditExp(String(candidate.years_of_experience ?? '0'))
      setEditRawText(candidate.raw_text || '')
      setSelectedCandidate(null)
      setCandidateAnalysis(null)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load candidate for editing')
    }
  }

  const saveCandidateEdit = async (candidateId) => {
    if (!editName.trim()) {
      setError('Candidate full name is required')
      return
    }
    try {
      setError('')
      setLoading(true)
      await api.put(`/candidates/${candidateId}`, {
        full_name: editName.trim(),
        current_title: editTitle.trim() || null,
        years_of_experience: Number(editExp || 0),
        raw_text: editRawText,
      })
      setEditingCandidate(null)
      await refresh()
      addActivity(`Candidate "${editName}" updated`)
      showToast('Candidate updated successfully')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update candidate')
    } finally {
      setLoading(false)
    }
  }

  const deleteCandidate = async (candidateId, candidateName) => {
    const confirmed = window.confirm(`Delete candidate "${candidateName}"?`)
    if (!confirmed) return
    try {
      setError('')
      setLoading(true)
      await api.delete(`/candidates/${candidateId}`)
      if (selectedCandidate?.id === candidateId) setSelectedCandidate(null)
      if (editingCandidate === candidateId) setEditingCandidate(null)
      setCandidateAnalysis(null)
      await refresh()
      addActivity(`Candidate "${candidateName}" deleted`)
      showToast('Candidate deleted')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete candidate')
    } finally {
      setLoading(false)
    }
  }

  const viewJob = async (jobId) => {
    try {
      setError('')
      const res = await api.get(`/jobs/${jobId}`)
      setSelectedJob(res.data)
      setEditingJob(null)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load job')
    }
  }

  const startEditJob = async (jobId) => {
    try {
      setError('')
      const res = await api.get(`/jobs/${jobId}`)
      const job = res.data
      setEditingJob(job.id)
      setEditJobTitle(job.title || '')
      setEditJobCompany(job.company || '')
      setEditJobLocation(job.location || '')
      setEditJobSeniority(job.seniority || '')
      setEditJobDescription(job.description_text || '')
      setSelectedJob(null)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load job for editing')
    }
  }

  const saveJobEdit = async (jobId) => {
    if (!editJobTitle.trim() || !editJobDescription.trim()) {
      setError('Job title and description are required')
      return
    }
    try {
      setError('')
      setLoading(true)
      await api.put(`/jobs/${jobId}`, {
        title: editJobTitle.trim(),
        company: editJobCompany.trim() || null,
        location: editJobLocation.trim() || null,
        seniority: editJobSeniority.trim() || null,
        description_text: editJobDescription,
      })
      setEditingJob(null)
      await refresh()
      addActivity(`Job "${editJobTitle}" updated`)
      showToast('Job updated successfully')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update job')
    } finally {
      setLoading(false)
    }
  }

  const deleteJob = async (jobId, jobTitleValue) => {
    const confirmed = window.confirm(`Delete job "${jobTitleValue}"?`)
    if (!confirmed) return
    try {
      setError('')
      setLoading(true)
      await api.delete(`/jobs/${jobId}`)
      if (selectedJob?.id === jobId) setSelectedJob(null)
      if (editingJob === jobId) setEditingJob(null)
      await refresh()
      addActivity(`Job "${jobTitleValue}" deleted`)
      showToast('Job deleted')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to delete job')
    } finally {
      setLoading(false)
    }
  }

  const runAll = async () => {
    try {
      setError('')
      setLoading(true)
      await api.post('/match/run-all')
      await refresh()
      addActivity('Full matching pipeline executed')
      showToast('Matching pipeline completed')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to run matching')
    } finally {
      setLoading(false)
    }
  }

  const runCandidateAnalysisFromSelector = async () => {
    if (!analysisCandidateId) return
    await viewCandidate(Number(analysisCandidateId))
  }

  const activeJobMatches = useMemo(() => {
    if (!jobDetailId) return []
    return matches
      .filter((m) => m.job_id === Number(jobDetailId))
      .sort((a, b) => b.total_score_percent - a.total_score_percent)
  }, [matches, jobDetailId])

  const selectedOutreachMatch = useMemo(() => {
    if (!selectedOutreachMatchId) return null
    return matches.find((m) => m.id === Number(selectedOutreachMatchId)) || null
  }, [matches, selectedOutreachMatchId])

  useEffect(() => {
    if (!selectedOutreachMatch) return
    setOutreachDraft(selectedOutreachMatch.outreach_email || '')
  }, [selectedOutreachMatch])

  const sendOutreach = () => {
    if (!selectedOutreachMatch) return
    addActivity(`Outreach email prepared for Candidate #${selectedOutreachMatch.candidate_id} and Job #${selectedOutreachMatch.job_id}`)
    showToast('Outreach email marked as sent')
  }

  const logout = () => {
    setIsAuthenticated(false)
    setIsBlockedView(false)
    setActivePage('dashboard')
    setSelectedCandidate(null)
    setCandidateAnalysis(null)
    setSelectedJob(null)
    setLoginPassword('')
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const login = async () => {
    try {
      setError('')
      setIsBlockedView(false)
      const res = await api.post('/auth/login', { email: loginEmail, password: loginPassword })
      setUserRole(res.data.role)
      setCurrentUserName(res.data.full_name)
      setIsAuthenticated(true)
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          id: res.data.id,
          full_name: res.data.full_name,
          email: res.data.email,
          role: res.data.role,
        })
      )
      showToast('Login successful')
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Login failed'
      setError(detail)
      if (detail === 'Access blocked by admin') {
        setIsBlockedView(true)
      }
    }
  }

  const registerRecruiter = async () => {
    if (!registerName || !registerEmail || !registerPassword) return
    try {
      setError('')
      await api.post('/auth/register', {
        full_name: registerName,
        email: registerEmail,
        password: registerPassword,
        role: 'recruiter',
      })
      setLoginEmail(registerEmail)
      setLoginPassword(registerPassword)
      setRegisterName('')
      setRegisterEmail('')
      setRegisterPassword('')
      addActivity('Recruiter account registered')
      showToast('Registration successful. Please login.')
      setAuthTab('login')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Registration failed')
    }
  }

  const toggleUserAccess = async (userId, nextActive) => {
    try {
      setError('')
      await api.patch(`/auth/users/${userId}/status`, { is_active: nextActive })
      await loadSystemUsers()
      addActivity(`User ${nextActive ? 'unblocked' : 'blocked'} by admin`)
      showToast(`User ${nextActive ? 'unblocked' : 'blocked'} successfully`)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update user status')
    }
  }

  useEffect(() => {
    if (isAuthenticated && userRole === 'admin' && activePage === 'admin-settings') {
      loadSystemUsers()
    }
  }, [isAuthenticated, userRole, activePage])

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'upload-cv', label: 'Upload CV' },
    { id: 'upload-job', label: 'Upload Job Description' },
    { id: 'candidate-list', label: 'Candidate List' },
    { id: 'job-list', label: 'Job List' },
    { id: 'candidate-match-detail', label: 'Candidate Match Detail' },
    { id: 'job-match-detail', label: 'Job Match Detail' },
    { id: 'comparison', label: 'Comparison Screen' },
    { id: 'outreach-email', label: 'Outreach Email' },
    { id: 'reports', label: 'Reports' },
    ...(userRole === 'admin' ? [{ id: 'admin-settings', label: 'Admin Settings' }] : []),
  ]

  if (!isAuthenticated) {
    if (isBlockedView) {
      return (
        <div className="app-layout">
          <main className="app-shell">
            <section className="card login-card">
              <h2>Access Blocked</h2>
              <p className="hint">Your access is blocked by admin.</p>
              <button className="danger" onClick={logout}>Logout</button>
            </section>
            {toast ? <div className={`toast ${toast.type}`}>{toast.message}</div> : null}
          </main>
        </div>
      )
    }
    return (
      <div className="app-layout">
        <main className="app-shell">
          <section className="card login-card">
            <h2>Login Screen</h2>
            <p className="hint">Auth entry point</p>
            {error ? <div className="error-box">{error}</div> : null}
            <div className="auth-tabs">
              <button className={`tab-btn ${authTab === 'login' ? 'active' : ''}`} onClick={() => setAuthTab('login')}>Login</button>
              <button className={`tab-btn ${authTab === 'register' ? 'active' : ''}`} onClick={() => setAuthTab('register')}>Register</button>
            </div>
            {authTab === 'login' ? (
              <>
                <input className="input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email" />
                <input className="input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Password" />
                <p className="hint">Role will be determined by registered account credentials.</p>
                <button className="primary" onClick={login} disabled={!loginEmail || !loginPassword}>Sign in</button>
              </>
            ) : (
              <>
                <input className="input" value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder="Full name" />
                <input className="input" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="Recruiter email" />
                <input className="input" type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Password (min 6)" />
                <button className="secondary" onClick={registerRecruiter} disabled={!registerName || !registerEmail || !registerPassword}>
                  Register Recruiter
                </button>
              </>
            )}
          </section>
          {toast ? <div className={`toast ${toast.type}`}>{toast.message}</div> : null}
        </main>
      </div>
    )
  }

  return (
    <div className={`app-layout ${darkMode ? 'dark' : ''}`}>
      <aside className="sidebar">
        <h2 className="brand">MatchFlow</h2>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-btn ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button className="secondary full-width" onClick={() => setDarkMode((v) => !v)}>
          {darkMode ? 'Switch to Light' : 'Switch to Dark'}
        </button>
        <button className="danger full-width" onClick={logout}>Logout</button>
      </aside>

      <main className="app-shell">
        <header className="app-header">
          <div>
            <h1>Resume Matching Agent</h1>
            <p className="hint">AI-assisted screening dashboard for recruiters</p>
            <p className="hint">Signed in as {currentUserName || 'User'} ({userRole})</p>
          </div>
          <div className="actions-row">
            <input
              className="input search"
              placeholder="Search candidates or jobs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="primary" onClick={runAll} disabled={loading}>Run Full Matching</button>
          </div>
        </header>

        {error ? <div className="error-box">{error}</div> : null}
        {toast ? <div className={`toast ${toast.type}`}>{toast.message}</div> : null}

        {activePage === 'dashboard' ? (
          <>
            <section className="stats-grid">
              <div className="card stat-card"><h3>{dashboard?.total_candidates ?? candidates.length}</h3><p>Total Candidates</p></div>
              <div className="card stat-card"><h3>{dashboard?.total_jobs ?? jobs.length}</h3><p>Total Jobs</p></div>
              <div className="card stat-card"><h3>{uploadedTodayCount}</h3><p>Uploaded Today</p></div>
              <div className="card stat-card"><h3>{dashboard?.average_match_score ?? 0}%</h3><p>Average Score</p></div>
              <div className="card stat-card"><h3>{dashboard?.risk_alerts ?? 0}</h3><p>Risk Alerts</p></div>
            </section>

            <section className="grid">
              <div className="card">
                <h2>Top Candidates by Score</h2>
                <ul className="list">
                  {topCandidatesByScore.length
                    ? topCandidatesByScore.map((row) => <li key={row.candidateId}>{row.candidateName} - {row.score}% ({row.match_level})</li>)
                    : <li>No scored candidates yet</li>}
                </ul>
              </div>
              <div className="card">
                <h2>Jobs with Most Candidates</h2>
                <ul className="list">
                  {jobsWithMostCandidates.length
                    ? jobsWithMostCandidates.map((row) => <li key={row.jobId}>{row.jobTitle} - {row.count} matches</li>)
                    : <li>No job match volume yet</li>}
                </ul>
              </div>
            </section>
            <section className="card">
              <h2>Recent Activity</h2>
              <ul className="list">
                {activity.length ? activity.map((a, idx) => <li key={idx}>{a}</li>) : <li>No activity yet</li>}
              </ul>
            </section>
          </>
        ) : null}

        {activePage === 'candidate-list' ? (
          <section className="grid">
            <div className="card">
              <h2>Candidate List</h2>
              <p className="hint">Filterable and actionable candidate index.</p>
              <input className="input" placeholder="Full name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
              <textarea className="input" placeholder="Paste CV text" value={candidateText} onChange={(e) => setCandidateText(e.target.value)} rows={8} />
              <button className="secondary" onClick={createCandidate} disabled={loading}>Save Candidate</button>
            </div>
            <div className="card">
              <h2>Candidates ({filteredCandidates.length})</h2>
              <ul className="list">
                {filteredCandidates.map((c) => (
                  <li key={c.id} className="list-item-actions">
                    <div>
                      <strong>{c.full_name}</strong>
                      <p className="hint compact">{c.current_title || 'No title set'}</p>
                    </div>
                    <div className="inline-actions">
                      <button className="secondary small" onClick={() => viewCandidate(c.id)} disabled={loading}>View</button>
                      <button className="secondary small" onClick={() => startEditCandidate(c.id)} disabled={loading}>Edit</button>
                      <button className="danger small" onClick={() => deleteCandidate(c.id, c.full_name)} disabled={loading}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {editingCandidate ? (
              <div className="card">
                <h2>Edit Candidate</h2>
                <input className="input" placeholder="Full name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <input className="input" placeholder="Current title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <input className="input" type="number" min="0" step="0.1" placeholder="Years of experience" value={editExp} onChange={(e) => setEditExp(e.target.value)} />
                <textarea className="input" placeholder="Candidate CV text" value={editRawText} onChange={(e) => setEditRawText(e.target.value)} rows={8} />
                <div className="inline-actions">
                  <button className="secondary" onClick={() => saveCandidateEdit(editingCandidate)} disabled={loading}>Save Changes</button>
                  <button className="secondary" onClick={() => setEditingCandidate(null)} disabled={loading}>Cancel</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activePage === 'candidate-match-detail' ? (
          <section className="card">
            <h2>Candidate Match Detail</h2>
            <p className="hint">Full score table, evidence and gaps.</p>
            <div className="inline-actions">
              <select className="input select-inline" value={analysisCandidateId} onChange={(e) => setAnalysisCandidateId(e.target.value)}>
                <option value="">Select candidate</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <button className="secondary" onClick={runCandidateAnalysisFromSelector} disabled={!analysisCandidateId}>Load Analysis</button>
            </div>
          </section>
        ) : null}

        {activePage === 'candidate-analysis' ? (
          <section className="card">
            <div className="analysis-header">
              <div>
                <h2>Candidate Analysis Output</h2>
                <p className="hint">
                  {candidateAnalysis?.job_context
                    ? `Based on best matched job: ${candidateAnalysis.job_context.job_title}`
                    : 'No matched job found yet'}
                </p>
              </div>
              <div className="inline-actions">
                <span className={`badge ${String(candidateAnalysis?.section_a?.match_level || 'unscored').toLowerCase()}`}>
                  {(candidateAnalysis?.section_a?.match_level || 'unscored').toUpperCase()}
                </span>
                <button className="secondary small" onClick={() => setActivePage(previousPage || 'candidate-list')}>
                  Back
                </button>
              </div>
            </div>

            <section className="analysis-section">
              <h3>Candidate Profile Fields</h3>
              <div className="summary-grid professional">
                <div className="summary-item"><span>Email</span><strong>{selectedCandidate?.email || '-'}</strong></div>
                <div className="summary-item"><span>Phone</span><strong>{selectedCandidate?.phone || '-'}</strong></div>
                <div className="summary-item"><span>Seniority level</span><strong>{selectedCandidate?.profile_json?.seniority_level || '-'}</strong></div>
                <div className="summary-item"><span>Technical skills</span><strong>{selectedCandidate?.profile_json?.technical_skills || '-'}</strong></div>
                <div className="summary-item"><span>Soft skills</span><strong>{selectedCandidate?.profile_json?.soft_skills || '-'}</strong></div>
                <div className="summary-item"><span>Tools & technologies</span><strong>{selectedCandidate?.profile_json?.tools_technologies || '-'}</strong></div>
                <div className="summary-item"><span>Work history</span><strong>{selectedCandidate?.profile_json?.work_history || '-'}</strong></div>
                <div className="summary-item"><span>Education</span><strong>{selectedCandidate?.profile_json?.education || '-'}</strong></div>
                <div className="summary-item"><span>Certifications</span><strong>{selectedCandidate?.profile_json?.certifications || '-'}</strong></div>
                <div className="summary-item"><span>Languages</span><strong>{selectedCandidate?.profile_json?.languages || '-'}</strong></div>
                <div className="summary-item"><span>Domain expertise</span><strong>{selectedCandidate?.profile_json?.domain_expertise || '-'}</strong></div>
                <div className="summary-item"><span>Employment type preference</span><strong>{selectedCandidate?.profile_json?.employment_type_preference || '-'}</strong></div>
                <div className="summary-item"><span>Work authorization</span><strong>{selectedCandidate?.profile_json?.work_authorization || '-'}</strong></div>
              </div>
            </section>

            <section className="analysis-section">
              <h3>Section A: Candidate Summary Card</h3>
              <div className="summary-grid professional">
                <div className="summary-item"><span>Name</span><strong>{candidateAnalysis?.section_a?.name || selectedCandidate?.full_name}</strong></div>
                <div className="summary-item"><span>Current title</span><strong>{candidateAnalysis?.section_a?.current_title || '-'}</strong></div>
                <div className="summary-item"><span>Total score %</span><strong>{candidateAnalysis?.section_a?.total_score_percent ?? 0}</strong></div>
                <div className="summary-item"><span>Years of experience</span><strong>{candidateAnalysis?.section_a?.years_of_experience ?? 0}</strong></div>
                <div className="summary-item"><span>Location</span><strong>{candidateAnalysis?.section_a?.location || '-'}</strong></div>
                <div className="summary-item"><span>Availability</span><strong>{candidateAnalysis?.section_a?.availability || '-'}</strong></div>
              </div>
              <div className="chips">
                {(candidateAnalysis?.section_a?.key_skills || []).length
                  ? candidateAnalysis.section_a.key_skills.map((skill, idx) => <span className="chip" key={`${skill}-${idx}`}>{skill}</span>)
                  : <span className="hint">No key skills extracted</span>}
              </div>
            </section>

            <section className="analysis-section">
              <h3>Section B: Detailed Requirement Scoring Table</h3>
              <div className="analysis-kpis">
                <div className="kpi"><span>Total Requirements</span><strong>{(candidateAnalysis?.section_b || []).length}</strong></div>
                <div className="kpi"><span>Strongly Demonstrated</span><strong>{(candidateAnalysis?.section_b || []).filter((item) => item.score >= 1).length}</strong></div>
                <div className="kpi"><span>Gaps</span><strong>{(candidateAnalysis?.section_b || []).filter((item) => item.score <= 0).length}</strong></div>
              </div>
              {(candidateAnalysis?.section_b || []).length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Requirement</th>
                        <th>Score</th>
                        <th>Evidence from CV</th>
                        <th>Confidence level</th>
                        <th>Gap type</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(candidateAnalysis?.section_b || []).map((item, idx) => (
                        <tr key={`${item.requirement}-${idx}`}>
                          <td>{item.requirement}</td>
                          <td>{item.score}</td>
                          <td>{item.evidence_from_cv || '-'}</td>
                          <td>{item.confidence_level}</td>
                          <td>{item.gap_type}</td>
                          <td>{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="hint">No requirement-level scoring yet. Run Full Matching to generate this section.</p>
              )}
            </section>

            <section className="analysis-section split">
              <div>
                <h3>Section C: Key Strengths</h3>
                <ul className="list">
                  {(candidateAnalysis?.section_c || []).length
                    ? candidateAnalysis.section_c.map((item, idx) => <li key={`strength-${idx}`}>{item}</li>)
                    : <li>No key strengths identified yet.</li>}
                </ul>
              </div>
              <div>
                <h3>Section D: Key Gaps</h3>
                <ul className="list">
                  {(candidateAnalysis?.section_d || []).length
                    ? candidateAnalysis.section_d.map((item, idx) => <li key={`gap-${idx}`}>{item}</li>)
                    : <li>No major gaps identified yet.</li>}
                </ul>
              </div>
            </section>

            <section className="analysis-section">
              <h3>Section E: CV Improvement Suggestions</h3>
              <ul className="list">
                {(candidateAnalysis?.section_e || []).map((item, idx) => <li key={`suggestion-${idx}`}>{item}</li>)}
              </ul>
            </section>

            <section className="analysis-section">
              <h3>Original CV Text</h3>
              <textarea className="input" rows={8} value={selectedCandidate?.raw_text || ''} readOnly />
            </section>
          </section>
        ) : null}

        {activePage === 'upload-cv' ? (
          <section className="grid">
            <div className="card">
              <h2>Upload CV</h2>
              <p className="hint">File upload with progress</p>
              <input className="input" placeholder="Full name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
              <input className="input" type="file" accept=".pdf,.docx,.csv" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <p className="hint">Supported: PDF, DOCX, CSV</p>
              <button className="secondary" onClick={uploadCandidateFile} disabled={loading}>Upload and Parse</button>
              {uploadProgress > 0 ? (
                <div className="progress-wrap">
                  <div className="progress-head">
                    <span className="hint">Upload progress</span>
                    <span className="hint">{uploadProgress}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="card">
              <h2>Import from Google Drive</h2>
              <input className="input" placeholder="Full name" value={driveName} onChange={(e) => setDriveName(e.target.value)} />
              <input className="input" placeholder="Public Google Drive file URL" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
              <p className="hint">Public share links only</p>
              <button className="secondary" onClick={uploadFromDrive} disabled={loading}>Import from Drive</button>
            </div>
          </section>
        ) : null}

        {activePage === 'upload-job' ? (
          <section className="grid">
            <div className="card">
              <h2>Upload Job Description</h2>
              <p className="hint">Paste, upload-style form entry for job details and requirements.</p>
              <input className="input" placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <textarea className="input" placeholder="Paste job description" value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} rows={5} />
              <textarea className="input" value={jobReqs} onChange={(e) => setJobReqs(e.target.value)} rows={4} />
              <button className="secondary" onClick={createJob} disabled={loading}>Save Job Description</button>
            </div>
          </section>
        ) : null}

        {activePage === 'job-list' ? (
          <section className="grid">
            <div className="card">
              <h2>Job List</h2>
              <p className="hint">All active job descriptions.</p>
              <h3>Jobs ({filteredJobs.length})</h3>
              <ul className="list">
                {filteredJobs.map((j) => (
                  <li key={j.id} className="list-item-actions">
                    <div>
                      <strong>{j.title}</strong>
                      <p className="hint compact">{j.company || 'No company set'}</p>
                    </div>
                    <div className="inline-actions">
                      <button className="secondary small" onClick={() => viewJob(j.id)} disabled={loading}>View</button>
                      <button className="secondary small" onClick={() => startEditJob(j.id)} disabled={loading}>Edit</button>
                      <button className="danger small" onClick={() => deleteJob(j.id, j.title)} disabled={loading}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {selectedJob ? (
              <div className="card">
                <h2>Job Details</h2>
                <p><strong>Title:</strong> {selectedJob.title}</p>
                <p><strong>Company:</strong> {selectedJob.company || '-'}</p>
                <p><strong>Location:</strong> {selectedJob.location || '-'}</p>
                <p><strong>Seniority:</strong> {selectedJob.seniority || '-'}</p>
                <p><strong>Description:</strong></p>
                <textarea className="input" rows={6} value={selectedJob.description_text || ''} readOnly />
                <p><strong>Requirements:</strong></p>
                <ul className="list">
                  {(selectedJob.requirements || []).map((req) => (
                    <li key={req.id}>{req.requirement_text} ({req.requirement_type})</li>
                  ))}
                </ul>
                <p><strong>Matches for this Job ({selectedJobMatches.length}):</strong></p>
                {selectedJobMatches.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Score %</th>
                          <th>Level</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJobMatches.map((m) => {
                          const candidate = candidates.find((c) => c.id === m.candidate_id)
                          return (
                            <tr key={m.id}>
                              <td>{candidate?.full_name || `Candidate #${m.candidate_id}`}</td>
                              <td>{m.total_score_percent}</td>
                              <td>{m.match_level}</td>
                              <td>{String(m.risk_flag)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="hint">No matches yet for this job. Run Full Matching to generate results.</p>
                )}
              </div>
            ) : null}
            {editingJob ? (
              <div className="card">
                <h2>Edit Job</h2>
                <input className="input" placeholder="Job title" value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)} />
                <input className="input" placeholder="Company" value={editJobCompany} onChange={(e) => setEditJobCompany(e.target.value)} />
                <input className="input" placeholder="Location" value={editJobLocation} onChange={(e) => setEditJobLocation(e.target.value)} />
                <input className="input" placeholder="Seniority" value={editJobSeniority} onChange={(e) => setEditJobSeniority(e.target.value)} />
                <textarea className="input" placeholder="Job description" value={editJobDescription} onChange={(e) => setEditJobDescription(e.target.value)} rows={6} />
                <div className="inline-actions">
                  <button className="secondary" onClick={() => saveJobEdit(editingJob)} disabled={loading}>Save Changes</button>
                  <button className="secondary" onClick={() => setEditingJob(null)} disabled={loading}>Cancel</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activePage === 'job-match-detail' ? (
          <section className="card">
            <h2>Job Match Detail</h2>
            <p className="hint">Ranked shortlist for a selected job.</p>
            <select className="input" value={jobDetailId} onChange={(e) => setJobDetailId(e.target.value)}>
              <option value="">Select job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th><th>Score %</th><th>Level</th><th>Risk</th><th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {activeJobMatches.map((m) => {
                    const candidate = candidates.find((c) => c.id === m.candidate_id)
                    return (
                      <tr key={m.id}>
                        <td>{candidate?.full_name || `Candidate #${m.candidate_id}`}</td>
                        <td>{m.total_score_percent}</td>
                        <td>{m.match_level}</td>
                        <td>{String(m.risk_flag)}</td>
                        <td>{m.summary}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activePage === 'comparison' ? (
          <section className="card">
            <h2>Comparison Screen</h2>
            <p className="hint">Side-by-side candidate comparison.</p>
            <div className="grid">
              <div>
                <select className="input" value={comparisonCandidateA} onChange={(e) => setComparisonCandidateA(e.target.value)}>
                  <option value="">Candidate A</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <select className="input" value={comparisonCandidateB} onChange={(e) => setComparisonCandidateB(e.target.value)}>
                  <option value="">Candidate B</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid">
              {[comparisonCandidateA, comparisonCandidateB].map((id, idx) => {
                const candidate = candidates.find((c) => c.id === Number(id))
                const candidateMatches = matches.filter((m) => m.candidate_id === Number(id))
                const avg = candidateMatches.length ? (candidateMatches.reduce((sum, m) => sum + m.total_score_percent, 0) / candidateMatches.length).toFixed(2) : '0'
                return (
                  <div key={`cmp-${idx}`} className="card">
                    <h3>{candidate?.full_name || `Candidate ${idx + 1}`}</h3>
                    <p><strong>Title:</strong> {candidate?.current_title || '-'}</p>
                    <p><strong>Experience:</strong> {candidate?.years_of_experience ?? 0} years</p>
                    <p><strong>Average match %:</strong> {avg}</p>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {activePage === 'outreach-email' ? (
          <section className="card">
            <h2>Outreach Email</h2>
            <p className="hint">Draft, edit and send personalized email.</p>
            <select className="input" value={selectedOutreachMatchId} onChange={(e) => setSelectedOutreachMatchId(e.target.value)}>
              <option value="">Select match</option>
              {matches.map((m) => <option key={m.id} value={m.id}>Candidate #{m.candidate_id} - Job #{m.job_id}</option>)}
            </select>
            <textarea className="input" rows={8} value={outreachDraft} onChange={(e) => setOutreachDraft(e.target.value)} placeholder="Outreach draft..." />
            <button className="primary" onClick={sendOutreach} disabled={!selectedOutreachMatchId || !outreachDraft.trim()}>Send Email</button>
          </section>
        ) : null}

        {activePage === 'reports' ? (
          <section className="card">
            <h2>Reports</h2>
            <p className="hint">Export match and skill trend reports.</p>
            <div className="inline-actions">
              <select className="input select-inline" value={reportCandidateId} onChange={(e) => setReportCandidateId(e.target.value)}>
                <option value="">Select candidate for CSV export</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <a className="secondary small" href={reportCandidateId ? `http://localhost:8000/api/reports/candidate/${reportCandidateId}.csv` : '#'}>Export Candidate Report CSV</a>
            </div>
            <h3>Skill Trend (from requirement evidence)</h3>
            <ul className="list">
              <li>Total Matches: {matches.length}</li>
              <li>Strong Matches: {matches.filter((m) => m.match_level === 'strong').length}</li>
              <li>Risk Alerts: {matches.filter((m) => m.risk_flag).length}</li>
            </ul>
          </section>
        ) : null}

        {activePage === 'admin-settings' ? (
          <section className="card">
            <h2>Admin Settings</h2>
            <p className="hint">Users, scoring config, ATS setup.</p>
            <h3>User Roles</h3>
            <ul className="list">
              <li><strong>Recruiter:</strong> Upload CV/JD, view matches, review shortlists, export reports, send outreach emails.</li>
              <li><strong>Admin:</strong> Manage users, scoring thresholds, risk rules, and ATS setup.</li>
            </ul>
            <label className="hint">Users (comma-separated emails)</label>
            <input className="input" value={adminUsers} onChange={(e) => setAdminUsers(e.target.value)} />
            <div className="inline-actions">
              <button className="secondary" onClick={loadSystemUsers}>Review All Users</button>
            </div>
            {(systemUsers || []).length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td>{user.is_active ? 'Active' : 'Blocked'}</td>
                        <td>
                          {user.role === 'admin' ? (
                            <span className="hint">Protected</span>
                          ) : (
                            <button
                              className={user.is_active ? 'danger small' : 'secondary small'}
                              onClick={() => toggleUserAccess(user.id, !user.is_active)}
                            >
                              {user.is_active ? 'Block Access' : 'Unblock'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <label className="hint">Scoring config</label>
            <select className="input" value={adminScoringMode} onChange={(e) => setAdminScoringMode(e.target.value)}>
              <option value="llm_with_fallback">LLM with fallback</option>
              <option value="rules_only">Rules only</option>
            </select>
            <label className="hint">ATS setup</label>
            <select className="input" value={adminAtsProvider} onChange={(e) => setAdminAtsProvider(e.target.value)}>
              <option>Greenhouse</option>
              <option>Lever</option>
              <option>Workable</option>
            </select>
            <button className="secondary" onClick={() => addActivity('Admin settings updated (UI config demo)')}>Save Settings</button>
          </section>
        ) : null}

        {activePage === 'matches' ? (
          <section className="card">
            <h2>Matches ({matches.length})</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Candidate ID</th><th>Job ID</th><th>Score %</th><th>Level</th><th>Risk</th><th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td>{m.candidate_id}</td>
                      <td>{m.job_id}</td>
                      <td>{m.total_score_percent}</td>
                      <td>{m.match_level}</td>
                      <td>{String(m.risk_flag)}</td>
                      <td>{m.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
