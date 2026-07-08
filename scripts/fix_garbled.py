import re

f = r'd:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\frontend\src\features\admin\AdminDashboardPage.premium.tsx'
content = open(f, 'r', encoding='utf-8').read()

# Remove all non-ASCII chars that appear in JSX text content (not in comments)
# Strategy: find all garbled patterns and replace with clean alternatives

# 1. Remove Â prefix (UTF-8 double-encoding artifact)
content = content.replace('\u00c2\u00b7', ' ')  # Â· → space (middle dot)
content = content.replace('\u00c2\u00ab', '')    # Â«
content = content.replace('\u00c2\u00bb', '')    # Â»
content = content.replace('\u00c2\u00ae', '')    # Â®
content = content.replace('\u00c2\u00bc', '')    # Â¼
content = content.replace('\u00c2\u00a2', '')    # Â¢
content = content.replace('\u00c2\u00bf', '')    # Â¿
content = content.replace('\u00c2\u00ba', '')    # Âº
content = content.replace('\u00c2\u00a7', '')    # Â§
content = content.replace('\u00c2\u00b6', '')    # Â¶

# 2. Fix Ã sequences (garbled accented chars used as icons)
content = content.replace('\u00c3\u0084', '')    # Ä → remove (was notepad emoji)
content = content.replace('\u00c3\u201c', '')    # Ã" → remove
content = content.replace('\u00c3\u2019', '')    # Ã' → remove
content = content.replace('\u00c3\u0192', '')    # Ãƒ → remove

# 3. Fix ┬ sequences  
content = re.sub(r'\u252c[\u0080-\u00ff\u0100-\u024f]', ' ', content)

# 4. Fix │ and ║ (box drawing used as separators)
content = content.replace('\u2502', '|')
content = content.replace('\u2551', '|')
content = content.replace('\u2500', '-')
content = content.replace('\u2550', '-')

# 5. Remove any remaining lone Â not part of a word
content = re.sub(r'(?<=[>\s\'"`{])[\u00c2\u00c3](?=[\u0080-\u00bf\u00c0-\u00ff])', '', content)

# 6. Clean up double spaces left behind
content = re.sub(r'  +', ' ', content)

# 7. Fix specific known garbled strings that might remain
content = content.replace(' completions', ' completions')
content = content.replace(' HW', ' HW')
content = content.replace(' notes', ' notes')
content = content.replace(' msgs', ' msgs')

open(f, 'w', encoding='utf-8').write(content)
print(f'Done - file cleaned ({len(content)} chars)')
