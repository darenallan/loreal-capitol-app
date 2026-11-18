import base64
import json
import urllib.request
import urllib.parse

print("Restoring original user photo...")

with open("albacos_alfredo_cool_vestes___albacost___alfredo___Gris.jpg", "rb") as f:
    jpeg_bytes = f.read()

b64_str = base64.b64encode(jpeg_bytes).decode("utf-8")
original_data_url = f"data:image/jpeg;base64,{b64_str}"

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
        data=json.dumps(original_data_url).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as resp:
        print(f"Restored model_photos[{k}]: {resp.status}")

# Update products matching Albacost Alfredo
prod_url = "https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json"
req_p = urllib.request.Request(prod_url)
with urllib.request.urlopen(req_p) as resp:
    prods = json.loads(resp.read().decode("utf-8"))

if isinstance(prods, dict):
    for pid, p in prods.items():
        if not p: continue
        title = (p.get("title") or "").strip().lower()
        color = (p.get("color") or "").strip().lower()
        cat = (p.get("category") or "").strip().lower()
        if ("albacos" in title or "alfredo" in title or "albacos" in cat) and ("gris" in color or "gris" in title):
            print(f"Restoring product {pid}: {p.get('title')} ({p.get('color')})")
            patch_req = urllib.request.Request(
                f"https://l-oreal-capitol-default-rtdb.firebaseio.com/products/{pid}.json",
                data=json.dumps({"imageUrl": original_data_url, "photo": original_data_url}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PATCH"
            )
            with urllib.request.urlopen(patch_req) as pr:
                print(f"Patched {pid}: {pr.status}")

print("Original shoe photo successfully restored in Firebase!")
