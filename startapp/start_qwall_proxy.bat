@"
@echo off
title QWall SQL Proxy - Puerto 8002
color 0E

:LOOP
echo [%date% %time%] Iniciando qwall-proxy...
cd /d "C:\Users\ssi.production\platformSSI\platformSSI\apps\qwall-proxy"
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --workers 1

echo.
echo [%date% %time%] Proxy detenido. Reiniciando en 5 segundos...
timeout /t 5 /nobreak >nul
goto LOOP
"@ | Out-File -FilePath "C:\Users\ssi.production\platformSSI\platformSSI\startapp\start_qwall_proxy.bat" -Encoding ascii