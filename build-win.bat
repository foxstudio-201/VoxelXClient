@echo off
echo ============================================
echo   VoxelXClient - Windows Build Script
echo ============================================
echo.

:: Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Vui long chay script nay voi quyen Administrator!
    echo.
    echo Cach chay:
    echo   1. Click phai vao file nay
    echo   2. Chon "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [OK] Dang chay voi quyen Administrator
echo.

:: Change to project directory (important when running as Admin)
cd /d "%~dp0"
echo [OK] Thu muc: %CD%
echo.

:: Code signing with self-signed certificate
set CSC_IDENTITY_AUTO_DISCOVERY=false
set CSC_LINK=%~dp0certs\code-signing.pfx
set CSC_KEY_PASSWORD=VoxelXClient2024

echo [1/2] Building Vite...
call npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Vite build that bai!
    pause
    exit /b 1
)

echo.
echo [2/2] Building Electron app...
call npx electron-builder --win --x64 --publish never
if %errorLevel% neq 0 (
    echo [ERROR] Electron build that bai!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BUILD THANH CONG!
echo   Output: dist-electron\
echo ============================================
echo.
pause
