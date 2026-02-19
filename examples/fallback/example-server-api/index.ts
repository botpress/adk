import express from 'express'
import { getJson } from 'serpapi'
import 'dotenv/config'

const app = express()

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  
  next()
})

app.use(express.json())

// ==========================================
// TYPES
// ==========================================

interface FlightTicket {
  id: string
  flightNumber: string
  airline: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  duration: string
  price: number
  currency: string
  cabinClass: string
  seatAvailability: number
  createdAt: string
}

// ==========================================
// SERVER STATE
// ==========================================

let isServerEnabled = true
let isMainEndpointEnabled = true
let isBackupEndpointEnabled = true
let isSerpApiEnabled = true

// ==========================================
// RANDOM DATA GENERATORS
// ==========================================

const cities = [
  'JFK', 'LAX', 'LHR', 'CDG', 'NRT', 'DXB', 'SIN', 'SYD', 'HKG', 'FRA',
  'AMS', 'MAD', 'BCN', 'FCO', 'MUC', 'ZUR', 'YYZ', 'YVR', 'MEX', 'GRU',
  'EZE', 'CPT', 'CAI', 'BOM', 'DEL', 'BKK', 'ICN', 'PEK', 'PVG', 'CAN'
]

const airlines = [
  'British Airways', 'Air France', 'Lufthansa', 'Emirates', 'Qatar Airways',
  'Singapore Airlines', 'Cathay Pacific', 'United Airlines', 'Delta Air Lines',
  'American Airlines', 'Japan Airlines', 'Korean Air', 'Air China', 'Qantas'
]

const cabinClasses = ['Economy', 'Business', 'First']

const generateRandomFlightNumber = (index: number): string => {
  return `BP${String(index + 1).padStart(3, '0')}`
}

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const getRandomInt = (min: number, max: number): number => 
  Math.floor(Math.random() * (max - min + 1)) + min

const generateRandomTime = (date: Date, hoursOffset: number = 0): string => {
  const newDate = new Date(date.getTime() + hoursOffset * 60 * 60 * 1000)
  return newDate.toISOString()
}

const generateRandomDuration = (): string => {
  const hours = getRandomInt(1, 14)
  const minutes = getRandomInt(0, 59)
  return `${hours}h ${minutes}m`
}

const generateRandomFlight = (index: number): FlightTicket => {
  const now = new Date()
  const departureOffset = getRandomInt(1, 30)
  const departureDate = new Date(now.getTime() + departureOffset * 24 * 60 * 60 * 1000)
  
  let origin = getRandomElement(cities)
  let destination = getRandomElement(cities)
  while (destination === origin) {
    destination = getRandomElement(cities)
  }
  
  const duration = generateRandomDuration()
  const durationHours = parseInt(duration.split('h')[0])
  
  return {
    id: `FL${String(index + 1).padStart(3, '0')}`,
    flightNumber: generateRandomFlightNumber(index),
    airline: getRandomElement(airlines),
    origin,
    destination,
    departureTime: generateRandomTime(departureDate),
    arrivalTime: generateRandomTime(departureDate, durationHours + getRandomInt(0, 2)),
    duration,
    price: getRandomInt(200, 2500),
    currency: 'USD',
    cabinClass: getRandomElement(cabinClasses),
    seatAvailability: getRandomInt(0, 300),
    createdAt: new Date().toISOString()
  }
}

// Generate 100 random flights
const flightDatabase: FlightTicket[] = Array.from({ length: 100 }, (_, i) => 
  generateRandomFlight(i)
)

// ==========================================
// PRICE FLUCTUATION
// ==========================================

const PRICE_INCREASE_STEP = 1
const PRICE_INCREASE_INTERVAL_MS = 5_000
const PRICE_RESET_DECREASE_STEP = 24
const PRICE_RESET_INTERVAL_MS = 120_000

const updateAllFlightPrices = (delta: number): void => {
  for (const flight of flightDatabase) {
    // Guard against negative prices during downward adjustments.
    flight.price = Math.max(0, flight.price + delta)
  }
}

setInterval(() => {
  updateAllFlightPrices(PRICE_INCREASE_STEP)
}, PRICE_INCREASE_INTERVAL_MS)

setInterval(() => {
  updateAllFlightPrices(-PRICE_RESET_DECREASE_STEP)
}, PRICE_RESET_INTERVAL_MS)

// ==========================================
// SERVER CONTROL MIDDLEWARE
// ==========================================

