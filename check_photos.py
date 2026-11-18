import json
import urllib.request

url = 'https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as resp:
    prods = json.loads(resp.read().decode('utf-8'))

with_photo = []
for pid, p in prods.items():
    if not p: continue
    photo = p.get('imageUrl') or p.get('photo')
    if photo:
        with_photo.append((pid, p.get('title') or p.get('name'), p.get('category'), p.get('color'), len(photo)))

print(f"Total products with photo: {len(with_photo)}")
for x in with_photo:
    print(x)
