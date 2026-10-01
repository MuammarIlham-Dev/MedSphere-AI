import urllib.request
import re
import difflib

# 1. Get all unique source URLs from the raw text
with open(r"d:\Projects\MedSphere Al\Data\doctor_registry_raw.txt", "r", encoding="utf-8") as f:
    urls = set(line.strip() for line in f if "http" in line and "sasthyaseba.com/hospitals/popular-diagnostic-centre-ltd-rajshahi/doctors" in line)

# 2. Fetch all URLs and extract image URLs
all_image_urls = set()
for i, url in enumerate(urls):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        imgs = re.findall(r'<img[^>]+src=["\'](https://img\.sasthyaseba\.com/[^"\']+/doctors/[^"\']+\.webp)["\']', html)
        all_image_urls.update(imgs)
    except Exception as e:
        pass

# 3. Create slug mapping
slug_map = {}
for img in all_image_urls:
    slug = img.split('/')[-1].replace('.webp', '')
    slug_map[slug] = img

# 4. Read TS file and update
ts_file = r"d:\Projects\MedSphere Al\src\data\popularDiagnosticRajshahi.ts"
with open(ts_file, "r", encoding="utf-8") as f:
    ts_content = f.read()

# 4a. Update the Doctor interface
if "avatar_url?: string;" not in ts_content:
    ts_content = ts_content.replace(
        "designation: 'Prof.' | 'Assoc. Prof.' | 'Asst. Prof.' | 'Dr.';",
        "designation: 'Prof.' | 'Assoc. Prof.' | 'Asst. Prof.' | 'Dr.';\n  avatar_url?: string;"
    )

def get_best_match(name, designation):
    target = f"{designation} {name}".lower().replace('.', '').replace('-', ' ').replace("'", "")
    target_words = set(target.split())
    
    best_slug = None
    best_score = 0
    
    for slug in slug_map.keys():
        slug_words = set(slug.replace('-', ' ').split())
        score = len(target_words.intersection(slug_words))
        if score > best_score:
            best_score = score
            best_slug = slug
            
    if best_score >= 2:
        return slug_map[best_slug]
    return None

# FIND MATCHES
# The structure is: { id: 'd016', number: '016', name: 'Salma Arjumand Banu',          designation: 'Asst. Prof.',
# We can just match the entire object start, or just name and designation
matches = list(re.finditer(r"(name:\s*'([^']+)',\s*designation:\s*'([^']+)',)", ts_content))
print(f"Found {len(matches)} doctors in TS file.")

offset = 0
matched_count = 0
for match in matches:
    name = match.group(2)
    designation = match.group(3)
    img_url = get_best_match(name, designation)
    
    if img_url:
        matched_count += 1
        # Insert right after designation: '...',
        insert_str = f" avatar_url: '{img_url}',"
        insert_pos = match.end() + offset
        ts_content = ts_content[:insert_pos] + insert_str + ts_content[insert_pos:]
        offset += len(insert_str)

with open(ts_file, "w", encoding="utf-8") as f:
    f.write(ts_content)
    
print(f"Updated TS file. Injected {matched_count} image URLs.")
