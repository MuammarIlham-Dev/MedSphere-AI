import urllib.request
import re
import os

ts_file = r"d:\Projects\MedSphere Al\src\data\popularDiagnosticRajshahi.ts"
with open(ts_file, "r", encoding="utf-8") as f:
    ts_content = f.read()

# Remove ALL existing avatar_url fields first
ts_clean = re.sub(r"\s*avatar_url:\s*'[^']*',", "", ts_content)

# Known verified mappings: {doctor name fragment: local path}
# Only include confirmed unique matches
VERIFIED_MAPPINGS = {
    "Md. Rais Uddin Mondol":        "/doctors/assoc-prof-dr-md-rais-uddin-mondol.jpg",
    "Molla Md. Iftekhar Hossain":   "/doctors/asst-prof-dr-dr-molla-md-iftekhar-hossain.jpg",
    "Rajesh Kumar Ghosh":           "/doctors/dr-rajesh-kumar-ghosh.jpg",
    "Rakibul Hasan Rashed":         "/doctors/dr-rakibul-hasan-rashed.jpg",
    "Julekha Khatun":               "/doctors/dr-julekha-khatun.jpg",
    "Mousumi Marjiara":             "/doctors/dr-mousumi-marjiara.jpg",
    "Samir Majumder":               "/doctors/prof-dr-samir-majumder.jpg",
    "Md. Ariful Alam Suman":        "/doctors/assoc-prof-dr-md-ariful-alam-suman.jpg",
    "Rupsha Nure Laila":            "/doctors/asst-prof-dr-rupsha-nure-laila.jpg",
    "Sm Golam Moula":               "/doctors/dr-sm-golam-moula.jpg",
    "S.M. Golam Moula":             "/doctors/dr-sm-golam-moula.jpg",
    "Rezaul Islam":                 "/doctors/asst-prof-dr-rezaul-islam.jpg",
    "Md. Mashiur Arefin Rubel":     "/doctors/asst-prof-dr-md-mashiur-arefin-rubel.jpg",
    "Md. Tafiqul Islam Taufiq":     "/doctors/asst-prof-dr-md-tafiqul-islam-taufiq.jpg",
    "Md. Abul Kashem Sarker":       "/doctors/prof-dr-md-abul-kashem-sarker.jpg",
}

# Now inject only verified mappings
def inject(content):
    for name, path in VERIFIED_MAPPINGS.items():
        # Find the exact doctor object by name field
        pattern = rf"(name:\s*'{re.escape(name)}',\s*designation:\s*'[^']+',)"
        replacement = rf"\1 avatar_url: '{path}',"
        content = re.sub(pattern, replacement, content)
    return content

ts_updated = inject(ts_clean)

# Verify
found = re.findall(r"avatar_url:\s*'(/doctors/[^']+)'", ts_updated)
print(f"Injected {len(found)} verified avatar URLs.")
for f in found:
    print(f"  {f}")

with open(ts_file, "w", encoding="utf-8") as f:
    f.write(ts_updated)

print("\nDone! TS file saved.")
