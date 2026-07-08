f = r'd:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\frontend\src\app\parent\page.tsx'
content = open(f, 'r', encoding='utf-8').read()

# Fix stat cards: add overflow-hidden, responsive sizing
content = content.replace(
    'stat-pill rounded-2xl p-4 flex items-center gap-3 cursor-default',
    'stat-pill rounded-2xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 cursor-default overflow-hidden'
)

# Fix the text sizes - responsive
content = content.replace('text-2xl font-black text-emerald-900 leading-none', 'text-lg sm:text-2xl font-black text-emerald-900 leading-none truncate')
content = content.replace('text-2xl font-black text-blue-900 leading-none', 'text-lg sm:text-2xl font-black text-blue-900 leading-none truncate')
content = content.replace('text-2xl font-black text-purple-900 leading-none', 'text-lg sm:text-2xl font-black text-purple-900 leading-none truncate')
content = content.replace('text-2xl font-black text-amber-900 leading-none', 'text-lg sm:text-2xl font-black text-amber-900 leading-none truncate')

# Fix SVG: use viewBox for responsive
content = content.replace('width="48" height="48"', 'width="100%" height="100%" viewBox="0 0 48 48"')

# Fix donut container: responsive size
content = content.replace('flex-shrink-0 w-12 h-12', 'flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12')

open(f, 'w', encoding='utf-8').write(content)
print('Done - stat cards fixed for mobile')
