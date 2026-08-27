import { useEffect, useRef, useState } from 'react';

type Preset = { capital: number; bet: number; edge: number; rounds: number };

const PRESETS: Record<string, Preset> = {
    lottery: { capital: 4.48, bet: 2.48, edge: 54, rounds: 2 },
    pachinko: { capital: 5, bet: 3.7, edge: 15, rounds: 2.7 },
    roulette: { capital: 5, bet: 3, edge: 2.7, rounds: 2.7 },
    spread: { capital: 6, bet: 4, edge: 0.02, rounds: 4 },
};

const PRESET_LABELS: Record<string, string> = {
    lottery: '宝くじ相当',
    pachinko: 'パチンコ相当',
    roulette: 'ルーレット相当',
    spread: '株スプレッド相当',
};

const logVal = (raw: number) => Math.round(Math.pow(10, raw));
const fmt = (n: number) => n.toLocaleString('ja-JP');
const fmtYen = (n: number) => {
    if (n >= 10000)
        return `${(n / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`;
    return `${fmt(Math.round(n))}円`;
};

type SimResult = {
    paths: Float32Array[];
    capital: number;
    rounds: number;
    bankruptRate: number;
    mean: number;
    median: number;
};

function simulate(capital: number, bet: number, edge: number, rounds: number): SimResult {
    const N_PATHS = Math.min(1000, Math.max(200, Math.floor(500000 / rounds)));
    const pWin = (1 - edge) / 2;
    const paths: Float32Array[] = [];
    const finals: number[] = [];
    let bankrupt = 0;
    for (let i = 0; i < N_PATHS; i++) {
        const path = new Float32Array(rounds + 1);
        path[0] = capital;
        let w = capital;
        for (let r = 1; r <= rounds; r++) {
            if (w <= 0) {
                path[r] = 0;
                continue;
            }
            w += Math.random() < pWin ? bet : -bet;
            if (w < 0) w = 0;
            path[r] = w;
        }
        if (w <= 0) bankrupt++;
        paths.push(path);
        finals.push(w);
    }
    finals.sort((a, b) => a - b);
    return {
        paths,
        capital,
        rounds,
        bankruptRate: bankrupt / N_PATHS,
        mean: finals.reduce((s, v) => s + v, 0) / N_PATHS,
        median: finals[Math.floor(N_PATHS / 2)],
    };
}

