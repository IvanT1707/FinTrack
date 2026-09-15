import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from './services/api'
import './App.css'

const COLORS = ['#e76f51', '#287271', '#e9c46a', '#264653', '#f4a261', '#6d597a']
const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2024, index).toLocaleString('uk-UA', { month: 'long' }))

function formatMoney(value) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function getCurrentPeriod() {
  const today = new Date()
  return { month: today.getMonth() + 1, year: today.getFullYear() }
}

async function apiRequest(path, options = {}) {
  try {
    const response = await api({ url: path, ...options })
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Не вдалося виконати запит')
  }
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        data: mode === 'login' ? { email, password } : { email, password, full_name: fullName },
      })
      if (mode === 'register') {
        setMode('login')
        setError('Account created. Sign in with your new credentials.')
      } else {
        localStorage.setItem('fintrack_access_token', data.access_token)
        localStorage.setItem('fintrack_refresh_token', data.refresh_token)
        localStorage.setItem('fintrack_user', JSON.stringify(data.user))
        onLogin(data.user)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-art" aria-label="FinTrack finance overview">
        <div className="art-mark"><CircleDollarSign size={20} /></div>
        <p className="eyebrow">PERSONAL FINANCE, WITH CLARITY</p>
        <h1>Give every гривня a direction.</h1>
        <p className="art-copy">One calm place to understand your spending, protect your limits, and see what next month may look like.</p>
        <div className="signal-card">
          <div className="signal-head"><span>MONTHLY SIGNAL</span><ArrowUpRight size={17} /></div>
          <strong>+18.4%</strong>
          <div className="signal-line"><i /><i /><i /><i /><i /><i /><i /></div>
          <small>Spending visibility is improving</small>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="brand-lockup"><span className="brand-dot" /> FinTrack</div>
          <div className="auth-heading">
            <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}</p>
            <h2>{mode === 'login' ? 'See the shape of your money.' : 'Start with a clearer view.'}</h2>
            <p>{mode === 'login' ? 'Sign in to continue to your financial overview.' : 'Create your personal FinTrack workspace.'}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" required /></label>}
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17} /></button>
          </form>
          <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
          </button>
          <div className="auth-note"><ShieldCheck size={16} /> Your financial data stays tied to your account.</div>
        </div>
      </section>
    </main>
  )
}

function MetricCard({ label, value, detail, tone }) {
  return <article className={`metric-card ${tone}`}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>
}

