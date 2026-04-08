@"
@echo off
title Plex ODBC Proxy - Puerto 8001
color 0B

:LOOP
echo [%date% %time%] Iniciando plex-proxy...
cd /d "C:\Users\ssi.production\plex-proxy\plex-proxyO"
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --workers 1

echo.
echo [%date% %time%] Proxy detenido. Reiniciando en 5 segundos...
timeout /t 5 /nobreak >nul
goto LOOP
"@ | Out-File -FilePath "C:\Users\ssi.production\platformSSI\platformSSI\startapp\start_proxy.bat" -Encoding ascii