function drawChart(canvas: HTMLCanvasElement, result: SimResult) {
    const { paths, capital, rounds } = result;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const pad = { top: 20, right: 20, bottom: 40, left: 68 };
    const W = cssW - pad.left - pad.right;
    const H = cssH - pad.top - pad.bottom;
    let yMax = 0;
    for (const p of paths) for (const v of p) if (v > yMax) yMax = v;
    yMax = Math.max(yMax, capital * 1.1);
    ctx.clearRect(0, 0, cssW, cssH);
    // Grid
    ctx.strokeStyle = '#eee';
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = pad.top + (H * i) / 5;
        const val = yMax * (1 - i / 5);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + W, y);
        ctx.stroke();
        ctx.fillText(
            val >= 10000 ? `${(val / 10000).toFixed(0)}万` : fmt(Math.round(val)),
            pad.left - 6,
            y,
        );
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
        const x = pad.left + (W * i) / 4;
        ctx.fillText(fmt(Math.round((rounds * i) / 4)), x, pad.top + H + 6);
    }
    // Initial capital reference
    ctx.strokeStyle = 'rgba(192, 86, 33, 0.6)';
    ctx.setLineDash([4, 4]);
    const y0 = pad.top + H * (1 - capital / yMax);
    ctx.beginPath();
    ctx.moveTo(pad.left, y0);
    ctx.lineTo(pad.left + W, y0);
    ctx.stroke();
    ctx.setLineDash([]);
    // Paths (spaghetti, colored by outcome)
    const rounds1 = paths[0].length - 1;
    for (const p of paths) {
        const isBankrupt = p[p.length - 1] <= 0;
        ctx.strokeStyle = isBankrupt
            ? 'rgba(192, 86, 33, 0.10)'
            : 'rgba(60, 100, 180, 0.06)';
        ctx.beginPath();
        for (let r = 0; r <= rounds1; r++) {
            const x = pad.left + (W * r) / rounds1;
            const y = pad.top + H * (1 - p[r] / yMax);
            if (r === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '12px sans-serif';
    ctx.fillText('ベット回数 →', pad.left + W / 2, pad.top + H + 22);
    ctx.save();
    ctx.translate(16, pad.top + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText('資産（円）', 0, 0);
    ctx.restore();
}

export default function BankruptcySimulator() {
    const [capital, setCapital] = useState(5);
    const [bet, setBet] = useState(3);
    const [edge, setEdge] = useState(2.7);
    const [rounds, setRounds] = useState(2.7);
    const [activePreset, setActivePreset] = useState<string | null>('roulette');
    const [stats, setStats] = useState<{ bankruptRate: number; mean: number; median: number } | null>(
        null,
    );
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            const capVal = logVal(capital);
            const betVal = logVal(bet);
            const edgeVal = edge / 100;
            const roundsVal = logVal(rounds);
            const result = simulate(capVal, betVal, edgeVal, roundsVal);
            if (canvasRef.current) drawChart(canvasRef.current, result);
            setStats({
                bankruptRate: result.bankruptRate,
                mean: result.mean,
                median: result.median,
            });
        }, 60);
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, [capital, bet, edge, rounds]);

    useEffect(() => {
        const onResize = () => {
            if (!canvasRef.current) return;
            const capVal = logVal(capital);
            const betVal = logVal(bet);
            const edgeVal = edge / 100;
            const roundsVal = logVal(rounds);
            const result = simulate(capVal, betVal, edgeVal, roundsVal);
            drawChart(canvasRef.current, result);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [capital, bet, edge, rounds]);

    function applyPreset(key: string) {
        const p = PRESETS[key];
        setCapital(p.capital);
        setBet(p.bet);
        setEdge(p.edge);
        setRounds(p.rounds);
        setActivePreset(key);
    }

    function markCustom() {
        setActivePreset(null);
    }

    return (
        <div className="bankruptcy-sim">
            <style>{`
                .bankruptcy-sim { --sim-bg: #fafaf7; --sim-fg: #2a2a2a; --sim-muted: #666; --sim-accent: #c05621; --sim-border: #e0dcd0; background: var(--sim-bg); border: 1px solid var(--sim-border); border-radius: 12px; padding: 18px; margin: 24px 0; font-family: 'Hiragino Sans', 'Yu Gothic', -apple-system, sans-serif; color: var(--sim-fg); line-height: 1.6; }
                .bankruptcy-sim h4 { margin: 0 0 6px; font-size: 1.05rem; font-weight: 600; }
                .bankruptcy-sim .sim-sub { color: var(--sim-muted); font-size: 0.85rem; margin-bottom: 14px; }
                .bankruptcy-sim .sim-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; }
                @media (max-width: 780px) { .bankruptcy-sim .sim-layout { grid-template-columns: 1fr; } }
                .bankruptcy-sim .sim-panel { background: white; border: 1px solid var(--sim-border); border-radius: 8px; padding: 14px; }
                .bankruptcy-sim .sim-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
                .bankruptcy-sim .sim-preset { padding: 5px 10px; background: white; border: 1px solid var(--sim-border); border-radius: 999px; cursor: pointer; font-size: 0.8rem; color: var(--sim-fg); }
                .bankruptcy-sim .sim-preset:hover { background: #f5f1e8; }
                .bankruptcy-sim .sim-preset.active { background: var(--sim-accent); color: white; border-color: var(--sim-accent); }
                .bankruptcy-sim .sim-slider { margin-bottom: 12px; }
                .bankruptcy-sim .sim-slider label { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; }
                .bankruptcy-sim .sim-slider label b { color: var(--sim-accent); font-family: 'SF Mono', Monaco, monospace; }
                .bankruptcy-sim .sim-slider input { width: 100%; accent-color: var(--sim-accent); }
                .bankruptcy-sim .sim-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
                .bankruptcy-sim .sim-stat { text-align: center; padding: 8px 4px; background: #f5f1e8; border-radius: 6px; }
                .bankruptcy-sim .sim-stat .val { font-size: 1.05rem; font-weight: 700; color: var(--sim-accent); font-family: 'SF Mono', Monaco, monospace; }
                .bankruptcy-sim .sim-stat .lbl { font-size: 0.65rem; color: var(--sim-muted); margin-top: 2px; }
                .bankruptcy-sim canvas { width: 100%; height: 360px; display: block; }
                .bankruptcy-sim .sim-note { font-size: 0.72rem; color: var(--sim-muted); margin-top: 10px; line-height: 1.5; }
                .bankruptcy-sim .sim-legend { display: flex; gap: 14px; font-size: 0.7rem; color: var(--sim-muted); margin-top: 6px; }
                .bankruptcy-sim .sim-legend span { display: inline-flex; align-items: center; gap: 5px; }
                .bankruptcy-sim .sim-legend i { width: 12px; height: 3px; display: inline-block; border-radius: 2px; }
            `}</style>
            <h4>破産確率シミュレータ</h4>
            <div className="sim-sub">
                ハウスエッジのある賭けを1,000本のシナリオでモンテカルロ。青=生存、赤=破産。
            </div>
            <div className="sim-layout">
                <div className="sim-panel">
                    <div className="sim-presets">
                        {Object.keys(PRESETS).map((k) => (
                            <button
                                key={k}
                                className={`sim-preset ${activePreset === k ? 'active' : ''}`}
                                onClick={() => applyPreset(k)}
                            >
                                {PRESET_LABELS[k]}
                            </button>
                        ))}
                    </div>
                    <div className="sim-slider">
                        <label>
                            <span>初期資金</span>
                            <b>{fmtYen(logVal(capital))}</b>
                        </label>
                        <input
                            type="range"
                            min="3"
                            max="7"
                            step="0.05"
                            value={capital}
                            onChange={(e) => {
                                setCapital(parseFloat(e.target.value));
                                markCustom();
                            }}
                        />
                    </div>
                    <div className="sim-slider">
                        <label>
                            <span>1回のベット額</span>
                            <b>{fmtYen(logVal(bet))}</b>
                        </label>
                        <input
                            type="range"
                            min="2"
                            max="5"
                            step="0.05"
                            value={bet}
                            onChange={(e) => {
                                setBet(parseFloat(e.target.value));
                                markCustom();
                            }}
                        />
                    </div>
                    <div className="sim-slider">
                        <label>
                            <span>ハウスエッジ</span>
                            <b>{edge.toFixed(2)}%</b>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="54"
                            step="0.1"
                            value={edge}
                            onChange={(e) => {
                                setEdge(parseFloat(e.target.value));
                                markCustom();
                            }}
                        />
                    </div>
                    <div className="sim-slider">
                        <label>
                            <span>ベット回数</span>
                            <b>{fmt(logVal(rounds))} 回</b>
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="4"
                            step="0.05"
                            value={rounds}
                            onChange={(e) => {
                                setRounds(parseFloat(e.target.value));
                                markCustom();
                            }}
                        />
                    </div>
                    <div className="sim-stats">
                        <div className="sim-stat">
                            <div className="val">
                                {stats ? `${(stats.bankruptRate * 100).toFixed(1)}%` : '―'}
                            </div>
                            <div className="lbl">破産率</div>
                        </div>
                        <div className="sim-stat">
                            <div className="val">{stats ? fmtYen(stats.mean) : '―'}</div>
                            <div className="lbl">平均終了資産</div>
                        </div>
                        <div className="sim-stat">
                            <div className="val">{stats ? fmtYen(stats.median) : '―'}</div>
                            <div className="lbl">中央値</div>
                        </div>
                    </div>
                    <div className="sim-note">
                        モデル：各ラウンドで ±ベット額 が発生する勝率 (1−エッジ)/2 のコイン。資産が
                        0 円以下で破産（以降 0）。プリセットは各業界の還元率から逆算した目安値。
                    </div>
                </div>
                <div className="sim-panel">
                    <canvas ref={canvasRef} />
                    <div className="sim-legend">
                        <span>
                            <i style={{ background: 'rgba(60,100,180,0.6)' }}></i>生存パス
                        </span>
                        <span>
                            <i style={{ background: 'rgba(192,86,33,0.6)' }}></i>破産パス
                        </span>
                        <span>
                            <i
                                style={{
                                    background: 'rgba(192,86,33,0.9)',
                                    borderTop: '1px dashed',
                                }}
                            ></i>
                            初期資金ライン
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
