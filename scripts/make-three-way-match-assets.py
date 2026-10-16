#!/usr/bin/env python3
"""Deterministic diagram assets; no generated artwork or invented runtime screenshot.

Demo frames visualize actual MCP output captured by r36-three-way-match-round.mjs.
The image is an evidence diagram, not a screenshot of a chat client.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
A=ROOT/'assets'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(n): return ImageFont.truetype(FONT,n)
# Source-native product symbol: three documents joining one evidence row.
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" rx="56" fill="#111c30"/><g fill="#e6edf8" stroke="#89a7d1" stroke-width="4"><rect x="42" y="67" width="82" height="122" rx="8"/><rect x="159" y="67" width="82" height="122" rx="8"/><rect x="276" y="67" width="82" height="122" rx="8"/></g><g fill="#182843" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle"><text x="83" y="112">PO</text><text x="200" y="112">GRN</text><text x="317" y="112">INV</text></g><path d="M83 210v26h117v20m0-46v46m117-46v26H200" fill="none" stroke="#8ca8ce" stroke-width="6"/><rect x="70" y="275" width="260" height="60" rx="10" fill="#233d58"/><path d="m99 305 12 12 24-27" fill="none" stroke="#5fe0a3" stroke-width="7"/><text x="224" y="313" fill="#edf3fa" font-family="Arial" font-size="22" text-anchor="middle">SKU evidence</text></svg>'''
(A/'three-way-match-logo.svg').write_text(svg+'\n')
im=Image.new('RGB',(400,400),'#111c30');d=ImageDraw.Draw(im)
for x,label in [(42,'PO'),(159,'GRN'),(276,'INV')]:
 d.rounded_rectangle((x,67,x+82,189),8,fill='#e6edf8',outline='#89a7d1',width=4);d.text((x+41,112),label,font=font(18),fill='#182843',anchor='mm');d.line([(x+41,210),(x+41,236),(200,236),(200,256)],fill='#8ca8ce',width=6)
d.rounded_rectangle((70,275,330,335),10,fill='#233d58');d.line([(99,305),(111,317),(135,290)],fill='#5fe0a3',width=7);d.text((224,305),'SKU evidence',font=font(22),fill='#edf3fa',anchor='mm');im.save(A/'three-way-match-logo.png')
runtime=json.loads((ROOT/'intel/R36-three-way-match-runtime.json').read_text())
report=next(x for x in runtime if x['id']=='twm1')['result']['report']
a=next(x for x in report['lines'] if x['sku']=='A'); b=next(x for x in report['lines'] if x['sku']=='B')
assert 'invoiced_above_accepted' in a['issue_codes'] and 'accepted_above_order' in b['issue_codes']
frames=[]
for active in range(3):
 im=Image.new('RGB',(1000,560),'#111c30');d=ImageDraw.Draw(im)
 d.text((38,30),'Supplier invoice matching by SKU',font=font(32),fill='#f2f6ff')
 d.text((38,78),'Captured MCP stdio fixture | diagram of actual evidence, not a client screenshot',font=font(19),fill='#a8bbd6')
 for x,head,rows in [(38,'Purchase order',['A: 10 units at 100','B: 10 units at 100']),(362,'Accepted receipt',['A: 5 units','B: 15 units']),(686,'Supplier invoice',['A: 10 units at 100','B: 10 units at 100'])]:
  d.rounded_rectangle((x,128,x+276,270),12,fill='#1e304b');d.text((x+16,146),head,font=font(24),fill='#e6edf8')
  for k,row in enumerate(rows): d.text((x+16,191+k*32),row,font=font(20),fill='#bacbe3')
 text=[('All totals agree',f"20 units each; PO and invoice: {report['totals']['invoice_lines_total_minor']} minor units."),('SKU A: billed above accepted',f"{a['invoice_quantity']} billed, {a['accepted_quantity']} accepted: {a['invoice_quantity']-a['accepted_quantity']} unsupported units."),('SKU B: accepted above order',f"{b['accepted_quantity']} accepted, {b['ordered_quantity']} ordered: {b['accepted_quantity']-b['ordered_quantity']} excess units.")][active]
 d.text((38,320),text[0],font=font(30),fill='#70dfb0' if active==0 else '#ffce83');d.text((38,372),text[1],font=font(25),fill='#f2f6ff')
 d.text((38,465),'Totals cannot replace line evidence. No payment approval.',font=font(22),fill='#a8bbd6')
 frames.append(im)
frames[0].save(A/'demo-three-way-match.gif',save_all=True,append_images=frames[1:],duration=[2200,2800,2800],loop=0,optimize=True)
print('Wrote SVG source, 400x400 PNG and 3-frame fixture GIF')
