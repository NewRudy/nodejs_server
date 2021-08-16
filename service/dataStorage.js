const formidable = require('formidable');
const uuid=require('node-uuid')
const date=require('silly-datetime')
const fs=require('fs')
const unzip=require('unzip')
const xml2js =require('xml2js')
const archiver =require('archiver')
const cp = require('child_process');//引入包

//这个是datalist的model
const dataModel=require('../model/dataList.js')


const standZip=require('../model/standZip.js')
const random=require('../model/random.js')
const srcZip=require('../model/srcZip.js')
const udxZip=require('../model/udxZip.js')
const visualLog =require('../model/visualLog.js')

const VisualSolution=require('../lib/data/templateIdOfVisualSolution.js')


var path="E:\/CONTAINER_DATASET\/"

var DataSet=dataModel.DataSet;

var StandZip=standZip.StandZip;
var Random=random.Random;
var SrcZip=srcZip.SrcZip;
var UdxZip=udxZip.UdxZip;
var VisualLog=visualLog.VisualLog


const compressing = require('compressing');
const zlib = require( 'zlib' );
var parser = new xml2js.Parser();

const delDir=require('../utils/utils');
const { create } = require('domain');

 

//上传符合要求的zip数据,接口1
exports.storage=function(req,res,next){

    var form =new formidable.IncomingForm();
    let uid=uuid.v4()
    let dirPath=__dirname+'/../upload_stand_zip/'+uid
   
    
    fs.mkdir(dirPath,(err)=>{

        if(err) throw err

        form.uploadDir=dirPath
        form.keepExtensions=true
        
        form.parse(req,function(err,fields,file){
         
         //必要参数的检验
            if(!fields.name||!fields.origination||!fields.serverNode||!fields.userId){
                res.send({code:0,message:"without name , userId ,origination, serverNode"})
                return
            } 

           let doc={
                uid:uid,
                name:fields.name,
                origination:fields.origination,
                serverNode:fields.serverNode,
                userId:fields.userId,

                // access:fields.access,
                date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                // info:JSON.parse(fields.info)
            };

           
            if("access" in fields){
                doc["access"]=fields.access
            }

            if("info" in fields){
                doc["info"]=JSON.parse(fields.info)
            }
            
            //解压压缩包
            compressing.zip.uncompress(file.ogmsdata.path, dirPath+'/unzipdata')
            .then(() => {
                console.log('unzip original zip data success');
                fs.readFile(dirPath+'/unzipdata'+'/config.udxcfg',(err,data)=>{
                    //解析配置文件
                    parser.parseString(data, function (err, result) {
                        let filesItem = fs.readdirSync(dirPath+'/unzipdata');



                        //数据校验成功
                        if(filesItem.length-1===result.UDXZip["Name"][0].add.length){
                            console.log("data check succcess!")

 

                        
                            //将除了配置文件外的数据压缩，为调用准备
                            var output = fs.createWriteStream( dirPath+'/'+uid+'.zip');
                            var archive = archiver('zip', {
                                gzip: true,
                                zlib: { level: 9 } // Sets the compression level.
                            });

                            archive.on('error', function(err) {
                            throw err;
                            });
                            archive.on('end',(err)=>{
                                console.log("zip original zip data without config data success")
                            })

                            // pipe archive data to the output file
                            archive.pipe(output);

                            // append files
                            let na=file.ogmsdata.path.split('\\')
                            for(item of filesItem){
                                if(item==="config.udxcfg"||item===na[na.length-1]){
                                    continue;
                                }
                                archive.file(dirPath+'/unzipdata/'+item, {name: item});
                            }
                             
                            //
                            archive.finalize();


                            let ret={source_store_id:uid,file_name:fields.name}

                            //库存数据信息记录
                           
                            StandZip.create(doc,function(err1,small){
                                if(err1){
                                    console.log(err1);
                                    res.send({code:0,message:err1});
                                    return
                                }
                                console.log("upload file")
                                res.send(ret);
                                return
                            })
                            
                            console.log("add zip data-"+uid)


                        }else{
                            res.send({code:0,message:"data check error!"})
                            return
                        }
                    });
    
                })

            })
            .catch(err => {
                console.error(err);
            });
    
             
        })
    })
   
}

