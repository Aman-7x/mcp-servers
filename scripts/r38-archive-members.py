#!/usr/bin/env python3
"""Read every archive byte without creating a large temporary extraction tree."""
import hashlib, json, pathlib, stat, sys, zipfile

archive = pathlib.Path(sys.argv[1]).resolve()
tree = pathlib.Path(sys.argv[2]).resolve()
seen = set()
count = total = links = 0
with zipfile.ZipFile(archive) as zipped:
    bad = zipped.testzip()
    if bad is not None:
        raise ValueError('Archive CRC failed: ' + bad)
    for member in zipped.infolist():
        path = pathlib.PurePosixPath(member.filename)
        if path.is_absolute() or '..' in path.parts or member.filename in seen:
            raise ValueError('Unsafe or duplicate member path')
        seen.add(member.filename)
        if member.is_dir():
            continue
        candidate = tree.joinpath(*path.parts)
        payload = zipped.read(member)
        if stat.S_ISLNK(member.external_attr >> 16):
            if not candidate.is_symlink():
                raise ValueError('Archive/tree symlink disagreement')
            target = pathlib.Path(candidate.readlink())
            if target.is_absolute() or not candidate.resolve().is_relative_to(tree):
                raise ValueError('Archive symlink escapes packaged tree')
            actual = str(target).encode()
            links += 1
        else:
            if not candidate.resolve().is_relative_to(tree):
                raise ValueError('Packaged member escapes tree')
            actual = candidate.read_bytes()
        if payload != actual:
            raise ValueError('Archive bytes differ from tested packaged tree: ' + member.filename)
        count += 1
        total += len(payload)
print(json.dumps({'archive': str(archive), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'archive_bytes': archive.stat().st_size, 'members_verified': count, 'uncompressed_bytes_verified': total, 'symlinks_verified': links, 'crc': 'all members passed', 'method': 'Every ZIP member matches the self-contained output tree used for actual MCP calls. No large temporary extraction fixture.'}))
