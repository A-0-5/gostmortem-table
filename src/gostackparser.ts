import { Readable } from 'stream';
import * as vscode from 'vscode';

export interface Goroutine {
  ID: number;
  State: string;
  Wait: number;
  LockedToThread: boolean;
  Stack: Frame[];
  FramesElided: boolean;
  CreatedBy: Frame;
  Ancestor?: Goroutine;
}

export interface Frame {
  Func: string;
  File: string;
  Line: number;
}

type ParserState =
  | 'stateHeader'
  | 'stateStackFunc'
  | 'stateStackFile'
  | 'stateCreatedBy'
  | 'stateCreatedByFunc'
  | 'stateCreatedByFile'
  | 'stateOriginatingFrom';

function parseGoroutineHeader(line: string): Goroutine | null {
  const goroutineHeader = /^(\d+) \[([^,]+)(?:, (\d+) minutes)?(, locked to thread)?\]:$/;
  const matches = line.match(goroutineHeader);
  if (!matches || matches.length !== 5) {
    return null;
  }
  const id = parseInt(matches[1]);
  const state = matches[2];
  const waitMinutes = matches[3];
  const locked = matches[4] !== undefined;
  const g: Goroutine = {
    ID: id,
    State: state,
    Wait: waitMinutes ? parseInt(waitMinutes) * 60 * 1000 : 0,
    LockedToThread: locked,
    Stack: [],
    FramesElided: false,
    CreatedBy: { Func: '', File: '', Line: 0 },
  };
  return g;
}

function parseFunc(line: string, state: ParserState): Frame | null {
  if (state === 'stateCreatedByFunc') {
    const i = line.indexOf(' ');
    if (i > 0) {
      return { Func: line.slice(0, i), File: '', Line: 0 };
    }
    return { Func: line, File: '', Line: 0 };
  }

  let openIndex = -1;
  let closeIndex = -1;
  for (let i = 0; i < line.length; i++) {
    const r = line[i];
    switch (r) {
      case '(':
        if (openIndex !== -1 && closeIndex === -1) {
          return null;
        }
        openIndex = i;
        closeIndex = -1;
        break;
      case ')':
        if (openIndex === -1 || closeIndex !== -1) {
          return null;
        }
        closeIndex = i;
        break;
    }
  }
  if (openIndex === -1 || closeIndex === -1 || openIndex === 0) {
    return null;
  }
  return { Func: line.slice(0, openIndex), File: '', Line: 0 };
}

function parseFile(line: string, f: Frame): boolean {
  if (line.length < 2 || line[0] !== '\t') {
    return false;
  }
  let ret : boolean  = false;
  line = line.slice(1);
  const stateFilename = 0;
  const stateColon = 1;
  const stateLine = 2;
  let state = stateFilename;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    switch (state) {
      case stateFilename:
        if (c === ':') {
          state = stateColon;
        }
        break;
      case stateColon:
        if (isDigit(c)) {
          f.File = line.slice(0, i - 1);
          f.Line = parseInt(c);
          state = stateLine;
          ret =  true;
        } else {
          state = stateFilename;
        }
        break;
      case stateLine:
        if (c === ' ') {
          return true;
        } else if (!isDigit(c)) {
          return false;
        }
        f.Line = f.Line * 10 + parseInt(c);
        break;
    }
  }
  return ret;
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

export function parse(value: string): [Goroutine[], Error[]] {
  // const sc = r.getReader();
  let state: ParserState = 'stateHeader';
  let lineNum = 0;
  let line = '';
  var goroutines: Goroutine[] = [];
  const errs: Error[] = [];
  let g: Goroutine | null = null;
  let f: Frame | null = null;
  const abortGoroutine = (msg: string) => {
    const err = new Error(`${msg} on line ${lineNum}: ${line}`);
    errs.push(err);
    goroutines.pop();
    state = 'stateHeader';
  };

  // while (true) {
    // const { done, value } = await sc.read();
    // if (done) {
    //   break;
    // }
    line += value;
    if (!line.endsWith("\n")) {
      line = line.concat("\n");
    }
    const lines = line.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      lineNum++;
      line = lines[i];
      switch (state) {
        case 'stateHeader':
        case 'stateOriginatingFrom':
          if (state === 'stateHeader') {
            if (!line.startsWith('goroutine ')) {
              continue;
            }
            g = parseGoroutineHeader(line.slice(10));
            if (g === null) {
              abortGoroutine('invalid goroutine header');
              continue;
            }
            goroutines.push(g);
          }
          if (state === 'stateOriginatingFrom') {
            const ancestorIDStr = line.slice(28, -2);
            const ancestorID = parseInt(ancestorIDStr);
            if (isNaN(ancestorID)) {
              abortGoroutine('invalid ancestor ID');
              continue;
            }
            const ancestorG: Goroutine = { ID: ancestorID, State: '', Wait: 0, LockedToThread: false, Stack: [], FramesElided: false, CreatedBy: { Func: '', File: '', Line: 0 } };
            g!.Ancestor = ancestorG;
            g = ancestorG;
          }
          state = 'stateStackFunc';
          break;
        case 'stateStackFunc':
        case 'stateCreatedByFunc':
          if (line.startsWith('created by ')) {
            line = line.slice(11);
          }
          f = parseFunc(line, state);
          if (f === null) {
            if (line === '...additional frames elided...') {
              g!.FramesElided = true;
              state = 'stateCreatedBy';
              continue;
            }
            if (line.startsWith('[originating from goroutine ')) {
              state = 'stateOriginatingFrom';
              i--;
              continue;
            }
            abortGoroutine('invalid function call');
            continue;
          }
          if (state === 'stateStackFunc') {
            g!.Stack.push(f);
            state = 'stateStackFile';
          } else {
            g!.CreatedBy = f;
            state = 'stateCreatedByFile';
          }
          break;
        case 'stateStackFile':
        case 'stateCreatedByFile':
          if (!parseFile(line, f!)) {
            abortGoroutine('invalid file:line ref');
            continue;
          }
          state = 'stateCreatedBy';
          break;
        case 'stateCreatedBy':
          if (line.startsWith('created by ')) {
            line = line.slice(11);
            state = 'stateCreatedByFunc';
            i--;
            continue;
          } else if (line.length === 0) {
            state = 'stateHeader';
          } else {
            state = 'stateStackFunc';
            i--;
            continue;
          }
          break;
      }
    }
    line = lines[lines.length - 1];
  // }

  return [goroutines, errs];
}