//上传原始数据和template的数据，接口2，3
exports.noTemplate=function(req,res,next){

    var form =new formidable.IncomingForm();
    let uid=uuid.v4()
    let type=req.params.type,dirPath,zipPath
    if(type==="tep"){
        dirPath=__dirname+'/../upload_template/'+uid
        zipPath=__dirname+'/../upload_template/'
    }else if(type==="udx"){
        dirPath=__dirname+'/../upload_mdlschema/'+uid
        zipPath=__dirname+'/../upload_mdlschema/'

    }
     
    fs.mkdir(dirPath,(err)=>{

        if(err) throw err

        form.uploadDir=dirPath
        form.keepExtensions=true
        

        form.parse(req,function(err,fields,file){

            if(!fields.name||!fields.origination||!fields.serverNode||!fields.userId){
                fs.rmdir(dirPath,(err)=>{
                    console.log(err)
                })
                res.send({code:0,message:"without name , userId ,origination, serverNode"})
                return;
            } 
            //入库数据结构
            let doc={
                uid:uid,
                name:fields.name,
                origination:fields.origination,
                serverNode:fields.serverNode,
                userId:fields.userId,
                date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
              
            };

            if("access" in fields){
                doc["access"]=fields.access
            }

            if("info" in fields){
                doc["info"]=JSON.parse(fields.info)
            }

           
            
            //检验数据
            // let filesItem=fs.readdirSync(dirPath)

            fs.readdir(dirPath,(err,filesItem)=>{

                console.log(filesItem)
                for(item of filesItem){

                    if((item.split("."))[1]==="udxcfg"){
                        cfg_name=item

                        fs.readFile(dirPath+'/'+item,(err,data)=>{
                            parser.parseString(data, function (err, result) {
                                //校验文件个数
                                console.log(filesItem,result.UDXZip["Name"][0].add.length)
                                if(filesItem.length-1==result.UDXZip["Name"][0].add.length){
                                    console.log("data check succcess!")


                                    //类型是tep检查模板id是否正确
                                    if(type==="tep"){

                                        let dataTemplateId=result.UDXZip["DataTemplateId"]
                                        if(!dataTemplateId){
                                            res.send({code:0,message:"data template id empty!"})
                                            return
                                        }

                                        doc["dataTemplateId"]=dataTemplateId[0]
                                    }
                                    

                                    //将除了配置文件外的数据压缩，为调用准备
                                    var output = fs.createWriteStream( zipPath+'/'+uid+'.zip');
                                    var archive = archiver('zip', {
                                        gzip: true,
                                        zlib: { level: 9 } // Sets the compression level.
                                    });

                                    archive.on('error', function(err) {
                                        throw err;
                                    });
                                    archive.on('end',(err)=>{
                                        delDir(dirPath)
                                         //存库记录
                                        let ret={source_store_id:uid,file_name:fields.name}
                                    
                                        if(type==="tep"){

                                            //存库
                                            SrcZip.create(doc,function(err1,small){
                                                if(err1){
                                                    console.log(err1);
                                                    res.send({code:0,message: err1});
                                                    return
                                                }
                                            
                                                res.send(ret);
                                                return
                                            })
                                            
                                            console.log("add template data-"+uid)
                                            
                                        }else if(type==="udx"){

                                            //存库
                                            UdxZip.create(doc,function(err2,small){
                                                if(err2){
                                                    console.log(err2);
                                                    res.send({code:0,message: err2});
                                                    return
                                                }
                                                
                                                res.send(ret);
                                                return
                                            })
                                            
                                            console.log("add udx data-"+uid)
                                        
                                        }



                                        console.log("zip original zip data without config data success")
                                    })

                                    // pipe archive data to the output file
                                    archive.pipe(output);

                                    // append files
                                    
                                    for(fe of filesItem){
                                        if(fe==item){
                                            continue;
                                        }else{
                                            console.log(fe)
                                            archive.file(dirPath+'/'+fe, {name: fe});
                                        }
                                        
                                    }
                                    
                                    //
                                    archive.finalize();


                                }else{
                                    console.log(filesItem.length===result.UDXZip["Name"][0].add.length)
                                    res.send({code:0,message:"data check error!"})
                                
                                }
                            })
                        })

                        break;
                    } 

                     
                }
            
            });

            
               
           
                
           
           
        })

        // form.on('end', function() {
        //     fs.readdir(dirPath,(err,filesItem)=>{
        //         console.log(filesItem)   
        //     })
             
           
        // });
        // res.send("error")
        // return

        
    })

     
    
}

//上传任意数据, 接口4
exports.randomSource=function randomSource(req,res,next){
    let uid=uuid.v4()

    var form =new formidable.IncomingForm();
    var dp=__dirname+'/../upload_random/'+uid
    form.uploadDir=dp
    form.keepExtensions=true

    fs.mkdir(dp,(err)=>{
        if(err) throw err;
        form.parse(req,function(err,fields,file){
                if(err){
                    console.log(err)
                }
                
                
                //必要参数的检验
                if(!fields.name||!fields.origination||!fields.serverNode||!fields.userId){
                    res.send({code:0,message:"without name , userId ,origination, serverNode"})
                    return
                } 

            let doc={
                    uid:uid,
                    name:fields.name,
                    origination:fields.origination,
                    serverNode:fields.serverNode,
                    userId:fields.userId,

                    // access:fields.access,
                    date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                    // info:JSON.parse(fields.info)
                };

            
                if("access" in fields){
                    doc["access"]=fields.access
                }

                if("info" in fields){
                    doc["info"]=JSON.parse(fields.info)
                }

            

                let ret={source_store_id:uid,file_name:fields.name}
                
                Random.create(doc,function(err2,small){
                    if(err2){
                        console.log(err2);
                        res.send({code:0,message: err2});
                        return
                    }
                    
                    res.send(ret);
                    return
                })
                
            })
    });
    
}

//下载数据，下载接口
exports.download=function(req,res,next){
    let uid=req.query.uid;
    let type=req.query.type;
    let path

    if(type==="zip"){

        path=__dirname+'/../upload_stand_zip/'+uid+'/'+uid+'.zip'
    }else if(type==="tep"){

        path=__dirname+'/../upload_template/'+uid+'.zip'
    }else if(type==="udx"){

        path=__dirname+'/../upload_mdlschema/'+uid+'.zip'
    }else if(type==="ran"){

        path=__dirname+'/../upload_random/'+uid

        compressing.zip.compressDir(path, path+'.zip')
        .then(() => {
            console.log('success');
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',//告诉浏览器这是一个二进制文件
                'Content-Disposition': 'attachment; filename=' + encodeURI("data")+'.zip',//告诉浏览器这是一个需要下载的文件
            });//设置响应头
            var readStream = fs.createReadStream(path+'.zip');//得到文件输入流

            readStream.on('data', (chunk) => {
                res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
            });
            readStream.on('end', () => {
                res.end();
                 fs.unlink(path+'.zip',(err)=>{
                     console.log(err)
                 })
                return;
            })


        })
        .catch(err => {
            console.error(err);
        });


    }

     
    if(type!="ran"){
        res.writeHead(200, {
                'Content-Type': 'application/octet-stream',//告诉浏览器这是一个二进制文件
                'Content-Disposition': 'attachment; filename=' + encodeURI("data")+'.zip',//告诉浏览器这是一个需要下载的文件
            });//设置响应头
            var readStream = fs.createReadStream(path);//得到文件输入流

            readStream.on('data', (chunk) => {
                res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
            });
            readStream.on('end', () => {
                res.end();
            })
    }
            
        
    
}


