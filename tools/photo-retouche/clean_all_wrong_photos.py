import json
import urllib.request

print("Cleaning all wrongly assigned photos from clothing products...")

# 1. Fetch all products
url = 'https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as resp:
    prods = json.loads(resp.read().decode('utf-8'))

cleaned_count = 0
for pid, p in prods.items():
    if not p: continue
    
    # We want to clear imageUrl / photo ONLY if it was wrongly assigned to clothing:
    # Any Albacost clothing (Paul Haggis, Jean Courcel, Jacques Mar, Efendi, Fabio Mateo, etc.)
    # Keep Mack James shoes ('inv_shoes_...') untouched.
    # Keep only the user's specific shoe item.
    if pid.startswith('inv_shoes_'):
        # Mack James shoes - keep!
        continue

    cat = (p.get('category') or '').strip().lower()
    title = (p.get('title') or p.get('name') or '').strip().lower()

    # If it is Albacost clothing that got the 61439 or 98227 photo
    photo = p.get('imageUrl') or p.get('photo')
    if photo and (len(photo) in [61439, 98227, 74739, 70631] or 'data:image' in str(photo)):
        # Check if it's the specific shoe or clothing
        is_shoe = 'chaussure' in cat or 'chaussure' in title or 'berwick' in title
        if not is_shoe:
            print(f"Clearing wrong photo from clothing {pid}: {p.get('title')} ({p.get('color')})")
            patch_url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/products/{pid}.json"
            p_req = urllib.request.Request(
                patch_url,
                data=json.dumps({"imageUrl": None, "photo": None}).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method="PATCH"
            )
            with urllib.request.urlopen(p_req) as pr:
                cleaned_count += 1

print(f"Successfully cleaned {cleaned_count} clothing products!")

# 2. Clean model_photos in Firebase
print("Cleaning model_photos in Firebase...")
photos_url = 'https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos.json'
photos_req = urllib.request.Request(photos_url)
with urllib.request.urlopen(photos_req) as resp:
    photos = json.loads(resp.read().decode('utf-8'))

# Delete the Albacost suit and generic Albacost keys that spread to suits
keys_to_delete = [
    'Albacost___C4809',
    'albacos alfredo cool vestes___albacost___albacos alfredo',
    'albacos alfredo cool vestes___albacost___alfredo'
]

for k in keys_to_delete:
    if k in photos:
        enc_k = urllib.parse.quote(k)
        del_url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos/{enc_k}.json"
        d_req = urllib.request.Request(del_url, method="DELETE")
        try:
            with urllib.request.urlopen(d_req) as d_resp:
                print(f"Deleted key from model_photos: {k} (status: {d_resp.status})")
        except Exception as e:
            print(f"Error deleting {k}: {e}")

print("Firebase cleanup completed 100%!")
