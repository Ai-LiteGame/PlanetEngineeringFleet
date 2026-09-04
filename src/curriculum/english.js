const parseWordLines = (source) => source.trim().split('\n').map((line) => {
  const [tier, word, meaning, category] = line.split('|');
  return Object.freeze({ tier: Number(tier), word, meaning, category });
});

const withWordIds = (items) => Object.freeze(items.map((item, index) => Object.freeze({
  id: `en-word-${String(index + 1).padStart(3, '0')}`,
  ...item,
})));

const WORD_SOURCE = parseWordLines(`
1|hello|你好|greeting
1|truck|卡车|vehicle
1|please|请|manners
1|thanks|谢谢|manners
1|yes|是|response
1|no|不|response
1|sorry|对不起|manners
1|okay|好的|response
1|i|我|people
1|you|你|people
1|we|我们|people
1|he|他|people
1|she|她|people
1|my|我的|people
1|your|你的|people
1|friend|朋友|people
1|family|家人|people
1|mother|妈妈|family
1|father|爸爸|family
1|sister|姐姐或妹妹|family
1|brother|哥哥或弟弟|family
1|teacher|老师|school
1|student|学生|school
1|baby|宝宝|people
1|boy|男孩|people
1|girl|女孩|people
1|name|名字|school
1|home|家|place
1|school|学校|place
1|room|房间|place
1|door|门|home
1|window|窗户|home
1|book|书|school
1|pen|钢笔|school
1|pencil|铅笔|school
1|paper|纸|school
1|bag|书包|school
1|desk|课桌|school
1|chair|椅子|school
1|ball|球|play
1|toy|玩具|play
1|cat|猫|animal
1|dog|狗|animal
1|bird|鸟|animal
1|fish|鱼|animal
1|tree|树|nature
1|flower|花|nature
1|sun|太阳|nature
1|moon|月亮|nature
1|star|星星|nature
1|rain|雨|weather
1|water|水|nature
1|milk|牛奶|food
1|rice|米饭|food
1|bread|面包|food
1|apple|苹果|food
1|banana|香蕉|food
1|cake|蛋糕|food
1|red|红色|color
1|blue|蓝色|color
1|yellow|黄色|color
1|green|绿色|color
1|black|黑色|color
1|white|白色|color
1|one|一|number
1|two|二|number
1|three|三|number
1|four|四|number
1|five|五|number
1|big|大的|size
1|small|小的|size
1|good|好的|feeling
1|happy|开心的|feeling
1|sad|难过的|feeling
1|hot|热的|weather
1|cold|冷的|weather
1|go|去|action
1|come|来|action
1|run|跑|action
1|walk|走|action
1|jump|跳|action
1|sit|坐|action
1|stand|站|action
1|look|看|action
1|see|看见|action
1|eat|吃|action
1|drink|喝|action
1|sleep|睡觉|action
1|play|玩|action
1|help|帮助|action
2|six|六|number
2|seven|七|number
2|eight|八|number
2|nine|九|number
2|ten|十|number
2|eleven|十一|number
2|twelve|十二|number
2|morning|早晨|time
2|afternoon|下午|time
2|evening|晚上|time
2|today|今天|time
2|tomorrow|明天|time
2|yesterday|昨天|time
2|monday|星期一|time
2|weekend|周末|time
2|spring|春天|season
2|summer|夏天|season
2|autumn|秋天|season
2|winter|冬天|season
2|cloud|云|weather
2|wind|风|weather
2|snow|雪|weather
2|sky|天空|nature
2|river|河流|nature
2|lake|湖|nature
2|mountain|山|nature
2|grass|草|nature
2|leaf|叶子|nature
2|seed|种子|nature
2|garden|花园|nature
2|rabbit|兔子|animal
2|panda|熊猫|animal
2|tiger|老虎|animal
2|elephant|大象|animal
2|monkey|猴子|animal
2|duck|鸭子|animal
2|chicken|鸡|animal
2|horse|马|animal
2|bus|公交车|vehicle
2|car|汽车|vehicle
2|train|火车|vehicle
2|bike|自行车|vehicle
2|boat|船|vehicle
2|plane|飞机|vehicle
2|road|道路|transport
2|bridge|桥|transport
2|station|车站|transport
2|ticket|车票|transport
2|stop|停下|action
2|turn|转弯|action
2|wait|等待|action
2|open|打开|action
2|close|关闭|action
2|make|制作|action
2|build|建造|engineering
2|draw|画|action
2|read|读|school
2|write|写|school
2|count|数数|math
2|find|找到|action
2|carry|搬运|action
2|clean|干净的|home
2|wash|洗|action
2|share|分享|manners
2|kind|友善的|feeling
2|brave|勇敢的|feeling
2|careful|小心的|safety
2|safe|安全的|safety
2|fast|快的|speed
2|slow|慢的|speed
2|long|长的|size
2|short|短的|size
2|tall|高的|size
2|heavy|重的|measurement
2|light|轻的|measurement
2|round|圆的|shape
2|square|正方形的|shape
2|triangle|三角形|shape
2|left|左边|direction
2|right|右边|direction
2|up|上面|direction
2|down|下面|direction
2|inside|里面|direction
2|outside|外面|direction
2|under|在下面|direction
2|next to|在旁边|direction
2|before|在之前|time
2|after|在之后|time
2|because|因为|connection
2|and|和|connection
2|but|但是|connection
2|orange|橙子|food
2|grape|葡萄|food
2|noodle|面条|food
2|soup|汤|food
2|egg|鸡蛋|food
2|cheese|奶酪|food
2|spoon|勺子|home
2|cup|杯子|home
2|plate|盘子|home
3|thirteen|十三|number
3|fourteen|十四|number
3|fifteen|十五|number
3|twenty|二十|number
3|hundred|一百|number
3|first|第一|order
3|last|最后|order
3|every|每一个|quantity
3|another|另一个|quantity
3|more|更多|quantity
3|less|更少|quantity
3|same|相同的|comparison
3|different|不同的|comparison
3|early|早的|time
3|late|晚的|time
3|minute|分钟|time
3|hour|小时|time
3|week|星期|time
3|month|月|time
3|year|年|time
3|weather|天气|weather
3|rainbow|彩虹|weather
3|storm|暴风雨|weather
3|forest|森林|nature
3|ocean|海洋|nature
3|island|岛|nature
3|rock|岩石|nature
3|soil|泥土|nature
3|plant|植物|nature
3|bamboo|竹子|nature
3|butterfly|蝴蝶|animal
3|bee|蜜蜂|animal
3|frog|青蛙|animal
3|turtle|乌龟|animal
3|dolphin|海豚|animal
3|penguin|企鹅|animal
3|whale|鲸鱼|animal
3|squirrel|松鼠|animal
3|zebra|斑马|animal
3|giraffe|长颈鹿|animal
3|ambulance|救护车|vehicle
3|fire engine|消防车|vehicle
3|subway|地铁|vehicle
3|taxi|出租车|vehicle
3|helmet|安全帽|safety
3|engine|发动机|engineering
3|wheel|车轮|engineering
3|ladder|梯子|engineering
3|hammer|锤子|engineering
3|rope|绳子|engineering
3|brick|砖块|engineering
3|tower|塔|engineering
3|robot|机器人|technology
3|rocket|火箭|space
3|satellite|卫星|space
3|planet|行星|space
3|space|太空|space
3|map|地图|transport
3|corner|角落|place
3|crossing|路口|transport
3|traffic light|红绿灯|transport
3|repair|修理|engineering
3|measure|测量|math
3|compare|比较|math
3|sort|分类|math
3|choose|选择|action
3|check|检查|action
3|follow|跟随|action
3|remember|记住|school
3|explain|解释|school
3|discover|发现|science
3|experiment|实验|science
3|observe|观察|science
3|collect|收集|science
3|recycle|回收利用|environment
3|protect|保护|environment
3|save|节约|environment
3|energy|能源|environment
3|electricity|电|science
3|battery|电池|technology
3|screen|屏幕|technology
3|keyboard|键盘|technology
3|camera|相机|technology
3|picture|图片|school
3|music|音乐|art
3|song|歌曲|art
3|dance|跳舞|art
3|paint|画画|art
3|colorful|五彩的|color
3|quiet|安静的|feeling
3|noisy|吵闹的|feeling
3|excited|兴奋的|feeling
3|worried|担心的|feeling
3|proud|骄傲的|feeling
3|ready|准备好的|action
3|together|一起|connection
3|again|再一次|time
3|always|总是|time
3|never|从不|time
3|maybe|也许|response
3|must|必须|safety
3|can|能|action
3|want|想要|action
3|need|需要|action
3|know|知道|school
3|learn|学习|school
3|practice|练习|school
3|answer|答案|school
3|question|问题|school
3|idea|主意|school
`);

