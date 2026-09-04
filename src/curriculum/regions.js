const createRegion = (id, title, theme, vehicles, projectTitles) => Object.freeze({
  id,
  title,
  theme,
  vehicles: Object.freeze(vehicles),
  projectTitles: Object.freeze(projectTitles),
});

export const REGIONS = Object.freeze([
  createRegion('sunny-town', '阳光工程镇', 'meadow',
    ['excavator', 'bulldozer', 'mixer', 'roller'],
    ['清理工地', '铺第一条路', '搭安全围栏', '修公交站', '安装路灯', '建积木房', '挖雨水沟', '修小石桥', '铺彩色步道', '建工具屋', '种工程树林', '修社区门', '搭运动场', '建消防站', '点亮工程镇']),
  createRegion('forest-valley', '森林救援谷', 'forest',
    ['excavator', 'crane', 'fire-truck', 'bulldozer'],
    ['清理倒树', '修山谷小路', '架溪流木桥', '搭动物饮水台', '建森林观察塔', '铺救援停机坪', '挖防火隔离带', '修松鼠通道', '安装山路护栏', '建雨水收集池', '加固岩石坡', '铺林间步道', '搭救援帐篷', '修萤火虫花园', '点亮森林营地']),
  createRegion('harbor-island', '港口物流岛', 'harbor',
    ['forklift', 'dump-truck', 'crane', 'mixer'],
    ['清扫码头', '修货物栈桥', '画集装箱格线', '搭海岛仓库', '安装吊车轨道', '铺港口道路', '建货车停车区', '修渔船泊位', '安装航标灯', '搭冷藏货棚', '建包裹分拣台', '加固防波堤', '铺海边装卸区', '修渡轮候船厅', '点亮物流港']),
  createRegion('undersea-city', '海底隧道城', 'undersea',
    ['tunnel-drill', 'crane', 'mixer', 'excavator'],
    ['钻开入口岩层', '铺海底隧道', '安装防水门', '接通供氧管', '建珊瑚观察窗', '修潜水车站', '铺发光地砖', '搭海草花园', '安装海底路灯', '建水压实验室', '修小鱼通道', '加固海底桥墩', '铺观光电车线', '搭鲸鱼观测台', '点亮海底城市']),
  createRegion('snow-airport', '冰雪机场', 'snow',
    ['snowplow', 'roller', 'crane', 'fire-truck'],
    ['清除跑道积雪', '铺防滑跑道', '安装导航灯', '建飞机机库', '修行李传送带', '搭候机暖房', '画登机引导线', '建除雪车库', '加固停机坪', '修机场消防站', '安装风向标', '铺机场接驳路', '搭冰雪观景台', '修直升机坪', '点亮夜航机场']),
  createRegion('future-shanghai', '未来上海城', 'city',
    ['tunnel-drill', 'crane', 'forklift', 'mixer'],
    ['开挖地铁站', '铺智能轨道', '建江边步道', '安装自动路灯', '搭空中花园', '修无人车站', '建玻璃高楼', '铺自行车绿道', '安装智慧信号灯', '修滨水码头', '搭机器人仓库', '建太阳能屋顶', '铺城市雨水花园', '修未来学校', '点亮上海天际线']),
]);
