/**
 * Hand-rolled interpreter for the FarmBot DSL.
 *
 * Supported syntax:
 *   plant("wheat")
 *   harvest()
 *   wait(N)
 *   move(N)
 *   bag()
 *
 *   for i in range(N):
 *       <body>
 *
 *   while <condition>:
 *       <body>
 *
 *   Conditions: True, False, crop_ready(), tile_empty(), has_wheat(N)
 */

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseProgram(source) {
  const lines = source.split('\n')
    .map((text, idx) => ({ text, indent: measureIndent(text), num: idx + 1 }))
    .filter(l => l.text.trim() !== '' && !l.text.trim().startsWith('#'))
  return parseBlock(lines, 0, 0).stmts
}

function measureIndent(line) {
  let n = 0
  for (const ch of line) {
    if (ch === ' ') n++
    else if (ch === '\t') n += 4
    else break
  }
  return n
}

function parseBlock(lines, startIdx, minIndent) {
  const stmts = []
  let i = startIdx

  while (i < lines.length) {
    const line = lines[i]
    if (line.indent < minIndent) break
    const trimmed = line.text.trim()

    // for i in range(N):
    const forMatch = trimmed.match(/^for\s+\w+\s+in\s+range\s*\(\s*(\d+)\s*\)\s*:$/)
    if (forMatch) {
      const count = parseInt(forMatch[1], 10)
      const bodyIndent = lines[i + 1]?.indent
      if (bodyIndent === undefined || bodyIndent <= line.indent) {
        stmts.push({ type: 'for', count, body: [], lineNum: line.num })
        i++; continue
      }
      const body = parseBlock(lines, i + 1, bodyIndent)
      stmts.push({ type: 'for', count, body: body.stmts, lineNum: line.num })
      i = i + 1 + body.consumed
      continue
    }

    // while <condition>:
    const whileMatch = trimmed.match(/^while\s+(.+)\s*:$/)
    if (whileMatch) {
      const cond = whileMatch[1].trim()
      const bodyIndent = lines[i + 1]?.indent
      if (bodyIndent === undefined || bodyIndent <= line.indent) {
        stmts.push({ type: 'while', cond, body: [], lineNum: line.num })
        i++; continue
      }
      const body = parseBlock(lines, i + 1, bodyIndent)
      stmts.push({ type: 'while', cond, body: body.stmts, lineNum: line.num })
      i = i + 1 + body.consumed
      continue
    }

    // if <condition>:
    const ifMatch = trimmed.match(/^if\s+(.+)\s*:$/)
    if (ifMatch) {
      const cond = ifMatch[1].trim()
      const bodyIndent = lines[i + 1]?.indent
      if (bodyIndent === undefined || bodyIndent <= line.indent) {
        stmts.push({ type: 'if', cond, ifBody: [], elseBody: [], lineNum: line.num })
        i++; continue
      }
      const ifBody = parseBlock(lines, i + 1, bodyIndent)
      let consumed = ifBody.consumed
      let elseBody = []

      // look ahead for else:
      const afterIf = i + 1 + consumed
      if (afterIf < lines.length && lines[afterIf].indent === line.indent
          && lines[afterIf].text.trim() === 'else:') {
        const elseBodyIndent = lines[afterIf + 1]?.indent
        if (elseBodyIndent !== undefined && elseBodyIndent > line.indent) {
          const eb = parseBlock(lines, afterIf + 1, elseBodyIndent)
          elseBody = eb.stmts
          consumed += 1 + eb.consumed   // skip 'else:' line + body
        } else {
          consumed += 1  // skip 'else:' with empty body
        }
      }

      stmts.push({ type: 'if', cond, ifBody: ifBody.stmts, elseBody, lineNum: line.num })
      i = i + 1 + consumed
      continue
    }

    // function call
    const callMatch = trimmed.match(/^(\w+)\s*\((.*)\)$/)
    if (callMatch) {
      const name = callMatch[1]
      const args = callMatch[2].trim() === '' ? [] : parseArgs(callMatch[2])
      stmts.push({ type: 'call', name, args, lineNum: line.num })
      i++; continue
    }

    stmts.push({ type: 'error', msg: `SyntaxError line ${line.num}: cannot parse "${trimmed}"`, lineNum: line.num })
    i++
  }

  return { stmts, consumed: i - startIdx }
}

