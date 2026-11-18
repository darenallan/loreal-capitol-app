from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
import numpy as np
import io, base64, urllib.request, json

# Load the cutout
img = Image.open('shoes_isolated_rembg.png').convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]

# Clean up any non-shoe pixels:
# 1. Navy blue box between shoes and at bottom
for y in range(h):
    for x in range(w):
        if arr[y, x, 3] > 0:
            r, g, b = int(arr[y, x, 0]), int(arr[y, x, 1]), int(arr[y, x, 2])
            # Navy box
            if r < 75 and (b >= r or (r < 50 and g < 50)):
                arr[y, x, 3] = 0
            # Isolated white halos at the perimeter/bottom
            if y > 220 and r > 215 and g > 215 and b > 215:
                arr[y, x, 3] = 0

# Clean mask
cleaned = Image.fromarray(arr, 'RGBA')

# Trim transparent pixels
bbox = cleaned.getbbox()
if bbox:
    # Expand slightly or crop
    cleaned = cleaned.crop(bbox)

# Target studio canvas: 750x750 pure white
canvas_size = 750
canvas = Image.new('RGBA', (canvas_size, canvas_size), (255, 255, 255, 255))

# Fit nicely with ~12% padding
max_w = int(canvas_size * 0.85)
max_h = int(canvas_size * 0.70)
scale = min(max_w / cleaned.width, max_h / cleaned.height)
new_w = int(cleaned.width * scale)
new_h = int(cleaned.height * scale)

shoes_resized = cleaned.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Position centered
pos_x = (canvas_size - new_w) // 2
pos_y = (canvas_size - new_h) // 2 + 10

# Create elegant luxury studio contact shadow (like Image 2 / Asphalte)
shadow = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
shoe_mask = shoes_resized.split()[-1]
shadow_layer = Image.new('RGBA', (new_w, new_h), (35, 35, 40, 45))
shadow_layer.putalpha(shoe_mask)

# Squash vertically to simulate light from above-front casting shadow on white floor
shadow_squashed = shadow_layer.resize((new_w, max(15, int(new_h * 0.30))), Image.Resampling.BILINEAR)
shadow_y = pos_y + new_h - int(new_h * 0.20)
shadow.paste(shadow_squashed, (pos_x, shadow_y), shadow_squashed)
shadow = shadow.filter(ImageFilter.GaussianBlur(14))

# Composite shadow then shoes onto pure white canvas
canvas = Image.alpha_composite(canvas, shadow)
canvas.paste(shoes_resized, (pos_x, pos_y), shoes_resized)

# Convert to RGB (pure #ffffff background)
final_catalog_img = canvas.convert('RGB')

# High-clarity polish ("l'image est tres bien claire")
enhancer = ImageEnhance.Sharpness(final_catalog_img)
final_catalog_img = enhancer.enhance(1.22)
color_enhancer = ImageEnhance.Color(final_catalog_img)
final_catalog_img = color_enhancer.enhance(1.04)

# Save as optimized JPEG
out_buffer = io.BytesIO()
final_catalog_img.save(out_buffer, format='JPEG', quality=82, optimize=True)
jpeg_bytes = out_buffer.getvalue()
size_kb = len(jpeg_bytes) / 1024
print(f"Final Studio Image created! Size: {size_kb:.1f} KB (protecting Firebase)")

final_catalog_img.save('final_berwick_studio.jpg', 'JPEG', quality=82, optimize=True)

# Generate dataUrl
b64_str = base64.b64encode(jpeg_bytes).decode('utf-8')
data_url = f"data:image/jpeg;base64,{b64_str}"

# Update Firebase for the shoe keys!
keys_to_update = [
    "albacos alfredo cool vestes___albacost___alfredo___Gris",
    "albacos alfredo cool vestes___albacost___alfredo",
    "albacos alfredo cool vestes___albacost___albacos alfredo___Gris",
    "albacos alfredo cool vestes___albacost___albacos alfredo"
]

for k in keys_to_update:
    enc_k = urllib.parse.quote(k)
    url = f"https://l-oreal-capitol-default-rtdb.firebaseio.com/model_photos/{enc_k}.json"
    req = urllib.request.Request(url, data=json.dumps(data_url).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='PUT')
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Updated model_photos[{k}]: {resp.status}")
    except Exception as e:
        print(f"Error updating {k}: {e}")

# Update products matching Albacost Alfredo
prod_url = "https://l-oreal-capitol-default-rtdb.firebaseio.com/products.json"
req_p = urllib.request.Request(prod_url)
with urllib.request.urlopen(req_p) as resp:
    prods = json.loads(resp.read().decode('utf-8'))

if isinstance(prods, dict):
    for pid, p in prods.items():
        if not p: continue
        title = (p.get("title") or "").strip().lower()
        color = (p.get("color") or "").strip().lower()
        cat = (p.get("category") or "").strip().lower()
        if ("albacos" in title or "alfredo" in title or "albacos" in cat) and ("gris" in color or "gris" in title):
            print(f"Updating product {pid}: {p.get('title')} ({p.get('color')})")
            patch_req = urllib.request.Request(
                f"https://l-oreal-capitol-default-rtdb.firebaseio.com/products/{pid}.json",
                data=json.dumps({"imageUrl": data_url, "photo": data_url}).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='PATCH'
            )
            with urllib.request.urlopen(patch_req) as pr:
                print(f"Patched {pid}: {pr.status}")

print("Firebase successfully updated with studio white photo!")
