import io
import base64
import json
import urllib.request
import urllib.parse
from PIL import Image

src_path = r"C:\Users\natakwe pangop marc\.gemini\antigravity-ide\brain\70b532b3-e1ea-4168-9d2a-29c358466743\berwick_studio_white_1793632886801.jpg"
img = Image.open(src_path).convert("RGB")

# Resize to standard luxury catalog size 750x750
img_750 = img.resize((750, 750), Image.Resampling.LANCZOS)

# Save as optimized JPEG at quality 80 to keep it featherweight (~35-42 KB)
buf = io.BytesIO()
img_750.save(buf, format="JPEG", quality=80, optimize=True)
jpeg_data = buf.getvalue()
size_kb = len(jpeg_data) / 1024
print(f"Compressed perfect studio shoe size: {size_kb:.1f} KB (100% Firebase safe)")

b64_str = base64.b64encode(jpeg_data).decode("utf-8")
data_url = f"data:image/jpeg;base64,{b64_str}"

# Keys in model_photos
keys = [
    "albacos alfredo cool vestes___albacost___alfredo___Gris",
    "albacos alfredo cool vestes___albacost___alfredo",
    "albacos alfredo cool vestes___albacost___albacos alfredo___Gris",
    "albacos alfredo cool vestes___albacost___albacos alfredo"
]

for k in keys:
    enc = urllib.parse.quote(k)
    url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos/{enc}.json"
    req = urllib.request.Request(
        url,
        data=json.dumps(data_url).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as resp:
        print(f"Pushed to Firebase model_photos[{k}]: {resp.status}")

# Update products
prods_url = "https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json"
req_prods = urllib.request.Request(prods_url)
with urllib.request.urlopen(req_prods) as resp:
    prods = json.loads(resp.read().decode("utf-8"))

if isinstance(prods, dict):
    for pid, p in prods.items():
        if not p: continue
        title = (p.get("title") or "").strip().lower()
        color = (p.get("color") or "").strip().lower()
        cat = (p.get("category") or "").strip().lower()
        # Albacost Alfredo
        if "albacos" in title or "alfredo" in title or "albacos" in cat:
            print(f"Patching product {pid}: {p.get('title')} ({p.get('color')})")
            patch_url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/products/{pid}.json"
            p_req = urllib.request.Request(
                patch_url,
                data=json.dumps({"imageUrl": data_url, "photo": data_url}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PATCH"
            )
            with urllib.request.urlopen(p_req) as pr:
                print(f"Product {pid} patched: {pr.status}")

print("All Firebase updates successfully completed!")
