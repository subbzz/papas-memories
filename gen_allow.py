import json
s=open('website/memories.js',encoding='utf-8').read()
d=json.loads(s[s.index('{'):s.rstrip().rstrip(';').rindex('}')+1])
keys=sorted(f"{i['folder']}/{i['file']}" for i in d['items'])
open('functions/_lib/allow.js','w',encoding='utf-8').write("// Generated from website/memories.js: the only files the proxy will serve.\nexport const ALLOWED = new Set(" + json.dumps(keys, ensure_ascii=False, indent=1) + ");\n")
print(len(keys),'allowed')