//数据上传
exports.ogmsDataUp=async function(req,res,next){
    var form =new formidable.IncomingForm({maxFileSize:6*1024 * 1024 * 1024});
    let uid=uuid.v4()
    let dirPath='/data/dataSource/'+uid

    
    fs.mkdir(dirPath,(err)=>{

        if(err) throw err

        form.uploadDir=dirPath
        form.keepExtensions=true
 	form.on('file',(name,file)=>{
            console.log(name);
            console.log(file.name);
            fs.renameSync(file.path,dirPath+'/'+file.name)
        });


        form.parse(req,function(err,fields,file){

            //必要参数的检验,参数有误的返回值
            if(!fields.name||!fields.origination||!fields.serverNode||!fields.userId){
                res.send({code:-1,message:"without name , userId ,origination, serverNode"})
                return
            }

            //数据信息记录
            var doc={
                uid:uid,
                name:fields.name,
                origination:fields.origination,
                serverNode:fields.serverNode,
                userId:fields.userId,

                // access:fields.access,
                date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                path:dirPath

                // info:JSON.parse(fields.info)
            };

           
            if("access" in fields){
                doc["access"]=fields.access
            }

            if("info" in fields){
                doc["info"]=JSON.parse(fields.info)
            }
            fs.readdir(dirPath,(errr,files)=>{
                if(files.length===0){
                    res.send({code:-1,message:'error,data count 0'})
                    return;
                }else if(files.length>1){
                     var reg=new RegExp('.udxcfg')
                     var config= configExistsF(files,reg)

                     if(config===undefined){
                         res.send({code:-1,message:'error,no config file'})
                         return;
                     }else{

                         fs.readFile(dirPath+'/'+config,(configerr,configContent)=>{
                             if(configerr){
                                 res.send({code:-1,message:'config error'})
                                 return
                             }

                            parser.parseString(configContent, function (err, result) {
                                //检查配置文件格式
                                if(!result||!result.UDXZip||!result.UDXZip['Name']||!result.UDXZip['Name'][0]||!result.UDXZip['DataTemplate']){
                                    res.send({code:-1,message:'config file content uncorrect!!'})
                                }
                                //检验数据个数是否匹配
                                if(files.length-1 != result.UDXZip["Name"][0].add.length){
                                    res.send({code:-1,message:'file count error!!'})
                                    return

                                }
                             
                                //检验类型字段是否存在
                                let type=result.UDXZip['DataTemplate'][0].$.type
                                if(type===undefined){
                                    res.send({code:-1,message:'config file no type info'})
                                    return;
                                }

                                if(type==="id"){
		console.log('data type: id',files)
		 
                                    doc['type']='template'
                                    //单个文件，不打包
                                    if(files.length===2){
		     
                                         let configFilePath
                                        doc['fileList']=[]
                                        for(f of files){
                                            if(reg.test(f)){
		           
                                                configFilePath=dirPath+'/'+f
			console.log('config path',configFilePath)
                                                continue
                                            }else{
			doc['singleFileName']=f
 		            	doc['fileList'].push(dirPath+'/'+f)
			}

		         }
                                           
                                           // let name_suffix=f.split('.')
		            //fs.renameSync(dirPath+'/'+f,dirPath+'/'+uid+'.'+name_suffix[1])

		          //datatemplate id 入库 
                                        	doc['dataTemplateId']=(result.UDXZip['DataTemplate'][0]._.replace(/[\r\n\t]/g,"")).trim();  
                                        	 
			//删除配置文件
                                        	fs.unlinkSync(configFilePath)

                                        	 
                                        	let ret={source_store_id:uid,file_name:fields.name}
                                        	//存库
                                        	DataSet.create(doc,function(err1,small){
                                            	if(err1){
                                                	console.log(err1);
                                                	res.send({code:0,message: err1});
                                                	return
                                            	}
                                        
                                            	res.send({code:0,data:ret});
                                            	return
                                        	})
                                           

                                          
                                        
                                       
                                       
                                    }else if(files.length>2){
                                        doc['fileList']=[]
                                        doc['dataTemplateId']=(result.UDXZip['DataTemplate'][0]._).trim(); 


                                        //将除了配置文件外的数据压缩，为调用准备
                                        var output = fs.createWriteStream( dirPath+'/'+uid+'.zip');
                                        var archive = archiver('zip', {
                                            gzip: true,
                                            zlib: { level: 9 } // Sets the compression level.
                                        });
                                        archive.on('error', function(err) {
                                            throw err;
                                        });
                                        var configFilePath
                                        archive.on('end',(err)=>{
                                            // throw err;
                                            doc['fileList']=[dirPath+'/'+uid+'.zip']
                                            
                                            let ret={source_store_id:uid,file_name:fields.name}
                                            //存库
                                            DataSet.create(doc,function(err1,small){
                                                if(err1){
                                                    console.log(err1);
                                                    res.send({code:1,message: err1});
                                                    return
                                                }
                                            
                                                res.send({code:0,data:ret});
                                                return
                                            })


                                        });
                                        // pipe archive data to the output file
                                        archive.pipe(output);
                                        

                                        // append files
                                        for(fe of files){
                                            if(reg.test(fe)){
                                                configFilePath=dirPath+'/'+fe
                                                continue;
                                            }                                             
                                             
                                             
                                            archive.file(dirPath+'/'+fe, {name: fe});                                         
                                        }
                                        
                                        //压缩结束
                                        archive.finalize();

                                    }else{
                                        res.send({code:-1,message:'error'})
                                        return;
                                    }


                                }else if(type==="schema"){
		console.log("schema")
                                    doc['type']='schema'
                                    //单个文件，不打包
		
		//datatemplate入库
 		var builder = new xml2js.Builder();
		   if(!result.UDXZip['DataTemplate'][0]['UdxDeclaration']){
			res.send({code:-1,message:'none udx data'})  
		   }
                                        var xml = builder.buildObject(
                                            {
                                                UdxDeclaration:result.UDXZip['DataTemplate'][0]['UdxDeclaration'][0]
                                        
                                            });
                                        doc['dataTemplate']=xml 
                                    if(files.length===2){
		 console.log('schema 2')
		  
                                        let configFilePath
                                        doc['fileList']=[]
                                        for(f of files){
                                            if(reg.test(f)){
                                                configFilePath=dirPath+'/'+f
                                                continue
                                            }else{
                                               doc['singleFileName']=f
 		            	doc['fileList'].push(dirPath+'/'+f)
			}		   
                                          //let name_suffix=f.split('.')
		        //  fs.renameSync(dirPath+'/'+f,dirPath+'/'+uid+'.'+name_suffix[1])

		          

                                           
                                        }
                                        
                                        //删除配置文件
                                        fs.unlinkSync(configFilePath)

                                        let ret={source_store_id:uid,file_name:doc['name']}
                                        //存库
                                        DataSet.create(doc,function(err1,small){
                                            if(err1){
                                                console.log(err1);
                                                res.send({code:1,message: err1});
                                                return
                                            }
                                        
                                            res.send({code:0,data:ret});
                                            return
                                        })



                                    }else if(files.length>2){

                                        //udx 数据有多个的情况暂时不考虑
					 doc['fileList']=[]

                                        //将除了配置文件外的数据压缩，为调用准备
                                        var output = fs.createWriteStream( dirPath+'/'+uid+'.zip');
                                        var archive = archiver('zip', {
                                            gzip: true,
                                            zlib: { level: 9 } // Sets the compression level.
                                        });
                                        archive.on('error', function(err) {
                                            throw err;
                                        });
                                        let configFilePath
                                        archive.on('end',(err)=>{
                                            // throw err;
                                            doc['fileList']=[dirPath+'/'+uid+'.zip']
                                            
                                            let ret={source_store_id:uid,file_name:fields.name}
                                            //存库
                                            DataSet.create(doc,function(err1,small){
                                                if(err1){
                                                    console.log(err1);
                                                    res.send({code:-1,message: err1});
                                                    return
                                                }
                                            
                                                res.send({code:0,data:ret});
                                                return
                                            })


                                        });
                                        // pipe archive data to the output file
                                        archive.pipe(output);
                                        

                                        // append files
                                        for(fe of files){
                                            if(reg.test(fe)){
                                                configFilePath=dirPath+'/'+fe
                                                continue;
                                            }                                             
                                           
                                             
					    let suffix=fe.split('.')
                                            archive.file(dirPath+'/'+fe, {name: fe});                                             
                                        }
                                        archive.finalize();

                                    }else{
                                        res.send({code:-1,message:'error'})
                                    }




                                }else if(type==="none"){
console.log("none")
                                    doc['type']='none'
                                    //单个文件，不打包
                                    if(files.length===2){
                                        let configFilePath
                                        doc['fileList']=[]
                                        for(f of files){
                                            if(reg.test(f)){
                                                configFilePath=dirPath+'/'+f
                                                continue
                                            }else{
                                                doc['singleFileName']=f
 		            	doc['fileList'].push(dirPath+'/'+f)

                                             	  }
                                        }console.log('none data:',doc)
                                        fs.unlinkSync(configFilePath)

                                        let ret={source_store_id:uid,file_name:fields.name}
                                        //存库
                                        DataSet.create(doc,function(err1,small){
                                            if(err1){
                                                console.log(err1);
                                                res.send({code:-1,message: err1});
                                                return
                                            }
                                        
                                            res.send({code:0,data:ret});
                                            return
                                        })

                                    }else if(files.length>2){
                                        doc['fileList']=[]

                                        //将除了配置文件外的数据压缩，为调用准备
                                        var output = fs.createWriteStream( dirPath+'/'+uid+'.zip');
                                        var archive = archiver('zip', {
                                            gzip: true,
                                            zlib: { level: 9 } // Sets the compression level.
                                        });
                                        archive.on('error', function(err) {
                                            throw err;
                                        });
                                        let configFilePath
                                        archive.on('end',(err)=>{
                                            // throw err;
                                            doc['fileList']=[dirPath+'/'+uid+'.zip']
                                            
                                            let ret={source_store_id:uid,file_name:fields.name}
                                            //存库
                                           DataSet.create(doc,function(err1,small){
                                                if(err1){
                                                    console.log(err1);
                                                    res.send({code:-1,message: err1});
                                                    return
                                                }
                                            
                                                res.send({code:0,data:ret});
                                                return
                                            })


                                        });
                                        // pipe archive data to the output file
                                        archive.pipe(output);
                                        

                                        // append files
                                        for(fe of files){
                                            if(reg.test(fe)){
                                                configFilePath=dirPath+'/'+fe
                                                continue;
                                            }                                             
                                          
                                            
					    
                                            archive.file(dirPath+'/'+fe, {name: fe});                                           
                                        }
                                        archive.finalize();



                                    }else{
                                        res.send({code:-1,message:'error'})
                                        return;
                                    }



                                }

                            })
                        })


                     }

                }else{
                    //只有一个数据文件
		    var reg=new RegExp('.udxcfg')
                    var config= configExistsF(files,reg)

                    if(config===undefined){
                        res.send({code:-1,message:'error,no config file'})
                        return;
                    }else{
			res.send({code:-1,message:'not only config file'})
                        return;

		    }




                }
	
            })




        
            

        })
    });

}
 function configExistsF(list,reg){
    let configName=undefined
    let regE=new RegExp(reg)
    for(file of list){
        if(regE.test(file)){
            configName=file
            break
        }
    }
    return configName
}

