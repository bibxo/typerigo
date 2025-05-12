// DOM Elements
const textDisplay = document.getElementById('text-display');
const textInput = document.getElementById('text-input');
const timer = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const accuracyDisplay = document.getElementById('accuracy');
const newGameBtn = document.getElementById('new-game-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const results = document.getElementById('results');
const resultWpm = document.getElementById('result-wpm');
const resultAccuracy = document.getElementById('result-accuracy');
const resultTime = document.getElementById('result-time');
const usernameInput = document.getElementById('username-input');
const setUsernameBtn = document.getElementById('set-username-btn');
const currentUser = document.getElementById('current-user');
const avgWpmDisplay = document.getElementById('avg-wpm');
const bestWpmDisplay = document.getElementById('best-wpm');
const totalGamesDisplay = document.getElementById('total-games');
const avgAccuracyDisplay = document.getElementById('avg-accuracy');
const recentGamesContainer = document.getElementById('recent-games');
const leaderboardBody = document.getElementById('leaderboard-body');
const leaderboardValueHeader = document.getElementById('leaderboard-value-header');
const tabButtons = document.querySelectorAll('.tab-btn');
const filterButtons = document.querySelectorAll('.filter-btn');

const BACKEND_URL = 'https://typerigo-backend.onrender.com'; 


const passages = [
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


let gameState = {
    startTime: null,
    timerInterval: null,
    currentText: '',
    username: localStorage.getItem('username') || '',
    isGameActive: false
};


function init() {
    if (gameState.username) {
        usernameInput.value = gameState.username;
        currentUser.textContent = `Current user: ${gameState.username}`;
        updateStats();
        updateLeaderboard();
    }
    
    newGameBtn.addEventListener('click', startNewGame);
    tryAgainBtn.addEventListener('click', startNewGame);
    textInput.addEventListener('input', handleTyping);
    setUsernameBtn.addEventListener('click', setUsername);
    

    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateLeaderboard(button.dataset.filter);
        });
    });
}

function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

function startNewGame() {
    const randomIndex = Math.floor(Math.random() * passages.length);
    gameState.currentText = passages[randomIndex];
    
    textDisplay.innerHTML = '';
    textInput.value = '';
    results.classList.add('hidden');
    textInput.disabled = false;
    textInput.focus();

    gameState.currentText.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.id = `char-${index}`;
        textDisplay.appendChild(span);
    });
    

    gameState.startTime = Date.now();
    gameState.isGameActive = true;

    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    gameState.timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}


function handleTyping() {
    if (!gameState.isGameActive) return;
    
    const inputText = textInput.value;
    const currentText = gameState.currentText;

    for (let i = 0; i < currentText.length; i++) {
        const charSpan = document.getElementById(`char-${i}`);
        if (i < inputText.length) {
            charSpan.className = inputText[i] === currentText[i] ? 'correct' : 'incorrect';
        } else {
            charSpan.className = '';
        }
    }
    
    if (inputText.length === currentText.length) {
        endGame();
    }
    
    updateGameStats();
}


function updateTimer() {
    const elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    timer.textContent = `${elapsedTime}s`;
}


function updateGameStats() {
    const inputText = textInput.value;
    const currentText = gameState.currentText;
    const elapsedTime = (Date.now() - gameState.startTime) / 1000 / 60; // in minutes
    
    let correctChars = 0;
    for (let i = 0; i < inputText.length; i++) {
        if (inputText[i] === currentText[i]) {
            correctChars++;
        }
    }
    const accuracy = Math.round((correctChars / inputText.length) * 100) || 0;

    const words = correctChars / 5;
    const wpm = Math.round(words / elapsedTime) || 0;
    
    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = `${accuracy}%`;
}





function endGame() {
    gameState.isGameActive = false;
    clearInterval(gameState.timerInterval);
    textInput.disabled = true;
    
    const finalWpm = parseInt(wpmDisplay.textContent);
    const finalAccuracy = parseInt(accuracyDisplay.textContent);
    const finalTime = timer.textContent;
    
    // Update results display
    resultWpm.textContent = finalWpm;
    resultAccuracy.textContent = `${finalAccuracy}%`;
    resultTime.textContent = finalTime;
    results.classList.remove('hidden');

    if (gameState.username) {
        saveGameResult(finalWpm, finalAccuracy, parseInt(finalTime));
    }
}

