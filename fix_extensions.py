import os
import re

folder = r"d:\Projects\MedSphere Al\public\doctors"
ts_file = r"d:\Projects\MedSphere Al\src\data\popularDiagnosticRajshahi.ts"

# Rename .jpg to .webp
for fname in os.listdir(folder):
    if fname.endswith(".jpg"):
        old = os.path.join(folder, fname)
        new = os.path.join(folder, fname.replace(".jpg", ".webp"))
        os.rename(old, new)
        print(f"Renamed: {fname} -> {fname.replace('.jpg', '.webp')}")

# Update TS file - replace .jpg with .webp inside avatar_url fields only
with open(ts_file, "r", encoding="utf-8") as f:
    content = f.read()

updated = re.sub(
    r"(avatar_url:\s*'/doctors/[^']+)\.jpg'",
    r"\1.webp'",
    content
)

with open(ts_file, "w", encoding="utf-8") as f:
    f.write(updated)

# Verify
found = re.findall(r"avatar_url:\s*'(/doctors/[^']+)'", updated)
print(f"\nTS file updated. {len(found)} avatar paths now use .webp:")
for p in found:
    print(f"  {p}")
