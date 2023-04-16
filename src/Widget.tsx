import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import html2canvas from "html2canvas";
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid';
import { LogLevel, ConsoleLog, NetworkLog } from "./types";

type CommentState = 'disabled' | 'enabled' | 'commenting';

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL!, process.env.REACT_APP_SUPABASE_API_KEY!);
const cursorImage = `data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 12C1 5.92488 5.92487 1 12 1C18.0752 1 23 5.92487 23 12C23 18.0753 18.0753 23 12 23H1.33895C1.15177 23 1 22.8482 1 22.6611V12Z' fill='%23231B7E' stroke='white' stroke-width='2'/%3E%3C/svg%3E%0A`;

const WidgetRoot = styled.div`
  font-family: Rubik, sans-serif;
  font-weight: 500;
`

const ClickCapturer = styled.div<{ commentState: CommentState }>`
  display: ${props => props.commentState !== 'disabled' ? 'block' : 'none'};
  position: fixed;
  inset: 0;
`

const ModeOverlay = styled.div<{ commentState: CommentState }>`
  border-color: #8585E0;
  border-width: 10px;
  opacity: ${props => props.commentState !== 'disabled' ? 1 : 0};
  transition: opacity 0.5s ease;
  pointer-events: none;
  position: fixed;
  inset: 0;
  border-style: solid;
`

const OverlayLabel = styled.div<{ commentState: CommentState }>`
  background: #231B7E;
  border: 2px solid #FFFFFF;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  color: #FFFFFF;
  position: fixed;
  left: 50%;
  transform: TranslateX(-50%);
  top: 24px;
  opacity: ${props => props.commentState !== 'disabled' ? 1 : 0};
  transition: opacity 0.5s ease;
  display: flex;
  align-items: center;
  height: 36px;
  pointer-events: ${props => props.commentState !== 'disabled' ? 'auto' : 'none'};
`

const CommentModeText = styled.div`
  font-family: 'Rubik', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 16px;
  line-height: 19px;
  color: white;
  padding-left: 12px;
`

const CommentContainer = styled.div<{ coords: { x: number, y: number }, commentState: CommentState }>`
  position: fixed;
  top: ${props => props.commentState === 'commenting' ? `${props.coords.y-36}px` : '-99999px'};
  left: ${props => props.commentState === 'commenting' ? `${props.coords.x}px` : '-99999px'};
  display: flex;
  gap: 16px;
`

const CommentBox = styled.div<{ active: boolean, visible: boolean }>`
  padding: ${props => props.active ? '16px' : '15px'} 16px;
  width: 256px;
  background: #FFFFFF;
  border: 1px solid #D1D5FA;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  position: relative;
  display: flex;
  flex-direction: column;
  scale: ${props => props.visible ? 1 : 0};
  transition: scale 0.1s ease, padding 0.5s ease;
  cursor: default !important;
`

const CommentField = styled.textarea`
  font-family: 'Rubik', sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 12px;
  line-height: 14px;
  outline: none;
  padding: 0;
  color: #171736;
  width: 100%;
  resize: none;
  border: none !important;
  cursor: text !important;
  
  &::placeholder {
    color: #8585E0;
  }
`

const CommentFooter = styled.div<{ active: boolean }>`
  height: ${props => props.active ? '46px' : '0'};
  overflow-y: clip;
  transition: height 0.5s ease;
`

const CommentSeperator = styled.div`
  border-top: 1px solid #D1D5FA;
  width: 100%;
  margin-top: 12px;
`

const FooterContent = styled.div`
  height: 24px;
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
`

const CheckBox = styled.div`
  cursor: pointer !important;
`

