const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'WeatherDB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function executeQuery(query, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [results] = await connection.execute(query, params);
        return results;
    } catch (error) {
        console.error('Database error:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// 1. Get all weather data with station and location info
app.get('/weather', async (req, res) => {
    try {
        const query = `
            SELECT wd.*, ws.Name as stationName, loc.City, loc.Country 
            FROM WeatherData wd
            LEFT JOIN WeatherStation ws ON wd.StationID = ws.StationID
            LEFT JOIN Location loc ON wd.LocationID = loc.LocationID
            ORDER BY wd.DateRecorded DESC
        `;
        const results = await executeQuery(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get all countries (for dropdown)
app.get('/countries', async (req, res) => {
    try {
        const results = await executeQuery('SELECT DISTINCT Country FROM Location ORDER BY Country');
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get locations by country (for dropdown)
app.get('/locations/:country', async (req, res) => {
    try {
        const { country } = req.params;
        const results = await executeQuery(
            'SELECT * FROM Location WHERE Country = ? ORDER BY City',
            [country]
        );
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get all stations (for dropdown)
app.get('/stations', async (req, res) => {
    try {
        const results = await executeQuery('SELECT * FROM WeatherStation ORDER BY Name');
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Add new weather data
app.post('/weather', async (req, res) => {
    try {
        const { StationID, LocationID, Temperature, Humidity, WindSpeed, Pressure } = req.body;
        
        // Validate ranges
        if (Temperature < -50 || Temperature > 50) {
            return res.status(400).json({ error: 'Temperature must be between -50°C and 50°C' });
        }
        if (Humidity < 0 || Humidity > 100) {
            return res.status(400).json({ error: 'Humidity must be between 0% and 100%' });
        }
        if (WindSpeed < 0 || WindSpeed > 200) {
            return res.status(400).json({ error: 'Wind speed must be between 0 and 200 km/h' });
        }
        if (Pressure < 800 || Pressure > 1100) {
            return res.status(400).json({ error: 'Pressure must be between 800 and 1100 hPa' });
        }
        
        const query = `
            INSERT INTO WeatherData 
            (StationID, LocationID, Temperature, Humidity, WindSpeed, Pressure, DateRecorded) 
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const result = await executeQuery(query, [
            StationID, LocationID, Temperature, Humidity, WindSpeed, Pressure
        ]);
        
        res.status(201).json({ 
            message: 'Weather data added successfully', 
            id: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Update existing weather data
app.put('/weather/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { StationID, LocationID, Temperature, Humidity, WindSpeed, Pressure } = req.body;
        
        // Validate ranges (same as POST)
        
        const query = `
            UPDATE WeatherData SET 
                StationID = ?, 
                LocationID = ?, 
                Temperature = ?, 
                Humidity = ?, 
                WindSpeed = ?, 
                Pressure = ?,
                DateRecorded = NOW()
            WHERE DataID = ?
        `;
        
        await executeQuery(query, [
            StationID, LocationID, Temperature, Humidity, WindSpeed, Pressure, id
        ]);
        
        res.json({ message: 'Weather data updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Delete weather data
app.delete('/weather/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM WeatherData WHERE DataID = ?', [id]);
        res.json({ message: 'Weather data deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Get preset weather data for major cities
app.get('/preset-weather', async (req, res) => {
    try {
        const query = `
            SELECT wd.*, ws.Name as stationName, loc.City, loc.Country 
            FROM WeatherData wd
            LEFT JOIN WeatherStation ws ON wd.StationID = ws.StationID
            LEFT JOIN Location loc ON wd.LocationID = loc.LocationID
            WHERE loc.City IN ('New York', 'London', 'Tokyo', 'Paris', 'Berlin')
            ORDER BY wd.DateRecorded DESC
            LIMIT 5
        `;
        const results = await executeQuery(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});