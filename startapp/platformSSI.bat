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

echo Iniciando QWall Proxy...
start "QWall SQL Proxy" cmd /k "C:\Users\ssi.production\platformSSI\platformSSI\startapp\start_qwall_proxy.bat"
timeout /t 3 /nobreak >nul

echo Iniciando platformSSI...
cd /d "C:\Users\ssi.production\platformSSI\platformSSI"

REM Recreate app services so docker-compose environment changes are actually applied.
echo Recreando servicios de aplicacion con variables de entorno actuales...
docker compose up -d --force-recreate backend celery_worker celery_beat frontend
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron recrear los servicios de platformSSI.
    pause
    exit /b 1
)

REM Incoming Inspection depends on this secret inside Celery.
echo Validando PLEX_PROXY_SECRET en Celery...
docker compose exec -T celery_worker python -c "import os,sys; s=os.getenv('PLEX_PROXY_SECRET',''); print('PLEX_PROXY_SECRET loaded:', bool(s), 'length:', len(s)); sys.exit(0 if s else 1)"
if %errorlevel% neq 0 (
    echo ERROR: PLEX_PROXY_SECRET no esta cargado en celery_worker.
    echo Revisa docker-compose.yml y recrea el contenedor antes de usar Incoming Inspection.
    pause
    exit /b 1
)

echo Aplicando migraciones de base de datos...
docker compose exec -T backend python manage.py migrate
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron aplicar las migraciones de Django.
    echo Revisa los logs del backend antes de usar platformSSI.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Acceso desde la red:
echo  http://pac-kingdel06:5173
echo ============================================
pause
"@ | Out-File -FilePath "C:\Users\ssi.production\platformSSI\platformSSI\startapp\start_platform.bat" -Encoding ascii