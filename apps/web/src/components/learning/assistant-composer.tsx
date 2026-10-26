"use client";

import * as React from 'react';
import {ArrowUp,AudioLines,ChevronDown,Mic,Plus,Square} from 'lucide-react';

type RecognitionEvent={results:ArrayLike<ArrayLike<{transcript:string}>>};
type Recognition={lang:string;interimResults:boolean;continuous:boolean;onresult:((event:RecognitionEvent)=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type VoiceWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
type Props={value:string;onChange:(text:string)=>void;onSend:()=>void;waiting:boolean;active:boolean;reply:string;inputRef:React.RefObject<HTMLInputElement|null>};

/** Voice and file input only prepare a draft; the learner always chooses when to send it. */
export function AssistantComposer({value,onChange,onSend,waiting,active,reply,inputRef}:Props){
  const fileRef=React.useRef<HTMLInputElement>(null);
  const recognition=React.useRef<Recognition|null>(null);
  const [listening,setListening]=React.useState(false);
  const [speaking,setSpeaking]=React.useState(false);
  const [language,setLanguage]=React.useState('en-US');
  const [status,setStatus]=React.useState('');
  const [previousActive,setPreviousActive]=React.useState(active);
  if(previousActive!==active){setPreviousActive(active);setListening(false);setSpeaking(false);}
  const changeRef=React.useRef(onChange);
  React.useEffect(()=>{changeRef.current=onChange;},[onChange]);
  const stopDictation=React.useCallback(()=>{
    const current=recognition.current;recognition.current=null;
    current?.abort();setListening(false);
  },[]);
  React.useEffect(()=>{
    if(!active){const current=recognition.current;recognition.current=null;current?.abort();window.speechSynthesis?.cancel();}
    return()=>{const current=recognition.current;recognition.current=null;current?.abort();window.speechSynthesis?.cancel();};
  },[active]);
  function dictate(){
    if(listening){stopDictation();setStatus('Dictation stopped. Review your message before sending.');return;}
    const Speech=(window as VoiceWindow).SpeechRecognition??(window as VoiceWindow).webkitSpeechRecognition;
    if(!Speech){setStatus('Dictation is unavailable in this browser. You can still type your message.');return;}
    window.speechSynthesis?.cancel();setSpeaking(false);
    const instance=new Speech();recognition.current=instance;
    const prefix=value.trimEnd();instance.lang=language;instance.interimResults=true;instance.continuous=true;
    instance.onresult=event=>{
      if(recognition.current!==instance)return;
      const spoken=Array.from(event.results).map(result=>result[0]?.transcript??'').join(' ');
      changeRef.current(`${prefix}${prefix?' ':''}${spoken}`.slice(0,600));
    };
    instance.onerror=event=>{
      if(recognition.current!==instance)return;
      recognition.current=null;setListening(false);
      setStatus(event.error==='not-allowed'?'Microphone access was denied. Allow it in your browser settings or type your message.':'Dictation stopped. Review your draft or try again.');
    };
    instance.onend=()=>{if(recognition.current===instance){recognition.current=null;setListening(false);setStatus('Dictation finished. Review your message before sending.');}};
    try{instance.start();setListening(true);setStatus('Listening… Your browser handles speech recognition. Stop to review before sending.');}
    catch{recognition.current=null;setListening(false);setStatus('The microphone could not start. You can type your message.');}
  }
  function readReply(){
    const synth=window.speechSynthesis;
    if(!synth){setStatus('Reading aloud is unavailable in this browser.');return;}
    if(speaking){synth.cancel();setSpeaking(false);setStatus('Reading stopped.');return;}
    if(!reply){setStatus('Send a question first. This button reads the latest assistant reply aloud.');return;}
    stopDictation();synth.cancel();
    const utterance=new SpeechSynthesisUtterance(reply);utterance.lang='en-US';
    utterance.onend=()=>{setSpeaking(false);setStatus('Read-aloud finished.');};
    utterance.onerror=()=>{setSpeaking(false);setStatus('Reading aloud stopped. The reply is still available in the chat.');};
    synth.speak(utterance);setSpeaking(true);setStatus('Reading the latest reply aloud.');
  }
  async function attach(file:File|undefined){
    if(!file)return;
    const original=value;
    try{
      if(!/\.(txt|md)$/i.test(file.name)||file.size>16384){setStatus('Choose a .txt or .md file up to 16 KB. Its text must fit the 600-character message limit.');return;}
      const text=(await file.text()).trim();
      if(!text){setStatus('This text file is empty.');return;}
      if(inputRef.current?.value!==original){setStatus('Your draft changed while reading the file. Select the file again to add it.');return;}
      const combined=[original.trim(),text].filter(Boolean).join('\n\n');
      if(combined.length>600){setStatus('This file does not fit the 600-character message limit. Add a shorter excerpt instead.');return;}
      onChange(combined);setStatus('File text added to your draft. Review it before sending.');inputRef.current?.focus();
    }catch{setStatus('The file could not be read. Your draft is unchanged.');}
  }
  return <div className="assistant-composer">
    <form className="pip-input assistant-composer-bar" onSubmit={event=>{event.preventDefault();if(waiting||!value.trim())return;stopDictation();setStatus('');onSend();}}>
      <button type="button" className="assistant-composer-icon" aria-label="Add text file" title="Add text file (.txt or .md)" disabled={waiting||listening} onClick={()=>fileRef.current?.click()}><Plus size={19}/></button>
      <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden tabIndex={-1} aria-label="Text file for message" onChange={event=>{void attach(event.target.files?.[0]);event.target.value='';}}/>
      <label className="sr-only" htmlFor="pip-question">Message your course assistant</label>
      <input ref={inputRef} id="pip-question" value={value} onChange={event=>onChange(event.target.value)} readOnly={listening} maxLength={600} placeholder="Write a message…" autoComplete="off" aria-describedby="assistant-composer-status"/>
      <button type="button" className="assistant-composer-icon" aria-label={listening?'Stop dictation':'Dictate message'} aria-pressed={listening} title={listening?'Stop dictation':'Dictate message'} disabled={waiting} onClick={dictate}>{listening?<Square size={15}/>:<Mic size={18}/>}</button>
      <span className="assistant-language"><select aria-label="Dictation language" value={language} disabled={listening} onChange={event=>setLanguage(event.target.value)}><option value="en-US">English</option><option value="hi-IN">Hindi</option><option value="ta-IN">Tamil</option></select><ChevronDown size={12} aria-hidden="true"/></span>
      {value.trim()?<button className="assistant-composer-icon assistant-composer-send" type="submit" disabled={waiting} aria-label="Send question"><ArrowUp size={19}/></button>:<button type="button" className="assistant-composer-icon" aria-label={speaking?'Stop reading reply':'Read latest reply aloud'} aria-pressed={speaking} title={speaking?'Stop reading reply':'Read latest reply aloud'} disabled={waiting} onClick={readReply}>{speaking?<Square size={15}/>:<AudioLines size={20}/>}</button>}
    </form>
    <p id="assistant-composer-status" className="assistant-composer-status" role="status">{status}</p>
  </div>;
}
