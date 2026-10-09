#!/usr/bin/env python3
"""Install a self-contained copy and GNOME launcher for the current user."""
from pathlib import Path
import shutil
import subprocess
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--next', action='store_true', help='Install the development version alongside the baseline')
options=parser.parse_args()
slug='open-spectrum-next' if options.next else 'open-spectrum'
name='Open Spectrum Next' if options.next else 'Open Spectrum'
extra=' --next' if options.next else ''
source=Path(__file__).resolve().parent
destination=Path.home()/'.local/share'/slug
desktop=Path.home()/'.local/share/applications'/(slug+'.desktop')
if destination.exists():
    raise SystemExit(f'{destination} already exists. Move it aside before reinstalling to preserve your copy.')
shutil.copytree(source,destination,ignore=shutil.ignore_patterns('node_modules','.git','.verify-profile','*.log','preview.png','gallery.png','procedural.png','settings-preview.png','target'))
shutil.copytree(source/'node_modules',destination/'node_modules',symlinks=True)
for rel in ['launch.sh','node_modules/electron/dist/electron','node_modules/electron/dist/chrome_crashpad_handler']:
    p=destination/rel
    p.chmod(p.stat().st_mode|0o111)
desktop.parent.mkdir(parents=True,exist_ok=True)
desktop.write_text(f'''[Desktop Entry]
Type=Application
Name={name}
Comment=Audio reactive visuals for your music
Exec="{destination}/launch.sh"{extra}
Icon={destination}/assets/icon.svg
Terminal=false
Categories=AudioVideo;Audio;
StartupNotify=true
''')
if shutil.which('update-desktop-database'):
    subprocess.run(['update-desktop-database',str(desktop.parent)],check=True)
print(f'Installed app: {destination}\nGNOME launcher: {desktop}')