exports.large=function(req,res,next){
   
    let async = require('async');//异步模块
     
    let form=new formidable.IncomingForm();
    

    //设置编辑
    form.encoding = 'utf-8';

    let dirPath=__dirname+"/../uploadFiles/tep/";
     
    //设置文件存储路径
    form.uploadDir = dirPath;
    //设置单文件大小限制
   // form.maxFilesSize = 200 * 1024 * 1024;
    /*form.parse表单解析函数，fields是生成数组用获传过参数，files是bolb文件名称和路径*/
    form.parse(req, function (err,fields,files) {
         files=files['data'];//获取bolb文件
         let index=fields['index'];//当前片数
         let total=fields['total'];//总片数
         let name=fields['name'];//文件名称
         let url= dirPath+'/'+name.split('.')[0]+'_'+index+'.'+name.split('.')[1];//临时bolb文件新名字
         fs.renameSync(files.path,url);//修改临时文件名字
    
         try{
            if(index==total){//当最后一个分片上传成功，进行合并
                /*
                    检查文件是存在，如果存在，重新设置名称
                */
                let uid=uuid.v4()
         
                // fs.mkdirSync(__dirname+"/../uploadFiles/"+uid)
                // let pathname=__dirname+"/../uploadFiles/"+uid+'/'+name;//上传文件存放位置和名称

                fs.mkdirSync('/data/dataSource/'+uid)
                let pathname='/data/dataSource/'+uid+'/'+name;//上传文件存放位置和名称

                fs.access(pathname,fs.F_OK,(err) => {
                    if(!err){   
                        let myDate=Date.now();
                        pathname=dirPath+'/'+myDate+name;
                        console.log(pathname);

                    }
                });
                //这里定时，是做异步串行，等上执行完后，再执行下面
                setTimeout(function(){
                    /*进行合并文件，先创建可写流，再把所有BOLB文件读出来，
                        流入可写流，生成文件
                        fs.createWriteStream创建可写流   
                        aname是存放所有生成bolb文件路径数组:
                        ['Uploads/img/3G.rar1','Uploads/img/3G.rar2',...]
                    */
                    let writeStream=fs.createWriteStream(pathname);
                    let aname=[];
                    for(let i=1;i<=total;i++){
                        let url=dirPath+'/'+name.split('.')[0]+'_'+i+'.'+name.split('.')[1];
                        aname.push(url);
                    }

                    //async.eachLimit进行同步处理
                    async.eachLimit(aname,1,function(item,callback){
                        //item 当前路径， callback为回调函数
                        fs.readFile(item,function(err,data){    
                           if(err)throw err;
                           //把数据写入流里
                            writeStream.write(data);
                            //删除生成临时bolb文件              
                            fs.unlink(item,function(){console.log('删除成功');})
                            callback();
                        });
                    },function(err){
                        if (err) throw err;
                        //后面文件写完，关闭可写流文件，文件已经成生完成
                        writeStream.end();

                        let doc={
                            name:req.body['name'],
                            uid:uid,
                            date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                            path:pathname,
                            singleFileName:name


                        }
                        DataSet.create(doc,(db_err,doc)=>{
                            if(db_err){
                                console.log(db_err);
                                res.send({code:0,message: db_err});
                                return
                            }
                             //返回给客服端，上传成功
                            let data=JSON.stringify({'code':0,"data": {
                                "source_store_id": uid,
                                "file_name": name
                            }});
                            res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); 
                            res.end(data);//返回数据
                    
                        })
                           
                    });
                },50);

            }else{//还没有上传文件，请继续上传
                let data=JSON.stringify({'code':1,'msg':'继续上传'});
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); 
                res.end(data);//返回数据    
            }
         }catch(err){
             console.log(err)
         }
       
    });

    

}

