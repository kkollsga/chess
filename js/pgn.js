// PGN parsing — port of original PGNHandler, returns metadata + position list.
import { FenParser } from './fen.js';

const REQUIRED_TAGS = ['Event','Site','Date','Round','White','Black','Result'];

function validatePGN(text) {
  if (!text || typeof text !== 'string') throw new Error('Invalid PGN: empty');
  if (!text.includes('\n\n')) throw new Error('Invalid PGN: missing moves section');
  const [header] = text.split(/\n\n/);
  for (const tag of REQUIRED_TAGS) {
    if (!header.includes(`[${tag} "`)) throw new Error(`Invalid PGN: missing [${tag}]`);
  }
  return true;
}

function parseMetadata(metaStr) {
  const meta = {};
  const re = /\[(\w+)\s+"([^"]+)"\]/g;
  let m;
  while ((m = re.exec(metaStr)) !== null) meta[m[1]] = m[2];
  return meta;
}

function isValidSquare(file, rank) { return file >= 'a' && file <= 'h' && rank >= 1 && rank <= 8; }

function getPossibleSourceSquares(analysis, subTurn) {
  const isWhiteTurn = subTurn === 0;
  const { pieceType, targetSquare, capture, sourceInfo } = analysis;
  const file = targetSquare.charAt(0);
  const rank = parseInt(targetSquare.charAt(1), 10);
  const fileIdx = file.charCodeAt(0) - 97;
  const addDir = (dx, dy, max = 7) => {
    const sqs = [];
    for (let i = 1; i <= max; i++) {
      const f = String.fromCharCode(97 + (fileIdx + dx * i));
      const r = rank + dy * i;
      if (isValidSquare(f, r)) sqs.push(f + r);
    }
    return sqs.length ? [sqs] : [];
  };
  let dirs = [];
  switch (pieceType.toUpperCase()) {
    case 'P': {
      const d = isWhiteTurn ? -1 : 1;
      if (capture) {
        dirs.push(...addDir(1, d, 1));
        dirs.push(...addDir(-1, d, 1));
      } else {
        dirs.push(...addDir(0, d, 1));
        if (rank === (isWhiteTurn ? 4 : 5)) dirs.push(...addDir(0, d * 2, 1));
      }
      break;
    }
    case 'N':
      [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]].forEach(([dx,dy]) => dirs.push(...addDir(dx, dy, 1)));
      break;
    case 'B':
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy]) => dirs.push(...addDir(dx, dy)));
      break;
    case 'R':
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy]) => dirs.push(...addDir(dx, dy)));
      break;
    case 'Q':
      [[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy]) => dirs.push(...addDir(dx, dy)));
      break;
    case 'K':
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dx,dy]) => dirs.push(...addDir(dx, dy, 1)));
      break;
  }
  if (sourceInfo) {
    dirs = dirs.map(dir => {
      let f = dir;
      if (/^[a-h]$/.test(sourceInfo)) f = f.filter(s => s.charAt(0) === sourceInfo);
      else if (/^[1-8]$/.test(sourceInfo)) f = f.filter(s => s.charAt(1) === sourceInfo);
      else if (/^[a-h][1-8]$/.test(sourceInfo)) f = f.filter(s => s === sourceInfo);
      return f;
    }).filter(d => d.length);
  }
  return dirs;
}

function findSourceSquare(pieceType, dirs, fen) {
  const valid = [];
  for (const dirSqs of dirs) {
    const pieces = FenParser.getPiecesAtSquares(dirSqs, fen);
    for (let i = 0; i < dirSqs.length; i++) {
      const p = pieces[i];
      if (p === pieceType) { valid.push(dirSqs[i]); break; }
      if (p !== null) break;
    }
  }
  if (!valid.length) throw new Error(`No ${pieceType} found`);
  if (valid.length > 1) throw new Error(`Ambiguous: ${valid.join(', ')}`);
  return valid[0];
}

function analyzeSingleMove(move, subTurn) {
  const isWhiteTurn = subTurn === 0;
  if (move.startsWith('O-O')) {
    const isKingSide = move === 'O-O' || move === 'O-O+' || move === 'O-O#';
    return {
      pieceType: isWhiteTurn ? 'K' : 'k',
      targetSquare: isWhiteTurn ? (isKingSide ? 'g1' : 'c1') : (isKingSide ? 'g8' : 'c8'),
      sourceInfo: isWhiteTurn ? 'e1' : 'e8',
      capture: false,
      castling: isKingSide ? 'king' : 'queen',
      check: move.includes('+') || move.includes('#'),
      promotion: null,
      enPassant: false
    };
  }
  const a = {
    pieceType: null, targetSquare: null, sourceInfo: null,
    capture: move.includes('x'), castling: null,
    check: move.includes('+') || move.includes('#'),
    promotion: null, enPassant: false
  };
  move = move.replace(/[+#]$/, '');
  if (move.includes('=')) { a.promotion = move.split('=')[1]; move = move.split('=')[0]; }
  const pieces = ['K','Q','R','B','N'];
  a.pieceType = pieces.includes(move[0]) ? move[0] : 'P';
  a.targetSquare = move.slice(-2);
  if (a.pieceType !== 'P') {
    const si = move.slice(1, -2).replace('x', '');
    if (si) a.sourceInfo = si;
  } else {
    const si = move.slice(0, -2).replace('x', '');
    if (si) a.sourceInfo = si;
  }
  if (!isWhiteTurn) {
    a.pieceType = a.pieceType.toLowerCase();
    if (a.promotion) a.promotion = a.promotion.toLowerCase();
  }
  if (a.pieceType.toLowerCase() === 'p' && a.capture) {
    const expected = isWhiteTurn ? '6' : '3';
    if (a.targetSquare.charAt(1) === expected) a.enPassant = true;
  }
  return a;
}

function parseMoveText(moveText) {
  let cur = FenParser.getDefaultFen();
  const positions = [cur];
  const sans = [];
  moveText = moveText.replace(/\{[^}]*\}/g, '').replace(/\([^)]*\)/g, '');
  const moves = moveText.trim().split(/\d+\./).filter(Boolean);
  for (let mi = 0; mi < moves.length; mi++) {
    const subs = moves[mi].trim().split(/\s+/).filter(Boolean);
    subs.forEach((sub, i) => {
      try {
        const a = analyzeSingleMove(sub, i);
        let src;
        if (a.castling) src = a.sourceInfo;
        else {
          const possible = getPossibleSourceSquares(a, i);
          src = findSourceSquare(a.pieceType, possible, cur);
        }
        cur = FenParser.movePiece(cur, src, a.targetSquare, a);
        positions.push(cur);
        sans.push(sub);
      } catch (err) {
        if (!err.message.includes('Move Number:')) {
          throw new Error(`Move ${mi + 1}${i === 0 ? '' : '...'} '${sub}': ${err.message}`);
        }
        throw err;
      }
    });
  }
  return { positions, sans };
}

export const PGNHandler = {
  validatePGN,
  parseMetadata,

  parsePGN(text) {
    validatePGN(text);
    const [metaStr, movesStr] = text.split(/\n\n/);
    const metadata = parseMetadata(metaStr);
    const endTokens = ['1/2-1/2','1-0','0-1'];
    metadata.Result = endTokens.find(t => movesStr.includes(t)) || metadata.Result || '*';
    const cleanMoves = endTokens.reduce((s, t) => s.replace(t, ''), movesStr).trim();
    const { positions, sans } = parseMoveText(cleanMoves);
    return { metadata, positions, sans };
  }
};
