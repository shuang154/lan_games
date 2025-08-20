const http = require('http');
const express = require('express');
const { Server } = require("socket.io");

// --- 可配置部分 ---
const PORT = process.env.PORT || 3002;
const GAME_PATH = '/games/connoisseur-of-lies';
const WINNING_SCORE = 3000; // 胜利所需分数
// --- End ---

const app = express();
app.use(express.static(__dirname)); 
const server = http.createServer(app);
const io = new Server(server, {
    path: `${GAME_PATH}/socket.io/`,
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PLAYER_COLORS = ['#e1b3b3', '#b3e1c1', '#b3cbe1', '#d1b3e1', '#e1d4b3', '#e1c4b3', '#b3e1d5'];

// --- 全新、扩充后的高质量题库 ---
const QUESTIONS = [
    { category: "动物奇闻", question: "章鱼有多少颗心脏？", answer: "3颗", explanation: "章鱼有三个心脏。一个主心脏负责将含氧血液泵送到全身，另外两个较小的心脏则专门负责将血液泵过鳃进行氧合。" },
    { category: "历史文化", question: "在古罗马，哪种颜色是财富和地位的象征，且仅限皇帝和元老院议员穿着？", answer: "紫色", explanation: "泰尔紫（Tyrian purple）是一种从海螺中提取的珍贵染料，生产成本极其高昂，因此在古罗马成为权力的专属颜色。" },
    { category: "奇特法规", question: "在哪个国家，以国家元首的名字给猪命名是违法的？", answer: "法国", explanation: "这项奇特的法律源于对国家象征的尊重，至今仍然有效。虽然很少被执行，但它反映了法国文化中对历史和权威的一种特殊态度。" },
    { category: "人体奥秘", question: "人一生中产生的唾液，大约可以装满多少个50米的游泳池？", answer: "2个", explanation: "一个成年人每天大约分泌1到1.5升的唾液。一生累积下来，总量可以达到数万升，足以装满两个标准大小的游泳池。" },
    { category: "科学发现", question: "唯一不能实现“自我清洁”的身体器官是什么？", answer: "牙齿", explanation: "皮肤会脱落更新，眼睛有泪水冲洗，但牙齿的牙釉质一旦被腐蚀或损坏，是无法自我再生的，必须依靠外部清洁来维持健康。" },
    { category: "植物世界", question: "世界上最古老的活体树木年龄大约是多少岁？", answer: "约5000岁", explanation: "位于美国加州白山的一棵名为“玛土撒拉”的刺果松，被认为是地球上最长寿的非克隆生物，年龄超过4850年。" },
    { category: "太空探索", question: "宇航员在太空中会变高吗？", answer: "是的", explanation: "在没有地球引力的环境下，宇航员的脊椎会伸展，身高通常会增加约3%，即大约5厘米。回到地球后会恢复原状。" },
    { category: "日常用品", question: "我们现在常用的“气泡包装纸”最初是作为什么产品发明的？", answer: "三维立体壁纸", explanation: "1957年，工程师们试图发明一种有纹理的塑料壁纸，但市场反响平平。后来他们才发现这种材料作为包装填充物有绝佳的缓冲效果。" },
    { category: "地理奇观", question: "哪个国家的国旗是世界上唯一一个非矩形的国旗？", answer: "尼泊尔", explanation: "尼泊尔国旗由两个重叠的三角旗组成，代表喜马拉雅山脉，也象征该国两大宗教——印度教和佛教。" },
    { category: "美食历史", question: "胡萝卜最初是什么颜色的？", answer: "紫色或白色", explanation: "我们今天常见的橙色胡萝卜是在17世纪的荷兰，由农民为致敬奥兰治王室（House of Orange）而专门培育出来的。" },
    { category: "动物行为", question: "什么动物的粪便是立方体形状的？", answer: "袋熊", explanation: "袋熊拥有独特的肠道结构，肠壁弹性不均，这使得它们消化后的粪便被塑造成近似完美的立方体，用于标记领地且不易滚走。" },
    { category: "语言文字", question: "英语中哪个常用单词没有元音字母 (a, e, i, o, u)？", answer: "Rhythm (节奏)", explanation: "在单词 'rhythm' 中，字母 'y' 充当了元音的角色，发出了元音的声音。这是英语中一个非常特殊的例子。" },
    { category: "社会习俗", question: "在维多利亚时代的英国，人们会为逝去的亲人拍摄什么类型的照片？", answer: "与尸体的合影", explanation: "这种被称为“遗体摄影”的习俗在当时非常普遍，因为摄影术刚发明不久且价格昂贵，这常常是普通家庭为亲人留下的唯一肖像。" },
    { category: "化学元素", question: "金属“镓”（Gallium）有什么奇特的物理特性？", answer: "可以在手心融化", explanation: "镓的熔点只有29.76摄氏度（约85.58华氏度），略高于室温，因此放在手心，体温就足以使其从固态变为液态。" },
    { category: "建筑奇迹", question: "比萨斜塔从一开始就是倾斜的吗？", answer: "是的", explanation: "比萨斜塔在始建于1173年，当工程进行到第三层时，由于地基不均和土层松软，塔身就已经开始倾斜了。" },
    { category: "海洋生物", question: "哪种水母被认为是“永生不老”的？", answer: "灯塔水母", explanation: "灯塔水母在达到性成熟阶段后，可以重新回到幼年的水螅型状态，理论上这个过程可以无限重复，使其免于自然死亡。" },
    { category: "科技历史", question: "第一只电脑鼠标是用什么材料制成的？", answer: "木头", explanation: "1964年，道格拉斯·恩格尔巴特发明的第一个鼠标原型，其外壳是用木头手工雕刻的，下面装有两个金属滚轮。" },
    { category: "艺术文化", question: "达芬奇的名画《蒙娜丽莎》有眉毛吗？", answer: "原本有，但消失了", explanation: "研究发现，达芬奇确实画了眉毛和睫毛，但经过数个世纪的修复和清洁，这些精细的笔触被逐渐磨损和溶解，最终消失了。" },
    { category: "金融趣闻", question: "哪个国家曾发行过面值为100万亿的钞票？", answer: "津巴布韦", explanation: "2009年，由于极度的通货膨胀，津巴布韦发行了面值为100万亿（1后面有14个零）的津巴布韦元，但这笔钱当时甚至不够买一个面包。" },
    { category: "体育历史", question: "在古代奥运会上，获胜的运动员会获得什么作为奖励？", answer: "一个橄榄枝花环", explanation: "古代奥运会更注重荣誉而非物质奖励。冠军的最高奖赏是从奥林匹亚宙斯神庙旁的圣橄榄树上切下的枝条编成的花环。" },
    { category: "历史趣闻", question: "在19世纪的美国，番茄酱（Ketchup）最初是作为哪种商品销售的？", answer: "药品", explanation: "在1830年代，医生们声称番茄酱可以治疗消化不良、腹泻等疾病，并将其制成药片出售。后来，它才逐渐演变为我们今天所知的调味品。" },
    { category: "科学奇观", question: "由于热胀冷缩，巴黎的埃菲尔铁塔在夏天会比冬天高出大约多少厘米？", answer: "约15厘米", explanation: "构成塔身的钢铁在夏天受热膨胀，导致整个结构向上伸展。这个高度变化虽然可观，但肉眼难以察觉。" },
    { category: "文化趣闻", question: "哪一个现代国家的官方国家动物是神话中的“独角兽”？", answer: "苏格兰", explanation: "自15世纪以来，独角兽一直是苏格兰的国家象征，代表着纯洁、纯真和力量。它经常出现在苏格兰的皇家徽章上。" },
    { category: "商业历史", question: "著名的电子游戏公司任天堂（Nintendo）在成立之初是做什么的？", answer: "制作花札（一种纸牌）", explanation: "任天堂于1889年成立，最初是一家手工制作和销售名为“花札”的日本传统纸牌的公司。直到20世纪下半叶，它才逐渐转型进入电子游戏领域。" },
    { category: "医疗器械", question: "现代外科手术中常用的“电锯”最初是为哪个医学领域发明的？", answer: "助产（帮助分娩）", explanation: "在18世纪，两名苏格兰医生发明了手摇链锯，用于在困难的分娩过程中切开产妇的骨盆，以扩大产道。后来这种工具才被应用于木工和外科手术。" },
    { category: "植物学",  question: "从植物学分类上看，牛油果（Avocado）属于哪一类水果？",  answer: "浆果（Berry）",  explanation: "在植物学定义中，浆果是从单一子房发育而来的肉质果实。牛油果、香蕉、甚至西瓜都符合这个定义，而草莓和覆盆子反而不属于真正的浆果。" },
    { category: "人体奥秘", question: "人类大脑本身能感觉到疼痛吗？", answer: "不能", explanation: "大脑是处理全身疼痛信号的中枢，但它自身内部没有疼痛感受器。这就是为什么外科医生可以在患者保持清醒的状态下进行脑部手术。" },
    { category: "语言文字", question: "在英文字母 i 和 j 上方的小点，有一个专门的名称叫什么？", answer: "Tittle (标题点/音点)", explanation: "这个词源自拉丁语 'titulus'，意为“标题”或“题词”。这个小点在排版和书法中是字母不可或缺的一部分。" },
    { category: "社会统计", question: "在美国，每年因自动售货机倒下致死的人数与哪种动物的攻击致死人数相当甚至更多？", answer: "鲨鱼", explanation: "统计数据显示，因摇晃自动售货机导致其翻倒被砸死的事故，虽然罕见，但比全球每年发生的鲨鱼无端攻击致死事件要多。这提醒人们不要“攻击”自动售货机。" },
    { category: "发明家轶事", question: "“品客”薯片的发明者弗雷德里克·鲍尔（Fredric Baur）去世后，他的部分骨灰被安放在哪里？", answer: "一个品客薯片罐里", explanation: "这是他生前的愿望。他对自己的这项发明——特别是独特的罐子设计——感到非常自豪。他的家人遵从了他的遗愿，将部分骨灰装在品客原味薯片罐中下葬。" },
    { category: "历史误解", question: "“吃胡萝卜能改善夜视能力”这个说法的起源是什么？", answer: "二战时期的英国宣传", explanation: "二战期间，英国皇家空军为了掩盖他们新发明的机载雷达技术的秘密，便对外宣传称，他们的王牌飞行员因大量食用胡萝卜而拥有了超凡的夜间视力。" },
    { category: "海洋生物",question: "乌贼（Cuttlefish）喷出的墨汁在古代除了防御，还有什么重要用途？",answer: "作为墨水书写",explanation: "乌贼墨是“sepia ink”（乌贼墨）的来源，这种棕色的墨水在古代罗马和希腊被广泛用于书写和绘画，其名称 'sepia' 本身就源于希腊语的“乌贼”。"},
    { category: "动物奇闻", question: "海马是由哪一方怀孕并产子？", answer: "雄性海马", explanation: "在海马中，雄性拥有育儿袋，雌性将卵产入雄性的育儿袋中，由雄性进行孵化和产子。" },
    { category: "自然现象", question: "为什么天空在黄昏时会呈现红色？", answer: "大气散射", explanation: "阳光穿过更多大气层时，短波长的蓝光被散射掉，剩下较多的红橙色光到达我们眼中，形成红霞。" },
    { category: "科技趣闻", question: "世界上第一个电脑病毒叫什么名字？", answer: "Creeper", explanation: "Creeper 病毒出现在 1971 年，最初传播在 ARPANET 上，会在系统上显示 'I'M THE CREEPER'。" },
    { category: "历史奇闻", question: "谁是第一个登上月球的非美国或苏联宇航员？", answer: "截至目前无", explanation: "到目前为止，只有美国和苏联（俄罗斯）有登月记录，其他国家的宇航员尚未单独登陆月球。" },
    { category: "文化趣闻", question: "日本有哪种节日是祭拜死鱼的？", answer: "鲤鱼旗节（端午节）", explanation: "端午节期间，人们会挂起鲤鱼旗，以鲤鱼象征力量和祝福，而不是死鱼。" },
    { category: "植物奇趣", question: "世界上最长寿的植物误以为是树木，实际上是菌类，它是什么？", answer: "灰色木耳", explanation: "灰树梗伞（俗称长寿菌）是大型真菌，通过真菌体（菌丝体）可以活数千年。" },
    { category: "物理奇妙", question: "声音在水中传播的速度比空气中快还是慢？", answer: "快", explanation: "声音在水中的传播速度约为 1500 m/s，比空气中的约 340 m/s 快得多，因此水下声音能传播更远。" },
    { category: "数学奇趣", question: " '零'这个数字是谁发明的？", answer: "印度人", explanation: "‘零’的概念最早在古印度出现，由数学家发明并传播到阿拉伯再到欧洲，开启了现代数学。" },
    { category: "语言趣味", question: "世界上使用最广泛的第二语言是什么？", answer: "英语", explanation: "母语使用者最多的是汉语，但作为第二语言被学习最广的语言是英语，全球约有 10 亿人作为二语使用。" },
    { category: "食品冷门", question: "可可豆是巧克力吗？", answer: "不是", explanation: "可可豆是制作巧克力的原料，但需要经过发酵、烘焙、研磨、脱脂、加糖等多道工序，才能成为我们吃的巧克力。" },
    { category: "航天奇闻", question: "国际空间站上有厕所吗？", answer: "有", explanation: "空间站装备了微重力环境专用的厕所，利用风扇形成气流将废物吸入收集容器。" },
    { category: "社会文化", question: "哪个国家有用邮票作为垃圾袋的小费？", answer: "日本", explanation: "在日本，有人会把多余的邮票贴在垃圾分类袋上，表示已经支付处理费用，也算“垃圾袋贴邮票留垃圾袋”文化。" },
    { category: "艺术趣闻", question: "莫奈画《睡莲》系列用了多长时间？", answer: "约 30 年", explanation: "莫奈从 1899 年开始创作《睡莲》，直到 1920 年代末期才陆续完成，前后经历约 30 年。" },
    { category: "音乐趣味", question: "世界上最早的录音音乐形式是什么？", answer: "圆柱形留声机", explanation: "托马斯·爱迪生 1877 年发明圆柱形留声机，制作带有沟槽的锡箔纸，可以录制和播放声音。" },
    { category: "生理秘密", question: "人体能自行合成维生素 C 吗？", answer: "不能", explanation: "人类缺乏一个合成维生素 C 的关键酶，因此必须从食物中摄取，如柑橘、猕猴桃等。" },
    { category: "时间趣闻", question: "为什么一年有 365.2422 天？", answer: "地球公转周期", explanation: "地球绕太阳一周大约需要 365.2422 天，这也是我们设置闰年的原因，以校正时间差异。" },
    { category: "动物趣闻", question: "哪种鸟类是世界上飞得最高的？", answer: "安第斯秃鹰", explanation: "安第斯秃鹰曾被观测到在 7000 米高空飞行，利用稀薄空气与强风完成长距离迁徙。" },
    { category: "自然奇观", question: "世界上最大的沙漠其实不是撒哈拉，它是？", answer: "南极洲", explanation: "沙漠是指降雨极少的区域，南极洲年降水极少，是最大的冷沙漠，其面积约为 1400 万平方公里。" },
    { category: "物种趣闻", question: "世界上最小的鸟是什么？", answer: "蜜蜂蜂鸟", explanation: "蜜蜂蜂鸟（Bee Hummingbird）来自古巴，体长仅约 6 cm，重量只有约 1.6 克，是已知最小的鸟类。" },
    { category: "心理学趣闻", question: "为什么害怕空旷场所有时更恐惧？", answer: "生理本能", explanation: "空旷空间意味着没有掩护，易暴露在危险中，这是远古人类的本能恐惧，现代依然影响心理。" },
    { category: "科技历史", question: "WiFi信号强度单位‘dBm’中的‘m’代表什么？", answer: "毫瓦（milliwatt）", explanation: "dBm是相对于1毫瓦功率的分贝值，0dBm=1毫瓦。这是无线通信中衡量绝对功率的标准单位。" },
    { category: "植物世界", question: "什么植物的种子需要经历森林大火才能发芽？", answer: "班克木", explanation: "班克木的种荚被树脂密封，只有大火高温熔化树脂后，种子才能脱落并在肥沃的灰烬中萌发。" },
    { category: "历史趣闻", question: "中世纪欧洲骑士比武时，长枪为什么设计成中空？", answer: "防止刺穿对手", explanation: "中空结构使长枪在撞击时碎裂，避免致命穿刺。碎片数量甚至用作计分依据——碎片越多说明攻击越精准。" },
    { category: "地理奇观", question: "地球上最干燥的地方是南极还是撒哈拉沙漠？", answer: "南极", explanation: "南极麦克默多干谷（McMurdo Dry Valleys）200万年未降雨，湿度低于撒哈拉，是火星环境模拟基地。" },
    { category: "化学元素", question: "为什么纯金戒指用牙咬会有牙印？", answer: "黄金硬度极低", explanation: "纯金莫氏硬度仅2.5（与指甲相当），牙齿珐琅质硬度达5，因此能轻易留下咬痕。这是古代鉴别黄金真伪的方法。" },
    { category: "艺术文化", question: "贝多芬作曲时如何克服耳聋？", answer: "咬住木棒感受钢琴振动", explanation: "他将木棒一端抵住钢琴，另一端用牙咬住，通过骨骼传导感知音符振动。晚期作品如《第九交响曲》由此诞生。" },
    { category: "科学发现", question: "太阳系中哪颗行星的自转方向与其他行星相反？", answer: "金星", explanation: "金星以243地球日自转一周，且方向自东向西（逆时针），与太阳系其他行星相反。成因可能是远古巨型撞击。" },
    { category: "法律趣闻", question: "在阿拉斯加，什么动物可合法作为‘伴娘’？", answer: "宠物驯鹿", explanation: "因原住民文化中驯鹿象征幸运，州法允许婚礼中驯鹿佩戴花环担任‘荣誉伴娘’。" },
    { category: "商业历史", question: "可口可乐最初是什么颜色？", answer: "绿色", explanation: "1886年配方中的焦糖色素较少，饮料呈淡绿色。后为统一品质增加色素，才变为标志性深棕色。" },
    { category: "语言文字", question: "哪种语言用眨眼表示‘是’？", answer: "马赛语（肯尼亚）", explanation: "马赛族人用快速眨眼表示肯定，这是避免野兽发现猎人的古老沟通方式，沿用至今。" },
    { category: "太空探索", question: "宇航服内为什么需要添加金粉？", answer: "反射红外辐射", explanation: "面罩镀金层能反射太阳红外线，避免宇航员面部灼伤。每套宇航服使用约1.5克黄金。" },
    { category: "动物行为", question: "为什么猫头鹰的头部能旋转270度？", answer: "颈椎有14节", explanation: "人类仅7节颈椎，猫头鹰多出的关节配合特殊血管结构，使其头部几乎可全周旋转而不阻断血流。" },
    { category: "人体奥秘", question: "人类胃酸能溶解刀片吗？", answer: "能溶解金属锌", explanation: "胃酸pH值约1.5-3.5，可腐蚀金属锌。但对不锈钢刀片无效——曾有记录显示刀片在胃中存留20年未溶化。" },
    { category: "历史趣闻", question: "拿破仑的著名手势（手插外套）真正原因是什么？", answer: "掩盖胃痛", explanation: "拿破仑长期患严重胃溃疡，手压腹部缓解疼痛的动作被画家雅克·路易·大卫美化后成为经典肖像姿势。" },
    { category: "科技历史", question: "二维码的三个角上的方块有什么作用？", answer: "定位与防畸变", explanation: "三个方块构成“回”字形定位标记，扫描器据此校正图像扭曲。第四个角无需方块，因算法可推算位置。" },
    { category: "植物世界", question: "什么花只在午夜开放且仅绽放一晚？", answer: "昙花", explanation: "昙花（Epiphyllum oxypetalum）为避开日间高温和昆虫，在21：00-4：00间开花，4小时后凋谢。" },
    { category: "音乐文化", question: "莫扎特《G大调弦乐小夜曲》为何编号K.525？", answer: "科歇尔编号", explanation: "K代表编目者科歇尔（Köchel），他按创作时间对所有莫扎特作品编号，K.525意为第525号作品。" }

];

let gameState = createInitialState();

// --- 全新、智能的随机出题逻辑 ---

/**
 * 使用 Fisher-Yates (aka Knuth) 算法来原地打乱数组顺序
 * @param {Array} array 需要被打乱的数组
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function createInitialState() {
    return {
        players: {},
        phase: 'setup',
        currentQuestion: null,
        questionQueue: [], // 修改：不再使用 questionIndex，而是用一个问题队列
        answers: [],
        votes: {},
        readyForNextRound: new Set()
    };
}

function getNextQuestion() {
    // 如果问题队列为空，则重新填充并洗牌
    if (gameState.questionQueue.length === 0) {
        console.log('[Game] All questions asked. Reshuffling...');
        // 复制一份主问题列表，避免直接修改常量
        gameState.questionQueue = [...QUESTIONS];
        shuffleArray(gameState.questionQueue);
    }
    // 从队列末尾弹出一个问题，高效且随机
    return gameState.questionQueue.pop();
}

io.on('connection', (socket) => {
    console.log(`[Connection] User connected: ${socket.id}`);

    socket.on('joinGame', ({ name }) => {
        const playerCount = Object.keys(gameState.players).length;
        gameState.players[socket.id] = {
            name: name,
            score: 0,
            color: PLAYER_COLORS[playerCount % PLAYER_COLORS.length],
            isHost: playerCount === 0
        };
        io.emit('updatePlayers', Object.values(gameState.players));
        socket.emit('joined', { isHost: gameState.players[socket.id].isHost });
    });

    socket.on('startGame', () => {
        if (!gameState.players[socket.id]?.isHost) return;
        
        // 修改：在游戏开始时，就创建好第一个洗牌后的问题队列
        console.log('[Game] Starting game, creating initial question queue.');
        gameState.questionQueue = [...QUESTIONS];
        shuffleArray(gameState.questionQueue);

        startNewRound();
    });
    
    // ... submitLie, submitVote, restartGame 等处理器保持不变 ...
    socket.on('submitLie', ({ lie }) => {
        gameState.answers.push({ text: lie, authorId: socket.id, isTruth: false });
        socket.emit('lieSubmitted');
        
        const submittedCount = gameState.answers.length - 1;
        if (submittedCount === Object.keys(gameState.players).length) {
            startVotingPhase();
        }
    });

    socket.on('submitVote', ({ voteText }) => {
        gameState.votes[socket.id] = voteText;

        if (Object.keys(gameState.votes).length === Object.keys(gameState.players).length) {
            calculateResults();
        }
    });
    
    socket.on('requestScoreboard', () => {
        if (!gameState.players[socket.id]) return;
        gameState.phase = 'scoreboard';
        socket.emit('showScoreboard', { players: Object.values(gameState.players) });
    });

    socket.on('requestNextPhase', () => {
        if (!gameState.players[socket.id] || gameState.phase !== 'scoreboard') return;
        gameState.readyForNextRound.add(socket.id);
        checkAndBroadcastReadyState();
    });

    socket.on('restartGame', () => {
        if (!gameState.players[socket.id]?.isHost) return;
        gameState = createInitialState();
        io.emit('resetToSetup');
    });

    socket.on('disconnect', () => {
        console.log(`[Disconnection] User disconnected: ${socket.id}`);
        const wasInGame = gameState.players[socket.id];
        delete gameState.players[socket.id];
        
        if (wasInGame) {
            gameState.readyForNextRound.delete(socket.id);
            if (Object.keys(gameState.players).length > 0) {
                 checkAndBroadcastReadyState();
            } else {
                 gameState = createInitialState();
            }
        }
        io.emit('updatePlayers', Object.values(gameState.players));
    });

    function checkAndBroadcastReadyState() {
        const readyCount = gameState.readyForNextRound.size;
        const totalPlayers = Object.keys(gameState.players).length;

        if (readyCount === totalPlayers && totalPlayers > 0) {
            if (gameState.phase === 'scoreboard') {
                const winner = Object.values(gameState.players).find(p => p.score >= WINNING_SCORE);
                if (winner) {
                    gameState.phase = 'gameOver';
                    io.emit('gameOver', { winnerName: winner.name });
                } else {
                    startNewRound();
                }
            }
        } else {
            io.emit('updateReadyCount', { readyCount, totalPlayers });
        }
    }
});


function startNewRound() {
    gameState.phase = 'writing';
    gameState.readyForNextRound.clear();
    gameState.currentQuestion = getNextQuestion();
    gameState.answers = [{ text: gameState.currentQuestion.answer, authorId: 'system', isTruth: true }];
    gameState.votes = {};
    io.emit('newRound', { question: gameState.currentQuestion });
}

function startVotingPhase() {
    gameState.phase = 'voting';
    const shuffledAnswers = gameState.answers.sort(() => Math.random() - 0.5);
    io.emit('startVoting', { answers: shuffledAnswers.map(a => a.text) });
}

function calculateResults() {
    gameState.phase = 'results';
    const truth = gameState.currentQuestion.answer;
    const pointsThisRound = {};
    for (const id in gameState.players) {
        pointsThisRound[id] = 0;
    }
    for (const voterId in gameState.votes) {
        const votedText = gameState.votes[voterId];
        if (votedText === truth) {
            if (pointsThisRound[voterId] !== undefined) {
                pointsThisRound[voterId] += 1000;
            }
        }
        const answerObj = gameState.answers.find(a => a.text === votedText);
        if (answerObj && answerObj.authorId !== 'system' && answerObj.authorId !== voterId) {
            if (pointsThisRound[answerObj.authorId] !== undefined) {
                pointsThisRound[answerObj.authorId] += 500;
            }
        }
    }
    for (const id in pointsThisRound) {
        if (gameState.players[id]) {
            gameState.players[id].score += pointsThisRound[id];
        }
    }
    const resultsPayload = {
        answers: gameState.answers.map(ans => {
            const author = gameState.players[ans.authorId];
            return {
                ...ans,
                authorName: author ? author.name : (ans.authorId === 'system' ? '真相' : '已断开的玩家'),
                authorColor: author ? author.color : (ans.authorId === 'system' ? '#3d3d3d' : '#9a9a9a'),
                voters: Object.entries(gameState.votes)
                             .filter(([voterId, voteText]) => voteText === ans.text)
                             .map(([voterId, voteText]) => gameState.players[voterId])
                             .filter(Boolean)
            };
        }),
        points: pointsThisRound,
        explanation: gameState.currentQuestion.explanation 
    };
    io.emit('showResults', resultsPayload);
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Connoisseur of Lies] 服务器启动，监听端口: ${PORT}`);
});