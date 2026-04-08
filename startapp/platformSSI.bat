@"
@echo off
title platformSSI - Servidor de Planta
color 0A

echo ============================================
echo  platformSSI - Iniciando servicios...
echo ============================================

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker no esta corriendo. Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Esperando 40 segundos...
    timeout /t 40 /nobreak >nul
)

echo Iniciando Plex ODBC Proxy...
start "Plex ODBC Proxy" cmd /k "C:\Users\ssi.production\platformSSI\platformSSI\startapp\start_proxy.bat"
timeout /t 3 /nobreak >nul

echo Iniciando platformSSI...
cd /d "C:\Users\ssi.production\platformSSI\platformSSI"
docker compose up -d

echo.
echo ============================================
echo  Acceso desde la red:
echo  http://pac-kingdel06:5173
echo ============================================
pause
"@ | Out-File -FilePath "C:\Users\ssi.production\platformSSI\platformSSI\startapp\start_platform.bat" -Encoding ascii