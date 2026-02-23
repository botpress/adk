# ✈️ Flight Tickets API

Express API with 100 randomly generated flight tickets (BP001 - BP100) + SerpAPI Google Flights integration.

## Features

- 🎲 **Random Flight Data**: 100 pre-generated flights for testing
- 🔍 **Search & Filter**: Search by origin, destination, price, cabin class
- 🌐 **Real Flight Search**: Integration with SerpAPI Google Flights
- 🔧 **Independent Endpoint Control**: Enable/disable Main and Backup endpoints separately for testing fallback behavior
- 🔄 **Server Toggle**: Global enable/disable for all endpoints
- 📄 **Pagination**: Get flights in pages
- 🏃 **Fast Development**: Hot reload with `--watch`

## Installation

```bash
# Install dependencies
npm install

# Copy .env.example to .env and add your SerpAPI key
cp .env.example .env
# Edit .env and add your SERPAPI_KEY
```

## Environment Setup

Create a `.env` file in the project root:

```env
# SerpAPI Configuration
SERPAPI_KEY=your-serpapi-key-here

# Server Configuration
PORT=3002
```

**Get your SerpAPI key:** https://serpapi.com/manage-api-key

## Running

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3002` by default.

## API Endpoints

### Flight Endpoints

#### Get Flight by ID - Main Endpoint
```
GET /api/flight/main/:id
```

Example: `/api/flight/main/FL001`

Independent enable/disable control via `/api/admin/endpoint/main/{enable|disable}`

#### Get Flight by ID - Backup Endpoint
```
GET /api/flight/backup/:id
```

Example: `/api/flight/backup/FL001`

Independent enable/disable control via `/api/admin/endpoint/backup/{enable|disable}`

#### Get Flight by ID - Original
```
GET /api/flight/:id
```

Example: `/api/flight/FL001`

Uses server-wide enable/disable control.

**Response (all endpoints):**
```json
{
  "id": "FL001",
  "flightNumber": "BP001",
  "airline": "Lufthansa",
  "origin": "PVG",
  "destination": "YVR",
  "departureTime": "2026-03-08T21:24:00.364Z",
  "arrivalTime": "2026-03-08T23:24:00.364Z",
  "duration": "2h 26m",
  "price": 2400,
  "currency": "USD",
  "cabinClass": "Economy",
  "seatAvailability": 138,
  "timestamp": "2026-02-16T21:24:00.367Z"
}
```

**When Disabled:**
```json
{
  "error": "Bad Request - Main endpoint is temporarily disabled",
  "endpoint": "main"
}
```

#### Get All Flights (Paginated)
```
GET /api/flights?page=1&limit=20
```

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 20) - Items per page

#### Search Flights
```
GET /api/flights/search?origin=JFK&maxPrice=500
```

**Query Parameters:**
- `origin` - Origin airport code (e.g., JFK)
- `destination` - Destination airport code
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `cabinClass` - Cabin class (Economy, Business, First)

---

### SerpAPI Google Flights Integration

#### Search Real Flights
```
GET /api/serp/flight_search?departure_id=CDG&arrival_id=AUS
```

Searches for real flights using Google Flights via SerpAPI.

**Required Query Parameters:**
- `departure_id` - Departure airport code (e.g., CDG for Paris)
- `arrival_id` - Arrival airport code (e.g., AUS for Austin)

**Optional Query Parameters:**
- `outbound_date` - Date in YYYY-MM-DD format (default: 2026-03-03)
- `currency` - Currency code (default: USD)
- `type` - Flight type (default: 2 for round trip)

**Example Request:**
```bash
curl "http://localhost:3002/api/serp/flight_search?departure_id=CDG&arrival_id=AUS&outbound_date=2026-03-03"
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-16T...",
  "searchParams": {
    "departure_id": "CDG",
    "arrival_id": "AUS",
    "outbound_date": "2026-03-03",
    "currency": "USD",
    "type": "2"
  },
  "data": {
    "best_flights": [...],
    "other_flights": [...],
    // Full SerpAPI response
  }
}
```

**Common Airport Codes:**
- CDG - Paris Charles de Gaulle
- AUS - Austin-Bergstrom International
- JFK - New York JFK
- LAX - Los Angeles International
- LHR - London Heathrow
- NRT - Tokyo Narita
- DXB - Dubai International

---

### Admin Control

#### Check Server Status
```
GET /api/admin/status
```

Returns current server and endpoint enable/disable status.

**Response:**
```json
{
  "serverEnabled": true,
  "mainEndpointEnabled": true,
  "backupEndpointEnabled": true,
  "timestamp": "2026-02-16T...",
  "uptime": 1234.56
}
```

#### Toggle Server
```
POST /api/admin/server/enable   # Enable all endpoints
POST /api/admin/server/disable  # Disable (returns 400)
```

When disabled, flight endpoints return:
```json
{
  "error": "Bad Request - Server is temporarily disabled"
}
```

#### Toggle Main Endpoint
```
POST /api/admin/endpoint/main/enable   # Enable Main Endpoint
POST /api/admin/endpoint/main/disable  # Disable Main Endpoint (returns 400)
```

Controls `/api/flight/main/:id` independently.

#### Toggle Backup Endpoint
```
POST /api/admin/endpoint/backup/enable   # Enable Backup Endpoint
POST /api/admin/endpoint/backup/disable  # Disable Backup Endpoint (returns 400)
```

Controls `/api/flight/backup/:id` independently.

---

## Available Data

**Cities (30 total):**
JFK, LAX, LHR, CDG, NRT, DXB, SIN, SYD, HKG, FRA, AMS, MAD, BCN, FCO, MUC, ZUR, YYZ, YVR, MEX, GRU, EZE, CPT, CAI, BOM, DEL, BKK, ICN, PEK, PVG, CAN

**Airlines (14 total):**
British Airways, Air France, Lufthansa, Emirates, Qatar Airways, Singapore Airlines, Cathay Pacific, United Airlines, Delta Air Lines, American Airlines, Japan Airlines, Korean Air, Air China, Qantas

**Cabin Classes:**
Economy, Business, First

## Development

The API uses:
- **Express** - Web framework
- **TypeScript** - Type safety
- **SerpAPI** - Real flight data integration
- **Node --watch** - Hot reload

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERPAPI_KEY` | Your SerpAPI key (required for `/api/serp/flight_search`) | - |
| `PORT` | Server port | 3002 |

