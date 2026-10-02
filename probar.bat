@echo off
cd /d "%~dp0"
set PORT=8765
set URL=http://127.0.0.1:%PORT%/

echo Simulador ICFES Matematicas
echo Abriendo %URL%
echo Para detenerlo, cierra esta ventana o pulsa Ctrl+C.
echo.

start "" cmd /c "ping -n 2 127.0.0.1 >nul & start %URL%"

where py >nul 2>&1 && (
  py -m http.server %PORT%
  goto :eof
)
where python >nul 2>&1 && (
  python -m http.server %PORT%
  goto :eof
)

echo No se encontro Python. Instalalo desde https://www.python.org/ y vuelve a abrir este archivo.
pause