function Dashboard({ user, onLogout }) {
  const initialPeriod = getCurrentPeriod()
  const [period, setPeriod] = useState(initialPeriod)
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const loading = !dashboard && !error

  const loadDashboard = useCallback(async () => {
    setError('')
    const { month } = period
    const year = Number(period.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setError('Enter a valid year between 2000 and 2100.')
      return
    }
    try {
      const query = `month=${month}&year=${year}`
      const [summary, byCategory, trend, budgets, forecast] = await Promise.all([
        apiRequest(`/analytics/summary?${query}`),
        apiRequest(`/analytics/by-category?${query}`),
        apiRequest(`/analytics/trend?months=6&${query}`),
        apiRequest(`/budget-limits?${query}`),
        apiRequest(`/forecast?${query}`),
      ])
      setDashboard({ summary, byCategory, trend, budgets, forecast })
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [period])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  function logout() {
    localStorage.removeItem('fintrack_access_token')
    localStorage.removeItem('fintrack_refresh_token')
    localStorage.removeItem('fintrack_user')
    onLogout()
  }

  function changePeriod(nextPeriod) {
    setDashboard(null)
    setError('')
    setPeriod(nextPeriod)
  }

  const summary = dashboard?.summary
  const chartData = dashboard?.byCategory?.categories || []
  const trendData = dashboard?.trend?.months || []
  const forecastData = dashboard?.forecast?.categories || []
  const budgetData = dashboard?.budgets || []

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><span className="brand-dot" /> FinTrack</div>
      <nav><a className="nav-active" href="#overview">Overview</a><a href="#spending">Spending</a><a href="#limits">Limits</a></nav>
      <div className="user-menu"><span className="avatar">{user?.full_name?.charAt(0) || 'U'}</span><span className="user-name">{user?.full_name || user?.email}</span><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={17} /></button></div>
    </header>

    <div className="content-wrap">
      <section className="page-heading" id="overview">
        <div><p className="eyebrow">PERSONAL OVERVIEW</p><h1>Good morning, {user?.full_name?.split(' ')[0] || 'there'}.</h1><p className="muted">Here is how your finances are moving this month.</p></div>
        <div className="period-control"><label htmlFor="period-month">Period</label><select id="period-month" value={period.month} onChange={(event) => changePeriod({ ...period, month: Number(event.target.value) })}>{MONTHS.map((name, index) => <option key={index + 1} value={index + 1}>{name}</option>)}</select><input aria-label="Year" inputMode="numeric" value={period.year} onChange={(event) => changePeriod({ ...period, year: event.target.value })} onBlur={() => { if (!period.year) changePeriod({ ...period, year: getCurrentPeriod().year }) }} /></div>
      </section>

      {error && <div className="alert"><span>{error}</span><button onClick={loadDashboard}><RefreshCw size={16} /> Retry</button></div>}
      {loading && <div className="loading-state"><RefreshCw className="spin" size={21} /> Loading your financial picture…</div>}

      {!loading && dashboard && <>
        <section className="metrics-grid">
          <MetricCard label="AVAILABLE BALANCE" value={formatMoney(summary?.balance)} detail="Income minus spending" tone="metric-green" />
          <MetricCard label="TOTAL INCOME" value={formatMoney(summary?.total_income)} detail="Money in this period" tone="metric-blue" />
          <MetricCard label="TOTAL SPENDING" value={formatMoney(summary?.total_expense)} detail="Across all categories" tone="metric-orange" />
          <MetricCard label="NEXT MONTH FORECAST" value={formatMoney(dashboard.forecast?.total_forecast)} detail="Weighted category forecast" tone="metric-violet" />
        </section>

        <section className="dashboard-grid">
          <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">CASHFLOW</p><h2>Income & spending</h2></div><BarChart3 size={21} /></div><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e6e2d9" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#77756d', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#77756d', fontSize: 11 }} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip formatter={(value) => formatMoney(value)} /><Line type="monotone" dataKey="income" name="Income" stroke="#287271" strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" dataKey="expense" name="Spending" stroke="#e76f51" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div className="legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Spending</span></div></article>
          <article className="panel category-panel" id="spending"><div className="panel-heading"><div><p className="eyebrow">WHERE IT GOES</p><h2>Spending mix</h2></div><WalletCards size={21} /></div>{chartData.length ? <div className="donut-wrap"><ResponsiveContainer width="52%" height={190}><PieChart><Pie data={chartData} dataKey="total_expense" nameKey="category" innerRadius={55} outerRadius={82} paddingAngle={3}>{chartData.map((entry, index) => <Cell key={entry.category_id} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(value)} /></PieChart></ResponsiveContainer><div className="category-list">{chartData.map((item, index) => <div className="category-row" key={item.category_id}><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.category}</span><strong>{formatMoney(item.total_expense)}</strong></div>)}</div></div> : <div className="empty-state">No spending recorded for this period.</div>}</article>
        </section>

        <section className="dashboard-grid lower-grid">
          <article className="panel forecast-panel"><div className="panel-heading"><div><p className="eyebrow">LOOKING AHEAD</p><h2>Forecast by category</h2></div><Sparkles size={21} /></div>{forecastData.length ? <div className="chart-bar"><ResponsiveContainer width="100%" height={225}><BarChart data={forecastData} layout="vertical" margin={{ left: 14, right: 18 }}><CartesianGrid strokeDasharray="4 6" horizontal={false} stroke="#e6e2d9" /><XAxis type="number" hide /><YAxis type="category" dataKey="category" width={90} tickLine={false} axisLine={false} tick={{ fill: '#4f514b', fontSize: 12 }} /><Tooltip formatter={(value) => formatMoney(value)} /><Bar dataKey="forecast" fill="#6d597a" radius={[0, 5, 5, 0]} barSize={18} /></BarChart></ResponsiveContainer></div> : <div className="empty-state">Add a few months of expenses to see a forecast.</div>}</article>
          <article className="panel limits-panel" id="limits"><div className="panel-heading"><div><p className="eyebrow">STAY ON TRACK</p><h2>Budget limits</h2></div><CircleDollarSign size={21} /></div>{budgetData.length ? <div className="limit-list">{budgetData.map((budget) => <div className="limit-row" key={budget.id}><div className="limit-meta"><span>{budget.category}</span><strong>{formatMoney(budget.spent)} <small>/ {formatMoney(budget.limit_amount)}</small></strong></div><div className="progress-track"><i className={`progress-${budget.status}`} style={{ width: `${Math.min(budget.percent, 100)}%` }} /></div><div className="limit-foot"><span>{Math.round(budget.percent)}% used</span><em className={`status-${budget.status}`}>{budget.status}</em></div></div>)}</div> : <div className="empty-state">No limits set for this period.</div>}</article>
        </section>
      </>}
    </div>
  </main>
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('fintrack_user') || 'null'))
  useEffect(() => {
    const handleLogout = () => setUser(null)
    window.addEventListener('fintrack:logout', handleLogout)
    return () => window.removeEventListener('fintrack:logout', handleLogout)
  }, [])
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <LoginScreen onLogin={setUser} />
}

export default App