// Check if server is enabled - returns 400 Bad Request when disabled
app.use('/api/flight', (req, res, next) => {
  if (!isServerEnabled) {
    return res.status(400).json({
      error: 'Bad Request - Server is temporarily disabled',
      serverEnabled: false,
      timestamp: new Date().toISOString()
    })
  }
  next()
})

app.use('/api/flights', (req, res, next) => {
  if (!isServerEnabled) {
    return res.status(400).json({
      error: 'Bad Request - Server is temporarily disabled',
      serverEnabled: false,
      timestamp: new Date().toISOString()
    })
  }
  next()
})

// ==========================================
// API ENDPOINTS
// ==========================================

// Helper function to get flight response
const getFlightResponse = (flight: FlightTicket) => ({
  id: flight.id,
  flightNumber: flight.flightNumber,
  airline: flight.airline,
  origin: flight.origin,
  destination: flight.destination,
  departureTime: flight.departureTime,
  arrivalTime: flight.arrivalTime,
  duration: flight.duration,
  price: flight.price,
  currency: flight.currency,
  cabinClass: flight.cabinClass,
  seatAvailability: flight.seatAvailability,
  timestamp: new Date().toISOString()
})

// Get flight by ID - Main Endpoint
app.get('/api/flight/main/:id', (req, res) => {
  if (!isMainEndpointEnabled) {
    return res.status(400).json({ 
      error: 'Bad Request - Main endpoint is temporarily disabled',
      endpoint: 'main'
    })
  }
  
  const flight = flightDatabase.find(f => f.id === req.params.id)
  
  if (!flight) {
    return res.status(404).json({ 
      error: 'Flight not found',
      availableIds: flightDatabase.map(f => f.id).slice(0, 10).join(', ') + ' ...'
    })
  }
  
  res.json(getFlightResponse(flight))
})

// Get flight by ID - Backup Endpoint
app.get('/api/flight/backup/:id', (req, res) => {
  if (!isBackupEndpointEnabled) {
    return res.status(400).json({ 
      error: 'Bad Request - Backup endpoint is temporarily disabled',
      endpoint: 'backup'
    })
  }
  
  const flight = flightDatabase.find(f => f.id === req.params.id)
  
  if (!flight) {
    return res.status(404).json({ 
      error: 'Flight not found',
      availableIds: flightDatabase.map(f => f.id).slice(0, 10).join(', ') + ' ...'
    })
  }
  
  res.json(getFlightResponse(flight))
})

// Get flight by ID - Original endpoint (uses server enable/disable)
app.get('/api/flight/:id', (req, res) => {
  const flight = flightDatabase.find(f => f.id === req.params.id)
  
  if (!flight) {
    return res.status(404).json({ 
      error: 'Flight not found',
      availableIds: flightDatabase.map(f => f.id).slice(0, 10).join(', ') + ' ...'
    })
  }
  
  res.json(getFlightResponse(flight))
})

// Get all flights (paginated)
app.get('/api/flights', (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const start = (page - 1) * limit
  const end = start + limit
  
  const paginatedFlights = flightDatabase.slice(start, end)
  
  res.json({
    page,
    limit,
    total: flightDatabase.length,
    totalPages: Math.ceil(flightDatabase.length / limit),
    timestamp: new Date().toISOString(),
    flights: paginatedFlights
  })
})

// Search flights by criteria
app.get('/api/flights/search', (req, res) => {
  const { origin, destination, minPrice, maxPrice, cabinClass } = req.query
  
  let results = [...flightDatabase]
  
  if (origin) {
    results = results.filter(f => f.origin === origin.toString().toUpperCase())
  }
  
  if (destination) {
    results = results.filter(f => f.destination === destination.toString().toUpperCase())
  }
  
  if (minPrice) {
    results = results.filter(f => f.price >= parseInt(minPrice as string))
  }
  
  if (maxPrice) {
    results = results.filter(f => f.price <= parseInt(maxPrice as string))
  }
  
  if (cabinClass) {
    results = results.filter(f => f.cabinClass.toLowerCase() === cabinClass.toString().toLowerCase())
  }
  
  res.json({
    searchCriteria: { origin, destination, minPrice, maxPrice, cabinClass },
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    flights: results
  })
})

// ==========================================
// SERPAPI GOOGLE FLIGHTS SEARCH
// ==========================================

