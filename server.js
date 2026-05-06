const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

console.log('🔄 Starting VelTech Server...');
// Add this endpoint to your server.js
app.post('/api/register', async (req, res) => {
  const { event_id, student_name, reg_num } = req.body;
  console.log('📝 Registration:', student_name, 'for event', event_id);
  
  try {
    const db = await mysql.createConnection(dbConfig);
    await db.execute(
      'INSERT INTO registrations (event_id, student_name, reg_num) VALUES (?, ?, ?)',
      [event_id, student_name, reg_num]
    );
    await db.end();
    res.json({ success: true });
  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false });
  }
});


// MySQL Config - EDIT YOUR PASSWORD!
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '5515',  // ← YOUR MySQL PASSWORD HERE
  database: 'veltech_events'
};

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// TEST LOGIN (WORKS)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);
  
  try {
    const db = await mysql.createConnection(dbConfig);
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE username = ? AND password = ?', 
      [username, password]
    );
    
    if (rows.length > 0) {
      console.log('✅ Login SUCCESS:', username, rows[0].role);
      res.json({ success: true, role: rows[0].role, user: rows[0] });
    } else {
      console.log('❌ Login FAILED');
      res.json({ success: false });
    }
    await db.end();
  } catch (error) {
    console.error('❌ MySQL ERROR:', error.message);
    res.json({ success: false, error: 'Database connection failed' });
  }
});

// FIXED EVENTS - With fallback data
app.get('/api/events', async (req, res) => {
  console.log('📊 Loading events...');
  
  try {
    const db = await mysql.createConnection(dbConfig);
    const [rows] = await db.execute(`
      SELECT e.*, COALESCE(COUNT(r.id), 0) as registrations
      FROM events e 
      LEFT JOIN registrations r ON e.id = r.event_id 
      GROUP BY e.id 
      ORDER BY e.id
    `);
    await db.end();
    console.log('✅ Events loaded:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('❌ Events ERROR:', error.message);
    // FALLBACK DATA - So UI doesn't break
    res.json([
      {id:1,name:'Codeathon 2026 (Demo)',category:'hackathon',venue:'Main Auditorium',event_date:'2026-04-15',capacity:200,registrations:0},
      {id:2,name:'Essay Contest #1 (Demo)',category:'essay',venue:'Library Hall',event_date:'2026-03-25',capacity:100,registrations:0}
    ]);
  }
});

// COUNTS (Same as events)
app.get('/api/counts', async (req, res) => {
  res.redirect('/api/events');  // Reuse events endpoint
});

// CREATE EVENT
app.post('/api/events', async (req, res) => {
  const { name, category, venue, event_date, capacity } = req.body;
  console.log('➕ Creating event:', name);
  
  try {
    const db = await mysql.createConnection(dbConfig);
    const [result] = await db.execute(
      'INSERT INTO events (name, category, venue, event_date, capacity) VALUES (?, ?, ?, ?, ?)',
      [name, category, venue, event_date, capacity || 100]
    );
    await db.end();
    console.log('✅ Event created:', result.insertId);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('❌ Create event failed:', error.message);
    res.json({ success: false });
  }
});

// DELETE EVENT
app.delete('/api/events/:id', async (req, res) => {
  console.log('🗑️ Deleting event:', req.params.id);
  
  try {
    const db = await mysql.createConnection(dbConfig);
    await db.execute('DELETE FROM events WHERE id = ?', [req.params.id]);
    await db.end();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Delete failed:', error.message);
    res.json({ success: false });
  }
});

app.listen(3000, () => {
  console.log('🚀 VelTech Server: http://localhost:3000');
  console.log('✅ Login: 252525/252525');
}).on('error', (err) => {
  console.error('❌ Server error:', err.message);
});
