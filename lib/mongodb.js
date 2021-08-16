const config=require("../config/config")
const mongoose=require("mongoose");
 
//连接
mongoose.connect(config.url,config.options,{useNewUrlParser: true})

var db = mongoose.connection;

//连接异常报错
db.on('error', console.error.bind(console, 'connection error:'));


//能打开表示连接成功了
db.once('open', function() {
  // we're connected!
  console.log("db connected");
  
});
 

 

module.exports=mongoose;