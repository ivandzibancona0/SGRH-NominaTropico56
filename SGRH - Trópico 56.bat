@echo off
title SGRH - Tropico 56
cd /d "%~dp0"

echo ===================================================
echo     Iniciando Servidor SGRH - Tropico 56
echo ===================================================
echo.
echo Abriendo aplicacion en http://localhost:3000 ...
echo.

:: Espera 2 segundos y abre el navegador en http://localhost:3000
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Ejecutar servidor Node.js
echo Servidor iniciado. Presiona Ctrl + C para detenerlo.
echo ---------------------------------------------------
node server.js

pause
