import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  LogOut,
  Plus,
  ReceiptText,
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

const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const BudgetPage = lazy(() => import('./pages/BudgetPage'))

const COLORS = ['#e76f51', '#287271', '#264653', '#6d597a', '#7d8f69', '#d4a373', '#4f6d7a']
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
  const navigate = useNavigate()
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
        navigate('/dashboard', { replace: true })
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
        <p className="eyebrow">ОСОБИСТІ ФІНАНСИ БЕЗ ШУМУ</p>
        <h1>Надайте кожній гривні напрям.</h1>
        <p className="art-copy">Спокійний простір, щоб розуміти витрати, тримати ліміти під контролем і бачити наступний місяць.</p>
        <div className="signal-card">
          <div className="signal-head"><span>МІСЯЧНИЙ СИГНАЛ</span><ArrowUpRight size={17} /></div>
          <strong>+18.4%</strong>
          <div className="signal-line"><i /><i /><i /><i /><i /><i /><i /></div>
          <small>Видимість витрат покращується</small>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="brand-lockup"><span className="brand-dot" /> FinTrack</div>
          <div className="auth-heading">
            <p className="eyebrow">{mode === 'login' ? 'З поверненням' : 'Створення акаунта'}</p>
            <h2>{mode === 'login' ? 'Побачте форму своїх фінансів.' : 'Почніть із яснішого огляду.'}</h2>
            <p>{mode === 'login' ? 'Увійдіть, щоб продовжити роботу з фінансовим оглядом.' : 'Створіть особистий простір FinTrack.'}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && <label>Ім’я та прізвище<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ваше ім’я" required /></label>}
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={loading}>{loading ? 'Зачекайте…' : mode === 'login' ? 'Увійти' : 'Створити акаунт'} <ArrowUpRight size={17} /></button>
          </form>
          <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? 'Немає акаунта? Створити' : 'Вже маєте акаунт? Увійти'}
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

function InternalNavigation() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(event) {
      const link = event.target.closest('a')
      const href = link?.getAttribute('href')

      if (!href || !href.startsWith('/') || href.startsWith('//')) return

      event.preventDefault()
      navigate(href)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [navigate])

  return null
}

