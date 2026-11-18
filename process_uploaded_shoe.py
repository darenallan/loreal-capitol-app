import io
import base64
import json
import urllib.request
from PIL import Image, ImageFilter, ImageEnhance
import rembg

print("Processing uploaded shoe with rembg AI segmentation...")

# 1. Load original uploaded photo
input_path = "scratch_uploaded_shoe.jpg"
with open(input_path, "rb") as f:
    input_bytes = f.read()

# 2. Run AI cutout with u2netp (lightweight 4MB model, instant download & execution)
session = rembg.new_session("u2netp")
output_bytes = rembg.remove(input_bytes, session=session)
fg_img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")

# 3. Trim transparent borders to get bounding box of the isolated item
bbox = fg_img.getbbox()
if bbox:
    fg_img = fg_img.crop(bbox)

# 4. Create Studio Canvas 750x750 Pure White (#FFFFFF)
canvas_size = 750
canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))

# 5. Fit foreground onto canvas with ~10% margin for luxury catalog presentation
target_w = int(canvas_size * 0.82)
target_h = int(canvas_size * 0.82)
scale = min(target_w / fg_img.width, target_h / fg_img.height)
new_w = int(fg_img.width * scale)
new_h = int(fg_img.height * scale)
fg_resized = fg_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Position centered horizontally, slightly centered-low vertically
pos_x = (canvas_size - new_w) // 2
pos_y = (canvas_size - new_h) // 2 + 10

# 6. Subtle soft studio contact shadow
shadow = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
# Create shadow from alpha channel
shadow_alpha = fg_resized.split()[-1]
shadow_layer = Image.new("RGBA", (new_w, new_h), (30, 30, 30, 40))
shadow_layer.putalpha(shadow_alpha)
shadow.paste(shadow_layer, (pos_x, pos_y + 12), shadow_layer)
shadow = shadow.filter(ImageFilter.GaussianBlur(14))

# Composite shadow onto canvas
canvas = Image.alpha_composite(canvas, shadow)

# Paste the crystal clear shoe
canvas.paste(fg_resized, (pos_x, pos_y), fg_resized)

# Convert to RGB (pure #ffffff background)
final_img = canvas.convert("RGB")

# Enhance clarity and detail slightly
enhancer = ImageEnhance.Sharpness(final_img)
final_img = enhancer.enhance(1.25)
color_enhancer = ImageEnhance.Color(final_img)
final_img = color_enhancer.enhance(1.05)

# Save as JPEG with quality 80 to ensure ~35-45 KB featherweight size
out_io = io.BytesIO()
final_img.save(out_io, format="JPEG", quality=80, optimize=True)
jpeg_data = out_io.getvalue()
size_kb = len(jpeg_data) / 1024
print(f"Finished cutout! Output size: {size_kb:.1f} KB")

# Save locally to check
final_img.save("processed_studio_shoe.jpg", "JPEG", quality=80, optimize=True)

# Build dataUrl
b64 = base64.b64encode(jpeg_data).decode("utf-8")
data_url = f"data:image/jpeg;base64,{b64}"

# 7. Update Firebase
key = "albacos alfredo cool vestes___albacost___albacos alfredo___Gris"
base_key = "albacos alfredo cool vestes___albacost___albacos alfredo"

encoded_key = urllib.parse.quote(key)
url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos/{encoded_key}.json"

req = urllib.request.Request(
    url,
    data=json.dumps(data_url).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="PUT"
)
with urllib.request.urlopen(req) as resp:
    print("Updated specific photo in Firebase:", resp.status)

# Also update base key if not set
encoded_base = urllib.parse.quote(base_key)
url_base = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos/{encoded_base}.json"
req_base = urllib.request.Request(
    url_base,
    data=json.dumps(data_url).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="PUT"
)
with urllib.request.urlopen(req_base) as resp:
    print("Updated base photo in Firebase:", resp.status)

# Also update matching products
products_url = "https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json"
req_prod = urllib.request.Request(products_url)
with urllib.request.urlopen(req_prod) as resp:
    products = json.loads(resp.read().decode("utf-8"))

if isinstance(products, dict):
    for pid, p in products.items():
        if not p: continue
        title = (p.get("title") or "").strip().lower()
        cat = (p.get("category") or "").strip().lower()
        if "albacos" in title or "alfredo" in title or "albacos" in cat:
            print(f"Updating product {pid}: {p.get('title')} ({p.get('color')})")
            patch_url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/products/{pid}.json"
            p_req = urllib.request.Request(
                patch_url,
                data=json.dumps({"imageUrl": data_url, "photo": data_url}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="PATCH"
            )
            with urllib.request.urlopen(p_req) as pr:
                print(f"Patched product {pid}: {pr.status}")

print("All done successfully!")
