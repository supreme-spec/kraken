# KRAKEN v2 — порядок применения

## Что создано автоматически
- `src/lib/decode-policy.ts` — серверная политика декодирования
- `src/lib/stream-probe.ts` — ffprobe автодетект + backfill
- `src/lib/ffmpeg-args.ts` — buildFfmpegArgs с enum-стратегией
- `src/lib/health-score.ts` — версионированный health-score
- `src/lib/ai-quality.ts` — proxy-метрики + feedback-loop
- `face_server/distance.py` — лесенка расстояний
- `patches/v2/01-04` — фрагменты для вставки

## Чего НЕ тронуто (твоя ручная работа)
1. `prisma/schema.prisma` — вставь `patches/v2/01_schema.prisma.additive` в конец `model Camera` (перед следующей `model`)
2. `server.ts` — вставь `patches/v2/02_server.ts.snippet` внутрь `startCameraDetection`
3. `face_server.py` — вставь `patches/v2/03_face_server.py.snippet` (импорт + цикл + endpoints)
4. UI (`Cameras.tsx`, `RoiEditor.tsx`) — вставь `patches/v2/04_ui.snippet.tsx`

## Порядок
1. `cp patches/v2/01_schema.prisma.additive /tmp/schema-add.txt` — затем вручную вставить в `schema.prisma`
2. `npx prisma validate` — убедись, что прошло
3. `npx prisma migrate dev --name v2_stream_profile_decode_policy`
4. Вставь 02/03/04 в соответствующие файлы
5. `npm run lint` — проверь TypeScript
6. Прогони чеклист backward-compat
7. `git push origin feat/v2-stream-profile-decode-policy` → draft PR → тест на железе

## Откат
```bash
git reset --hard backup/pre-v2-YYYYMMDD-HHMMSS
```
