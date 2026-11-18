"""Build a clean source distribution using an explicit allowlist (no runtime data)."""
from pathlib import Path
import hashlib
import re
import zipfile

root = Path(__file__).resolve().parent
package_name = 'Codex-Usage-Ribbon'
out = root / 'releases' / f'{package_name}-Windows.zip'
out.parent.mkdir(parents=True, exist_ok=True)
files = [
    'adapter.js', 'cdp.mjs', 'data.mjs', 'focus.mjs', 'host.mjs',
    'launch.ps1', 'launch-core.ps1', 'start.vbs', 'stop.ps1', 'stop.vbs',
    'start-menu-shortcut.ps1', 'start-link.cs',
    'install.ps1', 'install.cmd', 'LICENSE', 'NOTICE',
    'vendor/statusline.js', 'test/usage.test.mjs', 'test/launch.test.ps1', 'test/renderer.test.mjs',
    'assets/statusline.png',
    'package-portable.py', 'INSTALL.zh-CN.md', 'README.md', 'README.zh-CN.md', '.gitignore', '.gitattributes',
]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, package_name + '/' + name)
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        assert '/runtime/' not in name and '/evidence/' not in name
        assert name.startswith(package_name + '/') and '..' not in Path(name).parts
        content = archive.read(name)
        assert str(Path.home()).encode('utf-8') not in content
        if name.endswith(('/start-link.cs', '/package-portable.py')):
            for shell_guid in (
                b'00021401-0000-0000-C000-000000000046',
                b'9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3',
                b'886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99',
            ):
                content = content.replace(shell_guid, b'')
        assert not re.search(rb'\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b', content, re.I), name
digest = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.zip.sha256').write_text(f'{digest}  {out.name}\n', encoding='utf-8')
print(f'{out}\n{out.stat().st_size} bytes\nSHA256: {digest}')
