const mongoose=require('../lib/mongodb')

var Mixed = mongoose.Schema.Types.Mixed;

//定义schema,相当于定义表结构
var dataSChema = new mongoose.Schema({
   uid:String,
     path:  String,
     date: String,
     path:String,
     size:String,
     originalName:String,
     type:String,
     fileList:Array,
     //自描述属性
     singleFileName:String,
     fileId:String,
     info:Mixed,
     name:String,
     dataTemplateId:String,
     dataTemplate:String,
	
     origination:String,
     serverNode:String,
     access:String,
     userId:String,
     date:Date,
});

//创建model
var DataSet=mongoose.model('dataset',dataSChema,'datalist')

exports.DataSet=DataSet;


