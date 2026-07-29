// ── Cameras.tsx: вставить в рендер карточки камеры ──

// Кнопка перескан (рядом с другими кнопками камеры):
// <Button onClick={()=>api.post(`/cameras/${id}/rescan`)}>
//     🔍 Пересканировать поток
// </Button>

// Баннер устаревшего профиля (над списком камер):
// {cameras.some(c => c.profile_needs_refresh) && (
//     <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg mb-4 flex items-center justify-between">
//         <span>⚠ Профили камер устарели. Пересканируйте потоки для обновления метаданных.</span>
//         <Button onClick={()=>api.post('/admin/profiles/backfill')}>Обновить все</Button>
//     </div>
// )}

// Селектор калибровки расстояния (в форме редактирования камеры):
// <Select label="Калибровка расстояния" value={cam.distance_calib_mode || ''}
//     onChange={v => setForm({...cam, distance_calib_mode: v})}
//     options={[
//         {v:'', t:'Не задано'},
//         {v:'person2', t:'По человеку (2 постановки)'},
//         {v:'homography', t:'По полу (скотч)'},
//         {v:'pinhole', t:'Авто по лицу (грубо)'}
//     ]} />

// HealthBadge (в карточке камеры):
// {(() => {
//     const h = computeHealthScore(cam);
//     if (h.score >= 80) return <span className="text-green-400">● OK</span>;
//     if (h.score >= 50) return <span className="text-yellow-400">● ⚠</span>;
//     return <span className="text-red-400">● ✘</span>;
// })()}


// ── RoiEditor.tsx: переключатель rect/polygon ──
// Добавить переключатель типа ROI:
// <Toggle label="Режим ROI" value={isPolygon} onChange={setIsPolygon}
//     left="Прямоугольник" right="Многоугольник" />
//
// Координаты хранить в долях кадра (0..1), а не в пикселях.