**Note:** The SerpAPI endpoint will return an error if `SERPAPI_KEY` is not set.

## Testing Fallback Behavior

### Independent Endpoint Testing

Test fallback from Main to Backup endpoint:

```bash
# 1. Start the server
npm run dev

# 2. Both endpoints work initially
curl http://localhost:3002/api/flight/main/FL001
curl http://localhost:3002/api/flight/backup/FL001

# 3. Disable Main Endpoint
curl -X POST http://localhost:3002/api/admin/endpoint/main/disable

# 4. Test fallback: Main fails, Backup works
curl http://localhost:3002/api/flight/main/FL001    # Returns 400
curl http://localhost:3002/api/flight/backup/FL001  # Still works

# 5. Re-enable Main Endpoint
curl -X POST http://localhost:3002/api/admin/endpoint/main/enable
```

### Server-wide Testing

1. Start the server
2. Call `/api/admin/server/disable` to simulate downtime
3. Test your frontend's error handling
4. Call `/api/admin/server/enable` to restore

### Use Cases

- **Primary/Fallback Pattern**: Use Main as primary, Backup as fallback
- **Resilience Testing**: Test automatic failover mechanisms
- **Chaos Testing**: Randomly disable endpoints to test resilience
- **Load Balancing**: Distribute traffic between main and backup

## Project Structure

```
src/
└── index.ts    # Main API file
    ├── Types & interfaces
    ├── Random data generators
    ├── Flight database (100 flights)
    ├── Flight endpoints
    ├── SerpAPI integration
    ├── Admin control
    └── Server startup
```

## License

MIT
