@echo off
setlocal
TITLE Second Brain - Dev Launcher
cls

echo ===================================================
echo    SECOND BRAIN - LANCEMENT DU STACK DE DEV
echo ===================================================
echo.

REM --- Watchman est recommande pour Metro sous Windows ---
where watchman.exe >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Watchman detecte.
) else (
    echo [ATTENTION] Watchman introuvable - Metro peut planter. Installe-le : winget install facebook.watchman
)
echo.

REM --- 1) Docker : PostgreSQL + Redis + Qdrant ---
echo [1/4] Demarrage et verification des services Docker...
docker compose up -d --wait
if %errorlevel% neq 0 goto :error
echo.

REM --- 2) Prisma : migrations versionnees, jamais de db push implicite ---
echo [2/4] Application des migrations Prisma en attente...
call pnpm --filter @second-brain/api exec prisma migrate deploy
if %errorlevel% neq 0 goto :error
call pnpm --filter @second-brain/api prisma:generate
if %errorlevel% neq 0 goto :error
echo.

REM --- 3) API (NestJS) dans sa propre fenetre -> http://localhost:3000/api ---
echo [3/4] Lancement de l'API sur http://localhost:3000/api ...
start "Second Brain - API (3000)" cmd /k "pnpm --filter @second-brain/api dev"

REM --- 4) Web (Expo) dans sa propre fenetre -> http://localhost:8082 ---
echo [4/4] Lancement du Web sur http://localhost:8082 ...
start "Second Brain - Web (8082)" cmd /k "pnpm --filter @second-brain/mobile web"

echo.
echo ===================================================
echo   API : http://localhost:3000/api
echo   WEB : http://localhost:8082
echo ===================================================
echo.
echo Le PREMIER build web indexe le projet (Watchman) puis bundle :
echo cela peut prendre 1 a 3 minutes. Le navigateur s'ouvrira tout seul ;
echo si la page est vide, attends le message "Waiting on http://localhost:8082"
echo dans la fenetre Web puis rafraichis (F5).
echo.

REM --- Ouverture du navigateur (laisse le temps au bundle de demarrer) ---
timeout /t 45 /nobreak >nul
start "" http://localhost:8082

echo Fenetres API + Web ouvertes. Ferme-les pour arreter Second Brain.
echo Cette fenetre peut etre fermee.
pause
endlocal
exit /b 0

:error
echo.
echo [ERREUR] Le demarrage a echoue. Consulte le message ci-dessus.
pause
endlocal
exit /b 1