exports.largeBKend=function(req,res,next){
    let fs=require('fs');
    let async = require('async');//异步模块
    
        // 切片的临时存储
         let dirPath=__dirname+"/../uploadFiles/tep/";
    
         let index=req.body['index'];//当前片数
         let total=req.body['total'];//总片数
         let name=req.body['name'];//文件名称
       
         let url= dirPath+'/'+name.split('.')[0]+'_'+index+'.'+name.split('.')[1];//临时bolb文件新名字
      
         try{
            if(index==total){//当最后一个分片上传成功，进行合并
                /*
                    检查文件是存在，如果存在，重新设置名称
                */
          
                    let bf=Buffer.from(req.body['data'])
                    fs.writeFileSync(url,bf)
                
                    let uid=uuid.v4()
                    
                    fs.mkdirSync('/data/dataSource/'+uid)
                    let pathname='/data/dataSource/'+uid+'/'+name;//上传文件存放位置和名称

                    //这里定时，是做异步串行，等上执行完后，再执行下面
                    setTimeout(function(){
                    let writeStream=fs.createWriteStream(pathname);
                    let aname=[];
                    for(let i=1;i<=total;i++){
                        let url=dirPath+'/'+name.split('.')[0]+'_'+i+'.'+name.split('.')[1];
                        aname.push(url);
                    }
                    // let bf=[]
                    //async.eachLimit进行同步处理
                    async.eachLimit(aname,1,function(item,callback){
                        //item 当前路径， callback为回调函数
                        fs.readFile(item,function(err,data){    
                           if(err)throw err;
                           //把数据写入流里，这里有两种方式
                           // 第一种是利用stream边读边写，这种方式相对于第二种对于内存更加友好
                            writeStream.write(data);
                            // 第二种是利用拼接buffer进行，但由于是将所有文件读取buffer并放在bf数组中进行拼接，可能由于bf数组过大导致内存溢出，所以舍弃
                            // bf.push(data)

                            //删除生成临时bolb文件              
                            fs.unlink(item,function(){console.log('删除成功');})
                            callback();
                        });
                    },function(err){
                        if (err) throw err;
                        //后面文件写完，关闭可写流文件，文件已经成生完成
                        // 这里同时有两种方式进行文件合并
                        //第一种，是关闭流，由于利用stream是边读边写的，对内存友好
                        writeStream.end();

                        // 第二种，利用Buffer的concat函数进行buffer拼接，这种方式可能会造成内存溢出，故舍弃
                        //  let re=Buffer.concat(bf)
                        //  fs.writeFileSync(pathname,re)

                        let doc={
                            name:name,
                            uid:uid,
                            date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                            path:pathname,
                            singleFileName:name
                        }
                        DataSet.create(doc,(db_err,doc)=>{
                            if(db_err){
                                console.log(db_err);
                                res.send({code:0,message: db_err});
                                return
                            }
                             //返回给客服端，上传成功
                            let data=JSON.stringify({'code':0,"data": {
                                "source_store_id": uid,
                                "file_name": name
                            }});


                            res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); 
                            res.end(data);//返回数据
                    
                        })

                    });
                },50)
                
            }else{//还没有上传文件，请继续上传
                // bf.fill(req.body['data'])
                let bf=Buffer.from(req.body['data'])
                fs.writeFileSync(url,bf)


                let data=JSON.stringify({'code':1,'msg':'继续上传'});
                res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); 
                res.end(data);//返回数据    
            }
         }catch(err){
             console.log(err)
             let data=JSON.stringify({'code':-1,'msg':err});
             res.end(data);//返回数据  
         }
       
}