const SendButton = styled.div<{ active: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${props => props.active ? '#D1D5FA' : '#E0E0E0'};
  color: ${props => props.active ? '#3F33CC' : '#4D4D4D'};
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  bottom: ${props => props.active ? '16px' : '10px'};
  right: 16px;
  transition: color 0.5s ease, background-color 0.5s ease, bottom 0.5s ease;
  cursor: pointer !important;
`

const Highlighter = styled.div<{ highlighting: HTMLElement | null }>`
  position: absolute;
  box-sizing: border-box;
  //border: #FFFF0088 5px solid;
  pointer-events: none;
  ${props => {
    if(props.highlighting === null) {
      return 'display: none';
    }
    const bounds = props.highlighting.getBoundingClientRect();
    return `
    top: ${bounds.top}px;
    left: ${bounds.left}px;
    width: ${bounds.width}px;
    height: ${bounds.height}px;
    `
  }}
`;

const GenericFeedbackButton = styled.button`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 12px 16px;
  gap: 10px;
  background: #231B7E;
  border: 2px solid #FFFFFF;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  position: fixed;
  left: 15px;
  bottom: 15px;
  cursor: pointer;
`

function Widget() {
  const [commentState, setCommentState] = useState<'disabled' | 'enabled' | 'commenting'>('disabled');
  const [commentBoxCoords, setCommentBoxCoords] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [commentText, setCommentText] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const highlighterRef = useRef<HTMLDivElement>(null);
  const commentContainerRef = useRef<HTMLDivElement>(null);
  const widgetRootRef = useRef<HTMLDivElement>(null);
  const clickCapturerRef = useRef<HTMLDivElement>(null);
  const commentTextRef = useRef<HTMLTextAreaElement>(null);
  const consoleLogs = useMemo<ConsoleLog[]>(() => [], []);
  const networkLogs = useMemo<NetworkLog[]>(() => [], []);

  useEffect(() => {
    // watch console
    const consoleHijacker = (level: LogLevel, ...args: any[]) => {
      let message = args.length === 0 ? '' : args.length === 1 ? args[0].toString() : args.toString();
      consoleLogs.push({
        level: level,
        timestamp: new Date(),
        message: message
      });
    };
    const oldConsole = {
      debug: console.debug,
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    window.console = {
      ...console,
      debug: (...args: any[]) => {
        consoleHijacker('debug', args);
        oldConsole.log(...args);
      },
      log: (...args: any[]) => {
        consoleHijacker('log', args);
        oldConsole.log(...args);
      },
      info: (...args: any[]) => {
        consoleHijacker('info', args);
        oldConsole.info(...args);
      },
      warn: (...args: any[]) => {
        consoleHijacker('warn', args);
        oldConsole.warn(...args);
      },
      error: (...args: any[]) => {
        consoleHijacker('error', args);
        oldConsole.error(...args);
      }
    };

    // watch network with XMLHttpRequest
    window.XMLHttpRequest = class _ extends XMLHttpRequest {
      log: NetworkLog;

      constructor() {
        super();
        this.log = {
          sentWith: 'XMLHttpRequest',
          activityState: 'not started',
          url: '',
          method: '',
          status: 0,
          startTime: null,
          endTime: null,
          responseHeaders: {},
          requestHeaders: {},
          requestBody: ''
        };
        networkLogs.push(this.log);

        this.addEventListener('loadstart', () => {
          this.log.startTime = new Date();
          this.log.activityState = 'started';
        })
        this.addEventListener('loadend', () => {
          this.log.endTime = new Date();
          this.log.status = this.status;
          const headers = this.getAllResponseHeaders();
          if(headers !== '' && headers !== null) {
            for(const header of headers.split(/\r?\n/)) {
              if(!header.includes(':')) {
                continue;
              }
              const parts = header.split(':');
              const headerName = parts[0].trim();
              const headerValue = parts[1].trim();
              this.log.responseHeaders[headerName] = headerValue;
            }
          }
        });
        this.addEventListener('abort', () => {
          this.log.activityState = 'aborted';
        });
        this.addEventListener('error', () => {
          this.log.activityState = 'errored';
        });
        this.addEventListener('load', () => {
          this.log.activityState = 'done';
        });
        this.addEventListener('timeout', () => {
          this.log.activityState = 'timed out';
        });
      }

      open(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
        this.log.method = method;
        this.log.url = url.toString();

        if(async !== undefined) {
          super.open(method, url, async, user, password);
        }
        else {
          super.open(method, url);
        }
      }

      send(body?: Document | XMLHttpRequestBodyInit | null) {
        if(body instanceof Blob) {
          body.text().then(text => this.log.requestBody = text);
        }
        else if(body instanceof ArrayBuffer) {
          // pass
        }
        else if(body instanceof FormData) {
          // pass
        }
        else if(body instanceof URLSearchParams) {
          this.log.requestBody = body.toString();
        }
        else if(typeof body === 'string') {
          this.log.requestBody = body;
        }
        super.send(body);
      }

      setRequestHeader(name: string, value: string) {
        this.log.requestHeaders[name] = value;
        super.setRequestHeader(name, value);
      }
    };

    const decodeHeaders = (headersArg: HeadersInit | Headers) => {
      const headers = headersArg instanceof Headers ? headersArg : new Headers(headersArg);
      const decoded: {[key: string]: string} = {};
      for(const [key, value] of headers.entries()) {
        decoded[key] = value;
      }
      return decoded;
    }

    const oldFetch = fetch;
    window.fetch = async function(url: RequestInfo | URL, init?: RequestInit) {
      const log: NetworkLog = {
        sentWith: 'fetch',
        activityState: 'started',
        url: url.toString(),
        method: init === undefined || init.method === undefined ? 'GET' : init.method,
        status: 0,
        startTime: new Date(),
        endTime: null,
        responseHeaders: {},
        requestHeaders: init === undefined || init.headers === undefined ? {} : decodeHeaders(init.headers),
        requestBody: init === undefined || init.body === undefined || init.body === null ? '' : init.body.toString()
      };
      networkLogs.push(log);
      try {
        const res = await oldFetch(url, init);
        log.endTime = new Date();
        log.activityState = res.ok ? 'done' : 'errored';
        log.status = res.status;
        log.responseHeaders = decodeHeaders(res.headers);
        return res;
      }
      catch(err) {
        log.endTime = new Date();
        log.activityState = 'timed out';
        throw err;
      }
    };
  }, []);

  // set custom comment graphic on mouse during comment mode
  useEffect(() => {
    console.log(commentState);
    if(commentState !== 'disabled') {
      document.body.style.setProperty('cursor', `url("${cursorImage}") 0 24, pointer`, 'important');
    }
    else {
      document.body.style.cursor = 'unset';
    }
  }, [commentState]);

  // add comment box when user clicks in comment mode
  const addComment = (e: React.MouseEvent) => {
    // get underlying element
    const elementsThroughPoint = document.elementsFromPoint(e.clientX, e.clientY);
    if(elementsThroughPoint.length < 2) {
      return;
    }
    const target = elementsThroughPoint[1] as HTMLElement;

    // don't add comments on our own UI
    if(widgetRootRef.current!.contains(target)) {
      return;
    }

    if(target === highlightedElement) {
      setHighlightedElement(null);
    }
    else {
      setHighlightedElement(target);
    }

    setCommentBoxCoords({ x: e.clientX, y: e.clientY });
    setCommentState('commenting');
    commentTextRef.current!.focus();
  }

  const submitComment = async () => {
    // send comment data to db
    const screenshotPath = `${process.env.REACT_APP_PROJECT_ID}/${uuidv4()}.png`;
    await Promise.all([
      // take and upload screenshot
      new Promise<void>((resolve, reject) => {
        if(!includeScreenshot) {
          resolve();
        }

        html2canvas(document.body, {
          ignoreElements: element => widgetRootRef.current!.contains(element),
          allowTaint: false,
          useCORS: true,
          x: window.scrollX,
          y: window.scrollY,
          width: window.innerWidth,
          height: window.innerHeight,
        })
          .then(canvas => {
            canvas.toBlob(blob => {
              if(blob === null) {
                return reject('blob is null');
              }

              supabase
                .storage
                .from('screenshots')
                .upload(screenshotPath, blob)
                .then(res => {
                  if(res.error !== null) {
                    return reject(res.error);
                  }
                  resolve();
                })
                .catch(e => {
                  reject(e);
                });
            });
          })
          .catch(e => {
            reject(e);
          });
      }),

      // send all other data
      new Promise<void>((resolve, reject) => {
        supabase
          .from('issues')
          .insert({
            project_id: process.env.REACT_APP_PROJECT_ID!,
            url: window.location.href,
            comment_time: new Date(),
            comment: commentText,
            screenshot_path: includeScreenshot ? screenshotPath : 'NO_SCREENSHOT',
            device_info: {
              browser: 'TESTETSTEST'
            },
            console_logs: consoleLogs,
            network_logs: networkLogs
          })
          .then(res => {
            if(res.error !== null) {
              return reject(res.error);
            }
            resolve();
          });
      }),
    ]);

    setCommentText('');

    // setCommentState('disabled');
  }

  return <WidgetRoot ref={widgetRootRef}>
    <ClickCapturer commentState={commentState} onClick={addComment} ref={clickCapturerRef} />

    <ModeOverlay commentState={commentState} />

    <OverlayLabel commentState={commentState}>
      <CommentModeText>
        Comment Mode
      </CommentModeText>
      <svg onClick={() => setCommentState('disabled')} style={{ cursor: 'pointer', padding: '10px 12px 10px 10px' }} width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.2 12.5L0 11.3L4.8 6.5L0 1.7L1.2 0.5L6 5.3L10.8 0.5L12 1.7L7.2 6.5L12 11.3L10.8 12.5L6 7.7L1.2 12.5Z" fill="white"/>
      </svg>
    </OverlayLabel>

    <CommentContainer ref={commentContainerRef} coords={commentBoxCoords} commentState={commentState}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9413 0 36 8.05888 36 18C36 27.9413 27.9413 36 18 36H2.00842C0.899204 36 0 35.1008 0 33.9916V18Z" fill="#D2574C"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M20.2384 12.9707V6.79211C20.2384 6.55975 20.1649 6.36964 20.0178 6.22181C19.8707 6.07393 19.6922 6 19.482 6H16.3936C16.1625 6 15.9734 6.07393 15.8263 6.22181C15.6792 6.36964 15.6057 6.55975 15.6057 6.79211V13.7432L9.72065 10.304C9.52186 10.1878 9.32242 10.1572 9.12241 10.2122C8.92235 10.2672 8.76457 10.396 8.64898 10.5986L7.10474 13.306C6.99969 13.4902 6.97367 13.6837 7.02664 13.8865C7.07961 14.0894 7.2055 14.2489 7.40428 14.3651L12.9478 17.6048L7.40428 20.8446C7.2055 20.9606 7.07961 21.1201 7.02664 21.3229C6.97367 21.5257 7.00494 21.7285 7.12053 21.9313L8.66477 24.6386C8.76982 24.8227 8.92235 24.9423 9.12241 24.9974C9.32242 25.0525 9.52186 25.0216 9.72065 24.9056L15.6057 21.4663V28.6547C15.6057 28.8872 15.6792 29.0771 15.8263 29.2248C15.9734 29.373 16.1625 29.4468 16.3936 29.4468H19.482C19.6922 29.4468 19.8707 29.373 20.0178 29.2248C20.1649 29.0771 20.2384 28.8872 20.2384 28.6547V21.8653L20.823 22.2072L26.1092 25.2963C26.3081 25.4124 26.5073 25.4433 26.7072 25.3882C26.9076 25.3331 27.0601 25.2135 27.1651 25.0294L28.7094 22.3221C28.8248 22.1193 28.8561 21.9165 28.8032 21.7137C28.7503 21.5108 28.6244 21.3514 28.4256 21.2353L22.2133 17.6048L23.1393 17.0636L28.4256 13.9743C28.6244 13.8581 28.7503 13.6986 28.8032 13.4957C28.8561 13.2929 28.8302 13.0994 28.7252 12.9152L27.1809 10.2078C27.0651 10.0052 26.9076 9.87642 26.7072 9.8214C26.5073 9.76642 26.3081 9.79702 26.1092 9.91319L20.2384 13.3441V12.9707Z" fill="white"/>
      </svg>
      <CommentBox active={commentText.length !== 0} visible={commentState === 'commenting'}>
        <CommentField rows={1} ref={commentTextRef} value={commentText} onChange={e => {
          commentTextRef.current!.style.height = "";
          commentTextRef.current!.style.height = commentTextRef.current!.scrollHeight + "px";
          setCommentText(e.target.value);
        }} placeholder='Add a comment...' />
        <CommentFooter active={commentText.length !== 0}>
          <CommentSeperator />
          <FooterContent>
            <CheckBox>
              <svg display={includeScreenshot ? 'block' : 'none'} onClick={() => setIncludeScreenshot(prev => !prev)} width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_222_1842)">
                  <path fillRule="evenodd" clipRule="evenodd" d="M1.8125 11.1875H11.1875V1.8125H1.8125V11.1875ZM5.71875 8.76563C5.66667 8.78646 5.61007 8.79688 5.54895 8.79688C5.48785 8.79688 5.43056 8.78646 5.37708 8.76563C5.32361 8.74479 5.27083 8.70833 5.21875 8.65625L3.35938 6.78125C3.26562 6.6875 3.21875 6.57552 3.21875 6.44531C3.21875 6.3151 3.26562 6.20312 3.35938 6.10938C3.45312 6.01562 3.5651 5.97135 3.69531 5.97656C3.82552 5.98177 3.93229 6.02604 4.01562 6.10938L5.54688 7.64063L7.30469 5.88281L9.0625 4.125C9.15625 4.03125 9.26823 3.98438 9.39844 3.98438C9.52865 3.98438 9.64062 4.03125 9.73438 4.125C9.82812 4.21875 9.8724 4.33333 9.86719 4.46875C9.86198 4.60417 9.81771 4.71354 9.73438 4.79688L5.875 8.65625C5.82292 8.70833 5.77083 8.74479 5.71875 8.76563Z" fill="#8585E0"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M1.15625 11.8438C1.34375 12.0312 1.5625 12.125 1.8125 12.125H11.1875C11.4375 12.125 11.6562 12.0312 11.8438 11.8438C12.0312 11.6562 12.125 11.4375 12.125 11.1875V1.8125C12.125 1.5625 12.0312 1.34375 11.8438 1.15625C11.6562 0.96875 11.4375 0.875 11.1875 0.875H1.8125C1.5625 0.875 1.34375 0.96875 1.15625 1.15625C0.96875 1.34375 0.875 1.5625 0.875 1.8125V11.1875C0.875 11.4375 0.96875 11.6562 1.15625 11.8438ZM11.1875 11.1875H1.8125V1.8125H11.1875V11.1875Z" fill="#8585E0"/>
                  <path d="M5.54895 8.79688C5.61007 8.79688 5.66667 8.78646 5.71875 8.76563C5.77083 8.74479 5.82292 8.70833 5.875 8.65625L9.73438 4.79688C9.81771 4.71354 9.86198 4.60417 9.86719 4.46875C9.8724 4.33333 9.82812 4.21875 9.73438 4.125C9.64062 4.03125 9.52865 3.98438 9.39844 3.98438C9.26823 3.98438 9.15625 4.03125 9.0625 4.125L7.30469 5.88281L5.54688 7.64063L4.01562 6.10938C3.93229 6.02604 3.82552 5.98177 3.69531 5.97656C3.5651 5.97135 3.45312 6.01562 3.35938 6.10938C3.26562 6.20312 3.21875 6.3151 3.21875 6.44531C3.21875 6.57552 3.26562 6.6875 3.35938 6.78125L5.21875 8.65625C5.27083 8.70833 5.32361 8.74479 5.37708 8.76563C5.43056 8.78646 5.48785 8.79688 5.54895 8.79688Z" fill="white"/>
                </g>
                <defs>
                  <clipPath id="clip0_222_1842">
                    <rect width="13" height="13" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
              <svg display={includeScreenshot ? 'none' : 'block'} onClick={() => setIncludeScreenshot(prev => !prev)} width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_222_1840)">
                  <path d="M1.8125 12.125C1.5625 12.125 1.34375 12.0312 1.15625 11.8438C0.96875 11.6562 0.875 11.4375 0.875 11.1875V1.8125C0.875 1.5625 0.96875 1.34375 1.15625 1.15625C1.34375 0.96875 1.5625 0.875 1.8125 0.875H11.1875C11.4375 0.875 11.6562 0.96875 11.8438 1.15625C12.0312 1.34375 12.125 1.5625 12.125 1.8125V11.1875C12.125 11.4375 12.0312 11.6562 11.8438 11.8438C11.6562 12.0312 11.4375 12.125 11.1875 12.125H1.8125ZM1.8125 11.1875H11.1875V1.8125H1.8125V11.1875Z" fill="#8585E0"/>
                </g>
                <defs>
                  <clipPath id="clip0_222_1840">
                    <rect width="13" height="13" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </CheckBox>
            <img width={215/2} height={19/2} src='data:image/png;base64,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' />
          </FooterContent>
        </CommentFooter>
        <SendButton onClick={submitComment} active={commentText.length !== 0}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.14154 9.5L10.5001 6L7.14154 2.5" stroke="currentColor" strokeWidth="0.869566" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="0.434783" y1="-0.434783" x2="8.43174" y2="-0.434783" transform="matrix(-1 8.74228e-08 8.74228e-08 1 10.3666 6.48413)" stroke="currentColor" strokeWidth="0.869566" strokeLinecap="round"/>
          </svg>
        </SendButton>
      </CommentBox>
    </CommentContainer>

    <Highlighter ref={highlighterRef} highlighting={highlightedElement} />

    <GenericFeedbackButton onClick={() => setCommentState(prev => prev !== 'disabled' ? 'disabled' : 'enabled')}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.0037 11.6667C10.1818 11.6667 10.3299 11.6068 10.4479 11.487C10.566 11.3672 10.625 11.2188 10.625 11.0417V8.95835H12.7084C12.8854 8.95835 13.0339 8.89811 13.1537 8.77762C13.2735 8.65712 13.3334 8.50782 13.3334 8.32971C13.3334 8.15158 13.2735 8.00349 13.1537 7.88544C13.0339 7.76738 12.8854 7.70835 12.7084 7.70835H10.625V5.62502C10.625 5.44794 10.5648 5.2995 10.4443 5.17971C10.3238 5.05992 10.1745 5.00002 9.99637 5.00002C9.81825 5.00002 9.67016 5.05992 9.5521 5.17971C9.43405 5.2995 9.37502 5.44794 9.37502 5.62502V7.70835H7.29169C7.1146 7.70835 6.96617 7.7686 6.84637 7.88908C6.72658 8.00958 6.66669 8.15889 6.66669 8.337C6.66669 8.51512 6.72658 8.66321 6.84637 8.78127C6.96617 8.89933 7.1146 8.95835 7.29169 8.95835H9.37502V11.0417C9.37502 11.2188 9.43526 11.3672 9.55575 11.487C9.67625 11.6068 9.82555 11.6667 10.0037 11.6667ZM1.66669 16.8334V2.91669C1.66669 2.59724 1.79169 2.30905 2.04169 2.0521C2.29169 1.79516 2.58335 1.66669 2.91669 1.66669H17.0834C17.4028 1.66669 17.691 1.79516 17.9479 2.0521C18.2049 2.30905 18.3334 2.59724 18.3334 2.91669V13.75C18.3334 14.0695 18.2049 14.3577 17.9479 14.6146C17.691 14.8715 17.4028 15 17.0834 15H5.00002L2.72919 17.2709C2.53474 17.4653 2.30905 17.5094 2.0521 17.403C1.79516 17.2967 1.66669 17.1068 1.66669 16.8334ZM2.91669 15.3125L4.47919 13.75H17.0834V2.91669H2.91669V15.3125Z" fill="white"/>
      </svg>
    </GenericFeedbackButton>
  </WidgetRoot>
}

export default Widget;
