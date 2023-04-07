//.mjs file ---- module js file
//use import instead of require()
//use fastify to create a nodejs webserver
//1. host the static web resources from the sub-folder './build'
//2. provide the ChatGPT API to the web front-end

//this .mjs file can import another .mjs file, but it cannot import another .js file
//it can import the content of a javascript file (settings.mjs)

import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import { pathToFileURL } from 'url';
import * as url from 'url';
import fs from 'fs';
import {appendFile} from 'fs/promises';
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt';
import dotenv from 'dotenv';

dotenv.config();  //config using .env

const arg = process.argv.find(_arg => _arg.startsWith('--settings'));
const settingsFile = arg?.split('=')[1] ?? './settings.mjs';

let settings;
if (fs.existsSync(settingsFile)) {
    // get the full path
    const fullPath = fs.realpathSync(settingsFile);
    settings = (await import(pathToFileURL(fullPath).toString())).default;
} else {
    if (arg) {
        console.error('Error: the file specified by the --settings parameter does not exist.');
    } else {
        console.error('Error: the settings.mjs file does not exist.');
    }
    process.exit(1);
}


let chatGPTApiClient;
let chatGPTProxyApiClient;

const server = fastify();

await server.register(cors, {
    origin: '*',
});

//serve the static html/js/css/img resources from the sub-folder './build'
await server.register(fastifyStatic, {
    root: fs.realpathSync('./build')
});
console.log('serve the static web resources from the folder:', fs.realpathSync('./build'));

server.post('/chatgpt', async(request, reply) => {
	const objUrl = url.parse(request.url, true);
    const id = objUrl.query.id;

    id && console.log('From id: ' + id);
	if(id==null||id==''||!settings.whiteList.includes(id)){
		return reply.code(401).type('text/plain').send('Unauthorized');
	}
    const body = request.body || {};
    const abortController = new AbortController();

    reply.raw.on('close', () => {
        if (abortController.signal.aborted === false) {
            abortController.abort();
        }
    });

	let result;
	try{
		let apiResponse;
		switch(settings.apiOptions.clientToUse){
			case 'chatgpt':
				if(!chatGPTApiClient){
					chatGPTApiClient = new ChatGPTAPI({
						apiKey: settings.chatGptClient.openaiApiKey,
						completionParams: {
							model: 'gpt-3.5-turbo', //settings.chatGptClient.modelOptions.model,
							temperature: 1, //default to 0.8 in ChatGPTAPI.  What sampling temperature to use, between 0 and 2
							top_p: 1,
							presence_penalty: 1, //Number between -2.0 and 2.0
						},
					  });
					//completionParams
				    //https://platform.openai.com/docs/api-reference/chat/create
				}
				apiResponse = await chatGPTApiClient.sendMessage(body.q, {
					timeoutMs: 5 * 60 * 1000,
					parentMessageId: body.lastMsgId,
				  });
				break;
			case 'chatgpt-browser':
				if(!chatGPTProxyApiClient){
					chatGPTProxyApiClient = new ChatGPTUnofficialProxyAPI({
						accessToken: settings.chatGptBrowserClient.accessToken,
						apiReverseProxyUrl: settings.chatGptBrowserClient.reverseProxyUrl,
					  });
				}
				apiResponse = await chatGPTProxyApiClient.sendMessage(body.q, {
					timeoutMs: 5 * 60 * 1000,
					conversationId: body.lastMsgConversationId,
					parentMessageId: body.lastMsgId,
				  })
				break;
			default:
				process.exit(1);
		}
				  
		//console.log(`${settings.apiOptions.clientToUse} API response:`, apiResponse);
		result = {ts: body.ts, q: body.q, 
			id: apiResponse.id, //chatgpt, chatgpt-browser
			conversationId: apiResponse.conversationId, //chatgpt-browser
			text: apiResponse.text, 
			usage: apiResponse.detail && apiResponse.detail.usage ? apiResponse.detail.usage : undefined, //chatgpt
		};
		//console.log('result:', result);
		if(result.usage && result.usage.total_tokens){
			//chatgpt, log the usage for this userId
			var filename=`${id}.log`;
			var line = `{"ts":"${result.ts}", "tokens":${result.usage.total_tokens}},\n`;
			appendFile(filename, line, 'utf8')
				.then(()=>console.log(line))
				.catch(console.error);
		}
	}catch(error){
		console.error(error.message);
		result = {ts: body.ts, error: error.message};
	}
	return reply.send(result);
});

server.listen({
	port: settings.apiOptions.port,
	host: settings.apiOptions.host,
	}, 
	(error) => {
    if (error) {
        console.error(error);
        process.exit(1);
    }
});

console.log(`[ChatGPTWebApp] is running at http://${settings.apiOptions.host}:${settings.apiOptions.port}`)

server.get('/ping', () => Date.now().toString());

//------------/test---------------------------
// server.get('/test', async (request, reply) => {
//     const objUrl = url.parse(request.url, true);
//     const id = objUrl.query.id;  
//     console.log('test the GET.............');
//     console.log('url:', request.url);
//     console.log('id & method:', id, request.method);
//     if(id=='david')
//         reply.code(200).type('application/json').send({message: 'You are okay!', status: 0, code:'SUCCESS'});
//     else
//         reply.code(401).type('text/plain').send('error: unauthorized');
// });
// server.post('/test', async (request, reply) => {
//     const objUrl = url.parse(request.url, true);
//     const id = objUrl.query.id;  
//     console.log('test the POST.............');
//     console.log('url:', request.url);
//     console.log('id & method:', id, request.method);
//     console.log('request body object:', request.body);
//     console.log('request body string:', JSON.stringify(request.body));
//     if(id=='david')
//         reply.code(200).type('application/json').send({message: 'You are okay!', status: 0, code:'SUCCESS'});
//     else
//         reply.code(401).type('text/plain').send('error: unauthorized');
// });

/* test script from chrome console:
var requestData={name:'david', sex:'M', age:22, prop: {h:179, w:65}};
fetch('http://localhost:5000/test?id=david', {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(requestData),
    }).then(res=>res.json()).then(data=>console.log(data));
*/
//--------------------------------------
