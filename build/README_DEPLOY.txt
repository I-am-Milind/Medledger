MedLedger Deploy Bundle

Contents:
- build/web (static React app)
- build/api/dist (compiled Express API)
- build/api/package.json (API runtime deps)

Deploy API:
1) cd build/api
2) npm install --omit=dev
3) set env vars
4) npm start
