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

const logpath=settings.logPath ? settings.logPath : './logs';

if (!fs.existsSync(logpath)){
    fs.mkdirSync(logpath);
}

let chatGPTApiClient35;
let chatGPTApiClient40;
let chatGPTProxyApiClientGpt35a;
let chatGPTProxyApiClientGpt35b;
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
	let acceptcode = request.headers['accept-code'];
	const id = request.headers['user'];
	const model = request.headers['model'];
	let userKey = model;
	if(!acceptcode || !id || !model){
		console.log('Unauthorized');
		return reply.code(401).type('text/plain').send('Unauthorized');
	}
	if(['bing-chat','bing-sydney','chatgpt-browser-3.5-1','chatgpt-browser-3.5-2'].includes(model)){
		userKey='bing_chatgpt-browser';
	}
	try{
		acceptcode=Buffer.from(acceptcode,'base64').toString('utf-8');
	}catch(err){console.error(err)}
    console.log(`${id} - ${request.ip} - ${getTimeStamp()}`);
	
	if(id!=acceptcode||!settings.whiteList[userKey].includes(id)){
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
		//switch(settings.apiOptions.clientToUse){
		switch(body.model){
			case 'chatgpt-3.5':
				if(!chatGPTApiClient35){
					chatGPTApiClient35 = new ChatGPTAPI({
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
				apiResponse = await chatGPTApiClient35.sendMessage(body.q, {
					timeoutMs: 5 * 60 * 1000,
					parentMessageId: body.msgId,
				  });
/* response object:
{
  role: 'assistant',
  id: 'chatcmpl-7AgZyIdc9l5lX1RsSG9FvcQCWcQ2J',
  conversationId: undefined,
  parentMessageId: 'acf6dcc8-55d2-4439-a74e-90b8049bea43',
  text: 'I am ChatGPT, a large language model developed by OpenAI.',      
  detail: {
    id: 'chatcmpl-7AgZyIdc9l5lX1RsSG9FvcQCWcQ2J',
    object: 'chat.completion',
    created: 1682781310,
    model: 'gpt-3.5-turbo-0301',
    usage: { prompt_tokens: 61, completion_tokens: 15, total_tokens: 76 },
    choices: [ [Object] ]
  }
} 
*/
				  result = {ts: body.ts, q: body.q, 
					bot: 'GPT3.5',
					msgId: apiResponse.id, //chatgpt, chatgpt-browser
					conversationId: apiResponse.conversationId, //chatgpt-browser
					text: apiResponse.text, 
					usage: apiResponse.detail && apiResponse.detail.usage ? apiResponse.detail.usage : undefined, //chatgpt
				};
				//console.log('GPT3.5:', apiResponse, result);
				break;
			case 'chatgpt-4':
				result = {ts: body.ts, q: body.q,
						  bot: 'GPT4',
						  text: '暂时不可用!!! Temporarily unavailable!!!'
						};
				break;
					if(!chatGPTApiClient40){
						chatGPTApiClient40 = new ChatGPTAPI({
							apiKey: settings.chatGptClient.openaiApiKey,
							completionParams: {
								model: 'gpt-4', //settings.chatGptClient.modelOptions.model,
								temperature: 1, //default to 0.8 in ChatGPTAPI.  What sampling temperature to use, between 0 and 2
								top_p: 1,
								presence_penalty: 1, //Number between -2.0 and 2.0
							},
						  });
						//completionParams
						//https://platform.openai.com/docs/api-reference/chat/create
					}
					apiResponse = await chatGPTApiClient40.sendMessage(body.q, {
						timeoutMs: 5 * 60 * 1000,
						parentMessageId: body.msgId,
					  });
	/* response object:
{
  role: 'assistant',
  id: 'chatcmpl-7AgVDInJ7nu6TilLqGyd6Nu3BOy2k',
  conversationId: undefined,
  parentMessageId: '9c9ec012-86f3-4b07-8f13-cdbd0a269fe1',
  text: "I am ChatGPT, an AI language model created by OpenAI. I'm designed to understand and generate human-like responses to text-based questions or statements.",
  detail: {
    id: 'chatcmpl-7AgVDInJ7nu6TilLqGyd6Nu3BOy2k',
    object: 'chat.completion',
    created: 1682781015,
    model: 'gpt-4-0314',
    usage: { prompt_tokens: 59, completion_tokens: 32, total_tokens: 91 },
    choices: [ [Object] ]
  }
}
	*/

					  result = {ts: body.ts, q: body.q, 
						bot: 'GPT4',
						msgId: apiResponse.id, //chatgpt, chatgpt-browser
						conversationId: apiResponse.conversationId, //chatgpt-browser
						text: apiResponse.text, 
						usage: apiResponse.detail && apiResponse.detail.usage ? apiResponse.detail.usage : undefined, //chatgpt
					};
					//console.log('GPT4:', apiResponse, result);
					break;
			case 'chatgpt-browser-3.5-1':
				if(!chatGPTProxyApiClientGpt35a){
					const gpt35Setting = {...settings.chatGptBrowserClient,
						model: 'text-davinci-002-render-sha',
						reverseProxyUrl: settings.reverseProxyUrlsWorking[0]
					};
					chatGPTProxyApiClientGpt35a = new ChatGPTBrowserClient(gpt35Setting);
				}
				apiResponse = await chatGPTProxyApiClientGpt35a.sendMessage(body.q, {
					timeoutMs: 5 * 60 * 1000,
					conversationId: body.msgId && body.conversationId ? body.conversationId : undefined,
					parentMessageId: body.msgId && body.conversationId ? body.msgId : undefined,
				  });

				result = {ts: body.ts, q: body.q,
					bot: 'ChatGPT3.5',
					msgId: apiResponse.messageId ?? apiResponse.id, 
					conversationId: apiResponse.conversationId, //chatgpt-browser
					text: apiResponse.response ?? apiResponse.text, 
				};
				break;
			case 'chatgpt-browser-3.5-2':
					if(!chatGPTProxyApiClientGpt35b){
						const gpt35Setting = {...settings.chatGptBrowserClient,
							model: 'text-davinci-002-render-sha',
							reverseProxyUrl: settings.reverseProxyUrlsWorking[1]
						};
						chatGPTProxyApiClientGpt35b = new ChatGPTBrowserClient(gpt35Setting);
					}
					apiResponse = await chatGPTProxyApiClientGpt35b.sendMessage(body.q, {
						timeoutMs: 5 * 60 * 1000,
						conversationId: body.msgId && body.conversationId ? body.conversationId : undefined,
						parentMessageId: body.msgId && body.conversationId ? body.msgId : undefined,
					  });
	
					result = {ts: body.ts, q: body.q,
						bot: 'ChatGPT3.5',
						msgId: apiResponse.messageId ?? apiResponse.id, 
						conversationId: apiResponse.conversationId, //chatgpt-browser
						text: apiResponse.response ?? apiResponse.text, 
					};
					break;
			case 'bing-chat':
			case 'bing-sydney':
				//https://github.com/waylaidwanderer/node-chatgpt-api/blob/main/bin/server.js
				if(!bingAIApiClient){
					bingAIApiClient = new BingAIClient({ ...settings.bingAiClient, cache: settings.cacheOptions });
				}

				let opts;
				if(body.model === 'bing-sydney'){
					 //activate jailbreak mode for Bing
					opts = {
						jailbreakConversationId: !body.jailbreakConversationId ? true : body.jailbreakConversationId,
						parentMessageId: body.msgId ? body.msgId.toString() : undefined,
						toneStyle: 'creative', //body.toneStyle, //balanced, creative, precise, fast
						clientOptions: null,
						onProgress: null,
						abortController,
					};
				}else {
					//bing-chat
					opts = {
						conversationId: body.conversationId ? body.conversationId.toString() : undefined,
						conversationSignature: body.conversationSignature,
						clientId: body.clientId,
						invocationId: body.invocationId,
						toneStyle: 'creative', //body.toneStyle, //balanced, creative, precise, fast
						clientOptions: null,
						onProgress: null,
						abortController,
					};
				}

				apiResponse = await bingAIApiClient.sendMessage(body.q, opts);
				//console.log('bing response:', apiResponse);

				//jailbreak mode --- jailbreakConversationId has value
				result = {ts: body.ts, q: body.q, 
					bot: apiResponse.jailbreakConversationId ? 'Sydney' : 'Bing',
					jailbreakConversationId: apiResponse.jailbreakConversationId, //jailbreak
					msgId: apiResponse.messageId, //jailbreak
					conversationId: apiResponse.conversationId,
					conversationSignature: apiResponse.conversationSignature,
					clientId: apiResponse.clientId,
					invocationId: apiResponse.invocationId,
					text: apiResponse.response,
					suggestedResponses: apiResponse.details?.suggestedResponses?.map(a=>a.text),
				};
				
				break;
			default:
				console.error('body.model is invalid!');
				result = {bot: 'Bot(invalid body.model)'};
		}
				  
		//log the usage for this id
		var filename=`${logpath}/${id}.log`;
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

		var filename=`${logpath}/${id}.log`;
		var line = `{"ts":"${result.ts}", "ip":"${request.ip}", "error":${error.message}},\n`;
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

console.log(`[chat web app server] is running at http://${settings.apiOptions.host}:${settings.apiOptions.port}`)

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
