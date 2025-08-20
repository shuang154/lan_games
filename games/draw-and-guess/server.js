// --- 依赖导入 ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// --- 游戏配置 ---
const PORT = 3003; // 确保这个端口和Nginx配置一致
const GAME_PATH = '/games/draw-and-guess'; // 确保这个路径和Nginx/客户端配置一致
const TURN_DURATION_SECONDS = 120; // 每回合时长（秒）

// --- 游戏词库 ---
const classicWords = [
	    "对牛弹琴","胸无点墨", "守株待兔", "打草惊蛇", "虎背熊腰", "眼高手低", "鸡飞狗跳","画蛇添足", "坐井观天",
	    "目瞪口呆", "画龙点睛", "抱头鼠窜", "走马观花", "鼠目寸光", "如鱼得水", "三头六臂", "盲人摸象", "亡羊补牢", "狗急跳墙",
	    "三长两短", "头破血流", "台灯", "口红", "落井下石", "刻舟求剑", "七上八下", "放风筝", "落地灯", "内裤",
	    "烟斗", "鹦鹉", "钻戒", "网址", "牛肉面","刘翔", "棉花", "实验室", "首饰",
	    "水波", "衣橱", "鲜花", "小霸王", "土豆", "音响", "牛奶糖", "语文书", "扬州炒饭",
	    "NBA", "油", "兵马俑", "圣经","红绿灯", "生日派对", "消防员", "火锅", "游乐园", "过山车",
	     "宇航员", "珍珠奶茶", "加油站", "考试", "厨师", "烧烤", "长城", "婚礼", "飞行员", "小龙虾", "电影院",
	      "堵车", "魔术师", "寿司", "图书馆", "拔河", "运动员", "可乐", "超级市场", "钓鱼", "画家", "咖啡", "故宫", 
	      "购物", "程序员", "臭豆腐", "梦想", "全家福", "灵魂", "爱情", "世界末日", "黑洞", "时间", "喜怒哀乐", 
	      "灵感", "异口同声", "既视感", "自由", "十万火急", "口音", "智慧", "睡美人", "二维码", "压力", "美人鱼", 
	      "DNA", "无聊", "盗梦空间", "信号", "丸子"
	   ];
	                  
// --- 服务器设置 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    path: `${GAME_PATH}/socket.io/`,
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 游戏状态管理 ---
let gameState = resetGameState();

function resetGameState() {
    // 直接返回新对象，在首次运行时这是最安全的
    return {
        players: [],
        votes: {},
        gamePhase: 'setup',
        gameMode: null,
        currentTurn: 0,
        currentDrawerId: null,
        currentWord: '',
        turnOrder: [],
        turnTimer: null,
        turnDuration: TURN_DURATION_SECONDS,
        // 添加当前工具状态的"记忆"，用于保持绘画工具的一致性
        currentToolState: { color: '#000000', size: 5, tool: 'pen' }
    };
}

// --- 游戏核心逻辑 ---

function getShuffledWords() {
    return [...classicWords].sort(() => Math.random() - 0.5);
}

function chooseWinningMode() {
    const voteCounts = Object.entries(gameState.votes)
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count);

    return voteCounts.length > 0 ? voteCounts[0].mode : 'classic';
}

function startGame() {
    gameState.gameMode = chooseWinningMode();
    gameState.wordList = getShuffledWords();
    gameState.turnOrder = gameState.players.map(p => p.id).sort(() => Math.random() - 0.5);

    console.log(`[Game Start] Mode: ${gameState.gameMode}. Player order: ${gameState.turnOrder.join(', ')}`);
    
    io.emit('game:started', { gameState });
    startTurn();
}

function startTurn() {
    gameState.gamePhase = 'playing';
    gameState.currentTurn++;

    if (gameState.currentTurn > gameState.players.length) {
        endGame();
        return;
    }

    // 重置玩家回合状态
    gameState.players.forEach(p => p.hasGuessedCorrectly = false);
    
    // 每回合开始时，重置服务器的工具"记忆"为默认值
    gameState.currentToolState = { color: '#000000', size: 5, tool: 'pen' };

    gameState.currentDrawerId = gameState.turnOrder[gameState.currentTurn - 1];
    gameState.currentWord = gameState.wordList.pop();

    console.log(`[Turn ${gameState.currentTurn}] Drawer: ${gameState.currentDrawerId}, Word: ${gameState.currentWord}`);

    io.emit('turn:start', {
        gameState,
        word: gameState.currentWord
    });

    // 设置回合结束计时器
    if (gameState.turnTimer) clearTimeout(gameState.turnTimer);
    gameState.turnTimer = setTimeout(endTurn, gameState.turnDuration * 1000);
}

