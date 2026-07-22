import sqlite3, json

conn = sqlite3.connect('prisma/dev.db')
conn.row_factory = sqlite3.Row

print('=== Person Photos ===')
for row in conn.execute('SELECT person_id, photo_path, has_embedding FROM person_photos'):
    pid = row['person_id']
    path = row['photo_path'] or ''
    emb = row['has_embedding']
    print(f'  person_id={pid}, path={path}, has_embedding={emb}')

print()
print('=== Face Descriptors ===')
for row in conn.execute('SELECT person_id, descriptor IS NOT NULL as has_desc, LENGTH(descriptor) as desc_len FROM FaceDescriptor'):
    pid = row['person_id']
    has = row['has_desc']
    length = row['desc_len']
    print(f'  person_id={pid}, has_descriptor={has}, descriptor_length={length}')

print()
print('=== Persons ===')
for row in conn.execute('SELECT id, name, category FROM Person'):
    print(f'  id={row["id"]}, name={row["name"]}, category={row["category"]}')

conn.close()
