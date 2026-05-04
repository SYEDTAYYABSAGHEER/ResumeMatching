import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './styles.css'

const api = axios.create({ baseURL: 'http://localhost:8000/api' })

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
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
  const [selectedJob, setSelectedJob] = useState(null)
  const [editingJob, setEditingJob] = useState(null)
  const [editJobTitle, setEditJobTitle] = useState('')
  const [editJobCompany, setEditJobCompany] = useState('')
  const [editJobLocation, setEditJobLocation] = useState('')
  const [editJobSeniority, setEditJobSeniority] = useState('')
  const [editJobDescription, setEditJobDescription] = useState('')

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

  useEffect(() => {
    refresh()
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

  const selectedCandidateMatches = useMemo(() => {
    if (!selectedCandidate) return []
    return matches.filter((m) => m.candidate_id === selectedCandidate.id)
  }, [matches, selectedCandidate])

  const addActivity = (text) => {
    setActivity((prev) => [text, ...prev].slice(0, 8))
  }

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
      await api.post('/candidates/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadFile(null)
      await refresh()
      addActivity(`Candidate "${candidateName}" uploaded from file`)
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
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create job')
    } finally {
      setLoading(false)
    }
  }

  const viewCandidate = async (candidateId) => {
    try {
      setError('')
      const res = await api.get(`/candidates/${candidateId}`)
      setSelectedCandidate(res.data)
      setEditingCandidate(null)
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
      await refresh()
      addActivity(`Candidate "${candidateName}" deleted`)
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
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to run matching')
    } finally {
      setLoading(false)
    }
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'candidates', label: 'Candidates' },
    { id: 'imports', label: 'Imports' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'matches', label: 'Matches' },
  ]

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
      </aside>

      <main className="app-shell">
        <header className="app-header">
          <div>
            <h1>Resume Matching Agent</h1>
            <p className="hint">AI-assisted screening dashboard for recruiters</p>
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

        {activePage === 'dashboard' ? (
          <>
            <section className="stats-grid">
              <div className="card stat-card"><h3>{dashboard?.total_candidates ?? candidates.length}</h3><p>Total Candidates</p></div>
              <div className="card stat-card"><h3>{dashboard?.total_jobs ?? jobs.length}</h3><p>Total Jobs</p></div>
              <div className="card stat-card"><h3>{dashboard?.average_match_score ?? 0}%</h3><p>Average Score</p></div>
              <div className="card stat-card"><h3>{dashboard?.risk_alerts ?? 0}</h3><p>Risk Alerts</p></div>
            </section>

            <section className="grid">
              <div className="card">
                <h2>Recent Activity</h2>
                <ul className="list">
                  {activity.length ? activity.map((a, idx) => <li key={idx}>{a}</li>) : <li>No activity yet</li>}
                </ul>
              </div>
              <div className="card">
                <h2>Quick Actions</h2>
                <p className="hint">Use sidebar pages to upload candidates, create jobs, and review matches.</p>
                <button className="secondary" onClick={() => setActivePage('imports')}>Go to Imports</button>
              </div>
            </section>
          </>
        ) : null}

        {activePage === 'candidates' ? (
          <section className="grid">
            <div className="card">
              <h2>Create Candidate (Manual)</h2>
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
            {selectedCandidate ? (
              <div className="card">
                <h2>Candidate Details</h2>
                <p><strong>Name:</strong> {selectedCandidate.full_name}</p>
                <p><strong>Title:</strong> {selectedCandidate.current_title || '-'}</p>
                <p><strong>Experience:</strong> {selectedCandidate.years_of_experience ?? 0} years</p>
                <p><strong>CV Text:</strong></p>
                <textarea className="input" rows={8} value={selectedCandidate.raw_text || ''} readOnly />
                <p><strong>Matches for this Candidate ({selectedCandidateMatches.length}):</strong></p>
                {selectedCandidateMatches.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Score %</th>
                          <th>Level</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCandidateMatches.map((m) => {
                          const job = jobs.find((j) => j.id === m.job_id)
                          return (
                            <tr key={m.id}>
                              <td>{job?.title || `Job #${m.job_id}`}</td>
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
                  <p className="hint">No matches yet for this candidate. Run Full Matching to generate results.</p>
                )}
              </div>
            ) : null}
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

        {activePage === 'imports' ? (
          <section className="grid">
            <div className="card">
              <h2>Upload CV File (MinIO)</h2>
              <input className="input" placeholder="Full name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
              <input className="input" type="file" accept=".pdf,.docx,.csv" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <p className="hint">Supported: PDF, DOCX, CSV</p>
              <button className="secondary" onClick={uploadCandidateFile} disabled={loading}>Upload and Parse</button>
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

        {activePage === 'jobs' ? (
          <section className="grid">
            <div className="card">
              <h2>Create Job</h2>
              <input className="input" placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <textarea className="input" placeholder="Paste job description" value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} rows={5} />
              <textarea className="input" value={jobReqs} onChange={(e) => setJobReqs(e.target.value)} rows={4} />
              <button className="secondary" onClick={createJob} disabled={loading}>Save Job</button>
            </div>
            <div className="card">
              <h2>Jobs ({filteredJobs.length})</h2>
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
