import urllib.request
import re
import os

# 1. Collect all avatar_urls from the TS file
ts_file = r"d:\Projects\MedSphere Al\src\data\popularDiagnosticRajshahi.ts"
with open(ts_file, "r", encoding="utf-8") as f:
    ts_content = f.read()

img_urls = re.findall(r"avatar_url:\s*'(https://img\.sasthyaseba\.com[^']+)'", ts_content)
print(f"Found {len(img_urls)} avatar URLs in TS file.")

# 2. Create output dir
out_dir = r"d:\Projects\MedSphere Al\public\doctors"
os.makedirs(out_dir, exist_ok=True)

# 3. Download each image
for url in img_urls:
    slug = url.split('/')[-1].replace('.webp', '.jpg')  # save as jpg for broader compat
    out_path = os.path.join(out_dir, slug)
    if os.path.exists(out_path):
        print(f"Already exists: {slug}")
        continue
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://sasthyaseba.com/',
        })
        data = urllib.request.urlopen(req, timeout=10).read()
        with open(out_path, 'wb') as f:
            f.write(data)
        print(f"Downloaded: {slug} ({len(data)} bytes)")
    except Exception as e:
        print(f"FAILED: {url} — {e}")

# 4. Now rewrite avatar_url in TS file to use local paths
def url_to_local(url):
    slug = url.split('/')[-1].replace('.webp', '.jpg')
    return f"/doctors/{slug}"

new_content = re.sub(
    r"avatar_url:\s*'(https://img\.sasthyaseba\.com[^']+)'",
    lambda m: f"avatar_url: '{url_to_local(m.group(1))}'",
    ts_content
)

with open(ts_file, "w", encoding="utf-8") as f:
    f.write(new_content)

print("\nTS file updated with local paths.")
print("Done!")
