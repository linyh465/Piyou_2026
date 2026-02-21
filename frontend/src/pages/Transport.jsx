/**
 * 交通頁面 / Transport Page
 * 使用下拉式選單篩選路線與方向，方便規劃往返路程
 */
import { useEffect, useState, useMemo } from 'react';
import useThemeStore from '../stores/themeStore';
import useBusStore from '../stores/busStore';
import { busRoutes, busStops } from '../data/transportData';
import { IconBus, IconMapPin, IconClock, IconRefresh } from '../components/Icons';

// ── 下拉式選單元件 ──
function Select({ label, value, onChange, options, allLabel = '全部' }) {
    return (
        <div className="transport-select-group">
            <label className="transport-select-label">{label}</label>
            <select className="transport-select" value={value} onChange={e => onChange(e.target.value)}>
                <option value="">{allLabel}</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

// ── 到站狀態色 ──
function getStatusColor(arrival) {
    const mins = arrival.estimatedMinutes;
    const code = arrival.stopStatusCode;
    if (code !== undefined && code !== null && code !== 0) return 'var(--text-muted)';
    if (mins === null || mins === undefined) return 'var(--text-muted)';
    if (mins <= 1) return 'var(--color-danger)';
    if (mins <= 5) return '#f97316';
    return 'var(--text-secondary)';
}

export default function Transport() {
    const isDarkMode = useThemeStore((s) => s.isDarkMode);
    const {
        arrivals, isLoading, error, updatedAt,
        manualCooldown, manualRefresh,
        startAutoRefresh, stopAutoRefresh,
    } = useBusStore();

    // ── 篩選狀態 ──
    const [selectedRoute, setSelectedRoute] = useState('');
    const [selectedDir, setSelectedDir] = useState('');
    const [selectedStop, setSelectedStop] = useState('');

    useEffect(() => {
        startAutoRefresh();
        return () => stopAutoRefresh();
    }, [startAutoRefresh, stopAutoRefresh]);

    // 路線選項
    const routeOptions = busRoutes.map(r => ({
        value: r.name,
        label: `${r.name} ${r.description}`,
    }));

    // 方向選項
    const dirOptions = [
        { value: '去程', label: '去程（往目的地）' },
        { value: '返程', label: '返程（回程）' },
    ];

    // 站牌選項 — 從實際到站資料動態產生
    const stopOptions = useMemo(() => {
        const names = [...new Set(arrivals.map(a => a.stopName).filter(Boolean))];
        return names.map(n => ({ value: n, label: n }));
    }, [arrivals]);

    // 篩選後的資料
    const filtered = useMemo(() => {
        return arrivals.filter(a => {
            if (selectedRoute && a.routeName !== selectedRoute) return false;
            if (selectedDir && a.direction !== selectedDir) return false;
            if (selectedStop && a.stopName !== selectedStop) return false;
            return true;
        });
    }, [arrivals, selectedRoute, selectedDir, selectedStop]);

    // 取得路線描述
    const getRouteInfo = (routeName) => {
        return busRoutes.find(r => r.name === routeName);
    };

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* ── 頂部 ── */}
            <header className="page-header" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(249,115,22,0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#f97316',
                    }}>
                        <IconBus size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>公車動態</h1>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            靜宜大學站點 即時到站
                            {updatedAt && (
                                <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.6 }}>更新 {updatedAt}</span>
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

            {/* ── 篩選選單 ── */}
            <div className="transport-filters">
                <Select
                    label="路線"
                    value={selectedRoute}
                    onChange={setSelectedRoute}
                    options={routeOptions}
                    allLabel="所有路線"
                />
                <Select
                    label="方向"
                    value={selectedDir}
                    onChange={setSelectedDir}
                    options={dirOptions}
                    allLabel="去程 / 返程"
                />
                <Select
                    label="站牌"
                    value={selectedStop}
                    onChange={setSelectedStop}
                    options={stopOptions}
                    allLabel="所有站牌"
                />
            </div>

            {/* ── 錯誤提示 ── */}
            {error && arrivals.length === 0 && (
                <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239,68,68,0.04)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--color-danger)' }}>⚠️ {error}</p>
                </div>
            )}

            {/* ── 到站列表 ── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
                    <IconClock size={18} style={{ color: '#f97316' }} />
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
                        即將進站
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        共 {filtered.length} 筆
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isLoading && arrivals.length === 0 ? (
                        [1, 2, 3, 4].map(i => (
                            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 16 }} />
                        ))
                    ) : filtered.length > 0 ? (
                        filtered.map((arrival, idx) => {
                            const route = getRouteInfo(arrival.routeName);
                            return (
                                <div key={idx} className="card card-hover" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                                        {/* 路線徽章 */}
                                        <div style={{
                                            width: 52, height: 52, borderRadius: 14,
                                            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            color: '#f97316', flexShrink: 0,
                                        }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.1 }}>{arrival.routeName}</span>
                                        </div>

                                        {/* 詳情 */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {arrival.stopName}
                                                </span>
                                                <span className="badge" style={{
                                                    fontSize: '10px', padding: '2px 8px',
                                                    background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                                                    color: 'var(--text-secondary)',
                                                }}>
                                                    {arrival.direction}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <IconMapPin size={12} />
                                                {arrival.direction === '去程'
                                                    ? `往 ${route?.to || '目的地'}`
                                                    : `往 ${route?.from || '起點'}`
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* 到站時間 */}
                                    <div style={{
                                        flexShrink: 0, paddingLeft: 12, textAlign: 'right',
                                        color: getStatusColor(arrival),
                                    }}>
                                        <span style={{
                                            fontSize: '1.25rem', fontWeight: 700, whiteSpace: 'nowrap',
                                            ...(arrival.estimatedMinutes != null && arrival.estimatedMinutes <= 1
                                                ? { animation: 'pulse 2s ease-in-out infinite' }
                                                : {}),
                                        }}>
                                            {arrival.stopStatus || '-- 分'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="card" style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '40px 20px', textAlign: 'center',
                            border: '1px dashed var(--border)', color: 'var(--text-muted)',
                        }}>
                            <IconBus size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <span style={{ fontSize: '0.875rem' }}>
                                {selectedRoute || selectedDir || selectedStop
                                    ? '此篩選條件下無公車資訊'
                                    : '目前無即將到站之公車資訊'
                                }
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {/* ── 站點一覽 ── */}
            <section style={{ paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
                    <IconMapPin size={18} style={{ color: '#f97316' }} />
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
                        靜宜校園周邊站牌
                    </h2>
                </div>

                <div className="transport-stops-grid">
                    {busStops.map((stop) => (
                        <button
                            key={stop.id}
                            onClick={() => {
                                setSelectedStop(prev => prev === stop.name ? '' : stop.name);
                                setSelectedRoute('');
                                setSelectedDir('');
                            }}
                            className={`card card-hover transport-stop-btn ${selectedStop === stop.name ? 'transport-stop-active' : ''}`}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                }}>
                                    <IconMapPin size={14} />
                                </div>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                                    {stop.name}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {/* ── TDX 基礎會員提示 ── */}
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                資料來源：TDX 運輸資料流通服務 ｜ 自動更新間隔 2 分鐘（配合基礎會員額度）
            </p>
        </div>
    );
}