// Search real flights using SerpAPI Google Flights
app.get('/api/serp/flight_search', async (req, res) => {
  // Check if SerpAPI is enabled
  if (!isSerpApiEnabled) {
    return res.status(400).json({ 
      error: 'Bad Request - SerpAPI endpoint is temporarily disabled',
      endpoint: 'serp'
    })
  }
  
  try {
    const {
      departure_id,
      arrival_id,
      outbound_date = '2026-03-03',
      currency = 'USD',
      type = '2'
    } = req.query

    // Validate required parameters
    if (!departure_id || !arrival_id) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both departure_id and arrival_id are required',
        example: '/api/serp/flight_search?departure_id=CDG&arrival_id=AUS'
      })
    }

    // Call SerpAPI
    const result = await new Promise((resolve, reject) => {
      getJson({
        engine: "google_flights",
        departure_id: departure_id as string,
        arrival_id: arrival_id as string,
        currency: currency as string,
        type: type as string,
        outbound_date: outbound_date as string,
        api_key: process.env.SERPAPI_KEY || ""
      }, (json: any) => {
        if (json.error) {
          reject(new Error(json.error))
        } else {
          resolve(json)
        }
      })
    })

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      searchParams: {
        departure_id,
        arrival_id,
        outbound_date,
        currency,
        type
      },
      data: result
    })

  } catch (error: any) {
    res.status(500).json({
      error: 'SerpAPI request failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// ==========================================
// SERVER CONTROL ENDPOINTS
// ==========================================

// Get server status
app.get('/api/admin/status', (req, res) => {
  res.json({
    serverEnabled: isServerEnabled,
    mainEndpointEnabled: isMainEndpointEnabled,
    backupEndpointEnabled: isBackupEndpointEnabled,
    serpApiEnabled: isSerpApiEnabled,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Toggle server on/off
app.post('/api/admin/server/:state', (req, res) => {
  const { state } = req.params
  
  if (state === 'enable') {
    isServerEnabled = true
    res.json({
      message: 'Server enabled - all endpoints active',
      serverEnabled: true,
      timestamp: new Date().toISOString()
    })
  } else if (state === 'disable') {
    isServerEnabled = false
    res.json({
      message: 'Server disabled - returning 400 Bad Request',
      serverEnabled: false,
      timestamp: new Date().toISOString()
    })
  } else {
    res.status(400).json({
      error: 'Invalid state. Use "enable" or "disable"',
      example: '/api/admin/server/disable'
    })
  }
})

// Toggle Main Endpoint on/off
app.post('/api/admin/endpoint/main/:state', (req, res) => {
  const { state } = req.params
  
  if (state === 'enable') {
    isMainEndpointEnabled = true
    res.json({
      message: 'Main endpoint enabled',
      endpoint: 'main',
      enabled: true,
      timestamp: new Date().toISOString()
    })
  } else if (state === 'disable') {
    isMainEndpointEnabled = false
    res.json({
      message: 'Main endpoint disabled - returning 400 Bad Request',
      endpoint: 'main',
      enabled: false,
      timestamp: new Date().toISOString()
    })
  } else {
    res.status(400).json({
      error: 'Invalid state. Use "enable" or "disable"',
      example: '/api/admin/endpoint/main/disable'
    })
  }
})

// Toggle Backup Endpoint on/off
app.post('/api/admin/endpoint/backup/:state', (req, res) => {
  const { state } = req.params
  
  if (state === 'enable') {
    isBackupEndpointEnabled = true
    res.json({
      message: 'Backup endpoint enabled',
      endpoint: 'backup',
      enabled: true,
      timestamp: new Date().toISOString()
    })
  } else if (state === 'disable') {
    isBackupEndpointEnabled = false
    res.json({
      message: 'Backup endpoint disabled - returning 400 Bad Request',
      endpoint: 'backup',
      enabled: false,
      timestamp: new Date().toISOString()
    })
  } else {
    res.status(400).json({
      error: 'Invalid state. Use "enable" or "disable"',
      example: '/api/admin/endpoint/backup/disable'
    })
  }
})

// Toggle SerpAPI on/off
app.post('/api/admin/serp/:state', (req, res) => {
  const { state } = req.params
  
  if (state === 'enable') {
    isSerpApiEnabled = true
    res.json({
      message: 'SerpAPI endpoint enabled',
      endpoint: 'serp',
      enabled: true,
      timestamp: new Date().toISOString()
    })
  } else if (state === 'disable') {
    isSerpApiEnabled = false
    res.json({
      message: 'SerpAPI endpoint disabled - returning 400 Bad Request',
      endpoint: 'serp',
      enabled: false,
      timestamp: new Date().toISOString()
    })
  } else {
    res.status(400).json({
      error: 'Invalid state. Use "enable" or "disable"',
      example: '/api/admin/serp/disable'
    })
  }
})

// ==========================================
// HOME PAGE
// ==========================================

app.get('/', (req, res) => {
  const serverStatus = isServerEnabled ?
    `<strong style="color: green;">🟢 Server: ONLINE</strong>` :
    `<strong style="color: red;">🔴 Server: DISABLED (400 Bad Request)</strong>`
  
  const mainEndpointStatus = isMainEndpointEnabled ?
    `<span style="color: green;">🟢 Main Endpoint: ENABLED</span>` :
    `<span style="color: red;">🔴 Main Endpoint: DISABLED</span>`
    
  const backupEndpointStatus = isBackupEndpointEnabled ?
    `<span style="color: green;">🟢 Backup Endpoint: ENABLED</span>` :
    `<span style="color: red;">🔴 Backup Endpoint: DISABLED</span>`
  
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Flight Tickets API</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
          ul { line-height: 2; }
          .endpoint { background: #e8f4f8; padding: 10px; margin: 10px 0; border-radius: 5px; }
          .admin { background: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #dc3545; }
          .status { background: #d4edda; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #28a745; }
        </style>
      </head>
      <body>
        <h1>✈️ Flight Tickets API</h1>
        <p>100 randomly generated flight tickets (BP001 - BP100)</p>
        
        <div class="status">
          ${serverStatus}
        </div>
        
        <h2>Flight Endpoints:</h2>
        
        <div class="endpoint">
          <strong>Get Flight by ID - Main Endpoint</strong> ${mainEndpointStatus}<br>
          <code>GET /api/flight/main/:id</code><br>
          Example: <code>/api/flight/main/FL001</code>
        </div>
        
        <div class="endpoint">
          <strong>Get Flight by ID - Backup Endpoint</strong> ${backupEndpointStatus}<br>
          <code>GET /api/flight/backup/:id</code><br>
          Example: <code>/api/flight/backup/FL001</code>
        </div>
        
        <div class="endpoint">
          <strong>Get Flight by ID - Original (uses server enable/disable)</strong><br>
          <code>GET /api/flight/:id</code><br>
          Example: <code>/api/flight/FL001</code>
        </div>
        
        <div class="endpoint">
          <strong>Get All Flights (Paginated)</strong><br>
          <code>GET /api/flights?page=1&limit=20</code>
        </div>
        
        <div class="endpoint">
          <strong>Search Flights</strong><br>
          <code>GET /api/flights/search?origin=JFK&maxPrice=500</code><br>
          Query params: origin, destination, minPrice, maxPrice, cabinClass
        </div>

        <h2>SerpAPI Integration:</h2>
        
        <div class="endpoint">
          <strong>Search Real Flights (Google Flights via SerpAPI)</strong><br>
          <code>GET /api/serp/flight_search?departure_id=CDG&arrival_id=AUS</code><br>
          Required params: departure_id, arrival_id<br>
          Optional params: outbound_date (default: 2026-03-03), currency (default: USD), type (default: 2)
        </div>
        
        <h2>Admin Control:</h2>
        
        <div class="admin">
          <strong>Check Server Status</strong><br>
          <code>GET /api/admin/status</code>
        </div>
        
        <div class="admin">
          <strong>Toggle Server</strong><br>
          <code>POST /api/admin/server/enable</code> - Enable all endpoints<br>
          <code>POST /api/admin/server/disable</code> - Disable (returns 400)<br>
          When disabled, flight endpoints return: <code>{"error": "Bad Request - Server is temporarily disabled"}</code>
        </div>
        
        <div class="admin">
          <strong>Toggle Main Endpoint</strong><br>
          <code>POST /api/admin/endpoint/main/enable</code> - Enable Main Endpoint<br>
          <code>POST /api/admin/endpoint/main/disable</code> - Disable Main Endpoint (returns 400)
        </div>
        
        <div class="admin">
          <strong>Toggle Backup Endpoint</strong><br>
          <code>POST /api/admin/endpoint/backup/enable</code> - Enable Backup Endpoint<br>
          <code>POST /api/admin/endpoint/backup/disable</code> - Disable Backup Endpoint (returns 400)
        </div>
        
        <h3>Sample Flight:</h3>
        <pre>${JSON.stringify(flightDatabase[0], null, 2)}</pre>
        
        <p><strong>Available Cities:</strong> ${cities.slice(0, 10).join(', ')} ... (${cities.length} total)</p>
        <p><strong>Available Airlines:</strong> ${airlines.slice(0, 5).join(', ')} ... (${airlines.length} total)</p>
      </body>
    </html>
  `)
})

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`🚀 Flight API server running on http://localhost:${PORT}`)
  console.log(`📖 API docs: http://localhost:${PORT}/`)
  console.log(`✈️  Try: http://localhost:${PORT}/api/flight/FL001`)
})

export default app
