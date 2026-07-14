import { useEffect, useState } from 'react'
import { X, Check, UserCheck, Camera, User, Clock } from 'lucide-react'
import { apiFetch } from '../api/client'
import type { ConfirmationMessage } from '../types'

interface Props {
  confirmation: ConfirmationMessage | null
  onResolved: () => void
  onDismiss: () => void
}

// Remap ArcFace cosine similarity [0.28..0.85] → [0%..100%]
function cosineToPercent(cosine: number): number {
  const clamped = Math.max(0.28, Math.min(0.85, cosine))
  return Math.round(((clamped - 0.28) / (0.85 - 0.28)) * 100)
}

/**
 * Живой попап подтверждения оператора («Human-in-the-Loop»).
 *
 * Появляется, когда бэкенд детектит лицо в «серой зоне» уверенности
 * (low_threshold..confirmation_threshold) и присылает WS-сообщение
 * `{ type: "CONFIRMATION" }`. Оператор видит две фотографии (кадр из
 * камеры vs зарегистрированное фото из базы) и нажимает:
 *   ✅ «Да, это он»      → /api/confirmations/:id/approve
 *   ❌ «Нет, в фотохронику» → /api/confirmations/:id/reject
 */
export default function ConfirmPopup({ confirmation, onResolved, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tempFailed, setTempFailed] = useState(false)
  const [existingFailed, setExistingFailed] = useState(false)

  useEffect(() => {
    if (confirmation) {
      setVisible(true)
      setBusy(false)
      setTempFailed(false)
      setExistingFailed(false)
    } else {
      setVisible(false)
    }
  }, [confirmation])

  if (!confirmation) return null

  const pct = cosineToPercent(confirmation.confidence)

  const resolve = async (action: 'approve' | 'reject') => {
    if (busy) return
    setBusy(true)
    try {
      await apiFetch(`/confirmations/${confirmation.confirmation_id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ operator_id: 'operator' }),
      })
      setVisible(false)
      setTimeout(onResolved, 250)
    } catch (e: any) {
      // Ошибка не должна блокировать попап навсегда — даём оператору повторить
      console.warn('Ошибка подтверждения:', e)
      setBusy(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[9000] flex items-center justify-center transition-opacity duration-300 backdrop-blur-sm ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ backgroundColor: 'rgba(26, 20, 32, 0.78)' }}
      onClick={onDismiss}
    >
      <div
        className={`relative panel p-6 max-w-md w-full mx-4 animate-slide-in border-kraken-purple shadow-glow-purple ${
          visible ? '' : 'pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-kraken-muted hover:text-kraken-text"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-kraken-purple/10 text-kraken-purple flex-shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="font-bold text-lg text-kraken-purple">Подтверждение личности</div>
            <div className="text-kraken-muted text-xs">
              Камера {confirmation.camera_id ?? '—'} · сходство {pct}%
            </div>
          </div>
        </div>

        {/* Кандидат из базы */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-kraken-border flex-shrink-0 bg-kraken-hover flex items-center justify-center">
            {!existingFailed && confirmation.existing_photo ? (
              <img
                src={confirmation.existing_photo}
                alt={confirmation.person_name}
                className="w-full h-full object-cover"
                onError={() => setExistingFailed(true)}
              />
            ) : (
              <User size={28} className="text-kraken-disabled" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-kraken-text font-bold text-base truncate">
              {confirmation.person_name}
            </div>
            <div className="text-kraken-muted text-sm">
              {confirmation.category || 'Клиент'}
            </div>
          </div>
        </div>

        {/* Два фото: кадр vs база */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase text-kraken-disabled mb-1 flex items-center gap-1">
              <Camera size={11} /> Новый кадр
            </div>
            <div className="w-full h-40 rounded-lg overflow-hidden border border-kraken-border bg-kraken-base flex items-center justify-center">
              {!tempFailed ? (
                <img
                  src={confirmation.temp_photo}
                  alt="captured"
                  className="w-full h-full object-cover"
                  onError={() => setTempFailed(true)}
                />
              ) : (
                <span className="text-kraken-disabled text-xs">нет фото</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-kraken-disabled mb-1 flex items-center gap-1">
              <User size={11} /> Из базы
            </div>
            <div className="w-full h-40 rounded-lg overflow-hidden border border-kraken-border bg-kraken-base flex items-center justify-center">
              {!existingFailed && confirmation.existing_photo ? (
                <img
                  src={confirmation.existing_photo}
                  alt="registered"
                  className="w-full h-full object-cover"
                  onError={() => setExistingFailed(true)}
                />
              ) : (
                <span className="text-kraken-disabled text-xs">нет фото</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-kraken-muted text-xs mb-3 flex items-center gap-1.5">
          <Clock size={12} />
          Это тот же человек? Подтверждение улучшит точность распознавания.
        </div>

        {/* Кнопки Да / Нет */}
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => resolve('approve')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold"
          >
            <Check size={16} /> Да, это он
          </button>
          <button
            disabled={busy}
            onClick={() => resolve('reject')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold"
          >
            <X size={16} /> Нет, в фотохронику
          </button>
        </div>
      </div>
    </div>
  )
}
