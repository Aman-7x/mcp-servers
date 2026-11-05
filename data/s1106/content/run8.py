import w3lib
S = w3lib.S
a = S('asset-register')
a.call('calculate-depreciation', 0, 'asset_add', {'name': 'MacBook Pro 16', 'scheme': 'us', 'category': '5-year', 'cost_minor': 349900, 'currency': 'USD', 'purchase_date': '2026-03-10'})
a.call('calculate-depreciation', 1, 'asset_schedule', {'asset': 'MacBook Pro 16'})
a.call('calculate-depreciation', 2, 'asset_schedule', {'scheme': 'us', 'category': '7-year', 'cost_minor': 1200000, 'currency': 'USD', 'purchase_date': '2026-06-01'})
