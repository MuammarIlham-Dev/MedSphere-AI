import os, re

imports_map = {
    'Button': "@/components/ui/Button",
    'Badge': "@/components/ui/Badge",
    'Card': "@/components/ui/Card",
    'CardHeader': "@/components/ui/Card",
    'Input': "@/components/ui/Input",
    'Select': "@/components/ui/Input",
    'Modal': "@/components/ui/Modal",
    'Spinner': "@/components/ui/Spinner",
    'Tabs': "@/components/ui/Tabs",
    'KpiCard': "@/components/ui/KpiCard",
    'Skeleton': "@/components/ui/KpiCard",
    'EmptyState': "@/components/ui/KpiCard",
    'PageHeader': "@/components/ui/KpiCard",
    'PageTransition': "@/components/transitions/PageTransition",
    'cn': "@/lib/utils",
    'formatTime': "@/lib/utils",
    'formatDate': "@/lib/utils",
    'formatDateTime': "@/lib/utils",
    'supabase': "@/lib/supabase",
    'unwrap': "@/lib/api",
    'ApiError': "@/lib/api",
    'ChartCard': "@/components/charts/ChartCard",
    'Link': "react-router-dom",
    'ThemeToggle': "@/components/ui/ToastHost",
    'useAuthStore': "@/stores/authStore",
    'useQuery': "@tanstack/react-query"
}

def fix_imports(dir_path):
    for root, _, files in os.walk(dir_path):
        for file in files:
            if not (file.endswith('.ts') or file.endswith('.tsx')):
                continue
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            missing_imports = {}
            for name, imp_path in imports_map.items():
                if re.search(r'\b' + name + r'\b', content):
                    if not re.search(r'import\s+.*?\b' + name + r'\b', content):
                        if imp_path not in missing_imports:
                            missing_imports[imp_path] = []
                        missing_imports[imp_path].append(name)
            
            if missing_imports:
                import_lines = []
                for imp_path, names in missing_imports.items():
                    import_lines.append(f"import {{ {', '.join(names)} }} from '{imp_path}';")
                
                new_content = '\n'.join(import_lines) + '\n' + content
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed imports in {path}")

fix_imports('src')
