import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../services/api'
import Topbar from '../components/Topbar'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ name: '', type: 'expense' })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const user = JSON.parse(localStorage.getItem('fintrack_user') || 'null')

  async function loadCategories() {
    try {
      const response = await api.get('/categories')
      setCategories(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не вдалося завантажити категорії')
    }
  }

  useEffect(() => { loadCategories() }, [])

  function resetForm() {
    setForm({ name: '', type: 'expense' })
    setEditingId(null)
  }

  async function saveCategory(event) {
    event.preventDefault()
    try {
      if (editingId) await api.put(`/categories/${editingId}`, form)
      else await api.post('/categories', form)
      resetForm()
      await loadCategories()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не вдалося зберегти категорію')
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm('Видалити категорію?')) return
    try {
      await api.delete(`/categories/${id}`)
      await loadCategories()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Категорію не можна видалити')
    }
  }

  const ownCategories = categories.filter((category) => category.userId !== null)

  return <main className="app-shell page-shell">
    <Topbar user={user} />
    <div className="content-wrap">
      <section className="page-heading"><div><p className="eyebrow">КЛАСИФІКАЦІЯ</p><h1>Категорії</h1><p className="muted">Системні категорії доступні для вибору, власні можна змінювати.</p></div></section>
      {error && <div className="alert">{error}</div>}
      <div className="split-layout">
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">{editingId ? 'РЕДАГУВАННЯ' : 'НОВА КАТЕГОРІЯ'}</p><h2>{editingId ? 'Змінити категорію' : 'Додати власну'}</h2></div><Plus size={21} /></div><form className="stack-form" onSubmit={saveCategory}><label>Назва<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="1" maxLength="100" required /></label><label>Тип<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="expense">Витрата</option><option value="income">Дохід</option></select></label><div className="form-actions"><button className="primary-button" type="submit">{editingId ? 'Зберегти зміни' : 'Додати категорію'}</button>{editingId && <button className="secondary-button" type="button" onClick={resetForm}>Скасувати</button>}</div></form></section>
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">УСІ КАТЕГОРІЇ</p><h2>Ваш набір</h2></div></div><div className="category-cards">{categories.map((category) => <div className="category-card" key={category.id}><div><strong>{category.name}</strong><span className={`type-badge type-${category.type}`}>{category.type === 'income' ? 'Дохід' : 'Витрата'}</span>{category.userId === null && <small>Системна</small>}</div>{category.userId !== null && <div className="row-actions"><button title="Редагувати" onClick={() => { setEditingId(category.id); setForm({ name: category.name, type: category.type }) }}><Pencil size={16} /></button><button title="Видалити" onClick={() => deleteCategory(category.id)}><Trash2 size={16} /></button></div>}</div>)}{!ownCategories.length && <p className="muted">Власних категорій ще немає.</p>}</div></section>
      </div>
    </div>
  </main>
}
