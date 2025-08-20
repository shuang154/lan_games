// --- 可配置部分 ---
const socket = io({ path: '/games/connoisseur-of-lies/socket.io/' });
// --- End ---

// --- DOM Elements ---
const views = document.querySelectorAll('.view');
const playerNameInput = document.getElementById('player-name-input');
const joinBtn = document.getElementById('join-btn');
const playerList = document.getElementById('player-list');
const startGameBtn = document.getElementById('start-game-btn');

const questionText = document.getElementById('question-text');
const lieInput = document.getElementById('lie-input');
const submitLieBtn = document.getElementById('submit-lie-btn');
const lieSubmissionContent = document.getElementById('lie-submission-content');
const waitingForOthersContent = document.getElementById('waiting-for-others-content');

const answerOptionsContainer = document.getElementById('answer-options-container');
const resultsList = document.getElementById('results-list');
const nextRoundBtn = document.getElementById('next-round-btn');

const scoreboardList = document.getElementById('scoreboard-list');
const continueGameBtn = document.getElementById('continue-game-btn');
const winnerNameDisplay = document.getElementById('winner-name-display');
const restartGameBtn = document.getElementById('restart-game-btn');
const explanationBox = document.getElementById('explanation-box');
const explanationText = document.getElementById('explanation-text');
// --- Local State ---
let localPlayer = {};

// --- View Management ---
function showView(viewId) {
    views.forEach(view => {
        view.classList.toggle('active-view', view.id === viewId);
    });
}

// --- Event Listeners (Client Actions) ---
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        socket.emit('joinGame', { name });
        playerNameInput.disabled = true;
        joinBtn.disabled = true;
        localPlayer.name = name;
    }
});

startGameBtn.addEventListener('click', () => socket.emit('startGame'));
submitLieBtn.addEventListener('click', () => {
    const lie = lieInput.value.trim();
    if (lie) {
        socket.emit('submitLie', { lie });
    }
});
nextRoundBtn.addEventListener('click', () => {
    // 只请求自己的计分板数据，不影响他人
    socket.emit('requestScoreboard');
});
continueGameBtn.addEventListener('click', (e) => {
    socket.emit('requestNextPhase');
    e.target.disabled = true;
    e.target.textContent = '已就绪，等待中...';
});
restartGameBtn.addEventListener('click', () => socket.emit('restartGame'));


answerOptionsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('answer-option')) {
        const voteText = e.target.textContent;
        socket.emit('submitVote', { voteText });
        // Visually mark the voted option
        document.querySelectorAll('.answer-option').forEach(btn => btn.classList.add('voted'));
        e.target.style.borderColor = 'var(--c-player-4)';
    }
});


// --- Socket Event Handlers (Server Updates) ---
socket.on('updatePlayers', (players) => {
    playerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        li.style.backgroundColor = p.color;
        playerList.appendChild(li);
    });
    if (localPlayer.isHost) {
        startGameBtn.disabled = players.length < 2;
        startGameBtn.textContent = players.length < 2 ? '至少需要2名玩家' : '开始游戏';
    }
});

socket.on('joined', ({ isHost }) => {
    localPlayer.isHost = isHost;
    startGameBtn.classList.toggle('hidden', !isHost);
});

socket.on('newRound', ({ question }) => {
    questionText.textContent = question.question;
    document.getElementById('question-category').textContent = question.category;
    lieInput.value = '';
    lieSubmissionContent.classList.remove('hidden');
    waitingForOthersContent.classList.add('hidden');
    showView('writing-view');
});

socket.on('lieSubmitted', () => {
    lieSubmissionContent.classList.add('hidden');
    waitingForOthersContent.classList.remove('hidden');
});

socket.on('startVoting', ({ answers }) => {
    answerOptionsContainer.innerHTML = '';
    answers.forEach(text => {
        const button = document.createElement('button');
        button.className = 'answer-option';
        button.textContent = text;
        answerOptionsContainer.appendChild(button);
    });
    showView('voting-view');
});

socket.on('showResults', (payload) => {
    resultsList.innerHTML = '';
    payload.answers.forEach(ans => {
        const item = document.createElement('div');
        item.className = 'result-item';
        if (ans.isTruth) item.classList.add('is-truth');

        const votersHtml = ans.voters.map(v => `<span class="voter-chip" style="background-color:${v.color}">${v.name}</span>`).join('');

        // This logic is now much simpler and safer
        const authorName = ans.authorName;
        const authorColor = ans.authorColor;

        const pointsForAuthor = ans.authorId !== 'system' ? (payload.points[ans.authorId] || 0) : 0;

        item.innerHTML = `
            <div class="result-answer">${ans.text}</div>
            <div class="result-author">
                作者: <span style="color: ${authorColor}">${authorName}</span>
            </div>
            <div class="voters-list">${votersHtml.length > 0 ? votersHtml : '<p style="font-size:12px; color:#9a9a9a;">无人投此票</p>'}</div>
        `;
        resultsList.appendChild(item);
    });
    if (payload.explanation) {
        explanationText.textContent = payload.explanation;
        explanationBox.classList.remove('hidden');
    } else {
        explanationBox.classList.add('hidden');
    }

    // 确保按钮对所有人可见并可用
    nextRoundBtn.disabled = false;
    nextRoundBtn.textContent = '查看计分板';
    showView('results-view');
});

socket.on('showScoreboard', ({ players }) => {
    scoreboardList.innerHTML = '';
    players.sort((a,b) => b.score - a.score).forEach(p => {
        const item = document.createElement('li');
        item.className = 'score-item';
        item.innerHTML = `
            <span class="name" style="color: ${p.color}">${p.name}</span>
            <span class="score">${p.score} 分</span>
        `;
        scoreboardList.appendChild(item);
    });
    continueGameBtn.disabled = false;
    continueGameBtn.textContent = '下一回合';
    showView('scoreboard-view');
});


socket.on('gameOver', ({ winnerName }) => {
    winnerNameDisplay.textContent = `🏆 ${winnerName} 🏆`;
    restartGameBtn.classList.toggle('hidden', !localPlayer.isHost);
    showView('game-over-view');
});

socket.on('resetToSetup', () => {
    playerNameInput.disabled = false;
    joinBtn.disabled = false;
    startGameBtn.disabled = true;
    startGameBtn.textContent = '等待房主开始游戏';
    showView('setup-view');
});

// 添加这个全新的处理器
socket.on('updateReadyCount', ({ readyCount, totalPlayers }) => {
    const waitingText = `等待其他玩家... (${readyCount}/${totalPlayers})`;

    // 逻辑简化：此事件现在只可能在计分板视图触发
    if(document.getElementById('scoreboard-view').classList.contains('active-view')) {
        continueGameBtn.textContent = waitingText;
    }
});

// Initial view
showView('setup-view');