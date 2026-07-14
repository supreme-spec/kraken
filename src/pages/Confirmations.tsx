import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'
import { UserCheck, Check, X, Clock } from 'lucide-react'

interface Confirmation {
  id: number
  person_id: number
  confidence: number
  temp_photo_path: string
  existing_photo_path: string | null
  person_name: string | null
  category: string | null
  status: string
  created_at: string
  person?: { id: number; name: string; category: string; photo_path: string | null }
}

interface Stats {
  pending: number
  approved: number
  rejected: number
}

export default function Confirmations() {
  const [items, setItems] = useState<Confirmation[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0 })
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [pending, s] = await Promise.all([
        apiFetch<Confirmation[]>('/confirmations/pending'),
        apiFetch<Stats>('/confirmations/stats'),
      ])
      setItems(pending)
      setStats(s)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const resolve = async (id: number, action: 'approve' | 'reject') => {
    setBusy(id)
    try {
      await apiFetch(`/confirmations/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ operator_id: 'operator' }),
      })
      await load()
    } catch (e: any) {
      setError(e?.message || 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-kraken-text flex items-center gap-2">
          <UserCheck size={20} className="text-kraken-purple" /> Подтверждение оператора
        </h1>
        <div className="flex gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300">Ожидают: {stats.pending}</span>
          <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-300">Подтверждено: {stats.approved}</span>
          <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-300">Отклонено: {stats.rejected}</span>
        </div>
      </div>

      {error && <div className="text-red-400 mb-3">{error}</div>}

      {items.length === 0 ? (
        <div className="text-kraken-muted flex flex-col items-center justify-center h-64 gap-2">
          <Clock size={32} /> Нет ожидающих подтверждений ✅
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <div key={c.id} className="bg-kraken-panel border border-kraken-border rounded-xl p-4 flex flex-col gap-3">
              <div className="text-sm text-kraken-muted">
                Кандидат:{' '}
                <span className="text-kraken-text font-semibold">
                  {c.person?.name ?? c.person_name ?? '—'}
                </span>
                {c.person?.category ? ` (${c.person.category})` : ''} · сходство{' '}
                {(c.confidence * 100).toFixed(1)}%
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-[10px] uppercase text-kraken-disabled mb-1">Из базы</div>
                  {c.existing_photo_path ? (
                    <img
                      src={`/${c.existing_photo_path}`}
                      alt="existing"
                      className="w-full h-40 object-cover rounded-lg border border-kraken-border"
                    />
                  ) : (
                    <div className="w-full h-40 bg-kraken-base rounded-lg flex items-center justify-center text-kraken-disabled">
                      нет фото
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase text-kraken-disabled mb-1">Новое фото</div>
                  <img
                    src={`/${c.temp_photo_path}`}
                    alt="new"
                    className="w-full h-40 object-cover rounded-lg border border-kraken-border"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  disabled={busy === c.id}
                  onClick={() => resolve(c.id, 'approve')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
                >
                  <Check size={16} /> Да, это он
                </button>
                <button
                  disabled={busy === c.id}
                  onClick={() => resolve(c.id, 'reject')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
                >
                  <X size={16} /> Другой человек
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
