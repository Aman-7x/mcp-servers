import w3lib, sys
for s in sys.argv[1:]:
    w3lib.S(s).call('_license', s, 'license_status', {})
