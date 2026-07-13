# Smart Security Monitor 🔐

Система видеонаблюдения с распознаванием лиц в реальном времени.

**Стек:** React 19 · TypeScript · Express · Prisma (SQLite) · FastAPI · InsightFace (buffalo\_l) · FFmpeg · WebSocket

---

## Быстрый старт

### 1. Зависимости Node.js

```bash
npm install
```

### 2. Python-окружение (Face Engine)

```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Для продакшена рекомендуется минимальный набор:
```bash
pip install faiss-cpu insightface opencv-python-headless fastapi uvicorn python-multipart
```

### 2.1. Настройка переменных окружения AI-сервера

Скопируйте `.env.example` в `.env` и проверьте значения:

| Переменная               | По умолчанию                    | Описание                                    |
|--------------------------|---------------------------------|---------------------------------------------|
| `FACE_API_KEY`           | `super-secret-change-me`        | Ключ для защиты `/update-index`             |
| `FACE_FRAME_SKIP`        | `2`                             | Пропуск кадров (1 = каждый кадр)            |
| `FACE_MIN_FACE_SIZE`     | `60`                            | Мин. ширина лица в пикселях                 |
| `FACE_MIN_DET_SCORE`     | `0.8`                           | Мин. уверенность детекции InsightFace       |
| `FACE_COOLDOWN_SECONDS`  | `30`                            | Кулдаун повторного срабатывания             |
| `FACE_RECOGNITION_THRESHOLD` | `55`                        | Порог распознавания в процентах (0-100)     |
| `DB_PATH`                | `prisma/dev.db`                 | Путь к SQLite для авто-загрузки FAISS       |

### 3. Настройка базы данных

```bash
npm run db:migrate
```

### 4. Запуск в режиме разработки

Одна команда запускает всё (Node-сервер + Python Face Engine + Vite HMR):

```bash
npm run dev
```

Открыть: [http://localhost:3000](http://localhost:3000)

---

## Переменные окружения

Скопируйте `.env.example` в `.env` и проверьте значения:

| Переменная               | По умолчанию                    | Описание                                    |
|--------------------------|---------------------------------|---------------------------------------------|
| `PORT`                   | `3000`                          | Порт Node.js сервера                        |
| `HOST`                   | `0.0.0.0`                       | Сетевой интерфейс привязки                  |
| `API_KEY`                | —                               | API-ключ для `/api` и `/ws` (опционально)   |
| `VITE_API_KEY`           | —                               | API-ключ для клиента (должен совпадать)     |
| `FACE_SERVER_URL`        | `http://localhost:8001`         | URL Python Face Engine                      |
| `FACE_API_KEY`           | `super-secret-change-me`        | Ключ для защиты `/update-index`             |
| `FACE_FRAME_SKIP`        | `2`                             | Пропуск кадров (1 = каждый кадр)            |
| `FACE_MIN_FACE_SIZE`     | `60`                            | Мин. ширина лица в пикселях                 |
| `FACE_MIN_DET_SCORE`     | `0.8`                           | Мин. уверенность детекции InsightFace       |
| `FACE_COOLDOWN_SECONDS`  | `30`                            | Кулдаун повторного срабатывания             |
| `FACE_RECOGNITION_THRESHOLD` | `55`                        | Порог распознавания в процентах (0-100)     |
| `DB_PATH`                | `prisma/dev.db`                 | Путь к SQLite для авто-загрузки FAISS       |
| `DATABASE_URL`           | `file:./dev.db?journal_mode=WAL` | Путь к SQLite базе с WAL-режимом         |
| `NODE_ENV`               | `development`                   | Режим запуска                               |

---

## Скрипты

| Команда             | Описание                                  |
|---------------------|-------------------------------------------|
| `npm run dev`       | Dev-режим: Node + Python + Vite           |
| `npm run build`     | Production сборка                         |
| `npm start`         | Запуск production сборки                  |
| `npm run db:migrate`| Применить миграции Prisma                 |
| `npm run db:studio` | Открыть Prisma Studio (UI для БД)         |
| `npm run lint`      | TypeScript проверка                       |

---

## Архитектура

```
Browser (React 19 + Vite)
  ↕ HTTP /api/* + WebSocket /ws/*
Node.js Express (server.ts, port 3000)
  ↕ HTTP REST (multipart)
Python FastAPI (face_server.py, port 8001)
  ↕ InsightFace buffalo_l (ONNX)
Prisma ORM ← SQLite (prisma/dev.db)
```

### Поддерживаемые типы камер

- **USB** — Windows DirectShow (`video=USB Video Device`)
- **RTSP** — IP-камеры через FFmpeg
- **ONVIF** — автообнаружение по сети
- **Hikvision** — ISAPI интеграция
- **UNV** — LAPI HTTP Push webhook

### GPU-ускорение (автоматически)

Python Face Engine выбирает лучший доступный провайдер:

`CUDA (NVIDIA)` → `DirectML (AMD/Intel, Windows)` → `OpenVINO` → `ROCm` → `CPU`

---

## FFmpeg

Для стриминга USB и RTSP камер требуется FFmpeg.

Скачайте и поместите `ffmpeg.exe` в папку `bin/`:

```
bin/ffmpeg.exe
```

Или установите системно и добавьте в `PATH`.

---

## Структура базы данных

| Таблица          | Описание                          |
|------------------|-----------------------------------|
| `Camera`         | Камеры (USB, RTSP, ONVIF, UNV)   |
| `Person`         | База персон с фото                |
| `FaceDescriptor` | Эмбеддинги лиц (binary base64)   |
| `PersonPhoto`    | Фотографии персон                 |
| `Event`          | События распознавания             |
| `Recording`      | Записи видео                      |
| `Category`       | Категории (VIP, BLACKLIST, etc.)  |
| `Incident`       | Инциденты персон                  |
| `Tag`            | Теги персон                       |
| `Settings`       | Персистентные настройки           |
