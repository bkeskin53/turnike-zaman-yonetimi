#!/bin/sh
set -eu

BASE="http://app:3000"
KEY="${INTEGRATION_API_KEY:?INTEGRATION_API_KEY missing}"

echo "[client] waiting app health..."
until curl -s -f "$BASE/api/integration/v1/health" -H "x-integration-api-key: $KEY" >/dev/null; do
  sleep 1
done
echo "[client] app is healthy"

echo "[client] 1) employees upsert"
curl -s -S "$BASE/api/integration/v1/employees/upsert" \
  -H "content-type: application/json" \
  -H "x-integration-api-key: $KEY" \
  --data-binary '{
    "sourceSystem":"SAP",
    "batchRef":"real-sim-emp-001",
    "employees":[
      {"externalRef":"SAP:EMP1","employeeCode":"E001","firstName":"Test","lastName":"User","email":"test.user@example.com","isActive":true}
    ],
    "callback":{
      "url":"http://webhook_receiver:8088/callback",
      "secret":"my_secret_123",
      "mode":"ON_DONE"
    }
  }'

echo ""
echo "[client] 2) leaves upsert (with callback)"
curl -s -S "$BASE/api/integration/v1/leaves/upsert" \
  -H "content-type: application/json" \
  -H "x-integration-api-key: $KEY" \
  --data-binary '{
    "sourceSystem":"SAP",
    "batchRef":"real-sim-leave-001",
    "leaves":[
      {"externalRef":"LEAVE_SIM_1","employeeExternalRef":"SAP:EMP1","employeeCode":"E001","type":"ANNUAL","dateFrom":"2026-02-01","dateTo":"2026-02-03","note":"real sim leave"}
    ],
    "callback":{
      "url":"http://webhook_receiver:8088/callback",
      "secret":"my_secret_123",
      "mode":"ON_DONE"
    }
  }'

echo ""
echo "[client] done."