//数据下载

exports.ogmsDataDown=function(req,res,next){
    let uid=req.query.uid
    let dirPath='/data/dataSource/'+uid
DataSet.findOne({uid:uid},(err,doc)=>{
    console.log("s"+doc)
    if(!doc){
    res.send({code:-1,message:'error,wrong uid'})
    return
    }
    fs.readdir(dirPath,(err,files)=>{
        if(files.length===1){
 	
           if(files[0].split('.')[1]=='html'){
                fs.readFile(dirPath+'/'+files[0],(err,data)=>{
                    if(err||!data){
                        res.send({code:-1})
                        return
                    }
                    res.setHeader('Content-Type', 'text/html')
                    res.end(data)
                    
                })
           } else{
            res.attachment(doc['singleFileName']) //告诉浏览器这是一个需要下载的文件,解决中文乱码问题
            res.setHeader('fileName',escape(doc['singleFileName'])) 
            res.writeHead(200, {
                 'Content-Type': 'application/octet-stream;fileName='+escape(doc['singleFileName']),//告诉浏览器这是一个二进制文件
               
             });//设置响应头
 
             var readStream = fs.createReadStream(dirPath+'/'+files[0]);//得到文件输入流
         
             readStream.on('data', (chunk) => {
                 res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
             });
             readStream.on('end', () => {
                 res.end();
 
                 return;
             })
           }
          

        }else{

	res.setHeader('fileName',escape(doc['name']+'.zip')) 
 	res.attachment(doc['name']+'.zip') //告诉浏览器这是一个需要下载的文件，解决中文乱码问题
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream;fileName='+escape(doc['name'])+'.zip',//告诉浏览器这是一个二进制文件
                 
            });//设置响应头
            var readStream = fs.createReadStream(dirPath+'/'+uid+'.zip');//得到文件输入流
        
            readStream.on('data', (chunk) => {
                res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
            });
            readStream.on('end', () => {
                res.end();
                return;
            })

        }
    })

  
})


}


exports.info=function(req,res,next){
    
       
   
    DataSet.findOne({uid:req.query.uid},(err,doc)=>{
        console.log(doc)
        if(err){
            res.send({code:-1,message:err})
            return
        }

      let re={
            name:doc['name'],
            uid: doc['uid'],
           
            origination:doc['origination'] ,
            serverNode: doc['serverNode'],
            
            date: doc['date'],
         
            type: doc['type'],
            singleFileName: doc['singleFileName'],


      }

       res.send({code:0,message:re})
       return



    })

     
}


