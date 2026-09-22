import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../services/api'
import Topbar from '../components/Topbar'

const emptyForm = { category_id: '', amount: '', type: 'expense', description: '', transaction_date: new Date().toISOString().slice(0, 10) }

export default function TransactionsPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ type: '', category_id: '', from: '', to: '', page: 1, limit: 10 })
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [pagination, setPagination] = useState(null)
  const [error, setError] = useState('')
  const user = JSON.parse(localStorage.getItem('fintrack_user') || 'null')

  async function loadData() {
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''))
      const [transactions, categoryResponse] = await Promise.all([
        api.get(`/transactions?${params}`),
        api.get('/categories'),
      ])
      setItems(transactions.data.items)
      setPagination(transactions.data.pagination)
      setCategories(categoryResponse.data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не вдалося завантажити транзакції')
    }
  }

  useEffect(() => { loadData() }, [filters])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({ category_id: item.categoryId, amount: item.amount, type: item.type, description: item.description || '', transaction_date: item.transactionDate })
    setShowForm(true)
  }

  async function saveTransaction(event) {
    event.preventDefault()
    try {
      const payload = { ...form, category_id: Number(form.category_id), amount: Number(form.amount) }
      if (editingId) await api.put(`/transactions/${editingId}`, payload)
      else await api.post('/transactions', payload)
      setShowForm(false)
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не вдалося зберегти транзакцію')
    }
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Видалити цю транзакцію?')) return
    try {
      await api.delete(`/transactions/${id}`)
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не вдалося видалити транзакцію')
    }
  }

  return <main className="app-shell page-shell">
    <Topbar user={user} />
    <div className="content-wrap">
      <section className="page-heading"><div><p className="eyebrow">ОБЛІК ОПЕРАЦІЙ</p><h1>Транзакції</h1><p className="muted">Додавайте, фільтруйте та редагуйте свої доходи й витрати.</p></div><button className="primary-button cta-button" onClick={openCreate}><Plus size={17} /> Нова транзакція</button></section>
      {error && <div className="alert">{error}</div>}
      <section className="panel filters-panel"><div className="filter-grid"><label>Тип<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value, page: 1 })}><option value="">Усі типи</option><option value="income">Доходи</option><option value="expense">Витрати</option></select></label><label>Категорія<select value={filters.category_id} onChange={(event) => setFilters({ ...filters, category_id: event.target.value, page: 1 })}><option value="">Усі категорії</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Від<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value, page: 1 })} /></label><label>До<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value, page: 1 })} /></label></div></section>
      <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Дата</th><th>Категорія</th><th>Опис</th><th>Тип</th><th>Сума</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.transactionDate}</td><td>{item.Category?.name || '—'}</td><td>{item.description || '—'}</td><td><span className={`type-badge type-${item.type}`}>{item.type === 'income' ? 'Дохід' : 'Витрата'}</span></td><td className={item.type === 'income' ? 'money-in' : 'money-out'}>{item.type === 'income' ? '+' : '-'}{Number(item.amount).toFixed(2)} грн</td><td><div className="row-actions"><button title="Редагувати" onClick={() => openEdit(item)}><Pencil size={16} /></button><button title="Видалити" onClick={() => deleteTransaction(item.id)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{!items.length && <div className="empty-state">Транзакцій за цими фільтрами не знайдено.</div>}</div>{pagination && <div className="pagination"><span>Усього: {pagination.total}</span><div><button disabled={pagination.page <= 1} onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}>← Назад</button><strong>{pagination.page} / {pagination.total_pages || 1}</strong><button disabled={pagination.page >= pagination.total_pages} onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}>Далі →</button></div></div>}</section>
    </div>
    {showForm && <div className="modal-backdrop"><form className="transaction-modal" onSubmit={saveTransaction}><div className="modal-heading"><div><p className="eyebrow">{editingId ? 'РЕДАГУВАННЯ' : 'НОВА ОПЕРАЦІЯ'}</p><h2>{editingId ? 'Редагувати транзакцію' : 'Нова транзакція'}</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}>×</button></div><label>Тип<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, category_id: '' })}><option value="expense">Витрата</option><option value="income">Дохід</option></select></label><label>Категорія<select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} required><option value="">Оберіть категорію</option>{categories.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Сума<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label><label>Дата<input type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} required /></label><label>Опис<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="primary-button" type="submit">Зберегти</button></form></div>}
  </main>
}
