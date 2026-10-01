import re

def extract_images():
    with open(r"d:\Projects\MedSphere Al\Data\doctor_registry_raw.txt", "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    for i, line in enumerate(lines):
        if "Image URL" in line:
            print(f"Line {i}: {lines[i+1].strip()}")
            
if __name__ == "__main__":
    extract_images()