function Dashboard({ user, onLogout }) {
  const initialPeriod = getCurrentPeriod()
  const [period, setPeriod] = useState(initialPeriod)
  const [dashboard, setDashboard] = useState(null)
  const [categories, setCategories] = useState([])
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [transactionForm, setTransactionForm] = useState({ category_id: '', amount: '', type: 'expense', description: '', transaction_date: new Date().toISOString().slice(0, 10) })
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
      const [summary, byCategory, trend, budgets, forecast, availableCategories] = await Promise.all([
        apiRequest(`/analytics/summary?${query}`),
        apiRequest(`/analytics/by-category?${query}`),
        apiRequest(`/analytics/trend?months=6&${query}`),
        apiRequest(`/budget-limits?${query}`),
        apiRequest(`/forecast?${query}`),
        apiRequest('/categories'),
      ])
      setDashboard({ summary, byCategory, trend, budgets, forecast })
      setCategories(availableCategories)
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

  async function createTransaction(event) {
    event.preventDefault()
    try {
      await apiRequest('/transactions', { method: 'POST', data: { ...transactionForm, category_id: Number(transactionForm.category_id), amount: Number(transactionForm.amount) } })
      setShowTransactionForm(false)
      setTransactionForm({ category_id: '', amount: '', type: 'expense', description: '', transaction_date: new Date().toISOString().slice(0, 10) })
      await loadDashboard()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function movePeriod(offset) {
    const next = new Date(Number(period.year), period.month - 1 + offset, 1)
    changePeriod({ month: next.getMonth() + 1, year: next.getFullYear() })
  }

  const summary = dashboard?.summary
  const chartData = dashboard?.byCategory?.categories || []
  const trendData = dashboard?.trend?.months || []
  const forecastData = dashboard?.forecast?.categories || []
  const budgetData = dashboard?.budgets || []

  return <main className="app-shell">
    <header className="topbar">
      <Link className="brand-lockup" to="/dashboard"><span className="brand-dot" /> FinTrack</Link>
      <nav><Link className="nav-active" to="/dashboard">Огляд</Link><Link to="#spending">Витрати</Link><Link to="#limits">Ліміти</Link><Link to="/transactions">Транзакції</Link><Link to="/budget">Бюджет</Link></nav>
      <div className="user-menu"><span className="avatar">{user?.full_name?.charAt(0) || 'U'}</span><span className="user-name">{user?.full_name || user?.email}</span><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={17} /></button></div>
    </header>

    <div className="content-wrap">
      <section className="page-heading" id="overview">
        <div><p className="eyebrow">ОСОБИСТИЙ ОГЛЯД</p><h1>Доброго ранку, {user?.full_name?.split(' ')[0] || 'друже'}.</h1><p className="muted">Ось як рухаються ваші фінанси цього місяця.</p></div>
        <div className="heading-actions"><div className="period-control"><button title="Попередній місяць" onClick={() => movePeriod(-1)}><ChevronLeft size={17} /></button><strong>{MONTHS[period.month - 1]} {period.year}</strong><button title="Наступний місяць" onClick={() => movePeriod(1)}><ChevronRight size={17} /></button></div><button className="primary-button cta-button" onClick={() => setShowTransactionForm(true)}><Plus size={17} /> Нова транзакція</button></div>
      </section>

      {error && <div className="alert"><span>{error}</span><button onClick={loadDashboard}><RefreshCw size={16} /> Retry</button></div>}
      {loading && <div className="loading-state"><RefreshCw className="spin" size={21} /> Loading your financial picture…</div>}

      {!loading && dashboard && <>
        <section className="metrics-grid">
          <MetricCard label="ДОСТУПНИЙ БАЛАНС" value={formatMoney(summary?.balance)} detail="Доходи мінус витрати" tone="metric-green" />
          <MetricCard label="ЗАГАЛЬНІ ДОХОДИ" value={formatMoney(summary?.total_income)} detail="Надходження за період" tone="metric-blue" />
          <MetricCard label="ЗАГАЛЬНІ ВИТРАТИ" value={formatMoney(summary?.total_expense)} detail="Усі категорії" tone="metric-orange" />
        </section>

        <section className="dashboard-grid">
          <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">ГРОШОВИЙ ПОТІК</p><h2>Доходи та витрати</h2></div><BarChart3 size={21} /></div><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e6e2d9" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#5f625b', fontSize: 12 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#5f625b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}к`} /><Tooltip formatter={(value) => formatMoney(value)} /><Line type="monotone" dataKey="income" name="Доходи" stroke="#287271" strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" dataKey="expense" name="Витрати" stroke="#e76f51" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div className="legend"><span><i className="legend-income" /> Доходи</span><span><i className="legend-expense" /> Витрати</span></div></article>
          <article className="panel category-panel" id="spending"><div className="panel-heading"><div><p className="eyebrow">СТРУКТУРА ВИТРАТ</p><h2>Куди йдуть гроші</h2></div><WalletCards size={21} /></div>{chartData.length ? <div className="donut-wrap"><ResponsiveContainer width="52%" height={190}><PieChart><Pie data={chartData} dataKey="total_expense" nameKey="category" innerRadius={55} outerRadius={82} paddingAngle={3}>{chartData.map((entry, index) => <Cell key={entry.category_id} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(value)} /></PieChart></ResponsiveContainer><div className="category-list">{chartData.map((item, index) => <div className="category-row" key={item.category_id}><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.category}</span><strong>{formatMoney(item.total_expense)}</strong></div>)}</div></div> : <div className="empty-state"><ReceiptText size={25} /><span>Витрат за цей період не знайдено.</span><button onClick={() => setShowTransactionForm(true)}>Додати першу транзакцію</button></div>}</article>
        </section>

        <section className="dashboard-grid lower-grid">
          <article className="panel forecast-panel"><div className="panel-heading"><div><p className="eyebrow">ПРОГНОЗ</p><h2>Витрати за категоріями</h2></div><Sparkles size={21} /></div>{forecastData.length ? <div className="chart-bar" style={{ height: `${Math.max(225, forecastData.length * 36 + 45)}px` }}><ResponsiveContainer width="100%" height="100%"><BarChart data={forecastData} layout="vertical" margin={{ left: 14, right: 18 }}><CartesianGrid strokeDasharray="4 6" horizontal={false} stroke="#e6e2d9" /><XAxis type="number" hide /><YAxis type="category" dataKey="category" width={90} tickLine={false} axisLine={false} tick={{ fill: '#4f514b', fontSize: 12 }} /><Tooltip formatter={(value) => formatMoney(value)} /><Bar dataKey="forecast" fill="#6d597a" radius={[0, 5, 5, 0]} barSize={18} /></BarChart></ResponsiveContainer></div> : <div className="empty-state"><Sparkles size={25} /><span>Додайте кілька місяців витрат для прогнозу.</span></div>}</article>
          <article className="panel limits-panel" id="limits"><div className="panel-heading"><div><p className="eyebrow">КОНТРОЛЬ</p><h2>Бюджетні ліміти</h2></div><CircleDollarSign size={21} /></div>{budgetData.length ? <div className="limit-list">{budgetData.map((budget) => <div className="limit-row" key={budget.id}><div className="limit-meta"><span>{budget.category}</span><strong>{formatMoney(budget.spent)} <small>/ {formatMoney(budget.limit_amount)}</small></strong></div><div className="progress-track"><i className={`progress-${budget.status}`} style={{ width: `${Math.min(budget.percent, 100)}%` }} /></div><div className="limit-foot"><span>{Math.round(budget.percent)}% використано</span><em className={`status-${budget.status}`}>{budget.status === 'ok' ? 'у нормі' : budget.status === 'warning' ? 'увага' : 'перевищено'}</em></div></div>)}</div> : <div className="empty-state"><CircleDollarSign size={25} /><span>Лімітів на цей період немає.</span><button onClick={() => setShowTransactionForm(true)}>Переглянути бюджет</button></div>}</article>
        </section>
      </>}
    </div>
    <nav className="mobile-tabs"><a href="#overview">Огляд</a><a href="#spending">Витрати</a><button onClick={() => setShowTransactionForm(true)}><Plus size={20} /></button><a href="#limits">Ліміти</a><button onClick={logout}><LogOut size={17} /></button></nav>
    {showTransactionForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTransactionForm(false) }}><form className="transaction-modal" onSubmit={createTransaction}><div className="modal-heading"><div><p className="eyebrow">ШВИДКА ДІЯ</p><h2>Нова транзакція</h2></div><button type="button" className="icon-button" onClick={() => setShowTransactionForm(false)}>×</button></div><label>Тип<select value={transactionForm.type} onChange={(event) => setTransactionForm({ ...transactionForm, type: event.target.value })}><option value="expense">Витрата</option><option value="income">Дохід</option></select></label><label>Категорія<select value={transactionForm.category_id} onChange={(event) => setTransactionForm({ ...transactionForm, category_id: event.target.value })} required><option value="">Оберіть категорію</option>{categories.filter((category) => category.type === transactionForm.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Сума<input type="number" min="0.01" step="0.01" value={transactionForm.amount} onChange={(event) => setTransactionForm({ ...transactionForm, amount: event.target.value })} required /></label><label>Дата<input type="date" value={transactionForm.transaction_date} onChange={(event) => setTransactionForm({ ...transactionForm, transaction_date: event.target.value })} required /></label><label>Опис<input value={transactionForm.description} onChange={(event) => setTransactionForm({ ...transactionForm, description: event.target.value })} placeholder="Наприклад, покупки в магазині" /></label><button className="primary-button" type="submit">Зберегти транзакцію <ArrowUpRight size={17} /></button></form></div>}
  </main>
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('fintrack_user') || 'null'))
  useEffect(() => {
    const handleLogout = () => setUser(null)
    window.addEventListener('fintrack:logout', handleLogout)
    return () => window.removeEventListener('fintrack:logout', handleLogout)
  }, [])
  return <BrowserRouter><InternalNavigation /><Suspense fallback={<div className="loading-state">Завантаження сторінки…</div>}><Routes>
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginScreen onLogin={setUser} />} />
    <Route path="*" element={user ? <Routes>
      <Route path="/dashboard" element={<Dashboard user={user} onLogout={() => setUser(null)} />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/budget" element={<BudgetPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes> : <Navigate to="/login" replace />} />
  </Routes></Suspense></BrowserRouter>
}

export default App
