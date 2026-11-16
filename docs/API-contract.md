
# OUTPOST 30 — API Contract

## 1. Player Registration

POST /api/player

Request:
{
  "name": "Alex",
  "age": 12,
  "missionId": "OUTPOST-30"
}

Response:
{
  "success": true,
  "playerId": "P001"
}

## 2. Mission Configuration

GET /api/mission/A
GET /api/mission/B

Returns the selected category configuration.

## 3. Start Mission

POST /api/mission/start

Request:
{
  "playerId": "P001",
  "category": "B"
}

## 4. Get Events

GET /api/events

Returns available NASA events and training scenarios.

## 5. Submit Player Decision

POST /api/simulation/decision

Request:
{
  "missionId": "M001",
  "decision": "reduce_nonessential_power"
}

## 6. Get Simulation Status

GET /api/simulation/status/M001

Returns current resource levels and mission status.
