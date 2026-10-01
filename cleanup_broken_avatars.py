import os
import re

# 1. Delete all corrupt downloaded images
folder = r"d:\Projects\MedSphere Al\public\doctors"
if os.path.exists(folder):
    for fname in os.listdir(folder):
        fpath = os.path.join(folder, fname)
        os.remove(fpath)
        print(f"Deleted: {fname}")
    os.rmdir(folder)
    print("Removed /public/doctors folder")

# 2. Remove all avatar_url from the TS file
ts_file = r"d:\Projects\MedSphere Al\src\data\popularDiagnosticRajshahi.ts"
with open(ts_file, "r", encoding="utf-8") as f:
    content = f.read()

cleaned = re.sub(r"\s*avatar_url:\s*'[^']*',", "", content)

with open(ts_file, "w", encoding="utf-8") as f:
    f.write(cleaned)

remaining = re.findall(r"avatar_url", cleaned)
print(f"\nTS file cleaned. Remaining avatar_url occurrences: {len(remaining)}")
print("Done.")
