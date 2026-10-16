#!/usr/bin/env python3
"""Exact in-memory credential and private-PEM checks; never prints secret values."""
import argparse, datetime, json, os, pathlib, re, subprocess, zipfile
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
if not re.fullmatch(r'data/r37_[a-z0-9_]+\.json',args.output):raise SystemExit('Output must be an R37 data JSON file')
root=pathlib.Path.cwd();values=set();coverage={}
def add(value):
    if isinstance(value,str):value=value.encode()
    if value and len(value)>=16:values.add(value)
for key,value in os.environ.items():
    if any(label in key.upper() for label in ('TOKEN','SECRET','PASSWORD','API_KEY','PRIVATE_KEY')):add(value)
if (root/'.env').exists():
    for line in (root/'.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key,value=line.split('=',1)
            if any(label in key.upper() for label in ('TOKEN','SECRET','PASSWORD','API_KEY','PRIVATE_KEY')):add(value.strip().strip('\"\''))
coverage['environment_values']=bool(values)
try:add(subprocess.run(['gh','auth','token'],capture_output=True,check=True).stdout.strip());coverage['github_auth']=True
except subprocess.SubprocessError:coverage['github_auth']=False
keys=[('offline_signer',root/'keys/license-private.pem'),('google_service_account',pathlib.Path.home()/'.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json')]
for label,path in keys:
    if path.exists():
        value=json.loads(path.read_text())['private_key'] if path.suffix=='.json' else path.read_text()
        add(value.strip());add(json.dumps(value)[1:-1]);add(''.join(line for line in value.splitlines() if not line.startswith('-----')));coverage[label]=True
    else:coverage[label]=False
private_pem=re.compile(br'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
def matches(data):return any(value in data for value in values) or bool(private_pem.search(data))
assert values and matches(b'known-bad-control:'+next(iter(values))) and not matches(b'ordinary static public content')
files=subprocess.run(['git','ls-files','--cached','--others','--exclude-standard','-z'],capture_output=True,check=True).stdout.split(b'\0');hits=[];count=0
for raw in set(files):
    if not raw:continue
    path=pathlib.Path(os.fsdecode(raw))
    if path.is_file():
        count+=1
        if matches(path.read_bytes()):hits.append(str(path))
archives=[]
for name in ('duplicate-invoice-check','three-way-match','office-suite'):
    path=root/'bundles'/(name+'.mcpb');members=0
    with zipfile.ZipFile(path) as archive:
        for entry in archive.infolist():
            if not entry.is_dir():
                members+=1
                if matches(archive.read(entry)):hits.append(str(path.relative_to(root))+'::'+entry.filename)
    archives.append({'archive':str(path.relative_to(root)),'members_scanned':members})
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files_scanned':count,'known_values_checked':len(values),'coverage':coverage,'matching_paths':hits,'archives':archives,'known_bad_and_clean_controls':True,'private_values_or_fingerprints_printed':False,'scope':'Exact available in-memory credentials/signers, escaped private keys and generic private PEMs. Earlier pre-cleanup proof retains deleted private probe-value coverage.'}
pathlib.Path(args.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if hits or not all(coverage.values()):raise SystemExit(1)
