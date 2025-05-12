const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from public directory

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://your-mongodb-uri')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const gameResultSchema = new mongoose.Schema({
    username: { type: String, required: true },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    time: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

const GameResult = mongoose.model('GameResult', gameResultSchema);

let db;

async function initDatabase() {
    try {
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.access(dataDir);
        } catch (error) {
            await fs.mkdir(dataDir, { recursive: true });
            console.log('Data directory created');
        }

        db = await open({
            filename: path.join(dataDir, 'typing_game.db'),
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS passages (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                wpm INTEGER NOT NULL,
                accuracy INTEGER NOT NULL,
                time REAL NOT NULL,
                date TEXT NOT NULL
            );
        `);

        console.log('Database initialized successfully');

        const passageCount = await db.get('SELECT COUNT(*) as count FROM passages');
        
        if (passageCount.count === 0) {
            await populatePassages();
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
}


async function populatePassages() {
    try {
        const passagesFile = await fs.readFile('passages.json', 'utf8');
        const passages = JSON.parse(passagesFile);

        const stmt = await db.prepare('INSERT INTO passages (id, text) VALUES (?, ?)');
        
        for (const passage of passages) {
            await stmt.run(uuidv4(), passage);
        }
        
        await stmt.finalize();
        
        console.log(`${passages.length} passages added to database`);
    } catch (error) {
        console.error('Error populating passages:', error);
        

        const defaultPassages = [
            "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet.",
            "Programming is the art of telling another human being what one wants the computer to do.",
            "Typing speed tests are a great way to improve your typing skills and measure your progress.",
            "A good programmer is someone who always looks both ways before crossing a one-way street.",
            "In the world of typing, practice makes perfect. The more you type, the faster you become.",
            "Coding is like poetry; it's not just about what works, but about how elegantly it works.",
            "The internet is a global system of interconnected computer networks that use protocols.",
            "Technology is best when it brings people together. It should work for people, not the other way around.",
            "The computer was born to solve problems that did not exist before. Now it creates problems that never existed before.",
            "The greatest glory in living lies not in never falling, but in rising every time we fall."
        ];
        
        const stmt = await db.prepare('INSERT INTO passages (id, text) VALUES (?, ?)');
        
        for (const passage of defaultPassages) {
            await stmt.run(uuidv4(), passage);
        }
        
        await stmt.finalize();
        
        console.log(`${defaultPassages.length} default passages added to database`);
    }
}

app.get('/api/passages/random', async (req, res) => {
    try {
        const passage = await db.get('SELECT * FROM passages ORDER BY RANDOM() LIMIT 1');
        
        if (!passage) {
            return res.status(404).json({ error: 'No passages found' });
        }
        
        res.json({ text: passage.text });
    } catch (error) {
        console.error('Error fetching random passage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/api/results', async (req, res) => {
    try {
        const { username, wpm, accuracy, time } = req.body;
        
        if (!username || !wpm || !accuracy || !time) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const result = new GameResult({
            username,
            wpm,
            accuracy,
            time
        });
        
        await result.save();
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error saving result:', error);
        res.status(500).json({ success: false, message: 'Error saving result' });
    }
});

app.get('/api/users/:username/stats', async (req, res) => {
    try {
        const { username } = req.params;

        const totalGamesResult = await db.get(
            'SELECT COUNT(*) as count FROM games WHERE username = ?',
            [username]
        );
        
        if (totalGamesResult.count === 0) {
            return res.json({
                username,
                totalGames: 0,
                avgWpm: 0,
                bestWpm: 0,
                avgAccuracy: 0,
                recentGames: []
            });
        }

        const averagesResult = await db.get(
            'SELECT AVG(wpm) as avgWpm, AVG(accuracy) as avgAccuracy FROM games WHERE username = ?',
            [username]
        );

        const bestWpmResult = await db.get(
            'SELECT MAX(wpm) as bestWpm FROM games WHERE username = ?',
            [username]
        );
        

        const recentGames = await db.all(
            'SELECT * FROM games WHERE username = ? ORDER BY date DESC LIMIT 10',
            [username]
        );
        
        res.json({
            username,
            totalGames: totalGamesResult.count,
            avgWpm: Math.round(averagesResult.avgWpm),
            bestWpm: bestWpmResult.bestWpm,
            avgAccuracy: Math.round(averagesResult.avgAccuracy),
            recentGames
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/api/leaderboard', async (req, res) => {
    try {
        const { filter = 'best' } = req.query;
        
        let aggregationPipeline = [];
        
        switch (filter) {
            case 'best':
                aggregationPipeline = [
                    {
                        $group: {
                            _id: '$username',
                            bestWpm: { $max: '$wpm' },
                            totalGames: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            username: '$_id',
                            bestWpm: 1,
                            totalGames: 1,
                            _id: 0
                        }
                    },
                    { $sort: { bestWpm: -1 } }
                ];
                break;
                
            case 'average':
                aggregationPipeline = [
                    {
                        $group: {
                            _id: '$username',
                            avgWpm: { $avg: '$wpm' },
                            totalGames: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            username: '$_id',
                            avgWpm: { $round: ['$avgWpm', 0] },
                            totalGames: 1,
                            _id: 0
                        }
                    },
                    { $sort: { avgWpm: -1 } }
                ];
                break;
                
            case 'games':
                aggregationPipeline = [
                    {
                        $group: {
                            _id: '$username',
                            bestWpm: { $max: '$wpm' },
                            totalGames: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            username: '$_id',
                            bestWpm: 1,
                            totalGames: 1,
                            _id: 0
                        }
                    },
                    { $sort: { totalGames: -1 } }
                ];
                break;
        }
        
        const leaderboard = await GameResult.aggregate(aggregationPipeline);
        
        res.json({ success: true, data: leaderboard });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ success: false, message: 'Error fetching leaderboard' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer(); 