async function saveGameResult(wpm, accuracy, time) {
    const gameResult = {
        wpm,
        accuracy,
        time,
        date: new Date().toISOString()
    };
    
    // save to local storage:
    const userGames = JSON.parse(localStorage.getItem(`games_${gameState.username}`) || '[]');
    userGames.push(gameResult);
    localStorage.setItem(`games_${gameState.username}`, JSON.stringify(userGames));
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/results`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: gameState.username,
                wpm,
                accuracy,
                time
            })
        });
        
        if (!response.ok) {
            console.warn('Failed to sync with backend');
        }
    } catch (error) {
        console.warn('Error syncing with backend:', error);
    }
    

    updateStats();
    updateLeaderboard();
}
function updateStats() {
    if (!gameState.username) return;
    
    const userGames = JSON.parse(localStorage.getItem(`games_${gameState.username}`) || '[]');
    
    if (userGames.length === 0) {
        avgWpmDisplay.textContent = '0';
        bestWpmDisplay.textContent = '0';
        totalGamesDisplay.textContent = '0';
        avgAccuracyDisplay.textContent = '0%';
        recentGamesContainer.innerHTML = '<div class="no-data">No recent games.</div>';
        return;
    }

    const totalGames = userGames.length;
    const avgWpm = Math.round(userGames.reduce((sum, game) => sum + game.wpm, 0) / totalGames);
    const bestWpm = Math.max(...userGames.map(game => game.wpm));
    const avgAccuracy = Math.round(userGames.reduce((sum, game) => sum + game.accuracy, 0) / totalGames);

    avgWpmDisplay.textContent = avgWpm;
    bestWpmDisplay.textContent = bestWpm;
    totalGamesDisplay.textContent = totalGames;
    avgAccuracyDisplay.textContent = `${avgAccuracy}%`;

    const recentGames = userGames.slice(-5).reverse();
    recentGamesContainer.innerHTML = recentGames.map(game => `
        <div class="recent-game">
            <div class="game-date">${new Date(game.date).toLocaleDateString()}</div>
            <div class="game-stats">
                <span>${game.wpm} WPM</span>
                <span>${game.accuracy}%</span>
                <span>${game.time}s</span>
            </div>
        </div>
    `).join('');
}


async function updateLeaderboard(filter = 'best') {

    const localUsers = Object.keys(localStorage)
        .filter(key => key.startsWith('games_'))
        .map(key => key.replace('games_', ''));
    
    const localLeaderboardData = localUsers.map(username => {
        const games = JSON.parse(localStorage.getItem(`games_${username}`) || '[]');
        const totalGames = games.length;
        const bestWpm = Math.max(...games.map(game => game.wpm), 0);
        const avgWpm = Math.round(games.reduce((sum, game) => sum + game.wpm, 0) / totalGames) || 0;
        
        return { username, totalGames, bestWpm, avgWpm };
    });

    let globalLeaderboardData = [];
    try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard?filter=${filter}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                globalLeaderboardData = data.data;
            }
        }
    } catch (error) {
        console.warn('Error fetching global leaderboard:', error);
    }

    const mergedData = [...localLeaderboardData];
    globalLeaderboardData.forEach(globalUser => {
        const localIndex = mergedData.findIndex(local => local.username === globalUser.username);
        if (localIndex === -1) {
            mergedData.push(globalUser);
        } else {

            mergedData[localIndex] = {
                username: globalUser.username,
                totalGames: Math.max(mergedData[localIndex].totalGames, globalUser.totalGames),
                bestWpm: Math.max(mergedData[localIndex].bestWpm, globalUser.bestWpm),
                avgWpm: Math.max(mergedData[localIndex].avgWpm, globalUser.avgWpm)
            };
        }
    });

    switch (filter) {
        case 'best':
            mergedData.sort((a, b) => b.bestWpm - a.bestWpm);
            leaderboardValueHeader.textContent = 'Best WPM';
            break;
        case 'average':
            mergedData.sort((a, b) => b.avgWpm - a.avgWpm);
            leaderboardValueHeader.textContent = 'Average WPM';
            break;
        case 'games':
            mergedData.sort((a, b) => b.totalGames - a.totalGames);
            leaderboardValueHeader.textContent = 'Best WPM';
            break;
    }
    

    leaderboardBody.innerHTML = mergedData.length === 0 ? 
        '<tr><td colspan="4" class="no-data">No data available</td></tr>' :
        mergedData.map((user, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${filter === 'average' ? user.avgWpm : user.bestWpm}</td>
                <td>${user.totalGames}</td>
            </tr>
        `).join('');
}


function setUsername() {
    const username = usernameInput.value.trim();
    if (username) {
        gameState.username = username;
        localStorage.setItem('username', username);
        currentUser.textContent = `Current user: ${username}`;
        updateStats();
        updateLeaderboard();
    }
}

document.addEventListener('DOMContentLoaded', init);

function updateRecentGames() {
    const recentGamesList = document.getElementById('recent-games');
    recentGamesList.innerHTML = '';

    const recentGames = getRecentGames();
    recentGames.forEach(game => {
        const gameElement = document.createElement('div');
        gameElement.className = 'recent-game';
        gameElement.innerHTML = `
            <span class="game-date">${new Date(game.timestamp).toLocaleString()}</span>
            <div class="game-stats">
                <span>WPM: ${game.wpm}</span>
                <span>Accuracy: ${game.accuracy}%</span>
            </div>
        `;
        recentGamesList.appendChild(gameElement);
    });
} 