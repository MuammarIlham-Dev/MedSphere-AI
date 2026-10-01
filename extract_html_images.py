import re

def extract_images():
    file_path = r"C:\Users\Lenovo\.gemini\antigravity-ide\brain\4ac49890-c1e6-4581-9cee-386327ca488d\.system_generated\steps\164\content.md"
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract src from img tags
    img_urls = re.findall(r'<img[^>]+src=["\'](.*?)["\']', content)
    
    # Deduplicate and filter out obvious non-profile images
    unique_urls = set(img_urls)
    
    for url in sorted(unique_urls):
        if url.startswith('/'):
            print(f"URL: {url}")
        elif 'cdn' in url or 'img' in url:
            print(f"URL: {url}")
            
if __name__ == "__main__":
    extract_images()
