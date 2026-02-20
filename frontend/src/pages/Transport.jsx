import { useState, useEffect, useCallback } from 'react';
import useThemeStore from '../stores/themeStore';
import { busRoutes, busStops } from '../data/transportData';
import { IconBus, IconMapPin, IconClock, IconRefresh } from '../components/Icons';
import { api } from '../services/apiClient';

export default function Transport() {
    const isDarkMode = useThemeStore((s) => s.isDarkMode);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 即時公車資料狀態 / Real-time bus data state
    const [busData, setBusData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);

    // 取得公車資料 / Fetch bus data
    const fetchBusData = useCallback(async (showRefreshAnim = false) => {
        if (showRefreshAnim) setIsRefreshing(true);
        try {
            const res = await api.get('/data/bus');
            const data = res.data;

            // 依路線分組 / Group by route
            const grouped = {};
            for (const arrival of (data.arrivals || [])) {
                const route = arrival.routeName;
                if (!grouped[route]) grouped[route] = [];
                grouped[route].push(arrival);
            }

            setBusData(grouped);
            setUpdatedAt(data.updatedAt || null);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.detail || '載入公車資訊失敗');
        } finally {
            setIsLoading(false);
            if (showRefreshAnim) {
                setTimeout(() => setIsRefreshing(false), 300);
            }
        }
    }, []);

    // 初次載入 + 每 30 秒自動更新 / Initial load + auto-refresh every 30s
    useEffect(() => {
        fetchBusData();
        const interval = setInterval(() => fetchBusData(), 30000);
        return () => clearInterval(interval);
    }, [fetchBusData]);

    const handleRefresh = () => {
        fetchBusData(true);
    };

    // 取得路線描述 / Get route description from static data
    const getRouteDesc = (routeName) => {
        const route = busRoutes.find(r => r.name === routeName);
        return route?.description || '';
    };

    // 狀態顏色 / Status color based on arrival time
    const getStatusStyle = (arrival) => {
        const mins = arrival.estimatedMinutes;
        const code = arrival.stopStatusCode;

        // 非正常狀態 / Non-normal status
        if (code !== undefined && code !== null && code !== 0) {
            return 'text-gray-400';
        }
        if (mins === null || mins === undefined) return 'text-gray-400';
        if (mins <= 1) return 'text-red-500 font-bold animate-pulse';
        if (mins <= 5) return 'text-orange-500 font-semibold';
        return 'text-[color:var(--text-secondary)]';
    };

    return (
        <div className="page-container h-full flex flex-col overflow-hidden">
            {/* ── 頂部 Navbar ── */}
            <header className="page-header shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <IconBus size={24} />
                    </div>
                    <div>
                        <h1 className="page-title text-xl font-bold">公車動態</h1>
                        <p className="page-subtitle text-sm text-gray-500/80">
                            靜宜大學周邊交通資訊
                            {updatedAt && (
                                <span className="ml-2 text-xs opacity-60">更新 {updatedAt}</span>
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-black'
                        }`}
                    title="重新整理"
                >
                    <IconRefresh size={20} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* ── 內容區塊 ── */}
            <div className="page-content flex-1 overflow-y-auto min-h-0 space-y-6 pb-6">

                {/* 錯誤提示 */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* 路線即時資訊 */}
                <section>
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <IconBus size={18} className="text-orange-500" />
                        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                            主要公車路線
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {busRoutes.map((route) => {
                            const arrivals = busData?.[route.name] || [];

                            return (
                                <div
                                    key={route.id}
                                    className="card flex flex-col p-4 relative group"
                                >
                                    {/* 路線標頭 */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                                                <span className="text-xl font-bold">{route.name}</span>
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-[color:var(--text-primary)]">
                                                    路線 {route.name}
                                                </h3>
                                                <p className="text-sm text-[color:var(--text-secondary)]">
                                                    {route.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 到站資訊列表 */}
                                    {isLoading ? (
                                        <div className="space-y-2">
                                            {[1, 2].map(i => (
                                                <div key={i} className="h-10 rounded-lg bg-[color:var(--bg-subtle)] animate-pulse" />
                                            ))}
                                        </div>
                                    ) : arrivals.length > 0 ? (
                                        <div className="space-y-2">
                                            {arrivals.map((arrival, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 rounded-lg bg-[color:var(--bg-subtle)]"
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <IconMapPin size={14} className="text-[color:var(--text-secondary)] shrink-0" />
                                                        <span className="text-sm text-[color:var(--text-primary)] truncate">
                                                            {arrival.stopName}
                                                        </span>
                                                        <span className="text-xs text-[color:var(--text-secondary)] shrink-0">
                                                            {arrival.direction}
                                                        </span>
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 shrink-0 ml-2 ${getStatusStyle(arrival)}`}>
                                                        <IconClock size={14} />
                                                        <span className="text-sm whitespace-nowrap">
                                                            {arrival.stopStatus || '-- 分'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-[color:var(--bg-subtle)] text-sm text-[color:var(--text-secondary)]">
                                            <IconClock size={14} />
                                            <span>目前無到站資訊</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 關注站點區塊 */}
                <section>
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <IconMapPin size={18} className="text-orange-500" />
                        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                            靜宜校內/周邊站點
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {busStops.map((stop) => (
                            <div
                                key={stop.id}
                                className="card p-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[color:var(--bg-subtle)] flex items-center justify-center text-[color:var(--text-secondary)]">
                                        <IconMapPin size={16} />
                                    </div>
                                    <span className="font-medium text-[color:var(--text-primary)]">
                                        {stop.name}
                                    </span>
                                </div>

                                <div className="text-xs font-medium px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-[color:var(--text-secondary)]">
                                    查看路線
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}
