f = r'd:\Silveroak Juniors Enquiry\SOJ Curriculum\oakit\apps\frontend\src\features\admin\AdminDashboardPage.premium.tsx'
content = open(f, 'r', encoding='utf-8').read()
content = content.replace("'> URGENT'", "'URGENT'")
content = content.replace("'> Inactive'", "'Inactive'")
content = content.replace("'> Never logged in'", "'Never logged in'")
content = content.replace('\u00d4\u00a3\u00f4', '')
content = content.replace('\u00d4\u00a3\u00f9', '')
open(f, 'w', encoding='utf-8').write(content)
print('Done')
