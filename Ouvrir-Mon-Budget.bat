@echo off
rem Lance l'appli budget en local (http://localhost:5178) avec le chat, puis ouvre le navigateur.
rem Laisse cette fenetre ouverte pendant l'utilisation ; ferme-la pour arreter.
cd /d "%~dp0"
start "" /b python server.py
timeout /t 2 /nobreak >nul
start "" http://localhost:5178
echo Mon Budget tourne sur http://localhost:5178 - ferme cette fenetre pour arreter.
pause >nul
