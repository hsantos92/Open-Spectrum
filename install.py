#!/usr/bin/env python3
"""Install a self-contained copy and GNOME launcher for the current user."""
from pathlib import Path
import shutil
import subprocess
source=Path(__file__).resolve().parent
destination=Path.home()/'.local/share/open-spectrum'
desktop=Path.home()/'.local/share/applications/open-spectrum.desktop'
if destination.exists():
    raise SystemExit(f'{destination} already exists. Move it aside before reinstalling to preserve your copy.')
shutil.copytree(source,destination,ignore=shutil.ignore_patterns('node_modules','.git','.verify-profile','*.log','preview.png','gallery.png'))
shutil.copytree(source/'node_modules',destination/'node_modules',symlinks=True)
for rel in ['launch.sh','node_modules/electron/dist/electron','node_modules/electron/dist/chrome_crashpad_handler']:
    p=destination/rel
    p.chmod(p.stat().st_mode|0o111)
desktop.parent.mkdir(parents=True,exist_ok=True)
desktop.write_text(f'''[Desktop Entry]
Type=Application
Name=Open Spectrum
Comment=Audio reactive visuals for your music
Exec="{destination}/launch.sh"
Icon={destination}/assets/icon.svg
Terminal=false
Categories=AudioVideo;Audio;
StartupNotify=true
''')
if shutil.which('update-desktop-database'):
    subprocess.run(['update-desktop-database',str(desktop.parent)],check=True)
print(f'Installed app: {destination}\nGNOME launcher: {desktop}')
