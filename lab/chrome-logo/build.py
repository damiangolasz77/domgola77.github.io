import json,sys
f=json.load(open(sys.argv[1] if len(sys.argv)>1 else 'field.json'))
f={k:(round(v,6) if isinstance(v,float) else v) for k,v in f.items()}
s=open('chrome-logo.src.js').read().replace('/*FIELD*/null',json.dumps(f,separators=(',',':')))
open('chrome-logo.js','w').write(s)
print(len(s)//1024,'KB')
