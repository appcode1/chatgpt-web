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
import fs from 'fs';
import {appendFile} from 'fs/promises';
import { ChatGPTAPI /*, ChatGPTUnofficialProxyAPI*/ } from 'chatgpt'; //https://github.com/transitive-bullshit/chatgpt-api
import { /*ChatGPTClient,*/ ChatGPTBrowserClient, BingAIClient } from '@waylaidwanderer/chatgpt-api'; //https://github.com/waylaidwanderer/node-chatgpt-api
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
let bingAIApiClient;

const server = fastify();

await server.register(cors, {
    origin: '*',
});

//serve the static html/js/css/img resources from the sub-folder './build'
await server.register(fastifyStatic, {
    root: fs.realpathSync('./build')
});
console.log('serve the static web resources from the folder:', fs.realpathSync('./build'));

server.post('/conversation', async (request, reply) => {
	const acceptcode = request.headers['accept-code'];
	if(!acceptcode){
		console.log('Unauthorized');
		return reply.code(401).type('text/plain').send('Unauthorized');
	}
	let id;
	try{
		id=Buffer.from(acceptcode,'base64').toString('utf-8');
	}catch(err){console.error(err)}
    console.log(`${id} - ${request.ip} - ${getTimeStamp()}`);
	if(!id||!settings.whiteList.includes(id)){
		console.log('Unauthorized');
		return reply.code(401).type('text/plain').send('Unauthorized');
	}
    const body = request.body || {};
    const abortController = new AbortController();

    reply.raw.on('close', () => {
        if (abortController.signal.aborted === false) {
            abortController.abort();
        }
    });


	let apiResponse;
	let result;
	try{
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

				  result = {ts: body.ts, q: body.q, bot: 'GPT3.5',
					id: apiResponse.id, //chatgpt, chatgpt-browser
					conversationId: apiResponse.conversationId, //chatgpt-browser
					text: apiResponse.text, 
					usage: apiResponse.detail && apiResponse.detail.usage ? apiResponse.detail.usage : undefined, //chatgpt
				};
	
				break;
			case 'chatgpt-browser':
				if(!chatGPTProxyApiClient){
					// chatGPTProxyApiClient = new ChatGPTUnofficialProxyAPI({
					// 	accessToken: settings.chatGptBrowserClient.accessToken,
					// 	apiReverseProxyUrl: settings.chatGptBrowserClient.reverseProxyUrl,
					//   });
					//ChatGPTUnofficialProxyAPI has some bug, so change to use ChatGPTBrowserClient
					//
					chatGPTProxyApiClient = new ChatGPTBrowserClient(settings.chatGptBrowserClient);
				}
				apiResponse = await chatGPTProxyApiClient.sendMessage(body.q, {
					timeoutMs: 5 * 60 * 1000,
					conversationId: body.lastMsgId && body.lastMsgConversationId ? body.lastMsgConversationId : undefined,
					parentMessageId: body.lastMsgId && body.lastMsgConversationId ? body.lastMsgId : undefined,
				  });

				result = {ts: body.ts, q: body.q, bot: 'ChatGPT',
					id: apiResponse.messageId ?? apiResponse.id, 
					conversationId: apiResponse.conversationId, //chatgpt-browser
					text: apiResponse.response ?? apiResponse.text, 
				};
	
				break;
			case 'bing':
				//https://github.com/waylaidwanderer/node-chatgpt-api/blob/main/bin/server.js
				if(!bingAIApiClient){
					bingAIApiClient = new BingAIClient({ ...settings.bingAiClient, cache: settings.cacheOptions });
				}
				apiResponse = await bingAIApiClient.sendMessage(body.q, {
					jailbreakConversationId: body.jailbreakConversationId,
					conversationId: body.lastMsgConversationId ? body.lastMsgConversationId.toString() : undefined,
					parentMessageId: body.lastMsgId ? body.lastMsgId.toString() : undefined,
					conversationSignature: body.conversationSignature,
					clientId: body.clientId,
					invocationId: body.invocationId,
					shouldGenerateTitle: false, // only used for ChatGPTClient
					toneStyle: 'creative', //body.toneStyle, //creative, precise, fast
					clientOptions: null,
					onProgress: null,
					abortController,
				});

				result = {ts: body.ts, q: body.q, bot: 'Bing',
					conversationId: apiResponse.conversationId,
					conversationSignature: apiResponse.conversationSignature,
					clientId: apiResponse.clientId,
					invocationId: apiResponse.invocationId,
					text: apiResponse.response,
					suggestedResponses: apiResponse.details?.suggestedResponses?.map(a=>a.text),
				};
				break;
			default:
				console.error('settings.apiOptions.clientToUse is not defined in settings file!');
				process.exit(1);
		}
				  
		//console.log(`${settings.apiOptions.clientToUse} API response object:`, apiResponse);
		//console.log('result object:', result);

		//log the usage for this id
		var filename=`${id}.log`;
		var line = `{"ts":"${result.ts}", "ip":"${request.ip}", "bot":"${result.bot}"`;
		if(result.usage && result.usage.total_tokens){
			line += `, "tokens":${result.usage.total_tokens}},\n`;
		}else {
			line +='},\n';
		}
		appendFile(filename, line, 'utf8')
			.then(()=>console.log(line))
			.catch(console.error);
	}catch(error){
		console.error(error.message);
		result = {ts: body.ts, error: error.message};

		var filename=`${id}.log`;
		var line = `{"ts":"${result.ts}", "ip":"${request.ip}", "error":"some error happened"},\n`;
		appendFile(filename, line, 'utf8')
			.then(()=>console.log(line))
			.catch(console.error);
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

console.log(`[ChatGPT Web App] is running at http://${settings.apiOptions.host}:${settings.apiOptions.port}`)

server.get('/ping', async (request) => `server time: ${(new Date()).toString()}\n\n\nclient ip: ${request.ip}`);
const getTimeStamp = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2,'0');
    const day = String(date.getDate()).padStart(2,'0');
    const hour = String(date.getHours()).padStart(2,'0');
    const minute = String(date.getMinutes()).padStart(2,'0');
    const seconds = String(date.getSeconds()).padStart(2,'0');
    const msSeconds = String(date.getMilliseconds()).padStart(3,'0');
  
    return `${year}-${month}-${day}T${hour}:${minute}:${seconds}.${msSeconds}`;
}
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
