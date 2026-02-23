/**
 * 交通頁面 / Transport Page
 * 下拉選單選路線，左右滑動切換去程/返程
 * 顯示整條路線所有站牌的即時到站資訊
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import useThemeStore from '../stores/themeStore';
import useBusStore from '../stores/busStore';
import { busRoutes } from '../data/transportData';
import { IconBus, IconMapPin, IconClock, IconRefresh, IconChevronRight } from '../components/Icons';

// ── 到站狀態色 ──
function getStatusColor(arrival) {
    if (!arrival) return 'var(--text-muted)';
    const mins = arrival.estimatedMinutes;
    const code = arrival.stopStatusCode;
    if (code !== undefined && code !== null && code !== 0) return 'var(--text-muted)';
    if (mins === null || mins === undefined) return 'var(--text-muted)';
    if (mins <= 1) return 'var(--color-danger)';
    if (mins <= 3) return '#f97316';
    if (mins <= 10) return '#eab308';
    return 'var(--text-secondary)';
}

// ── 到站狀態背景色（用於即將進站的高亮）──
function getStatusBg(arrival) {
    if (!arrival) return 'transparent';
    const mins = arrival.estimatedMinutes;
    const code = arrival.stopStatusCode;
    if (code !== undefined && code !== null && code !== 0) return 'transparent';
    if (mins === null || mins === undefined) return 'transparent';
    if (mins <= 1) return 'rgba(239,68,68,0.06)';
    if (mins <= 3) return 'rgba(249,115,22,0.04)';
    return 'transparent';
}

// ── 格式化到站時間（顯示分秒）──
function formatArrivalTime(arrival) {
    if (!arrival) return { main: '--', sub: '' };
    const code = arrival.stopStatusCode;
    if (code === 1) return { main: '尚未發車', sub: '' };
    if (code === 2) return { main: '交管不停靠', sub: '' };
    if (code === 3) return { main: '末班已過', sub: '' };
    if (code === 4) return { main: '今日未營運', sub: '' };

    const secs = arrival.estimatedSeconds;
    if (secs === null || secs === undefined) return { main: '--', sub: '' };
    if (secs <= 60) return { main: '進站中', sub: '' };
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return {
        main: `${mins} 分`,
        sub: remainSecs > 0 ? `${remainSecs} 秒` : '',
    };
}

export default function Transport() {
    const isDarkMode = useThemeStore((s) => s.isDarkMode);
    const {
        arrivals, routeStops, isLoading, error, updatedAt,
        manualCooldown, manualRefresh,
        startAutoRefresh, stopAutoRefresh,
    } = useBusStore();

    // ── 路線選擇 ──
    const [selectedRoute, setSelectedRoute] = useState('301');
    // ── 方向：0 = 去程, 1 = 返程 ──
    const [dirIndex, setDirIndex] = useState(0);
    const direction = dirIndex === 0 ? '去程' : '返程';

    // ── 觸控滑動 ──
    const touchRef = useRef({ startX: 0, startY: 0, startTime: 0 });
    const containerRef = useRef(null);

    useEffect(() => {
        startAutoRefresh();
        return () => stopAutoRefresh();
    }, [startAutoRefresh, stopAutoRefresh]);

    // 路線切換時重設方向
    const handleRouteChange = useCallback((routeId) => {
        setSelectedRoute(routeId);
        setDirIndex(0);
    }, []);

    // ── 手勢處理 ──
    const handleTouchStart = useCallback((e) => {
        touchRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            startTime: Date.now(),
        };
    }, []);

    const handleTouchEnd = useCallback((e) => {
        const { startX, startY, startTime } = touchRef.current;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;
        const elapsed = Date.now() - startTime;

        // 必須是水平滑動（水平距離 > 垂直距離）且距離 > 50px 且時間 < 500ms
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50 && elapsed < 500) {
            if (diffX > 0) {
                // 右滑 → 去程
                setDirIndex(0);
            } else {
                // 左滑 → 返程
                setDirIndex(1);
            }
        }
    }, []);

    // 取得當前路線資訊
    const routeInfo = useMemo(() => {
        return busRoutes.find(r => r.id === selectedRoute) || busRoutes[0];
    }, [selectedRoute]);

    // 取得當前方向的站牌列表（從 routeStops API 或 arrivals 推斷）
    const currentStops = useMemo(() => {
        // 優先使用 StopOfRoute API 的站牌資料
        const stopsData = routeStops[selectedRoute];
        if (stopsData && stopsData[direction]) {
            const apiStops = stopsData[direction];
            // 若 API 回傳的是物件陣列
            if (apiStops.length > 0) {
                return apiStops.map(s => ({
                    stopName: s.stopName,
                    stopSequence: s.stopSequence,
                })).sort((a, b) => a.stopSequence - b.stopSequence);
            }
        }

        // fallback: 從 arrivals 中提取此路線此方向的站牌
        const fromArrivals = arrivals
            .filter(a => a.routeName === selectedRoute && a.direction === direction)
            .sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0));

        // 去重
        const seen = new Set();
        return fromArrivals.filter(a => {
            if (seen.has(a.stopName)) return false;
            seen.add(a.stopName);
            return true;
        }).map(a => ({
            stopName: a.stopName,
            stopSequence: a.stopSequence || 0,
        }));
    }, [routeStops, arrivals, selectedRoute, direction]);

    // 建立站牌 → 到站資料的映射
    const arrivalMap = useMemo(() => {
        const map = {};
        arrivals
            .filter(a => a.routeName === selectedRoute && a.direction === direction)
            .forEach(a => {
                // 以站名為 key（同一站可能有多筆，取最近的）
                if (!map[a.stopName] || (a.estimatedSeconds !== null &&
                    (map[a.stopName].estimatedSeconds === null || a.estimatedSeconds < map[a.stopName].estimatedSeconds))) {
                    map[a.stopName] = a;
                }
            });
        return map;
    }, [arrivals, selectedRoute, direction]);

    // ── 車輛位置追蹤：使用 RealTimeNearStop 進離站事件精確定位每台公車 ──
    const busIndicatorMap = useMemo(() => {
        // map: stopName → { label, color, bgColor, plate, source }
        const indicators = {};

        // ── 1. RealTimeNearStop 位置資料（eventType 只有真實公車位置才會有）──
        const positionEntries = arrivals.filter(
            a => a.routeName === selectedRoute && a.direction === direction && a.eventType
        );

        // 建立站序 → 站名 的對照（用於「即將進站」標記下一站）
        const seqToStop = {};
        currentStops.forEach(s => { seqToStop[s.stopSequence] = s.stopName; });
        const sequences = currentStops.map(s => s.stopSequence).sort((a, b) => a - b);

        // 依車牌分組
        const byPlate = {};
        positionEntries.forEach(entry => {
            const plate = entry.plateNumb || 'unknown';
            if (!byPlate[plate]) byPlate[plate] = [];
            byPlate[plate].push(entry);
        });

        Object.entries(byPlate).forEach(([plate, entries]) => {
            // 每輛車通常只有一筆 RealTimeNearStop 記錄
            entries.forEach(entry => {
                const stopName = entry.stopName;
                const seq = entry.stopSequence || 0;

                if (entry.eventType === '進站') {
                    // 車輛正在此站 → 進站中
                    indicators[stopName] = {
                        label: '進站中',
                        color: 'var(--color-danger, #ef4444)',
                        bgColor: 'rgba(239,68,68,0.10)',
                        plate,
                        source: 'position',
                    };
                } else {
                    // 車輛已離此站 → 已離站
                    indicators[stopName] = {
                        label: '已離站',
                        color: 'var(--color-info, #3b82f6)',
                        bgColor: 'rgba(59,130,246,0.10)',
                        plate,
                        source: 'position',
                    };
                    // 找到下一站，標記「即將進站」
                    const seqIdx = sequences.indexOf(seq);
                    if (seqIdx !== -1 && seqIdx < sequences.length - 1) {
                        const nextSeq = sequences[seqIdx + 1];
                        const nextStopName = seqToStop[nextSeq];
                        if (nextStopName && !indicators[nextStopName]) {
                            indicators[nextStopName] = {
                                label: '即將進站',
                                color: '#f97316',
                                bgColor: 'rgba(249,115,22,0.08)',
                                plate,
                                source: 'position',
                            };
                        }
                    }
                }
            });
        });

        // ── 2. ETA 補充：若 ETA ≤ 60 秒（進站中）但無 RealTimeNearStop，補上指標以同步 ──
        arrivals
            .filter(a => a.routeName === selectedRoute && a.direction === direction)
            .forEach(a => {
                if (indicators[a.stopName]) return; // 已有位置資料，不覆蓋
                if (a.estimatedSeconds !== null && a.estimatedSeconds !== undefined && a.estimatedSeconds <= 60 &&
                    (a.stopStatusCode === 0 || a.stopStatusCode === undefined || a.stopStatusCode === null)) {
                    indicators[a.stopName] = {
                        label: '進站中',
                        color: 'var(--color-danger, #ef4444)',
                        bgColor: 'rgba(239,68,68,0.06)',
                        plate: a.plateNumb || null,
                        source: 'eta',
                    };
                }
            });

        return indicators;
    }, [arrivals, selectedRoute, direction, currentStops]);

    // 計算統計資訊（以唯一車牌數統計行駛中公車）
    const stats = useMemo(() => {
        const arriving = Object.values(arrivalMap).filter(
            a => a.estimatedMinutes !== null && a.estimatedMinutes <= 3 && (a.stopStatusCode === 0 || a.stopStatusCode === undefined)
        ).length;
        // 以唯一車牌計算行駛中公車數量（只算 RealTimeNearStop 來源的進站/離站）
        const busPlates = new Set();
        Object.values(busIndicatorMap).forEach(ind => {
            if (ind.source === 'position' && ind.plate && (ind.label === '進站中' || ind.label === '已離站')) {
                busPlates.add(ind.plate);
            }
        });
        const busCount = busPlates.size;
        const total = currentStops.length;
        return { arriving, total, busCount };
    }, [arrivalMap, currentStops, busIndicatorMap]);

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* ── 頂部標題 ── */}
            <header className="page-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: `${routeInfo.color}15`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: routeInfo.color,
                    }}>
                        <IconBus size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>公車動態</h1>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            即時到站資訊
                            {updatedAt && (
                                <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.6 }}>
                                    更新 {updatedAt}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={manualRefresh}
                    disabled={manualCooldown > 0}
                    className="btn btn-ghost"
                    style={{ minWidth: 40, padding: '8px', borderRadius: 12 }}
                    title={manualCooldown > 0 ? `請稍候 ${manualCooldown} 秒` : '重新整理'}
                >
                    {manualCooldown > 0 ? (
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{manualCooldown}s</span>
                    ) : (
                        <IconRefresh size={20} />
                    )}
                </button>
            </header>

            {/* ── 路線選擇下拉 ── */}
            <div className="transport-route-selector">
                {busRoutes.map(route => (
                    <button
                        key={route.id}
                        onClick={() => handleRouteChange(route.id)}
                        className={`transport-route-chip ${selectedRoute === route.id ? 'active' : ''}`}
                        style={{
                            '--route-color': route.color,
                            borderColor: selectedRoute === route.id ? route.color : 'var(--border)',
                            background: selectedRoute === route.id
                                ? `${route.color}12`
                                : isDarkMode ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)',
                        }}
                    >
                        <span className="transport-route-chip-number" style={{
                            color: selectedRoute === route.id ? route.color : 'var(--text-secondary)',
                        }}>
                            {route.name}
                        </span>
                        <span className="transport-route-chip-desc" style={{
                            color: selectedRoute === route.id ? 'var(--text)' : 'var(--text-muted)',
                        }}>
                            {route.description}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── 方向切換 Tab ── */}
            <div className="transport-dir-tabs">
                <button
                    className={`transport-dir-tab ${dirIndex === 0 ? 'active' : ''}`}
                    onClick={() => setDirIndex(0)}
                    style={{ '--tab-color': routeInfo.color }}
                >
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>去程</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        往 {routeInfo.to}
                    </span>
                </button>
                <button
                    className={`transport-dir-tab ${dirIndex === 1 ? 'active' : ''}`}
                    onClick={() => setDirIndex(1)}
                    style={{ '--tab-color': routeInfo.color }}
                >
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>返程</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        往 {routeInfo.from}
                    </span>
                </button>
                <p style={{
                    fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center',
                    width: '100%', marginTop: 4,
                }}>
                    ← 左滑返程 ｜ 右滑去程 →
                </p>
            </div>

            {/* ── 統計列 ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '0 4px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconClock size={16} style={{ color: routeInfo.color }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                        站牌一覽
                    </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {stats.busCount > 0 && (
                        <span style={{ color: routeInfo.color, fontWeight: 600, marginRight: 8 }}>
                            🚌 {stats.busCount} 輛行駛中
                        </span>
                    )}
                    {stats.arriving > 0 && (
                        <span style={{ color: '#f97316', fontWeight: 600, marginRight: 8 }}>
                            {stats.arriving} 站即將到站
                        </span>
                    )}
                    共 {stats.total} 站
                </span>
            </div>

            {/* ── 錯誤提示 ── */}
            {error && arrivals.length === 0 && (
                <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239,68,68,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-danger)' }}>⚠️ {error}</p>
                </div>
            )}

            {/* ── 站牌列表（可滑動切換方向）── */}
            <div
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{ minHeight: 200 }}
            >
                {isLoading && currentStops.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 14 }} />
                        ))}
                    </div>
                ) : currentStops.length > 0 ? (
                    <div className="transport-stop-list">
                        {currentStops.map((stop, idx) => {
                            const arrival = arrivalMap[stop.stopName];
                            const { main, sub } = formatArrivalTime(arrival);
                            const isProvidence = stop.stopName.includes('靜宜');
                            const statusColor = getStatusColor(arrival);
                            const statusBg = getStatusBg(arrival);
                            const busIndicator = busIndicatorMap[stop.stopName];
                            const hasBus = !!busIndicator;

                            // ── 同步：進站中的公車指標同步到右側 ETA 顯示 ──
                            const isBusArriving = busIndicator?.label === '進站中';
                            const displayMain = isBusArriving ? '進站中' : main;
                            const displaySub = isBusArriving ? '' : sub;
                            const displayColor = isBusArriving ? 'var(--color-danger, #ef4444)' : statusColor;
                            const isArriving = isBusArriving || (
                                arrival?.estimatedMinutes !== null &&
                                arrival?.estimatedMinutes !== undefined &&
                                arrival?.estimatedMinutes <= 1 &&
                                (arrival?.stopStatusCode === 0 || arrival?.stopStatusCode === undefined)
                            );

                            return (
                                <div
                                    key={`${stop.stopName}-${idx}`}
                                    className={`transport-stop-row ${isProvidence ? 'highlight' : ''}`}
                                    style={{ background: hasBus ? busIndicator.bgColor : statusBg }}
                                >
                                    {/* 左側：站序線 */}
                                    <div className="transport-stop-line">
                                        <div className="transport-stop-line-track" style={{
                                            background: idx === 0 ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                                        }} />
                                        <div className="transport-stop-dot" style={{
                                            background: hasBus ? busIndicator.color
                                                : isProvidence ? routeInfo.color
                                                : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                                            boxShadow: hasBus ? `0 0 0 4px ${busIndicator.color}30`
                                                : isProvidence ? `0 0 0 3px ${routeInfo.color}30` : 'none',
                                            width: hasBus ? 16 : isProvidence ? 14 : 10,
                                            height: hasBus ? 16 : isProvidence ? 14 : 10,
                                        }} />
                                        <div className="transport-stop-line-track" style={{
                                            background: idx === currentStops.length - 1 ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                                        }} />
                                    </div>

                                    {/* 中間：站名 + 車輛位置指標 */}
                                    <div className="transport-stop-info">
                                        <span style={{
                                            fontWeight: isProvidence ? 700 : 500,
                                            fontSize: isProvidence ? '0.9375rem' : '0.875rem',
                                            color: isProvidence ? routeInfo.color : 'var(--text)',
                                        }}>
                                            {isProvidence && '📍 '}{stop.stopName}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '0.6875rem',
                                                color: 'var(--text-muted)',
                                            }}>
                                                第 {stop.stopSequence} 站
                                            </span>
                                            {busIndicator && (
                                                <span style={{
                                                    fontSize: '0.625rem',
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    background: busIndicator.bgColor,
                                                    color: busIndicator.color,
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    ...(busIndicator.label === '進站中' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                                                }}>
                                                    🚌 {busIndicator.label}
                                                    {busIndicator.plate && busIndicator.plate !== 'unknown' && (
                                                        <span style={{ opacity: 0.75, fontWeight: 500 }}>
                                                            {busIndicator.plate}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 右側：到站時間（與公車指標同步）*/}
                                    <div className="transport-stop-eta" style={{ color: displayColor }}>
                                        <span style={{
                                            fontSize: displayMain === '進站中' || displayMain === '尚未發車' ? '0.8125rem' : '1rem',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                            ...(isArriving ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                                        }}>
                                            {displayMain}
                                        </span>
                                        {displaySub && (
                                            <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                                                {displaySub}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card" style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', padding: '48px 20px', textAlign: 'center',
                        border: '1px dashed var(--border)', color: 'var(--text-muted)',
                    }}>
                        <IconBus size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <span style={{ fontSize: '0.875rem' }}>
                            目前無此路線的站牌資訊
                        </span>
                        <span style={{ fontSize: '0.75rem', marginTop: 4 }}>
                            資料載入中或該路線今日未營運
                        </span>
                    </div>
                )}
            </div>

            {/* ── 路線資訊卡 ── */}
            <div className="card" style={{
                padding: '14px 16px',
                border: `1px solid ${routeInfo.color}30`,
                background: `${routeInfo.color}08`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${routeInfo.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: routeInfo.color, fontWeight: 800, fontSize: '1rem',
                    }}>
                        {routeInfo.name}
                    </div>
                    <div>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
                            {routeInfo.description}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {direction === '去程'
                                ? `${routeInfo.from} → ${routeInfo.to}`
                                : `${routeInfo.to} → ${routeInfo.from}`
                            }
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: '0.6875rem', padding: '3px 8px' }}>
                        🕐 自動更新 2 分鐘
                    </span>
                    <span className="badge" style={{ fontSize: '0.6875rem', padding: '3px 8px' }}>
                        📊 TDX 即時資料
                    </span>
                    {isLoading && (
                        <span className="badge" style={{ fontSize: '0.6875rem', padding: '3px 8px', color: routeInfo.color }}>
                            ⏳ 載入中...
                        </span>
                    )}
                </div>
            </div>

            {/* ── 資料來源提示 ── */}
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
                資料來源：TDX 運輸資料流通服務（ETA + RealTimeNearStop + StopOfRoute）
            </p>
        </div>
    );
}
