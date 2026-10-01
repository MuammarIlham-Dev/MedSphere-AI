import urllib.request
import re
import json
import os

# The CDN uses image transformation tokens in the URL that require Referer headers
# to match their configured allowed origins. We can try fetching each speciality page
# and look for doctor profile data in the JSON-serialized state in the HTML

specialities = [
    "Cardiologist", "Dermatologist", "Endocrinologist", "Gastroenterologist",
    "Gynecologist", "Hematologist", "Nephrologist", "Neurologist",
    "Neurosurgeon", "Oncologist", "Orthopedic+Surgeon", "Otolaryngologist",
    "Pediatrician", "Physical+Medicine", "Respiratory+Specialist", "Surgeon", "Urologist"
]

all_doctors = {}
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://sasthyaseba.com/',
}

base = "https://sasthyaseba.com/hospitals/popular-diagnostic-centre-ltd-rajshahi/doctors?speciality="

for spec in specialities[:3]:  # Test with first 3
    url = base + spec
    req = urllib.request.Request(url, headers=headers)
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
        # Find all doctor image URLs - they're in JSON state embedded in the HTML
        # Look for the pattern used in this Qwik framework
        imgs = re.findall(r'https://img\.sasthyaseba\.com/[A-Za-z0-9]+/doctors/\d+/[A-Za-z0-9]+/[^"\\s\']+', html)
        print(f"\n{spec}: found {len(imgs)} images")
        for img in set(imgs):
            print(f"  {img}")
    except Exception as e:
        print(f"Error {spec}: {e}")

print("\nDone checking")
