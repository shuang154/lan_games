document.addEventListener('DOMContentLoaded', () => {
    // 检查Socket.IO是否已加载
    if (typeof io === 'undefined') {
        console.error('Socket.IO client not loaded.');
        alert('无法连接到服务器，请刷新页面。');
        return;
    }
    
    
    const socket = io({ path: '/games/draw-and-guess/socket.io/' });
// 连接到服务器的Socket.IO实例
    // --- 状态管理 ---
    let myPlayer = { id: null, name: '' };
    let gameState = {};
    let hasJoined = false; // <--- 新增这一行
    let canvas, ctx;
    let drawing = false;
    let currentTool = { color: '#000000', size: 5 };

    // --- DOM元素获取 ---
    const views = {
        setup: document.getElementById('setup-view'),
        game: document.getElementById('game-view'),
        intermission: document.getElementById('intermission-view'),
        gameOver: document.getElementById('game-over-view'),
    };
    
    // 设置视图
    const playerNameInput = document.getElementById('player-name-input');
    const joinBtn = document.getElementById('join-btn');
    const playerList = document.getElementById('player-list');
    const modeSelectionContainer = document.getElementById('mode-selection-container');
    const startGameBtn = document.getElementById('start-game-btn');
    
    // 游戏视图
    const turnCounter = document.getElementById('turn-counter');
    const totalTurns = document.getElementById('total-turns');
    const myScore = document.getElementById('my-score');
    const timerBar = document.getElementById('turn-timer-bar');
    const topicDisplay = document.getElementById('topic-display-drawer');
    const wordToDraw = document.getElementById('word-to-draw');
    const toolbar = document.getElementById('drawing-toolbar');
    const chatMessages = document.getElementById('chat-messages');
    const guessInput = document.getElementById('guess-input');
    const sendGuessBtn = document.getElementById('send-guess-btn');
    const guessWrapper = document.getElementById('guess-input-wrapper');

    // 结束/排名视图
    const correctAnswerDisplay = document.getElementById('correct-answer-display');
    const turnScoreList = document.getElementById('turn-score-list');
    const finalScoreboard = document.getElementById('final-scoreboard');
    const playAgainBtn = document.getElementById('play-again-btn');
    const nextTurnBtn = document.getElementById('next-turn-btn');

    // --- 视图切换 ---
    function switchView(viewId) {
        Object.values(views).forEach(view => view.classList.remove('active-view'));
        views[viewId].classList.add('active-view');
    }

    // --- 画布逻辑 ---
    function setupCanvas() {
        canvas = document.getElementById('drawing-canvas');
        if (!canvas) {
            console.error("无法找到画布元素");
            return;
        }
        
        // 确保画布有尺寸
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            console.warn("画布尺寸为零，等待DOM渲染完成");
            // 此处已经在外层使用了setTimeout，这里不再重复添加
            // 但如果外层没有使用setTimeout，这里应该添加延迟重试
        }
        
        console.log("初始化画布", { width: rect.width, height: rect.height });
        
        // 调整Canvas分辨率以获得更清晰的绘图
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 绑定事件监听器
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
    }

    function getMousePos(evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    function startDrawing(e) {
        // 调试绘图权限
        console.log("尝试绘画 - 当前权限:", {
            isMyTurn: gameState.isMyTurn, 
            myId: myPlayer.id,
            currentDrawerId: gameState.currentDrawerId
        });
            
        if (!gameState.isMyTurn) {
            console.log("无法绘画：不是您的回合");
            return;
        }
        
        drawing = true;
        const pos = getMousePos(e);
        const drawData = {
            type: 'start',
            x: pos.x,
            y: pos.y,
            color: currentTool.color,
            size: currentTool.size,
        };
        handleDraw(drawData);
        socket.emit('draw:data', drawData);
        console.log("开始绘画", drawData);
    }

    function draw(e) {
        if (!drawing || !gameState.isMyTurn) return;
        const pos = getMousePos(e);
        const drawData = {
            type: 'draw',
            x: pos.x,
            y: pos.y,
        };
        handleDraw(drawData);
        socket.emit('draw:data', drawData);
    }

    function stopDrawing() {
        if (!drawing || !gameState.isMyTurn) return;
        drawing = false;
        ctx.beginPath();
        const drawData = { type: 'stop' };
        socket.emit('draw:data', drawData);
    }
    
    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function handleDraw(data) {
        if (!ctx) {
            console.error("无法绘图：canvas上下文不存在");
            // 尝试重新初始化canvas
            if (canvas) {
                console.log("尝试重新获取canvas上下文");
                ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.error("无法重新获取canvas上下文");
                    return;
                }
                // 重新设置ctx属性
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            } else {
                console.error("canvas元素不存在，无法初始化绘图");
                return;
            }
        }
        
        // 设置绘图属性
        ctx.lineWidth = data.size || currentTool.size;
        ctx.strokeStyle = data.color || currentTool.color;

        try {
            switch (data.type) {
                case 'start':
                    ctx.beginPath();
                    ctx.moveTo(data.x, data.y);
                    break;
                case 'draw':
                    ctx.lineTo(data.x, data.y);
                    ctx.stroke();
                    break;
                case 'stop':
                    ctx.beginPath();
                    break;
                case 'clear':
                    clearCanvas();
                    break;
            }
        } catch (err) {
            console.error("绘图时发生错误:", err);
        }
    }
    
// --- 工具栏逻辑 ---
function setupToolbar() {
    toolbar.addEventListener('click', (e) => {
        const target = e.target; // 方便引用

        // --- 处理颜色选择 ---
        if (target.dataset.color) {
            const currentActive = toolbar.querySelector('.color-swatch.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            target.classList.add('active');
            currentTool.color = target.dataset.color;
        }

        // --- 处理笔刷大小选择 ---
        if (target.dataset.size) {
            const currentActive = toolbar.querySelector('.sizes .tool-btn.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            target.classList.add('active');
            currentTool.size = parseInt(target.dataset.size, 10);
        }

        // --- 处理橡皮擦 ---
        if (target.id === 'eraser-btn') {
            const currentActiveColor = toolbar.querySelector('.color-swatch.active');
            if (currentActiveColor) {
                currentActiveColor.classList.remove('active');
            }
            currentTool.color = '#FFFFFF'; // 白色作为橡皮擦
        }

        // --- 处理清空画布 ---
        if (target.id === 'clear-btn') {
            if (confirm('确定要清空所有绘画内容吗？')) {
                clearCanvas();
                socket.emit('draw:data', { type: 'clear' });
            }
        }
    });
}

    // --- 设置视图逻辑 ---
    function renderSetupView() {
        // 渲染玩家列表
        playerList.innerHTML = '';
        const me = gameState.players?.find(p => p.id === myPlayer.id);
        
        gameState.players?.forEach(p => {
            const li = document.createElement('li');
            // 显示准备标记
            li.textContent = `${p.name} ${p.isReady ? '✅' : ''}`;
            playerList.appendChild(li);
        });

        // 渲染模式投票
        document.querySelectorAll('.mode-card').forEach(card => {
            const mode = card.dataset.mode;
            const votes = gameState.votes[mode] || 0;
            const counter = card.querySelector('.vote-counter');
            
            counter.textContent = votes;
            card.classList.toggle('voted', votes > 0);
            
            // 标记我投票的模式
            const myVote = gameState.players.find(p => p.id === myPlayer.id)?.votedMode;
            card.classList.toggle('selected', myVote === mode);
        });

        // 更新开始按钮状态
        if(hasJoined){
            startGameBtn.disabled = false;
            // 根据自己的准备状态，更新按钮文字
            startGameBtn.textContent = me?.isReady ? '取消准备' : '准备';
        } else {
             startGameBtn.disabled = true;
             startGameBtn.textContent = '加入后可准备';
        }
    }
    
   joinBtn.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        // 使用正确的 hasJoined 标志来判断是否可以加入
        if (name && !hasJoined) {
            hasJoined = true; // 标记为已加入，防止重复点击
            myPlayer.name = name;
            socket.emit('player:join', { name });
            playerNameInput.disabled = true;
            joinBtn.disabled = true;
        }
    });

    modeSelectionContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.mode-card');
        if (card && !card.classList.contains('disabled') && myPlayer.id) {
            const mode = card.dataset.mode;
            socket.emit('player:voteMode', { mode });
        }
    });
    
    startGameBtn.addEventListener('click', () => {
        if (hasJoined) { // 只有已加入的玩家才能准备
            socket.emit('player:toggleReady');
        }
    });

    // --- 游戏逻辑 ---
    function addChatMessage(msgData) {
        const item = document.createElement('li');
        item.textContent = msgData.text;
        if(msgData.type) {
            item.classList.add(msgData.type);
        }
        chatMessages.appendChild(item);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function handleGuessSubmit() {
        const guess = guessInput.value.trim();
        if (guess) {
            socket.emit('player:guess', { guess });
            guessInput.value = '';
        }
    }
    
    sendGuessBtn.addEventListener('click', handleGuessSubmit);
    guessInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleGuessSubmit();
    });

    // --- 结束/排名逻辑 ---
    playAgainBtn.addEventListener('click', () => socket.emit('game:playAgain'));
    nextTurnBtn.addEventListener('click', () => {
        nextTurnBtn.disabled = true; // 点击后立刻禁用
        socket.emit('player:readyForNextTurn');
    });

    // --- Socket.IO 事件监听 ---
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        
        // 如果没有ID，使用socket.id作为临时ID
        if (!myPlayer.id) {
            myPlayer.id = socket.id;
            console.log('设置临时玩家ID:', myPlayer.id);
        }
    });
    
    socket.on('state:init', (data) => {
        myPlayer.id = socket.id;
        gameState = data.gameState;
        
        // 尝试在游戏状态中找到自己
        const existingPlayer = gameState.players.find(p => p.name === myPlayer.name);
        if (existingPlayer && hasJoined) {
            console.log("已找到现有玩家信息:", existingPlayer.name, existingPlayer.id);
            // 不重复加入
        }
        
        renderSetupView();
    });
    
    socket.on('state:update', (data) => {
        gameState = data.gameState;
        
        // 总是确保玩家ID与socket.id同步
        if (hasJoined) {
            // 先尝试用名字查找
            const meByName = gameState.players.find(p => p.name === myPlayer.name);
            if (meByName) {
                // 如果服务器上的ID与本地ID不同，更新本地ID
                if (myPlayer.id !== meByName.id) {
                    console.log(`ID同步: 按名字找到玩家，更新ID ${myPlayer.id} -> ${meByName.id}`);
                    myPlayer.id = meByName.id;
                }
            } else if (myPlayer.id !== socket.id) {
                // 如果找不到匹配的名字，使用当前的socket.id
                console.log(`ID同步: 未找到玩家，更新ID ${myPlayer.id} -> ${socket.id}`);
                myPlayer.id = socket.id;
            }
        }
        
        // 找到自己在玩家列表中的记录
        const me = gameState.players.find(p => p.id === myPlayer.id);
        if (me) {
            console.log("状态更新：确认玩家", me.name, "ID:", me.id, "准备状态:", me.isReady);
        } else if (hasJoined) {
            console.warn("警告: 找不到匹配ID的玩家:", myPlayer.id, "尝试使用名字查找");
            const meByName = gameState.players.find(p => p.name === myPlayer.name);
            if (meByName) {
                console.log("通过名字找到玩家，更新ID:", meByName.id);
                myPlayer.id = meByName.id;
            }
        }
        
        renderSetupView();
    });
    
    socket.on('game:started', (data) => {
        gameState = data.gameState;
        
        // 切换到游戏视图
        switchView('game');
        
        // 延迟初始化画布，确保DOM元素已经渲染完成并获得了正确的尺寸
        setTimeout(() => {
            console.log("游戏开始：延迟初始化画布");
            
            if (!canvas || !ctx) {
                setupCanvas();
                setupToolbar();
            } else {
                console.log("游戏开始：画布已初始化");
            }
            
            // 验证canvas是否可用
            if (canvas && ctx) {
                console.log("画布验证成功：", {
                    "canvas": canvas instanceof HTMLCanvasElement,
                    "宽度": canvas.width,
                    "高度": canvas.height
                });
                // 清除旧内容
                clearCanvas();
            } else {
                console.error("画布验证失败", {canvas, ctx});
            }
        }, 50); // 延迟50毫秒，通常足够DOM渲染完成
    });

    socket.on('turn:start', (data) => {
        gameState = data.gameState;
        const me = gameState.players.find(p => p.id === myPlayer.id);
        const drawer = gameState.players.find(p => p.id === gameState.currentDrawerId);
        
        // 添加安全检查，防止因为找不到玩家或画手而导致错误
        if (!me || !drawer) {
            console.error("致命错误：在当前回合中找不到玩家信息。游戏状态可能已不同步，请刷新页面重试。");
            console.log("调试信息 - myPlayer.id:", myPlayer.id);
            console.log("调试信息 - 所有玩家:", gameState.players.map(p => ({ id: p.id, name: p.name })));
            console.log("调试信息 - currentDrawerId:", gameState.currentDrawerId);
            return; // 提前退出，防止后续代码因找不到 me 或 drawer 而崩溃
        }
        
        // 解决可能导致无法作画的问题：确保玩家ID正确同步
        // 优先使用服务器确认的ID
        if (myPlayer.id !== me.id) {
            console.log(`回合开始: 更新ID ${myPlayer.id} -> ${me.id}`);
            myPlayer.id = me.id;
        }
        
        // 更新绘画权限状态
        gameState.isMyTurn = myPlayer.id === gameState.currentDrawerId;
        console.log("当前回合:", {
            "是否是我的回合": gameState.isMyTurn,
            "我的ID": myPlayer.id,
            "当前画手ID": gameState.currentDrawerId
        });
        console.log("绘画权限检查:", {
            myPlayerId: myPlayer.id,
            drawerID: gameState.currentDrawerId,
            isMyTurn: gameState.isMyTurn
        });
        
        // 重置UI
        chatMessages.innerHTML = '';
        timerBar.style.transition = 'none';
        timerBar.style.width = '100%';
        
        // 更新信息显示
        turnCounter.textContent = gameState.currentTurn;
        totalTurns.textContent = gameState.players.length;
        myScore.textContent = me.score;
        addChatMessage({ type: 'system', text: `第 ${gameState.currentTurn} 轮开始，轮到 ${drawer.name} 作画！`});
        
        // 根据角色设置UI
        if(gameState.isMyTurn) {
            topicDisplay.style.display = 'block';
            wordToDraw.textContent = data.word;
            toolbar.style.display = 'flex';
            guessWrapper.style.display = 'none';
        } else {
            topicDisplay.style.display = 'none';
            toolbar.style.display = 'none';
            guessWrapper.style.display = 'flex';
            guessInput.disabled = false;
        }

        switchView('game');
        
        // 延迟初始化画布，确保DOM元素已经完全渲染
        setTimeout(() => {
            console.log("轮次开始：延迟初始化画布");
            
            // 确保画布准备就绪
            if (!canvas || !ctx) {
                setupCanvas();
                setupToolbar();
            }
            
            // 清除旧内容
            clearCanvas();
            
            // 验证画布尺寸
            if (canvas) {
                console.log("画布状态：", {
                    "宽度": canvas.width, 
                    "高度": canvas.height,
                    "是否我的回合": gameState.isMyTurn
                });
            } else {
                console.error("无法获取画布元素");
            }
            
            // 强制重绘以重置计时器动画
            void timerBar.offsetWidth;
            timerBar.style.transition = `width ${gameState.turnDuration}s linear`;
            timerBar.style.width = '0%';
        }, 50); // 延迟50毫秒，确保DOM渲染完成
    });

	// 修改后的代码
    socket.on('draw:data', (data) => {
        // 如果是我的回合（即我是绘画者），那么我已经通过本地操作立即绘图了，
        // 此时应该忽略从服务器广播回来的、由我自己产生的数据，以防止冲突和重复绘制。
        if (gameState.isMyTurn) {
            return;
        }

        // 如果我不是绘画者，那么就处理从服务器收到的绘画数据。
        handleDraw(data);
        
        // 调试信息（可选，可以保留）
        if (data.type === 'start' || data.type === 'clear') {
            console.log("（作为猜题者）收到绘画数据:", data);
        }
    });

    socket.on('chat:update', (data) => {
        addChatMessage(data);
    });
    
    socket.on('player:correctGuess', (data) => {
        // 如果是我猜对了，禁用输入框
        if(data.playerId === myPlayer.id) {
            guessInput.disabled = true;
        }
    });
    
    socket.on('turn:end', (data) => {
        correctAnswerDisplay.textContent = data.word;
        
        // 显示本轮得分
        turnScoreList.innerHTML = '';
        data.turnScores.forEach(item => {
            const p = document.createElement('p');
            p.textContent = `${item.name} +${item.score}分`;
            turnScoreList.appendChild(p);
        });
        
        nextTurnBtn.disabled = false;
        nextTurnBtn.textContent = '继续';
        switchView('intermission');
    });

    socket.on('game:over', (data) => {
        finalScoreboard.innerHTML = '';
        data.finalScores.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="name">${player.name}</span> <span class="score">${player.score}</span>`;
            finalScoreboard.appendChild(li);
        });
        switchView('gameOver');
    });
    
    socket.on('game:reset', () => {
        // 保存当前名称，以便重新加入时可以使用
        const playerName = myPlayer.name;
        
        // 重置客户端状态以进行新游戏
        myPlayer.id = socket.id; // 保持使用当前的socket.id
        hasJoined = true; // 保持加入状态，因为服务端已经有玩家信息了
        
        // 预填用户名但禁用输入，因为玩家已经在游戏中
        playerNameInput.value = playerName || '';
        playerNameInput.disabled = true;
        joinBtn.disabled = true;
        
        // 强制刷新UI
        switchView('setup');
        
        console.log("游戏重置，玩家ID已更新:", socket.id);
        // 不再自动重新加入，因为服务器端已经保留了玩家信息
    });

    // 监听准备人数更新
    socket.on('update:readyCount', (data) => {
        nextTurnBtn.textContent = `等待其他玩家... (${data.readyCount}/${data.totalPlayers})`;
    });

});