function endTurn() {
    if (gameState.gamePhase !== 'playing') return; // 防止重复调用

    gameState.gamePhase = 'intermission';
    if (gameState.turnTimer) clearTimeout(gameState.turnTimer);
    
    // 计算本轮得分
    const turnScores = gameState.players
        .filter(p => p.turnScore > 0)
        .map(p => ({ name: p.name, score: p.turnScore }));
    
    // 重置回合分数
    gameState.players.forEach(p => p.turnScore = 0);

    io.emit('turn:end', {
        word: gameState.currentWord,
        turnScores: turnScores
    });
}

function endGame() {
    gameState.gamePhase = 'gameOver';
    if (gameState.turnTimer) clearTimeout(gameState.turnTimer);

    const finalScores = [...gameState.players]
        .sort((a, b) => b.score - a.score);
    
    io.emit('game:over', { finalScores });
}


// --- Socket.IO 连接与事件处理 ---
io.on('connection', (socket) => {
    console.log(`[Connection] A user connected: ${socket.id}`);

    // 1. 新玩家连接
    socket.emit('state:init', { gameState });

    // 2. 玩家加入游戏
    socket.on('player:join', ({ name }) => {
        const newPlayer = {
            id: socket.id,
            name: name,
            score: 0,
            turnScore: 0, // 用于记录单回合得分
            votedMode: null,
            isReady: false, // 新增准备状态
            readyForNext: false,
            hasGuessedCorrectly: false,
        };
        gameState.players.push(newPlayer);
        console.log(`[Player Join] ${name} (${socket.id}) joined. Total players: ${gameState.players.length}`);
        io.emit('state:update', { gameState });
    });

    // 3. 玩家投票选择模式
    socket.on('player:voteMode', ({ mode }) => {
        const player = gameState.players.find(p => p.id === socket.id);
        if (player) {
            player.votedMode = mode;
            // 重新计算总票数
            gameState.votes = gameState.players.reduce((acc, p) => {
                if (p.votedMode) {
                    acc[p.votedMode] = (acc[p.votedMode] || 0) + 1;
                }
                return acc;
            }, {});
            io.emit('state:update', { gameState });
        }
    });
    
    // 4. 玩家准备状态切换
    socket.on('player:toggleReady', () => {
        const player = gameState.players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = !player.isReady; // 切换准备状态
            io.emit('state:update', { gameState }); // 更新所有客户端的UI

            // 检查是否所有人都准备好了
            if (gameState.players.length >= 2 && gameState.players.every(p => p.isReady)) {
                startGame(); // 调用开始游戏函数
            }
        }
    });

    // 5. 同步绘画数据
    socket.on('draw:data', (data) => {
        // 检查此用户是否是当前的画手
        if (socket.id !== gameState.currentDrawerId) return;
        
        // 根据数据类型分别处理
        if (data.type === 'start') {
            // 当收到'start'事件时，更新服务器的"记忆"
            if (data.color) gameState.currentToolState.color = data.color;
            if (data.size) gameState.currentToolState.size = data.size;
            if (data.tool) gameState.currentToolState.tool = data.tool;
            
            // 直接广播原始数据，因为它已经包含了正确的工具信息
            io.emit('draw:data', data);
            console.log(`[Draw Start] 更新工具状态: ${JSON.stringify(gameState.currentToolState)}`);
            
        } else if (data.type === 'draw') {
            // 当收到'draw'事件时（只有坐标），附加上服务器"记忆"的工具信息
            const broadcastData = {
                ...data, // 包含 { type: 'draw', x, y }
                ...gameState.currentToolState // 附加上 { color, size, tool }
            };
            io.emit('draw:data', broadcastData);
            
        } else if (data.type === 'end') {
            // 结束一笔，保持工具状态
            io.emit('draw:data', {
                ...data,
                ...gameState.currentToolState
            });
            
        } else {
            // 对于 'clear' 等其他事件，直接广播
            io.emit('draw:data', data);
        }
    });

    // 6. 玩家猜词
    socket.on('player:guess', ({ guess }) => {
        const player = gameState.players.find(p => p.id === socket.id);
        const drawer = gameState.players.find(p => p.id === gameState.currentDrawerId);
        
        // 确保玩家存在、不是画手、且本回合未猜对
        if (!player || player.id === drawer.id || player.hasGuessedCorrectly) return;
        
        if (guess.trim().toLowerCase() === gameState.currentWord.toLowerCase()) {
            // 猜对了！
            player.hasGuessedCorrectly = true;
            
            // 计算得分
            const guessersCount = gameState.players.filter(p => p.hasGuessedCorrectly).length;
            const points = Math.max(100 - (guessersCount - 1) * 20, 40); // 100, 80, 60, 40...
            player.score += points;
            player.turnScore += points;
            
            if (drawer) {
                const drawerPoints = 50;
                drawer.score += drawerPoints;
                drawer.turnScore += drawerPoints;
            }
            
            io.emit('player:correctGuess', { playerId: player.id });
            io.emit('chat:update', { type: 'correct', text: `🎉 ${player.name} 猜对了！` });
            
            // 检查是否所有人都猜对了
            const allGuessed = gameState.players.every(p => p.id === drawer.id || p.hasGuessedCorrectly);
            if (allGuessed) {
                endTurn();
            }

        } else {
            // 猜错了
            io.emit('chat:update', { type: 'guess', text: `${player.name}: ${guess}` });
        }
    });
    
    // 7. 玩家准备好进入下一轮
    socket.on('player:readyForNextTurn', () => {
        const player = gameState.players.find(p => p.id === socket.id);
        if(player) player.readyForNext = true;

        // 计算准备人数并广播
        const readyCount = gameState.players.filter(p => p.readyForNext).length;
        const totalPlayers = gameState.players.length;
        io.emit('update:readyCount', { readyCount, totalPlayers });

        // 使用已计算好的变量来判断
        if (readyCount === totalPlayers) {
            gameState.players.forEach(p => p.readyForNext = false); // 重置准备状态
            startTurn();
        }
    });

    // 8. 重新开始一局游戏
    socket.on('game:playAgain', () => {
        if (gameState.turnTimer) {
            clearTimeout(gameState.turnTimer);
        }
        
        // 只重置游戏状态，保留玩家但重置他们的状态
        const existingPlayers = gameState.players.map(player => ({
            id: player.id,
            name: player.name,
            score: 0,
            turnScore: 0,
            votedMode: null,
            isReady: false, // 确保所有玩家都是未准备状态
            readyForNext: false,
            hasGuessedCorrectly: false
        }));
        
        // 重置游戏状态但保留玩家列表
        gameState = {
            ...resetGameState(),
            players: existingPlayers
        };
        
        io.emit('game:reset');
        io.emit('state:update', { gameState });
    });

    // 9. 玩家断开连接
    socket.on('disconnect', () => {
        const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const disconnectedPlayer = gameState.players[playerIndex];
            gameState.players.splice(playerIndex, 1);
            console.log(`[Player Left] ${disconnectedPlayer.name} left. Total players: ${gameState.players.length}`);
            
            // 如果游戏正在进行
            if(gameState.gamePhase === 'playing') {
                // 如果画手掉线，直接结束本回合
                if(disconnectedPlayer.id === gameState.currentDrawerId){
                    io.emit('chat:update', { type: 'system', text: `作画者 ${disconnectedPlayer.name} 已掉线，本轮结束。` });
                    endTurn();
                }
            }
            io.emit('state:update', { gameState });
        }
    });
});

// --- 启动服务器 ---
server.listen(PORT, () => {
    console.log(`
    ---------------------------------------------
    🎨 Draw & Guess Server is running!
    📡 Listening on port: ${PORT}
    🔗 Access Path: ${GAME_PATH}
    ---------------------------------------------
    `);
});
