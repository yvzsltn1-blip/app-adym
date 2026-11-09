@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ============================================================
rem  Nobet Cizelgesi - GitHub'a Yukle
rem  Bu dosyaya cift tiklayinca tum degisiklikler
rem  https://github.com/yvzsltn1-blip/app-adym adresine gonderilir.
rem ============================================================

cd /d "%~dp0"

set "REMOTE_URL=https://github.com/yvzsltn1-blip/app-adym.git"
set "BRANCH=main"

echo.
echo ============================================
echo   GitHub'a yukleniyor...
echo   %REMOTE_URL%
echo ============================================
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Git bulunamadi. Lutfen git kurun: https://git-scm.com/download/win
    pause
    exit /b 1
)

if not exist ".git" (
    echo [BILGI] Git deposu olusturuluyor...
    git init -q
    if errorlevel 1 goto :hata
    git branch -M %BRANCH%
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REMOTE_URL%
) else (
    git remote set-url origin %REMOTE_URL%
)

echo [BILGI] Dosyalar ekleniyor...
git add -A
if errorlevel 1 goto :hata

set "MESAJ=Guncelleme %date% %time%"
set "MESAJ=!MESAJ::=-!"

git diff --cached --quiet
if errorlevel 1 (
    echo [BILGI] Commit olusturuluyor: !MESAJ!
    git commit -m "!MESAJ!" -q
    if errorlevel 1 goto :hata
) else (
    echo [BILGI] Yeni degisiklik yok, yine de gonderim denenecek.
)

echo [BILGI] GitHub'a gonderiliyor...
git push -u origin %BRANCH%
if errorlevel 1 (
    echo.
    echo [HATA] Gonderim basarisiz.
    echo.
    echo Olasi nedenler:
    echo   - GitHub kullanici adi / sifre veya token isteniyor veya yanlis.
    echo   - Internet baglantisi yok.
    echo   - Uzak depoda sizde olmayan commit var: once "git pull --rebase origin %BRANCH%".
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   TAMAM - Yukleme basarili.
echo   https://github.com/yvzsltn1-blip/app-adym
echo ============================================
echo.
pause
exit /b 0

:hata
echo.
echo [HATA] Islem basarisiz oldu. Yukaridaki mesajlara bakin.
echo.
pause
exit /b 1
