import os
import re

def process_file(source_file, comment_prefix):
    with open(source_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    current_filepath = None
    current_content = []
    
    file_pattern = re.compile(r'^' + re.escape(comment_prefix) + r'\s+([\w\.\/\-]+)\s*.*$')
    
    for i, line in enumerate(lines):
        is_filename_line = False
        if i > 0 and (lines[i-1].startswith(comment_prefix + ' ===') or lines[i-1].startswith(comment_prefix + ' ---')):
            match = file_pattern.match(line)
            if match:
                filename = match.group(1).strip()
                if filename.endswith('.json') or filename.endswith('.ts') or filename.endswith('.tsx') or filename.endswith('.js') or filename.endswith('.html') or filename.endswith('.css') or filename.endswith('.sql') or filename.endswith('.toml') or filename.endswith('.example') or filename.startswith('public/') or filename.startswith('src/'):
                    
                    if current_filepath:
                        save_file(current_filepath, current_content, comment_prefix)
                    
                    if filename.endswith('.sql') and not filename.startswith('supabase/'):
                        current_filepath = f"supabase/migrations/{filename}"
                    else:
                        current_filepath = filename
                    current_content = []
                    is_filename_line = True
        
        if not is_filename_line and current_filepath is not None:
            if source_file == 'medsphere-config.ts':
                if line.startswith('// '):
                    current_content.append(line[3:])
                elif line.startswith('//\n'):
                    current_content.append('\n')
                elif line == '//\n' or line == '//':
                    current_content.append('\n')
                else:
                    current_content.append(line)
            else:
                current_content.append(line)

    if current_filepath:
        save_file(current_filepath, current_content, comment_prefix)

def save_file(filepath, lines, comment_prefix):
    cleaned = []
    for line in lines:
        if line.startswith(comment_prefix + ' ===') or line.startswith(comment_prefix + ' ---'):
            continue
        if line.startswith('===') or line.startswith('---'):
            continue
        cleaned.append(line)
    
    while cleaned and cleaned[0].strip() == '':
        cleaned.pop(0)
    while cleaned and cleaned[-1].strip() == '':
        cleaned.pop(-1)
        
    if not cleaned:
        return
        
    os.makedirs(os.path.dirname(filepath) or '.', exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(cleaned)
    print(f"Extracted: {filepath}")

if __name__ == "__main__":
    files_to_process = [
        ('medsphere-config.ts', '//'),
        ('medsphere-core.txt', '//'),
        ('medsphere-database.sql', '--'),
        ('medsphere-types.txt', '//'),
        ('medsphere-ui.txt', '//'),
        ('medsphere-pages.txt', '//')
    ]
    
    for filename, prefix in files_to_process:
        if os.path.exists(filename):
            print(f"Processing {filename}...")
            process_file(filename, prefix)
