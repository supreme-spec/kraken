import sqlite3
conn = sqlite3.connect('prisma/dev.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT id, name, category, embedding_count FROM Person WHERE name LIKE ?", ('%Старков%',))
person = cur.fetchone()
if not person:
    print('Person not found')
else:
    print('PERSON:', dict(person))
    cur.execute("SELECT id, person_id, photo_path, is_primary, has_embedding, source, confidence FROM person_photos WHERE person_id = ?", (person['id'],))
    photos = cur.fetchall()
    print('PHOTOS:', [dict(p) for p in photos])
    cur.execute("SELECT id, person_id, confidence, created_at FROM FaceDescriptor WHERE person_id = ?", (person['id'],))
    descs = cur.fetchall()
    print('DESCRIPTORS:', [dict(d) for d in descs])
conn.close()