exports.dataVisual=function(req,res,next){
    let suffix='',
        
        uid=req.query.uid,
        picId=uuid.v4(),
        path =''
     
        if(!uid){
            res.send({code:0,message: "uid is necessary!"});
            return
        }


	    path='/data/dataSource/'+uid+'/'+uid+'.zip'
        //在snapshot日志里检索是否生成了截图
        VisualLog.find({dataUid:uid},(err,doc)=>{
        
            //若生成过，直接找到截图返回给client
            if(doc.length>0){
                let res_path= '/home/server/snapShotCache/'+doc[0].uid+'.png' 

                fs.readFile(res_path,(err,data)=>{
                    res.writeHead(200, {
                        'Content-Type': 'application/octet-stream',//告诉浏览器这是一个二进制文件
                        'Content-Disposition': 'attachment; filename=' + 'visual.png',//告诉浏览器这是一个需要下载的文件
                    });//设置响应头
                    var readStream = fs.createReadStream(res_path);//得到文件输入流
    
                    readStream.on('data', (chunk) => {
                        res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
                    });
                    readStream.on('end', () => {
                        res.end();
 
                        return;
                    })
    
                })

            }else{
                //若未生成过snapshot，则生成
        
                fs.readdir('/data/dataSource/'+uid+'/',(err,files)=>{

                    if(files.length===1){
                       
                        path='/data/dataSource/'+uid+'/'+files[0]
                        console.log(path)
                    }

                    compressing.zip.uncompress(path, __dirname+'/../temp/'+uid+'/')
                    .then(()=>{

                        fs.readdir( __dirname+'/../temp/'+uid+'/',(err,files)=>{
                            

                    //判断采用的可视化方案

                            DataSet.find({uid},(err,doc)=>{

                                if(doc.length>0){

                    var py_script_path=''

                    console.log(VisualSolution.shp.indexOf(doc[0]['dataTemplateId']))
                                    if(VisualSolution.shp.indexOf(doc[0]['dataTemplateId'])>-1){

                                        py_script_path=__dirname+'/../lib/'+'/visual/shp.py'
                                        suffix='shp'

                                    }else if(VisualSolution.tiff.indexOf(doc[0]['dataTemplateId'])>-1){
                                        py_script_path=__dirname+'/../lib/'+'/visual/tiff.py'
                                        suffix='tif'

                                    }else{

                    res.send({code:-1,message:'There are no existing data templates'})
                    return;
                    }

                            for(v of files){ 
                                let reg=new RegExp('.'+suffix)
                                if(reg.test(v)){

                                    let temp_path="/home/server/temp/"+uid+"/"+v
                                
                                

                            //判断可视化类型，目前只有tif和shp两种

                            
                            const ls = cp.spawn('python3', [ py_script_path,temp_path,picId]);

                                    ls.stdout.on('data', (data) => {
                                            console.log(`stdout: ${data}`);
                                            var res_path=`${data}`.trim()
                                            console.log(res_path)
                            
                                            fs.readFile(res_path,(err,data)=>{
                                                res.writeHead(200, {
                                                    'Content-Type': 'application/octet-stream',//告诉浏览器这是一个二进制文件
                                                    'Content-Disposition': 'attachment; filename=' + 'visual.png',//告诉浏览器这是一个需要下载的文件
                                                });//设置响应头
                                                var readStream = fs.createReadStream(res_path);//得到文件输入流
                                
                                                readStream.on('data', (chunk) => {
                                                    res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
                                                });
                                                readStream.on('end', () => {
                                                    res.end();

                                                    VisualLog.create({
                                                        uid:picId,
                                                        dataUid:uid,
                                                        generateDate:date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                                                        cached:true
                                                    },(err,data)=>{
                                                        if(err){
                                                            console.log(err)
                                                        }

                                                    })
                                                    
                                                    return;
                                                })
                                
                                            })


                                    });

                                    ls.stderr.on('data', (data) => {
                                    console.error(`stderr: ${data}`);
                                    });

                                    ls.on('close', (code) => {
                                    console.log(`子进程退出，退出码 ${code}`);
                                    });
                                
                                

                                    break
                                }
                            }
                    }else{
                                    res.send({code:-1,message:'error,no data'})
                    }
                        })
                    })
                    })
                    .catch((err)=>{
                        console.log(err)
                    })



                })
                

            }

        })

}


