import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import html2canvas from "html2canvas";
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid';
import { LogLevel, ConsoleLog, NetworkLog } from "./types";

const customCursorData = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAAAKFSURBVGhD7ZkttsIwEEYrkUgkEskSkMhKJBLJDpAsAckSkF0Gy2AJlbwvna8hlPMeaZIy5bxc1QwndG6STvpT3L+cLKBNFtAmC2jzjwWqqlqtVufzmW0lwgVms1lRFJPJhG0lwgWQvcC2EuGnx9iLwPV6ZUiDcIHNZiMCZVkypEG4AAZeBABDGkSd266i4/HIkDepiliUwH6/F4GAWpSqiEUJ1HUtAoAhb9gtevlF929h2xt2ywJZoIVtb9gtC2SBFra9YbeiiNzL1ATsLh65l6kJ4O6DPeNWkZoAYM8sEAVTyALBZIEWtvvAnroCtpyz3QfpCGL2slgBKee73Y7tPiTZy2IFYkiyl2kK4Lme6X+pwHw+Z/pfKmCXUNglJGgKBCPvlE6nE47fC4zkNbqLXXuHw+G9gH0DNR4H+0LNwNjvJKnWaanrer1eS1bvBdxqjbkbyTzAYbvdmpwY+BN3ysYzD8AkxMM/eeg24NLhD9qYbHjogTsPI3EwqfDQg6dLp9l9brcbf1PC5MFDPzoOurUVG5lJgi1v4FCWZZM/0frIJxtUbwHhcrksFosmf52PfBx+wEB/3I98n7+mOfyAgSC0autj+AFjQXSu6c84oGxMp1M5o/lWzXAoH66tT2NfFDh7rAB4ra24feJvqXks/fYxKIEA6NTWge6XsHh4gmbsJZhGQEBtRepyguT3rZ3Fw2haATDcfevr4hESC2Bm3dqaah7c4beLR0gsINiFBHAc6YCyZv8QdZPRlkEE3Ic4gNMH11bI20f45XLZGX4wiIDgasAhoLZ2LlwUCf7gMKAAeHp90H+bcy9cbDWMPjOsAMCwYeqZhfdUVFVlVw54XTnkfv8B6YXUFtbfuaoAAAAASUVORK5CYII=`;

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL!, process.env.REACT_APP_SUPABASE_API_KEY!);

const ClickCapturer = styled.div<{ isCommentMode: boolean }>`
  display: ${props => props.isCommentMode ? 'block' : 'none'};
  position: fixed;
  inset: 0;
`

const Container = styled.div`
  position: fixed;
  bottom: 10px;
  left: 10px;
`

const Button = styled.button`
  
`

const CommentBox = styled.div`
  position: fixed;
  top: -99999px;
`

const Highlighter = styled.div<{ highlighting: HTMLElement | null }>`
  position: absolute;
  box-sizing: border-box;
  border: #FFFF0088 5px solid;
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
`

function Widget() {
  const [commentMode, setCommentMode] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [commentText, setCommentText] = useState('');
  const highlighterRef = useRef<HTMLDivElement>(null);
  const commentBoxRef = useRef<HTMLDivElement>(null);
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

    const oldFetch = fetch;
    window.fetch = function(url: RequestInfo | URL, init?: RequestInit) {
      return oldFetch(url, init).then(res => {
        console.log(res);
        return res;
      });
    };
  }, []);

  // set custom comment graphic on mouse during comment mode
  useEffect(() => {
    if(commentMode) {
      document.body.style.setProperty('cursor', `url(${customCursorData}), pointer`, 'important')
    }
    else {
      document.body.style.cursor = 'unset';
    }

  }, [commentMode]);

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

    commentBoxRef.current!.style.left = `${e.clientX}px`;
    commentBoxRef.current!.style.top = `${e.clientY}px`;
    commentTextRef.current!.focus();
    console.log(commentTextRef.current);
  }

  const submitComment = async () => {
    const screenshotPath = `${process.env.REACT_APP_PROJECT_ID}/${uuidv4()}.png`;

    await Promise.all([

      // take and upload screenshot
      new Promise<void>((resolve, reject) => {
        html2canvas(document.body, {
          ignoreElements: element => widgetRootRef.current!.contains(element),
          allowTaint: false,
          useCORS: true
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
            comment_time: new Date(),
            comment: commentText,
            screenshot_path: screenshotPath,
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
      })
    ]);

    // asynchronously take and upload screenshot of page
    console.log(consoleLogs);
    console.log(networkLogs);

    commentBoxRef.current!.style.top = '-9999px';
    setCommentMode(false);
  }

  return <div ref={widgetRootRef}>
    <ClickCapturer isCommentMode={commentMode} onClick={addComment} ref={clickCapturerRef} />
    <Container>
      <Button onClick={() => setCommentMode(prev => !prev)}>Click me to leave a comment</Button>
    </Container>
    <CommentBox ref={commentBoxRef}>
      <p>Comment:</p>
      <textarea ref={commentTextRef} value={commentText} onChange={e => setCommentText(e.target.value)}>

      </textarea>
      <button onClick={submitComment}>Submit</button>
    </CommentBox>
    <Highlighter ref={highlighterRef} highlighting={highlightedElement} />
  </div>
}

export default Widget;
