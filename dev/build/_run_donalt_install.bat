@echo off
cd /d "C:\Users\franc\Desktop\DOSWAPZ"
python "dev\build\install_all_character_poses.py" donalt > "dev\build\_donalt_install_output.txt" 2>&1
python -c "import os; p=r'assets/images/kol-fighter/characters/donalt/poses'; fs=['idle-r.png','high-punch-r.png','high-kick-r.png'];
[open(r'dev/build/_donalt_pose_sizes.txt','w').write('\n'.join(f'{f}: {os.path.getsize(os.path.join(p,f))} bytes' for f in fs if os.path.exists(os.path.join(p,f))))]" >> "dev\build\_donalt_install_output.txt" 2>&1