exports.dataVisualNoCache=function(req,res,next){
    let suffix='',
        
        uid=req.query.uid,
        picId=uuid.v4(),
        path =''
     
        if(!uid){
            res.send({code:0,message: "uid is necessary!"});
            return
        }

       
 	path='/data/dataSource/'+uid+'/'+uid+'.zip'




         //若未生成过snapshot，则生成
     
                  fs.readdir('/data/dataSource/'+uid+'/',(err,files)=>{

                    if(files.length===1){
                       
                        path='/data/dataSource/'+uid+'/'+files[0]
                        
                    }

                    compressing.zip.uncompress(path, __dirname+'/../temp/'+uid+'/')
                    .then(()=>{

                        fs.readdir( __dirname+'/../temp/'+uid+'/',(err,files)=>{
                            

                    //判断采用的可视化方案

                            DataSet.find({uid},(err,doc)=>{

                                if(doc.length>0){

                    var py_script_path=''

                    console.log(VisualSolution.shp.indexOf(doc[0]['dataTemplateId']))
                                    if(VisualSolution.shp.indexOf(doc[0]['dataTemplateId'])>-1){

                                        py_script_path=__dirname+'/../lib/'+'/visual/shp.py'
                                        suffix='shp'

                                    }else if(VisualSolution.tiff.indexOf(doc[0]['dataTemplateId'])>-1){
                                        py_script_path=__dirname+'/../lib/'+'/visual/tiff.py'
                                        suffix='tif'

                                    }else{

                    res.send({code:-1,message:'There are no existing data templates'})
                    return;
                    }

                            for(v of files){ 
                                let reg=new RegExp('.'+suffix)
                                if(reg.test(v)){

                                    let temp_path="/home/server/temp/"+uid+"/"+v
                                
                                

                            //判断可视化类型，目前只有tif和shp两种

                            
                            const ls = cp.spawn('python3', [ py_script_path,temp_path,picId]);

                                    ls.stdout.on('data', (data) => {
                                            console.log(`stdout: ${data}`);
                                            var res_path=`${data}`.trim()
                                            console.log(res_path)
                            
                                            fs.readFile(res_path,(err,data)=>{
                                                res.writeHead(200, {
                                                    'Content-Type': 'application/octet-stream',//告诉浏览器这是一个二进制文件
                                                    'Content-Disposition': 'attachment; filename=' + 'visual.png',//告诉浏览器这是一个需要下载的文件
                                                });//设置响应头
                                                var readStream = fs.createReadStream(res_path);//得到文件输入流
                                
                                                readStream.on('data', (chunk) => {
                                                    res.write(chunk, 'binary');//文档内容以二进制的格式写到response的输出流
                                                });
                                                readStream.on('end', () => {
                                                    res.end();

                                                    VisualLog.create({
                                                        uid:picId,
                                                        dataUid:uid,
                                                        generateDate:date.format(new Date(), 'YYYY-MM-DD HH:mm'),
                                                        cached:true
                                                    },(err,data)=>{
                                                        if(err){
                                                            console.log(err)
                                                        }

                                                    })
                                                    
                                                    return;
                                                })
                                
                                            })


                                    });

                                    ls.stderr.on('data', (data) => {
                                    console.error(`stderr: ${data}`);
                                    });

                                    ls.on('close', (code) => {
                                    console.log(`子进程退出，退出码 ${code}`);
                                    });
                                
                                

                                    break
                                }
                            }
                    }else{
                                    res.send({code:-1,message:'error,no data'})
                    }
                        })
                    })
                    })
                    .catch((err)=>{
                        console.log(err)
                    })



                })





}

exports.test=function test(req,res,next){
    res.send({data:'test'})
}

//添加描述信息
exports.storageDesc=function(req,res,next){

 
    const uid=uuid.v4();

    var form = new formidable.IncomingForm();
    //文件放在文件夹xia
    form.parse(req,function(err,fields,files){

        let DataSet=dataModel.DataSet;
        if(!fields.dataFileId||!fields.name||!fields.dataTemplateId||!fields.origination||!fields.serverNode||!fields.userId){
            res.send("without name , dataFileId ,origination, serverNode or dataTemplateId")
            return
        } 
        let obj={
            uid:uid,
            name:fields.name,
            fileId:fields.dataFileId,
            dataTemplateId:fields.dataTemplateId,
            origination:fields.origination,
            serverNode:fields.serverNode,
            userId:fields.userId,
            access:fields.access,
            date: date.format(new Date(), 'YYYY-MM-DD HH:mm'),
            info:JSON.parse(fields.info)
        };

        if(err){
            console.log(err);
            res.send(err);
            
        }
        console.log("add info")
        DataSet.create(obj,function(err1,small){
            if(err1){
                console.log(err1);
                res.send(err1);
            }
            res.send({source_store_id:uid,file_name:fields.name});
        })
    })
}

//获取数据列表
exports.datalist=function(req,res,next){
    let page=req.query.page-1
   
    DataSet.count({},function(err,ct){
         
        DataSet.find({},null,{skip:10*page,limit:10},function(err,doc){
            let re=[]
            doc.forEach(_=>{
                let obj={}
                obj["info"]=_.info;
                obj["uid"]=_.uid;
                obj["date"]=_.date;
                obj["name"]=_.name;
                obj["dataTemplateId"]=_.dataTemplateId;
                obj["userId"]=_.userId;
                obj["access"]=_.access;
                re.push(obj)
            })
            console.log("get data list,total: ",ct)
            res.send({total:ct,list:re})
        })
    })
}

exports.filter=function(req,res,next){
    let cont=req.query.words
    let page=req.query.page-1

    let query={"info.name":new RegExp(cont)}

    DataSet.count(query,function(err,ct){
        DataSet.find(query,null,{skip:10*page,limit:10},function(err,doc){
            let re=[]
            doc.forEach(_=>{
                let obj={}
                obj["info"]=_.info;
                obj["uid"]=_.uid;
                obj["date"]=_.date
                re.push(obj)
            })
            console.log("get data list,total: ",ct)
            res.send({total:ct,list:re})
        })
    })



}






//更新数据描述信息
// TODO 这里先只是desc字段更新 
exports.update=function(req,res,next){
   
    const form = new formidable.IncomingForm()
    form.parse(req,function(err,fields,files){
        let uid=fields.uid
        let desc=fields.desc
        DataSet.updateOne({uid:uid},{desc: desc},null,function(err,re){
          if(re.nModified>0){
                res.send("update success")
            }else{
                res.send("fail: modify 0 data")
            }
          
        })
        
    })
    
}

//删除数据
exports.del=function(req,res,next){
    
     
        let uid=req.query.uid
        
        DataSet.findOne({uid:uid},function(err,doc){
	if(!doc){
	res.send({code:-1,message:"can't delete any more"})
	return
	}
            if(err){
                res.send(err)
            }else{
                try{
                    delDir(doc.path)

                    DataSet.deleteOne({uid:uid},function(err){
                        if(err){
                              res.send(err)
                          }else{
                              res.send({code:0,message:"delete success"})
                          }
                    })

                }catch(err){
                    console.log(err)
                    res.send({code:-1,message:'delete error'})
                }                


            }            
        })                                
     
}
 
