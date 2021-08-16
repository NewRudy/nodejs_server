var storageData=require('../service/dataStorage.js');

//第一种接口上传数据到服务器
exports.storageData=storageData.storage;
//数据描述
exports.storageDesc=storageData.storageDesc;

//第2,3种接口
exports.noTemplate=storageData.noTemplate;


//第四种接口
exports.randomSource=storageData.randomSource;

//获得数据
exports.datasource=storageData.download;


//可视化
exports.dataVisual=storageData.dataVisual;

//强制可视化生成
exports.dataVisualNoCache=storageData.dataVisualNoCache;


//数据上传
exports.ogmsDataUp=storageData.ogmsDataUp;

//数据切片上传
exports.large=storageData.large;

// 数据切片上传
exports.largeBKend=storageData.largeBKend;



//数据下载

exports.ogmsDataDown=storageData.ogmsDataDown;
// 数据信息
exports.info=storageData.info;



//测试
exports.test=storageData.test;




//数据列表
exports.datalist=storageData.datalist;

//数据检索
exports.filter=storageData.filter;

//更新数据描述
exports.update=storageData.update;
//删除数据
exports.delete=storageData.del;
