import os, re

for root, _, files in os.walk('src'):
    for file in files:
        if not (file.endswith('.ts') or file.endswith('.tsx')):
            continue
        path = os.path.join(root, file)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # We find all import lines
        lines = content.split('\n')
        new_lines = []
        base = os.path.splitext(file)[0]
        
        for line in lines:
            if line.startswith('import ') and '{' in line:
                # check if self-import
                match = re.search(r'import\s+\{([^}]+)\}\s+from\s+[\'"](.*?)[\'"]', line)
                if match:
                    imports = [i.strip() for i in match.group(1).split(',')]
                    
                    remove = False
                    for i in imports:
                        if i == base:
                            remove = True
                        if file == 'KpiCard.tsx' and i in ('Skeleton', 'EmptyState', 'PageHeader', 'KpiCard'): remove = True
                        if file == 'Input.tsx' and i in ('Select', 'Input'): remove = True
                        if file == 'Card.tsx' and i in ('CardHeader', 'Card'): remove = True
                        if file == 'api.ts' and i in ('ApiError', 'unwrap'): remove = True
                        if file == 'utils.ts' and i in ('formatTime', 'formatDate', 'formatDateTime', 'cn'): remove = True
                        if file == 'ToastHost.tsx' and i in ('ThemeToggle', 'ToastHost'): remove = True
                        if file == 'authStore.ts' and i in ('useAuthStore'): remove = True
                    if remove:
                        continue
            new_lines.append(line)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