export const ENGLISH_WORDS = withWordIds(WORD_SOURCE);

const parsePatternLines = (source) => source.trim().split('\n').map((line) => {
  const [tier, text, meaning, slotText] = line.split('|');
  return Object.freeze({
    tier: Number(tier),
    text,
    meaning,
    slots: slotText ? slotText.split(',') : [],
  });
});

const withPatternIds = (items) => Object.freeze(items.map((item, index) => Object.freeze({
  id: `en-pattern-${String(index + 1).padStart(3, '0')}`,
  ...item,
})));

const PATTERN_SOURCE = parsePatternLines(`
1|Hello!|你好！|
1|I need {item}.|我需要……|item
1|Thank you!|谢谢你！|
1|Please help me.|请帮助我。|
1|Yes, please.|好的，请。|
1|No, thank you.|不用了，谢谢。|
1|My name is {name}.|我的名字是……|name
1|I am {name}.|我是……|name
1|This is my {family}.|这是我的……|family
1|I have a {thing}.|我有一个……|thing
1|It is a {color} {thing}.|它是一个……颜色的……|color,thing
1|I see a {animal}.|我看见一只……|animal
1|I like {food}.|我喜欢……|food
1|I want {food}.|我想要……|food
1|I can {action}.|我会……|action
1|Can you {action}?|你会……吗？|action
1|Let us {action}.|让我们……吧。|action
1|Come here, please.|请到这里来。|
1|Look at the {thing}.|看看这个……|thing
1|Where is my {thing}?|我的……在哪里？|thing
1|It is on the {place}.|它在……上面。|place
1|The {thing} is big.|这个……很大。|thing
1|The {thing} is small.|这个……很小。|thing
1|I am happy.|我很开心。|
1|Are you okay?|你还好吗？|
1|Good morning!|早上好！|
1|Good afternoon!|下午好！|
1|Good evening!|晚上好！|
1|See you tomorrow!|明天见！|
1|Time to sleep.|该睡觉了。|
2|What is this?|这是什么？|
2|What color is it?|它是什么颜色？|
2|How many {things}?|有多少个……？|things
2|I have {number} {things}.|我有……个……|number,things
2|The {animal} can {action}.|这只……会……|animal,action
2|The {vehicle} is fast.|这辆……很快。|vehicle
2|Stop at the red light.|红灯时停下。|
2|Wait for the bus.|等公交车。|
2|Turn left here.|在这里向左转。|
2|Turn right here.|在这里向右转。|
2|The book is under the desk.|书在桌子下面。|
2|The ball is next to the chair.|球在椅子旁边。|
2|Open the door, please.|请打开门。|
2|Close the window, please.|请关上窗户。|
2|Please sit down.|请坐下。|
2|Please stand up.|请站起来。|
2|Let us read a book.|让我们读一本书。|
2|Let us count together.|让我们一起数数。|
2|I can draw a {thing}.|我会画一个……|thing
2|Can I play now?|我现在可以玩吗？|
2|May I have some {food}?|我可以吃一些……吗？|food
2|It is raining today.|今天在下雨。|
2|The sun is bright.|太阳很明亮。|
2|The sky is blue.|天空是蓝色的。|
2|I wear my {clothing}.|我穿着我的……|clothing
2|Put it in the bag.|把它放进书包里。|
2|Please clean the table.|请擦干净桌子。|
2|We share our toys.|我们分享玩具。|
2|Be kind to friends.|要友善对待朋友。|
2|Be careful on the road.|在路上要小心。|
2|This way is safe.|这条路是安全的。|
2|I go to school by {vehicle}.|我乘……去学校。|vehicle
2|The train is at the station.|火车在车站。|
2|We cross at the crossing.|我们在路口过马路。|
2|My birthday is in {month}.|我的生日在……月。|month
3|What do you need?|你需要什么？|
3|I need a {tool}.|我需要一个……|tool
3|Let us build a {thing}.|让我们建造一个……|thing
3|The worker wears a helmet.|工人戴着安全帽。|
3|The truck carries {things}.|卡车运送……|things
3|The wheel is round.|车轮是圆的。|
3|This bridge is strong.|这座桥很坚固。|
3|The robot can move.|机器人会移动。|
3|The rocket flies to space.|火箭飞向太空。|
3|The satellite is in space.|卫星在太空中。|
3|We look at the map.|我们看地图。|
3|Which way should we go?|我们应该走哪边？|
3|First, we {action}.|首先，我们……|action
3|Then, we {action}.|然后，我们……|action
3|Finally, we {action}.|最后，我们……|action
3|Why is the plant green?|为什么植物是绿色的？|
3|Because it needs sunlight.|因为它需要阳光。|
3|The seed grows into a plant.|种子长成植物。|
3|We protect the forest.|我们保护森林。|
3|Please recycle the paper.|请回收纸张。|
3|Save water and energy.|节约水和能源。|
3|I can measure the {thing}.|我会测量……|thing
3|Which one is longer?|哪一个更长？|
3|This box is heavier.|这个箱子更重。|
3|They are the same size.|它们一样大。|
3|Sort the blocks by color.|按颜色给积木分类。|
3|What comes next?|下一个是什么？|
3|There are more {things}.|有更多的……|things
3|There are fewer {things}.|有更少的……|things
3|The answer is {number}.|答案是……|number
3|Let us check the answer.|让我们检查答案。|
3|I have an idea.|我有一个主意。|
3|Can you explain it?|你能解释一下吗？|
3|We learn from mistakes.|我们从错误中学习。|
3|Practice makes us better.|练习让我们更进步。|
`);

export const ENGLISH_PATTERNS = withPatternIds(PATTERN_SOURCE);