function parseArgs(raw) {
  return raw.split(',').map(a => {
    a = a.trim()
    const strMatch = a.match(/^["'](.*)["']$/)
    if (strMatch) return strMatch[1]
    const num = Number(a)
    if (!isNaN(num)) return num
    return a
  })
}

// ─── Condition evaluator ─────────────────────────────────────────────────────

function evalCond(expr, getState) {
  // not <condition>
  const notMatch = expr.match(/^not\s+(.+)$/)
  if (notMatch) return !evalCond(notMatch[1].trim(), getState)

  if (expr === 'True' || expr === 'true') return true
  if (expr === 'False' || expr === 'false') return false

  const callMatch = expr.match(/^(\w+)\s*\((.*)\)$/)
  if (callMatch) {
    const name = callMatch[1]
    const args = callMatch[2].trim() === '' ? [] : parseArgs(callMatch[2])
    const state = getState()
    const { drone, bag } = state
    const tile = state.getTileAt ? state.getTileAt(drone.col, drone.row) : null
    switch (name) {
      case 'crop_ready':     return tile?.stage === 'ready'
      case 'tile_empty':     return tile?.stage === 'empty'
      case 'not_ready':      return tile?.stage !== 'ready'
      case 'has_wheat':      return (bag.wheat ?? 0) >= (args[0] ?? 1)
      case 'can_move_right': return state.canMove('right')
      case 'can_move_left':  return state.canMove('left')
      case 'can_move_up':    return state.canMove('up')
      case 'can_move_down':  return state.canMove('down')
    }
  }
  return false
}

// ─── Interpreter ─────────────────────────────────────────────────────────────

export async function* interpret(source, getState, userRoutines = {}) {
  let stmts
  try {
    stmts = parseProgram(source)
  } catch (e) {
    yield { type: 'log', msg: `ParseError: ${e.message}`, logType: 'error' }
    return
  }
  yield* runStmts(stmts, getState, userRoutines)
  yield { type: 'done' }
}

async function* runStmts(stmts, getState, userRoutines) {
  for (const stmt of stmts) yield* runStmt(stmt, getState, userRoutines)
}

async function* runStmt(stmt, getState, userRoutines) {
  if (stmt.type === 'error') {
    yield { type: 'log', msg: stmt.msg, logType: 'error' }
    return
  }
  if (stmt.type === 'for') {
    for (let i = 0; i < stmt.count; i++) {
      yield* runStmts(stmt.body, getState, userRoutines)
    }
    return
  }
  if (stmt.type === 'while') {
    while (evalCond(stmt.cond, getState)) {
      yield { type: 'tick' }
      yield* runStmts(stmt.body, getState, userRoutines)
    }
    return
  }
  if (stmt.type === 'if') {
    if (evalCond(stmt.cond, getState)) {
      yield* runStmts(stmt.ifBody, getState, userRoutines)
    } else if (stmt.elseBody.length > 0) {
      yield* runStmts(stmt.elseBody, getState, userRoutines)
    }
    return
  }
  if (stmt.type === 'call') {
    yield* runCall(stmt, getState, userRoutines)
  }
}

async function* runCall(stmt, getState, userRoutines = {}) {
  const { name, args } = stmt

  switch (name) {
    case 'plant': {
      const crop = args[0] ?? 'wheat'
      const { drone } = getState()
      const tile = getState().getTileAt(drone.col, drone.row)
      if (!tile) { yield { type: 'log', msg: `plant(): no tile here`, logType: 'error' }; return }
      if (tile.stage !== 'empty') { yield { type: 'log', msg: `plant(): tile is ${tile.stage}`, logType: 'error' }; return }
      yield { type: 'plant', crop }
      yield { type: 'log', msg: `Planted ${crop}`, logType: 'success' }
      break
    }

    case 'harvest': {
      const gettile = () => { const d = getState().drone; return getState().getTileAt(d.col, d.row) }
      if (gettile()?.stage === 'empty') { yield { type: 'log', msg: `harvest(): nothing planted`, logType: 'error' }; return }
      while (gettile()?.stage !== 'ready') yield { type: 'poll' }
      yield { type: 'harvest' }
      yield { type: 'log', msg: `Harvested wheat`, logType: 'success' }
      break
    }

    case 'move': {
      const arg = args[0]
      // move("left"), move("right"), move("up"), move("down")
      if (typeof arg === 'string' && ['left','right','up','down'].includes(arg)) {
        if (!getState().canMove(arg)) {
          yield { type: 'log', msg: `move("${arg}"): no tile in that direction`, logType: 'error' }
          return
        }
        yield { type: 'move_dir', dir: arg }
      } else {
        yield { type: 'log', msg: `move(): use move("left"), move("right"), move("up"), or move("down")`, logType: 'error' }
      }
      break
    }

    case 'move_right':
    case 'move_left':
    case 'move_up':
    case 'move_down': {
      const dir = name.replace('move_', '')
      if (!getState().canMove(dir)) {
        yield { type: 'log', msg: `${name}(): no tile in that direction`, logType: 'error' }
        return
      }
      yield { type: 'move_dir', dir }
      break
    }

    case 'wait': {
      const secs = typeof args[0] === 'number' ? args[0] : 1
      for (let i = 0; i < secs; i++) yield { type: 'wait' }
      break
    }

    case 'bag': {
      const { bag } = getState()
      const contents = Object.entries(bag).map(([k, v]) => `${k}: ${v}`).join(', ')
      yield { type: 'log', msg: `Bag — ${contents || 'empty'}`, logType: 'info' }
      break
    }

    default:
      // Check user-defined routines
      if (userRoutines[name]) {
        let stmts
        try { stmts = parseProgram(userRoutines[name]) }
        catch (e) { yield { type: 'log', msg: `ParseError in '${name}': ${e.message}`, logType: 'error' }; return }
        yield* runStmts(stmts, getState, userRoutines)
      } else {
        yield { type: 'log', msg: `NameError: '${name}' is not defined`, logType: 'error' }
      }
  }
}
