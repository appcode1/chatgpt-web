//.js file --- regular js file (non-module)
//use require() instead of import
//use fastify to create a nodejs webserver
//host the static web resources from the sub-folder './build'
//it can read the json file

const server = require('fastify')(); //or require('fastify')({logger: true});
const cors = require('@fastify/cors');
const fastifyStatic = require('@fastify/static');
const fs = require('fs');
const url = require('url');
const dotenv = require('dotenv');

dotenv.config();  //config using .env

const arg = process.argv.find(_arg => _arg.startsWith('--settings'));
const settingsFile = arg?.split('=')[1] ?? './mytestsettings.json';

let settings;
if (fs.existsSync(settingsFile)) {
    // get the full path
    const fullPath = fs.realpathSync(settingsFile);
    settings = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
} else {
    if (arg) {
        console.error('Error: the file specified by the --settings parameter does not exist.');
    } else {
        console.error('Error: the mytestsettings.json file does not exist.');
    }
    process.exit(1);
}


// Run the server!
const start = async () => {
    await server.register(cors, {
        origin: '*',
    });

    //serve the static html/js/css/img resources from the sub-folder './build'
    await server.register(fastifyStatic, {
        root: fs.realpathSync('./build')
    });
    console.log('serve the static web resources from the folder:', fs.realpathSync('./build'));

    await server.listen({
        port: process.env.API_PORT,
        host: process.env.API_HOST,
        }, 
        (error) => {
        if (error) {
            console.error(error);
            process.exit(1);
        }
    });
    console.log(`[my nodejs testing web server] is running at http://${process.env.API_HOST}:${process.env.API_PORT}`)
  };
start();


//server.get('/ping', () => Date.now().toString());
server.get('/ping', async (request) => `server time: ${(new Date()).toString()}\n\n\nclient ip: ${request.ip}`);

//------------/test---------------------------
server.get('/test', async (request, reply) => {
    const objUrl = url.parse(request.url, true);
    const id = objUrl.query.id;  
    console.log('test the GET.............');
    console.log('url:', request.url);
    console.log('id & method:', id, request.method);
    console.log('ip:', request.ip);

    if(id=='david'||settings.whiteList.includes(id))
        reply.code(200).type('application/json').send({message: 'You are okay!', status: 0, code:'SUCCESS', ip: request.ip});
    else
        reply.code(401).type('text/plain').send('error: unauthorized');
});
server.post('/test', async (request, reply) => {
    const objUrl = url.parse(request.url, true);
    const id = objUrl.query.id;  
    console.log('test the POST.............');
    console.log('url:', request.url);
    console.log('id & method:', id, request.method);
    console.log('request body object:', request.body);
    console.log('request body string:', JSON.stringify(request.body));
    if(id=='david'||settings.whiteList.includes(id))
        reply.code(200).type('application/json').send({message: 'You are okay!', status: 0, code:'SUCCESS', ip: request.ip});
    else
        reply.code(401).type('text/plain').send('error: unauthorized');
});

/* test script from chrome console:
var requestData={name:'david', sex:'M', age:22, prop: {h:179, w:65}};
fetch('http://localhost:5000/test?id=david', {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(requestData),
    }).then(res=>res.json()).then(data=>console.log(data));
*/
//--------------------------------------
