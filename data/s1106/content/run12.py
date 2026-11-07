import w3lib
S = w3lib.S
S('invoice').call('create-work-orders', 0, 'business_set', {'name': 'Ortiz Refrigeration', 'address': '900 Walnut St, Boulder, CO 80302', 'default_currency': 'USD', 'default_tax_rate': 0, 'payment_terms_days': 14, 'timezone': 'America/Denver'}, False)
