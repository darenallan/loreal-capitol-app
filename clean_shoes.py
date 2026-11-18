from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

img = Image.open('shoes_isolated_rembg.png').convert('RGBA')
arr = np.array(img)

r = arr[:, :, 0].astype(int)
g = arr[:, :, 1].astype(int)
b = arr[:, :, 2].astype(int)
a = arr[:, :, 3].astype(int)

# Identify blue box / non-shoe pixels:
# 1. Any pixel where blue is dominant or near-dominant over red:
# In cognac leather shoes, R is much higher than B (e.g., R - B >= 25 or R > 1.2 * B).
# The blue box has B >= R or B > G or (R < 70 and G < 70 and B < 110).
# Also below y > 230 on the bottom edges.
is_blue_box = (
    (b >= r) | 
    ((b > g) & (b > 40)) | 
    ((r < 80) & (b > 50)) |
    ((r < 60) & (g < 60) & (b < 75))
)

# Apply mask only where alpha > 0
# Let's also keep the shoe welt/sole if it's leather/dark brown, but not the blue box.
# For sole welt: R is typically slightly higher than B, or very dark brown.
# If it's pure blue/grey box, it's removed.
mask_out = is_blue_box & (a > 0)

# Set alpha to 0 for blue box pixels
arr[mask_out, 3] = 0

# Also check for small isolated noise or white bottom artifacts
# Anything below the lowest shoe sole (around y > 260 if R < 90)
h, w = arr.shape[:2]
for y in range(h):
    for x in range(w):
        if arr[y, x, 3] > 0:
            cr, cg, cb = arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]
            # If it's dark navy or black box below the left heel (e.g. x between 200 and 320, y > 140)
            if (cb > cr and cb > 30) or (cb > cg and cb > 35):
                arr[y, x, 3] = 0
            # Bottom white/grey remnants
            if y > 250 and cr > 200 and cg > 200 and cb > 200:
                arr[y, x, 3] = 0

cleaned_img = Image.fromarray(arr, mode='RGBA')

# Crop to bounding box of the isolated shoes
bbox = cleaned_img.getbbox()
if bbox:
    cleaned_img = cleaned_img.crop(bbox)

# Create 750x750 Pure White Studio Cyclorama
canvas_size = 750
canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))

# Fit shoes with luxury margins (~12% margin)
target_w = int(canvas_size * 0.84)
target_h = int(canvas_size * 0.65)
scale = min(target_w / cleaned_img.width, target_h / cleaned_img.height)
new_w = int(cleaned_img.width * scale)
new_h = int(cleaned_img.height * scale)

shoes_scaled = cleaned_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Position centered
pos_x = (canvas_size - new_w) // 2
pos_y = (canvas_size - new_h) // 2 + 10

# Create soft studio floor contact shadow
shadow_canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
shoe_alpha = shoes_scaled.split()[-1]
shadow_elem = Image.new("RGBA", (new_w, new_h), (25, 25, 25, 38))
shadow_elem.putalpha(shoe_alpha)

# Slight perspective squash for realistic floor shadow
shadow_elem_sq = shadow_elem.resize((new_w, max(10, int(new_h * 0.35))), Image.Resampling.BILINEAR)
shadow_pos_y = pos_y + new_h - int(new_h * 0.22)
shadow_canvas.paste(shadow_elem_sq, (pos_x, shadow_pos_y), shadow_elem_sq)
shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(16))

# Composite shadow
canvas = Image.alpha_composite(canvas, shadow_canvas)

# Paste the shoes
canvas.paste(shoes_scaled, (pos_x, pos_y), shoes_scaled)

# Convert to RGB (pure white #ffffff background)
final_shoe = canvas.convert("RGB")

# Enhance clarity and details
enhancer = ImageEnhance.Sharpness(final_shoe)
final_shoe = enhancer.enhance(1.2)

final_shoe.save("berwick_shoes_pure_white.jpg", "JPEG", quality=82, optimize=True)
print("Saved berwick_shoes_pure_white.jpg successfully!")
