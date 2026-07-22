import sqlite3
conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print('TABLES:', tables)
for t in tables:
    if 'photo' in t.lower() or 'person' in t.lower() or 'embed' in t.lower():
        cur.execute(f'PRAGMA table_info({t})')
        cols = [r[1] for r in cur.fetchall()]
        print(f'{t}: {cols}')
conn.close()
