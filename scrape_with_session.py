import urllib.request
import urllib.parse
import http.cookiejar
import re
import os
import time

# Use a cookie jar + opener to simulate a real browser session
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [
    ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'),
    ('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'),
    ('Accept-Language', 'en-US,en;q=0.9'),
    ('Accept-Encoding', 'gzip, deflate, br'),
    ('Connection', 'keep-alive'),
    ('Upgrade-Insecure-Requests', '1'),
    ('Sec-Fetch-Dest', 'document'),
    ('Sec-Fetch-Mode', 'navigate'),
    ('Sec-Fetch-Site', 'none'),
    ('Cache-Control', 'max-age=0'),
]

print("Step 1: Visiting main site to establish session...")
try:
    resp = opener.open('https://sasthyaseba.com/', timeout=15)
    resp.read()
    print(f"  Main site OK. Cookies: {len(list(cj))}")
except Exception as e:
    print(f"  Warning: {e}")

time.sleep(1)

# Now fetch image pages to collect all URLs
print("\nStep 2: Collecting doctor image URLs from all speciality pages...")

specialities = [
    "Cardiologist", "Dermatologist", "Endocrinologist", "Gastroenterologist",
    "Gynecologist+%26+Obstetrician", "Hematologist", "Nephrologist", "Neurologist",
    "Neurosurgeon", "Oncologist", "Orthopedic+Surgeon", "Otolaryngologist",
    "Pediatrician+%26+Neonatologist", "Physical+Medicine", "Respiratory+Specialist",
    "Surgeon", "Urologist", "Hepatologist", "Neuromedicine+Specialist"
]

all_doctor_images = {}  # slug -> url

for spec in specialities:
    url = f"https://sasthyaseba.com/hospitals/popular-diagnostic-centre-ltd-rajshahi/doctors?speciality={spec}"
    try:
        opener.addheaders = [h for h in opener.addheaders if h[0] != 'Referer']
        opener.addheaders.append(('Referer', 'https://sasthyaseba.com/'))
        resp = opener.open(url, timeout=15)
        html = resp.read().decode('utf-8', errors='replace')
        
        # Find all doctor image src attributes
        imgs = re.findall(
            r'<img[^>]+src=["\'](https://img\.sasthyaseba\.com/[^"\']+/doctors/\d+/[^"\']+\.webp)["\']',
            html
        )
        
        for img_url in imgs:
            slug = img_url.split('/')[-1]
            # Pick the largest-size variant (longest token)
            if slug not in all_doctor_images:
                all_doctor_images[slug] = img_url
            else:
                # Keep the variant that has most specific token (longer URL)
                pass
        
        print(f"  {spec}: {len(imgs)} images found (total unique: {len(all_doctor_images)})")
        time.sleep(0.5)
    except Exception as e:
        print(f"  {spec}: ERROR - {e}")

print(f"\nTotal unique doctor images: {len(all_doctor_images)}")

# Now download images using the session with Referer header
out_dir = r"d:\Projects\MedSphere Al\public\doctors"
os.makedirs(out_dir, exist_ok=True)

downloaded = 0
failed = 0

for slug, img_url in all_doctor_images.items():
    out_path = os.path.join(out_dir, slug)
    
    try:
        img_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        img_opener.addheaders = [
            ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'),
            ('Accept', 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'),
            ('Accept-Language', 'en-US,en;q=0.9'),
            ('Referer', 'https://sasthyaseba.com/hospitals/popular-diagnostic-centre-ltd-rajshahi/doctors'),
            ('Sec-Fetch-Dest', 'image'),
            ('Sec-Fetch-Mode', 'no-cors'),
            ('Sec-Fetch-Site', 'cross-site'),
        ]
        
        resp = img_opener.open(img_url, timeout=15)
        data = resp.read()
        
        # Validate: real WebP images have VP8, VP8L, or VP8X chunk
        if b'VP8 ' in data[:200] or b'VP8L' in data[:200] or b'VP8X' in data[:200]:
            # Check dimensions aren't 9259 (error page)
            idx = data.find(b'VP8 ')
            is_error_page = False
            if idx != -1:
                import struct
                bs = data[idx+8+3:]
                if len(bs) >= 4:
                    h = (struct.unpack('<H', bs[2:4])[0] & 0x3FFF) + 1
                    if h > 5000:
                        is_error_page = True
            
            if is_error_page:
                print(f"  SKIP (error page): {slug}")
                failed += 1
            else:
                with open(out_path, 'wb') as f:
                    f.write(data)
                downloaded += 1
                print(f"  OK: {slug} ({len(data)} bytes)")
        else:
            print(f"  SKIP (not WebP): {slug} ({len(data)} bytes)")
            failed += 1
    except Exception as e:
        print(f"  FAIL: {slug} - {e}")
        failed += 1
    
    time.sleep(0.3)

print(f"\nDownloaded: {downloaded}, Failed/Skipped: {failed}")

# List what we got
if downloaded > 0:
    print("\nSuccessfully downloaded:")
    for f in os.listdir(out_dir):
        sz = os.path.getsize(os.path.join(out_dir, f))
        print(f"  {f} ({sz}b)")
