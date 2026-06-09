@echo off
start "Signaling Server" cmd /k "node signaling-server.mjs"
start "API Server" cmd /k "cd artifacts\api-server && pnpm run dev"
start "Frontend Server" cmd /k "cd artifacts\soulsync && pnpm run dev"
