Set-Location 'C:\Users\franc\Desktop\DOSWAPZ'
$log = 'dev\build\_donalt_install_output.txt'
python 'dev\build\install_all_character_poses.py' donalt *>&1 | Tee-Object -FilePath $log
python -c @"
import os
p = r'assets/images/kol-fighter/characters/donalt/poses'
for f in ['idle-r.png','high-punch-r.png','high-kick-r.png']:
    fp = os.path.join(p, f)
    if os.path.exists(fp):
        print(f'{f}: {os.path.getsize(fp)} bytes')
"@ | Add-Content $log