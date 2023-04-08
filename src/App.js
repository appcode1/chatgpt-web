import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { useState, useEffect } from 'react';
import { isBlank, formatTime, getTimeStamp } from './utility';

function App() {
  const [userId, setUserId] = useState('');
  const [signInStatus, setSignInStatus] = useState('');
  //const [ip, setIP] = useState('0.0.0.0');
  const [question, setQuestion] = useState('');
  const [lastReply, setLastReply] = useState({});
  const [conversation, setConversation] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);
  const [totalTokens, setTotalTokens] = useState(0); 

  const mainDiv = document.querySelector('#main');
  const scrollToBottom = () => {
    mainDiv.scrollTop = mainDiv.scrollHeight;
    setTimeoutId(null);
  };
  const scrollToView = () => {
    setConversation(conversation);
    if(timeoutId) clearTimeout(timeoutId);
    const tid = setTimeout(scrollToBottom, 1000);
    setTimeoutId(tid);
  };
  function getData(key) {
    const savedData = JSON.parse(window.localStorage.getItem("chat"))||{};
    return savedData[key];
}
  function saveData(key, value){
      let savedChat = JSON.parse(window.localStorage.getItem("chat"))||{};
      savedChat[key] = value;
      window.localStorage.setItem("chat", JSON.stringify(savedChat));
  }

  // const getIP = () => {
  //   fetch('https://api.ipify.org')
  //   .then(res => res.text())
  //   .then(data => {
  //     window._ip = data;
  //     setIP(data);
  //   });
  // };
  //window._ip || getIP(); //execute it only one time

  const handleInput = (e) => setQuestion(e.target.value);
  const handleUserId = (e) => {
    setUserId(e.target.value);
    setSignInStatus('');
  };
  
  const userIdSignIn = (e) => {
    if(isBlank(userId)) 
      return;

    const theId = String(userId).replace(/\s/g,'').toLowerCase(); //remove the space
    if(theId.length>=3 && theId.length<=20){
      saveData('signedin', {userId: theId, status: 'OK'});
      setUserId(theId);
      setSignInStatus('OK');
      setTotalTokens(0);
    }
    else
      setSignInStatus('Invalid User ID');
  };
  const signOut = () => {
    setConversation([]);
    setUserId('');
    setSignInStatus('');
    saveData('signedin', {});
  };

  function downloadTextFile(text, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {
        type: 'application/json'
    }));
    a.download = name;
    a.click();
  }
  const clearChatData = () =>{
    setConversation([]);
    saveData(userId, []);
    setTotalTokens(0);
  };
  const exportData = () => {
    if(conversation.length == 0) return;

    let output='';
    conversation.forEach(a => {
      let temp=a.tt ? `${a.tt}  ` : '';
      temp += a.usage ? `tokens:${a.usage.total_tokens}` : '';
      if(temp!=''){
        temp += '\r\n';
      }
      output +=`${a.ts}\r\nYou: ${a.q}\r\n${temp}${a.bot ? a.bot : 'Bot'}: ${a.text}\r\n\r\n`;
    });
    var total = conversation.filter(c => c.usage && c.usage.total_tokens).map(o=>o.usage.total_tokens).reduce((a,b)=>a+b, 0);
    if(total && total>0){
      output +=`\r\n=== total tokens: ${total} ===`;
    }
    downloadTextFile(output, `chat_${formatTime(new Date())}.txt`);
  };
  const sendChat = () => {
    if(isBlank(question)) return;

    const timeStamp = getTimeStamp();
    conversation.push({ts: timeStamp, q: question, text: 'waiting for reply...'});
    const requestData = {ts: timeStamp, q: question,
          lastMsgId: lastReply.id, //chatgpt
          lastMsgConversationId: lastReply.conversationId, //chatgpt, bing
          conversationSignature: lastReply.conversationSignature, //bing
          clientId: lastReply.clientId, //bing
          invocationId: lastReply.invocationId, //bing
        };
    fetch(`${document.location.origin}/conversation?id=${userId}`, {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(requestData),
    })
    .then((res) => {
      if(res.status == 200){
        //OK
        const timeStamp2=getTimeStamp();
        res.json().then(data => {
          if(data && data.text){
            setLastReply({ts: data.ts, 
              id: data.id, //chatgpt
              conversationId: data.conversationId, //chatgpt, bing
              conversationSignature: data.conversationSignature, //bing
              clientId: data.clientId, //bing
              invocationId: data.invocationId, //bing
            });
            data.tt=timeStamp2;
            const theIndex = conversation.findIndex(c => c.ts == data.ts);
            if(theIndex>=0){
              conversation[theIndex] = data;
              saveData(userId, conversation);
              var total = conversation.filter(c => c.usage && c.usage.total_tokens).map(o=>o.usage.total_tokens).reduce((a,b)=>a+b, 0);
              setTotalTokens(total);
              scrollToView();
            }
          }else{
            const theIndex = conversation.findIndex(c => c.ts == (data && data.ts ? data.ts : requestData.ts));
            if(theIndex>=0){
              conversation[theIndex].text = data && data.error ? data.error : 'some error happened';
              scrollToView();
            }
          }
        }).catch(error =>{
          const theIndex = conversation.findIndex(c => c.ts == requestData.ts);
          if(theIndex>=0){
            conversation[theIndex].text = 'some error happened';
            scrollToView();
          }
        });
      }else {
        //401, 400
        //other failed status
        const theIndex = conversation.findIndex(c => c.ts == requestData.ts);
        if(theIndex>=0){
          conversation[theIndex].text = `${res.status} - ${res.statusText}`;
          scrollToView();
        }

        if(res.status == 401){
        //Unauthorized
          setTimeout(()=>{
            saveData('signedin', null);
            setSignInStatus('Unauthorized User ID');
            setConversation([]);
          }, 10000);
        }
      }
    })
    .catch(error => {
      console.log("Error:", error.message);
      const theIndex = conversation.findIndex(c => c.ts == requestData.ts);
      if(theIndex>=0){
        conversation[theIndex].text = 'some error happened';
        scrollToView();
      }
    });

    setQuestion('');
    scrollToView();
  };
  const createMarkup = (text, bot) => {
    return {__html: `<span class="answer">${bot ? bot : 'Bot'}: </span>` + text.replace(/\n/g,'<br/>')};
  };
  const QuestionAnaswer = (talk) => 
    <div className='my-2' key={talk.ts}>
      <div className='status'>{talk.ts}</div>
      <div><span className='question'>You: </span>{talk.q}</div>
      {(talk.tt || talk.usage) && <div className='status'>
        {talk.tt && <span className='me-3'>{talk.tt}</span>}
        {talk.usage && <span>tokens: {talk.usage.prompt_tokens} + {talk.usage.completion_tokens} = {talk.usage.total_tokens}</span>}
      </div>}
      {talk.text && <div dangerouslySetInnerHTML={createMarkup(talk.text, talk.bot)} />}
    </div>;
  
  const MyChat = () => { 
    return conversation.map(c => QuestionAnaswer(c));
  };
  
  if(userId==null||userId==''){
    const signedin = getData('signedin');
    if(signedin && signedin.status == 'OK' && signedin.userId){
      setUserId(signedin.userId);
      setSignInStatus('OK');
    }
  }

  if(isBlank(userId) || userId.length < 3 || signInStatus != 'OK') {
    return (
      <div className='signin-box'>
          <div className='fw-bold fs-4 title px-3'>Chat with AI</div>
          <div className="my-2 px-3">Enter the User ID:</div>          
          <div className='my-2 px-3'>
            <input type="text" className="form-control" maxLength={20} value={userId} onChange={handleUserId}/>
          </div>
          <div className='my-2 px-3'>
            <button type="button" className="btn btn-primary mb-1" onClick={userIdSignIn}>Sign In</button>
          </div>
          {signInStatus &&
            <div className='px-3 text-danger'>
              {signInStatus}
            </div>
          }
      </div>
    );
  }


  if(!conversation||conversation.length==0){
    if(userId) {
      const savedConversation = getData(userId);
      if(savedConversation!=null && Array.isArray(savedConversation) && savedConversation.length>0){
        setConversation(savedConversation);
        var total = savedConversation.filter(c => c.usage && c.usage.total_tokens).map(o=>o.usage.total_tokens).reduce((a,b)=>a+b, 0);
        setTotalTokens(total);
      }
    }
  }

  return (
    <div className="App">
      <div className='app-header'>
        <div className="my-auto">{userId}</div>
        <div className='my-auto fw-08'>tokens:{totalTokens}</div>
        <div>
          <button className="btn btn-primary btn-sm" style={{marginRight:'1rem'}} type="button" onClick={exportData}>导出内容</button>
          <button className="btn btn-primary btn-sm" style={{marginRight:'1rem'}} type="button" onClick={clearChatData}>清除对话</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={signOut}>退出</button>
        </div>
      </div>
      <div className='app-main' id='main'>
        <MyChat />
      </div>
      <div className='app-footer'>
        <div className="input-group">
          <input type="text" className="form-control" placeholder="输入文字" value={question} onChange={handleInput} />
          <button className="btn btn-primary btn-lg" type="button" onClick={sendChat}>发送</button>
        </div>
      </div>
    </div>
  );
}

export default App;
