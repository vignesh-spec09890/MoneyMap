@echo off
cd /d C:\Users\ASUS\Documents\Payments-copy\server
echo Installing server dependencies...
call npm install
cd /d C:\Users\ASUS\Documents\Payments-copy
echo Starting dev servers...
call npm run dev
pause